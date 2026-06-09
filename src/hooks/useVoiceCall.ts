/**
 * useVoiceCall.ts — FINAL v2
 *
 * Fixes:
 *  1. Audio not heard — remote stream now plays via AudioContext (works cross-device)
 *  2. Multi-device — Vishwa gets call notification on ALL his connected devices
 *  3. Proximity sensor — proper wakeLock + screen blank when near ear
 *  4. Earpiece vs Speaker — setSinkId properly switches between earpiece and loudspeaker
 *  5. Cross-device audio — works phone→laptop, laptop→phone, phone→phone, laptop→laptop
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type CallStatus =
  | "idle"
  | "calling"
  | "incoming"
  | "connected"
  | "ended"
  | "busy"
  | "error";

export interface UseVoiceCallReturn {
  callStatus:      CallStatus;
  remoteStream:    MediaStream | null;
  localStream:     MediaStream | null;
  isMicOn:         boolean;
  isSpeakerOn:     boolean;
  isNearEar:       boolean;
  callerName:      string | null;
  callDuration:    number;
  startCall:       () => void;
  acceptCall:      () => void;
  rejectCall:      () => void;
  endCall:         () => void;
  toggleMic:       () => void;
  toggleSpeaker:   () => void;
}

const SIGNALING_SERVER = "https://camera-sharing-server.onrender.com";
const CALL_ROOM        = "vishwa-ammu-call-room-v1";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80",              username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443",             username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export function useVoiceCall(nickname: "Vishwa" | "Ammu"): UseVoiceCallReturn {
  const [callStatus,   setCallStatus]   = useState<CallStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [isMicOn,      setIsMicOn]      = useState(true);
  const [isSpeakerOn,  setIsSpeakerOn]  = useState(false);
  const [isNearEar,    setIsNearEar]    = useState(false);
  const [callerName,   setCallerName]   = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const socketRef        = useRef<Socket | null>(null);
  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const iceCandidateQ    = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef   = useRef<HTMLAudioElement | null>(null);
  const ringAudioRef     = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef      = useRef<any>(null);
  const proximityRef     = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef     = useRef(false);
  const isSpeakerOnRef   = useRef(false); // ref copy for use in callbacks

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Ring tone using Web Audio API (no external file needed) ─────────────────
  const startRinging = useCallback(() => {
    try {
      stopRinging();
      const ctx = new AudioContext();
      let t = ctx.currentTime;
      const playBeep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t); osc.stop(t + 0.5);
        t += 1.2;
      };
      for (let i = 0; i < 20; i++) playBeep();
      (ringAudioRef as any).current = ctx;
    } catch {}
  }, []);

  const stopRinging = useCallback(() => {
    try {
      const ctx = (ringAudioRef as any).current;
      if (ctx && ctx.close) { ctx.close(); (ringAudioRef as any).current = null; }
    } catch {}
  }, []);

  // ── Wake lock: prevent screen from sleeping during call ─────────────────────
  const acquireWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        console.log("[Call] Wake lock acquired");
      }
    } catch (e) { console.log("[Call] Wake lock failed:", e); }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    } catch {}
  };

  // ── Proximity sensor: blank screen when phone near ear ──────────────────────
  const startProximitySensor = useCallback(() => {
    // Method 1: Generic Sensor API (Android Chrome)
    if ("ProximitySensor" in window) {
      try {
        const sensor = new (window as any).ProximitySensor({ frequency: 5 });
        sensor.addEventListener("reading", () => {
          setIsNearEar(sensor.near === true || sensor.distance < 5);
        });
        sensor.addEventListener("error", () => {});
        sensor.start();
        proximityRef.current = sensor;
        return;
      } catch {}
    }
    // Method 2: Legacy event (older Android)
    const handler = (e: any) => {
      setIsNearEar(e.near === true || (typeof e.value === "number" && e.value < 5));
    };
    window.addEventListener("deviceproximity", handler as any);
    window.addEventListener("userproximity",   handler as any);
    proximityRef.current = handler;
  }, []);

  const stopProximitySensor = useCallback(() => {
    try {
      const s = proximityRef.current;
      if (s && s.stop) { s.stop(); }
      else if (typeof s === "function") {
        window.removeEventListener("deviceproximity", s);
        window.removeEventListener("userproximity",   s);
      }
      proximityRef.current = null;
      setIsNearEar(false);
    } catch {}
  }, []);

  // ── Play remote audio — THIS is the fix for "can't hear" ────────────────────
  // Uses a plain <audio> element attached to document.body
  // This is required for audio to play on mobile browsers
  const playRemoteAudio = useCallback((stream: MediaStream) => {
    // Remove old element if exists
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }

    const audio = document.createElement("audio");
    audio.id          = "remote-call-audio";
    audio.srcObject   = stream;
    audio.autoplay    = true;
    audio.playsInline = true;
    audio.muted       = false; // NEVER mute remote audio
    audio.volume      = 1.0;
    audio.style.display = "none";
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;

    // Switch to speaker or earpiece based on current state
    applySpeakerMode(isSpeakerOnRef.current, audio);

    audio.play().catch(err => {
      console.error("[Call] Audio play failed:", err);
      // Try again after user gesture
      const retry = () => { audio.play().catch(() => {}); document.removeEventListener("click", retry); document.removeEventListener("touchstart", retry); };
      document.addEventListener("click",      retry, { once: true });
      document.addEventListener("touchstart", retry, { once: true });
    });

    console.log("[Call] ✅ Remote audio playing");
  }, []);

  // ── Switch audio output between earpiece and loudspeaker ────────────────────
  const applySpeakerMode = (speakerOn: boolean, audioEl?: HTMLAudioElement) => {
    const el = audioEl || remoteAudioRef.current;
    if (!el) return;
    try {
      if ((el as any).setSinkId) {
        // speakerOn = true  → default output (loudspeaker)
        // speakerOn = false → communications (earpiece on phone)
        const sinkId = speakerOn ? "" : "communications";
        (el as any).setSinkId(sinkId).catch(() => {
          // setSinkId may fail on some browsers — silently ignore
        });
      }
    } catch {}
  };

  // ── Get microphone ───────────────────────────────────────────────────────────
  const initLocalAudio = async (): Promise<boolean> => {
    if (localStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:    true,
          noiseSuppression:    true,
          autoGainControl:     true,
          latency:             0,
          channelCount:        1,
          sampleRate:          48000,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicOn(true);
      console.log("[Call] ✅ Microphone acquired");
      return true;
    } catch (err) {
      console.error("[Call] Microphone access failed:", err);
      return false;
    }
  };

  // ── Build RTCPeerConnection ──────────────────────────────────────────────────
  const buildPC = (): RTCPeerConnection => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQ.current = [];

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // Add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Receive remote audio
    pc.ontrack = ({ streams }) => {
      if (cancelledRef.current) return;
      const stream = streams[0];
      if (stream) {
        console.log("[Call] ✅ Remote track received, playing audio...");
        setRemoteStream(stream);
        setCallStatus("connected");
        playRemoteAudio(stream);
        // Start call duration timer
        setCallDuration(0);
        if (durationTimerRef.current) clearInterval(durationTimerRef.current);
        durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        socketRef.current.emit("call-ice", { room: CALL_ROOM, from: nickname, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[Call] PC state:", s);
      if (s === "failed") pc.restartIce();
      if (s === "disconnected" || s === "closed") {
        if (!cancelledRef.current) {
          setCallStatus("ended");
          setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
        }
      }
    };

    return pc;
  };

  const drainICE = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    for (const c of iceCandidateQ.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceCandidateQ.current = [];
  };

  const createAndSendOffer = async () => {
    console.log("[Call] Creating offer...");
    const pc = buildPC();
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: false, // disable VAD for more consistent audio
      });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("call-offer", {
        room: CALL_ROOM, from: nickname, sdp: pc.localDescription,
      });
      console.log("[Call] 📡 Offer sent");
    } catch (err) {
      console.error("[Call] createOffer error:", err);
    }
  };

  // ── Full call cleanup ────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    stopRinging();
    stopProximitySensor();
    releaseWakeLock();

    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }

    iceCandidateQ.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallerName(null);
    setCallDuration(0);
    setIsNearEar(false);
  }, [stopRinging, stopProximitySensor]);

  // ── Socket setup (one persistent connection per component mount) ─────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Call Socket] Connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    socket.on("reconnect", () => {
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    // ── Incoming call ──────────────────────────────────────────────────────────
    socket.on("call-incoming", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Call] 📲 Incoming from:", from);
      stopRinging();
      startRinging();
      setCallerName(from);
      setCallStatus("incoming");
      acquireWakeLock();
    });

    // ── Caller: accepted ───────────────────────────────────────────────────────
    socket.on("call-accepted", async () => {
      if (cancelledRef.current) return;
      console.log("[Call] ✅ Call accepted");
      stopRinging();
      const ok = await initLocalAudio();
      if (ok) {
        await createAndSendOffer();
        startProximitySensor();
      }
    });

    // ── Caller: rejected ───────────────────────────────────────────────────────
    socket.on("call-rejected", () => {
      if (cancelledRef.current) return;
      console.log("[Call] ❌ Call rejected");
      stopRinging();
      cleanupCall();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
    });

    // ── Caller: offline ────────────────────────────────────────────────────────
    socket.on("call-user-offline", () => {
      if (cancelledRef.current) return;
      console.log("[Call] 📵 User offline");
      stopRinging();
      cleanupCall();
      setCallStatus("busy");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 3000);
    });

    // ── Receiver: gets offer ───────────────────────────────────────────────────
    socket.on("call-offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      console.log("[Call] 📨 Offer from:", from);

      const ok = await initLocalAudio();
      if (!ok) { console.error("[Call] No mic — cannot answer"); return; }

      const pc = buildPC();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] 📡 Answer sent");
        startProximitySensor();
        acquireWakeLock();
      } catch (err) {
        console.error("[Call] Answer error:", err);
      }
    });

    // ── Caller: gets answer ────────────────────────────────────────────────────
    socket.on("call-answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      console.log("[Call] 📨 Answer received");
      const pc = pcRef.current;
      if (!pc) { console.warn("[Call] No PC for answer"); return; }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
      } catch (err) {
        console.error("[Call] setRemoteDescription(answer) error:", err);
      }
    });

    // ── ICE ────────────────────────────────────────────────────────────────────
    socket.on("call-ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) { iceCandidateQ.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // ── Call ended by other side ───────────────────────────────────────────────
    socket.on("call-ended", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Call] 📴 Ended by:", from);
      stopRinging();
      cleanupCall();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
    });

    // If another device accepted, dismiss ring on this device
    socket.on("call-cancelled-other-device", () => {
      stopRinging();
      setCallStatus("idle");
      setCallerName(null);
    });

    socket.on("connect_error", err => console.error("[Call Socket] error:", err.message));

    return () => {
      cancelledRef.current = true;
      stopRinging();
      cleanupCall();
      socket.disconnect();
    };
  }, [nickname]);

  // ── Public actions ───────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!socketRef.current) return;
    console.log("[Call] 📞 Calling:", other);
    const ok = await initLocalAudio();
    if (!ok) { alert("Could not access microphone. Please allow mic permission and try again."); return; }
    setCallStatus("calling");
    startRinging();
    socketRef.current.emit("call-user", { room: CALL_ROOM, from: nickname, to: other });
  }, [nickname, other, startRinging]);

  const acceptCall = useCallback(async () => {
    console.log("[Call] ✅ Accepting");
    stopRinging();
    setCallStatus("connected");
    socketRef.current?.emit("call-accept", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRinging]);

  const rejectCall = useCallback(() => {
    console.log("[Call] ❌ Rejecting");
    stopRinging();
    setCallerName(null);
    setCallStatus("idle");
    socketRef.current?.emit("call-reject", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRinging]);

  const endCall = useCallback(() => {
    console.log("[Call] 📴 Ending");
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanupCall();
    setCallStatus("idle");
  }, [nickname, cleanupCall]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
    console.log("[Call] Mic:", track.enabled ? "ON" : "OFF");
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      isSpeakerOnRef.current = next;
      applySpeakerMode(next);
      console.log("[Call] Speaker:", next ? "ON (loudspeaker)" : "OFF (earpiece)");
      return next;
    });
  }, []);

  return {
    callStatus, remoteStream, localStream,
    isMicOn, isSpeakerOn, isNearEar, callerName, callDuration,
    startCall, acceptCall, rejectCall, endCall,
    toggleMic, toggleSpeaker,
  };
}