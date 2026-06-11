/**
 * useVoiceCall.ts — FINAL v7
 *
 * CRITICAL FIXES:
 *
 * AUDIO TRANSMISSION FIX:
 * Mobile browsers block audio autoplay unless triggered by a user gesture.
 * The Accept button click IS a user gesture, but ontrack fires seconds later
 * — after the gesture context expires. Browser silently blocks audio.play().
 * 
 * Solution: Pre-create and pre-play a SILENT audio element on the Accept/Call click
 * (while gesture context is alive). Then when ontrack fires, set srcObject
 * on the already-playing element. Browser allows this because the element
 * was already "unlocked" by the user gesture.
 *
 * REMOTE STREAM NOT SHOWING:
 * - Proper ontrack handler that immediately sets srcObject
 * - Ensures audio tracks are present before attempting playback
 * - Handles stream replacement when reconnecting
 *
 * PROXIMITY SENSOR:
 * ProximitySensor API removed from Chrome. Use Page Visibility API instead.
 * When phone is held to ear during a call, screen turns off and page becomes hidden.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type CallStatus =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "connected"
  | "ended"
  | "busy";

export interface UseVoiceCallReturn {
  callStatus:    CallStatus;
  isMicOn:       boolean;
  isSpeakerOn:   boolean;
  isNearEar:     boolean;
  callerName:    string | null;
  callDuration:  number;
  startCall:     () => void;
  acceptCall:    () => void;
  rejectCall:    () => void;
  endCall:       () => void;
  toggleMic:     () => void;
  toggleSpeaker: () => void;
}

const SIGNALING_SERVER = "https://camera-sharing-server.onrender.com";
const CALL_ROOM = "vishwa-ammu-call-room-v1";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",                username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",               username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export function useVoiceCall(nickname: "Vishwa" | "Ammu"): UseVoiceCallReturn {
  const [callStatus,   setCallStatus]   = useState<CallStatus>("idle");
  const [isMicOn,      setIsMicOn]      = useState(true);
  const [isSpeakerOn,  setIsSpeakerOn]  = useState(false);
  const [isNearEar,    setIsNearEar]    = useState(false);
  const [callerName,   setCallerName]   = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const socketRef      = useRef<Socket | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Pre-created audio element — unlocked by user gesture on Accept/Call click
  const audioElRef     = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const durationRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringCtxRef     = useRef<AudioContext | null>(null);
  const isSpeakerRef   = useRef(false);
  const cancelledRef   = useRef(false);
  const wakeLockRef    = useRef<any>(null);
  const callStatusRef  = useRef<CallStatus>("idle");

  // Keep ref in sync with state for use inside event handlers
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Ringtone ──────────────────────────────────────────────────────────────
  const stopRing = useCallback(() => {
    try { ringCtxRef.current?.close(); } catch {}
    ringCtxRef.current = null;
  }, []);

  const startRing = useCallback(() => {
    stopRing();
    try {
      const ctx = new AudioContext();
      ringCtxRef.current = ctx;
      let t = ctx.currentTime;
      for (let i = 0; i < 15; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = i % 2 === 0 ? 440 : 480;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); o.stop(t + 0.4);
        t += 1.5;
      }
    } catch {}
  }, [stopRing]);

  // ── Wake lock ─────────────────────────────────────────────────────────────
  const acquireWake = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {}
  };
  const releaseWake = () => {
    try { wakeLockRef.current?.release(); } catch {};
    wakeLockRef.current = null;
  };

  // ── Proximity via Page Visibility ─────────────────────────────────────────
  // When screen turns off (phone near ear), visibilitychange fires as "hidden"
  const startProximity = useCallback(() => {
    const handler = () => {
      if (callStatusRef.current !== "connected") return;
      setIsNearEar(document.hidden);
    };
    document.addEventListener("visibilitychange", handler);
    (startProximity as any).__handler = handler;
    console.log("[Proximity] Page visibility listener started");
  }, []);

  const stopProximity = useCallback(() => {
    const handler = (startProximity as any).__handler;
    if (handler) document.removeEventListener("visibilitychange", handler);
    setIsNearEar(false);
  }, [startProximity]);

  // ── Pre-create audio element (must happen inside user gesture) ──────────────
  // Called immediately when user clicks Accept or Call button
  const unlockAudio = () => {
    if (audioElRef.current) {
      console.log("[Audio] Audio element already created, reusing");
      return;
    }

    console.log("[Audio] Creating and unlocking audio element");
    const audio = document.createElement("audio");
    audio.autoplay    = true;
    audio.playsInline = true;
    audio.muted       = false;
    audio.volume      = 1.0;
    audio.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;opacity:0.01;";
    document.body.appendChild(audio);

    // Play silent audio immediately while gesture is active
    // This "unlocks" the audio element in the browser
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play()
      .then(() => {
        console.log("[Audio] ✅ Element unlocked by user gesture");
        audio.src = "";
        audio.srcObject = null;
      })
      .catch((err) => {
        console.warn("[Audio] ⚠️ Silent audio play failed:", err);
      });

    audioElRef.current = audio;
  };

  // ── Set remote stream on pre-unlocked audio element ────────────────────────
  const playRemoteAudio = useCallback((stream: MediaStream) => {
    console.log("[Audio] Playing remote stream", {
      tracks: stream.getTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });

    let audio = audioElRef.current;

    if (!audio) {
      console.warn("[Audio] ⚠️ No pre-created audio element, creating fallback");
      audio = document.createElement("audio");
      audio.autoplay    = true;
      audio.playsInline = true;
      audio.muted       = false;
      audio.volume      = 1.0;
      audio.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;opacity:0.01;";
      document.body.appendChild(audio);
      audioElRef.current = audio;
    }

    // CRITICAL: Set the remote stream
    console.log("[Audio] Setting srcObject on audio element");
    audio.srcObject = stream;
    audio.muted     = false;
    audio.volume    = 1.0;

    // Apply speaker mode
    applySpeaker(isSpeakerRef.current, audio);

    // Attempt to play
    audio.play()
      .then(() => {
        console.log("[Audio] ✅ Remote audio playing");
      })
      .catch((err) => {
        console.warn("[Audio] ⚠️ play() blocked:", err);
        // Last resort: try on next user interaction
        const resume = () => {
          console.log("[Audio] Resuming audio on user interaction");
          audio!.play().catch((e) => {
            console.error("[Audio] Resume play failed:", e);
          });
          document.removeEventListener("touchstart", resume);
          document.removeEventListener("click",      resume);
        };
        document.addEventListener("touchstart", resume, { once: true });
        document.addEventListener("click",      resume, { once: true });
      });
  }, []);

  const applySpeaker = (on: boolean, el?: HTMLAudioElement) => {
    const a = el ?? audioElRef.current;
    if (!a) return;
    try {
      if (typeof (a as any).setSinkId === "function") {
        (a as any).setSinkId(on ? "" : "communications").catch(() => {});
      }
    } catch {}
  };

  const removeAudio = useCallback(() => {
    if (audioElRef.current) {
      console.log("[Audio] Removing audio element");
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      try { document.body.removeChild(audioElRef.current); } catch {}
      audioElRef.current = null;
    }
  }, []);

  // ── Get microphone ────────────────────────────────────────────────────────
  const getMic = async (): Promise<boolean> => {
    // Check if existing stream is still alive
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      const alive = tracks.some(t => t.readyState === "live");
      if (alive) {
        console.log("[Mic] ✅ Reusing live stream");
        return true;
      }
      console.log("[Mic] ⚠️ Existing stream dead, getting fresh");
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    try {
      console.log("[Mic] 🎤 Requesting microphone");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const tracks = stream.getAudioTracks();
      console.log("[Mic] ✅ Got mic", {
        tracks: tracks.length,
        details: tracks.map(t => `${t.label} state=${t.readyState}`),
      });
      localStreamRef.current = stream;
      setIsMicOn(true);
      return true;
    } catch (err: any) {
      console.error("[Mic] ❌ Failed:", err.name, err.message);
      return false;
    }
  };

  // ── Build RTCPeerConnection ──────────────────────────────────────────────
  const buildPC = (): RTCPeerConnection => {
    console.log("[PC] 🔨 Building peer connection");
    
    // Clean up old PC
    if (pcRef.current) {
      console.log("[PC] 🔥 Closing old peer connection");
      pcRef.current.ontrack             = null;
      pcRef.current.onicecandidate      = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQ.current = [];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Add local tracks BEFORE any SDP exchange
    const stream = localStreamRef.current;
    if (stream) {
      const tracks = stream.getAudioTracks();
      console.log("[PC] 📤 Adding', tracks.length, 'audio track(s)");
      tracks.forEach(t => {
        pc.addTrack(t, stream);
        console.log("[PC] Track added:', t.label, 'enabled:', t.enabled, 'state:', t.readyState);
      });
    } else {
      console.error("[PC] ❌ NO local stream — audio will fail!");
    }

    // ✅ CRITICAL FIX: Proper remote audio handling
    pc.ontrack = (event) => {
      if (cancelledRef.current) {
        console.log("[PC] ⚠️ ontrack fired but call cancelled");
        return;
      }

      console.log("[PC] 📥 ontrack fired", {
        kind: event.track.kind,
        streams: event.streams.length,
        audioTracks: event.streams[0]?.getAudioTracks().length ?? 0,
      });

      // Use streams[0] if available, otherwise wrap the track
      const s = event.streams[0] ?? new MediaStream([event.track]);
      console.log("[PC] Remote audio tracks:', s.getAudioTracks().length);

      // Play the remote audio
      playRemoteAudio(s);
      
      setCallStatus("connected");
      startTimer();
      startProximity();
      acquireWake();
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        console.log("[PC] 📡 Sending ICE candidate");
        socketRef.current.emit("call-ice", { room: CALL_ROOM, from: nickname, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[PC] 🔗 Connection state →', s);
      if (s === "connected") {
        setCallStatus(p => p === "connecting" ? "connected" : p);
        startTimer();
      }
      if (s === "failed") {
        console.log("[PC] ⚡ ICE failed, restarting");
        pc.restartIce();
      }
      if (s === "disconnected" || s === "closed") {
        console.log("[PC] ❌ Connection ended");
        if (!cancelledRef.current) {
          stopTimer();
          setCallStatus("ended");
          setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
        }
      }
    };

    return pc;
  };

  const drainICE = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      console.log("[PC] ⏳ ICE drain waiting for remoteDescription");
      return;
    }
    console.log("[PC] 🧊 Draining', iceCandidateQ.current.length, 'ICE candidates');
    for (const c of iceCandidateQ.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceCandidateQ.current = [];
  };

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setCallDuration(0);
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log("[Call] 🧹 Cleanup");
    stopRing(); stopProximity(); releaseWake(); stopTimer();
    
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
    
    removeAudio();
    iceCandidateQ.current = [];
    setCallerName(null);
    setCallDuration(0);
    setIsNearEar(false);
  }, [stopRing, stopProximity, stopTimer, removeAudio]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });
    socket.on("reconnect", () => {
      console.log("[Socket] 🔄 Reconnected");
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    // Incoming: start ring
    socket.on("call-incoming", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Socket] 📞 Incoming call from:', from);
      startRing();
      setCallerName(from);
      setCallStatus("incoming");
    });

    // Caller: accepted → get mic + send offer
    socket.on("call-accepted", async () => {
      if (cancelledRef.current) return;
      console.log("[Socket] ✅ Call accepted");
      stopRing();
      setCallStatus("connecting");
      const ok = await getMic();
      if (!ok) { cleanup(); setCallStatus("idle"); return; }
      const pc = buildPC();
      try {
        console.log("[Call] 📨 Creating offer');
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit("call-offer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] ✅ Offer sent");
      } catch (e) { 
        console.error("[Call] ❌ createOffer failed:', e); 
        setCallStatus("error");
      }
    });

    socket.on("call-rejected", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] ❌ Call rejected");
      stopRing(); cleanup(); setCallStatus("idle");
    });

    socket.on("call-user-offline", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] 📵 User offline");
      stopRing(); cleanup();
      setCallStatus("busy");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 3000);
    });

    // Receiver: gets offer → get mic + send answer
    socket.on("call-offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (from === nickname || cancelledRef.current) return;
      console.log("[Call] 📨 Offer received from:', from);
      const ok = await getMic();
      if (!ok) { 
        console.error("[Call] ❌ No mic for answer"); 
        return; 
      }
      const pc = buildPC();
      try {
        console.log("[WebRTC] Setting remote description (offer)');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        
        console.log("[Call] Creating answer');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] ✅ Answer sent");
      } catch (e) { 
        console.error("[Call] ❌ Answer failed:', e); 
        setCallStatus("error");
      }
    });

    // Caller: gets answer
    socket.on("call-answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      const pc = pcRef.current;
      if (!pc) { 
        console.error("[Call] ❌ No PC for answer!"); 
        return; 
      }
      try {
        console.log("[WebRTC] Setting remote description (answer)');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        console.log("[Call] ✅ Answer set — ICE negotiating");
      } catch (e) { 
        console.error("[Call] ❌ setRemoteDescription failed:', e); 
        setCallStatus("error");
      }
    });

    // ICE
    socket.on("call-ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) {
        console.warn("[Call] ⚠️ ICE received but no PC");
        return;
      }
      if (!pc.remoteDescription) { 
        console.log("[Call] 📦 Queueing ICE (no remote description)');
        iceCandidateQ.current.push(candidate); 
        return; 
      }
      try { 
        await pc.addIceCandidate(new RTCIceCandidate(candidate)); 
      } catch (e) {
        console.warn("[Call] ⚠️ ICE error:', e);
      }
    });

    // Ended
    socket.on("call-ended", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] 📴 Call ended");
      stopRing(); cleanup();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
    });

    socket.on("call-cancelled-other-device", () => {
      console.log("[Socket] ❌ Cancelled on other device");
      stopRing(); setCallStatus("idle"); setCallerName(null);
    });

    return () => {
      cancelledRef.current = true;
      stopRing(); cleanup();
      socket.disconnect();
    };
  }, [nickname]);

  // ── Public API ────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!socketRef.current) return;
    console.log("[Call] 📞 Starting call');
    // Unlock audio element NOW while user gesture is active
    unlockAudio();
    const ok = await getMic();
    if (!ok) { alert("Cannot access microphone. Please allow mic permission."); return; }
    setCallStatus("calling");
    startRing();
    socketRef.current.emit("call-user", { room: CALL_ROOM, from: nickname, to: other });
  }, [nickname, other, startRing]);

  const acceptCall = useCallback(() => {
    console.log("[Call] ✅ Accepting call");
    // Unlock audio element NOW while user gesture is active (Accept button click)
    unlockAudio();
    stopRing();
    setCallStatus("connecting");
    socketRef.current?.emit("call-accept", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRing]);

  const rejectCall = useCallback(() => {
    console.log("[Call] ❌ Rejecting call');
    stopRing(); cleanup(); setCallStatus("idle");
    socketRef.current?.emit("call-reject", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRing, cleanup]);

  const endCall = useCallback(() => {
    console.log("[Call] 📴 Ending call');
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanup(); setCallStatus("idle");
  }, [nickname, cleanup]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
    console.log("[Call] 🎤 Mic toggled:', track.enabled);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      isSpeakerRef.current = next;
      applySpeaker(next);
      console.log("[Call] 🔊 Speaker toggled:', next);
      return next;
    });
  }, []);

  return {
    callStatus, isMicOn, isSpeakerOn, isNearEar,
    callerName, callDuration,
    startCall, acceptCall, rejectCall, endCall,
    toggleMic, toggleSpeaker,
  };
}
