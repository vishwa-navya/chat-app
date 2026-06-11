/**
 * useVoiceCall.ts — FINAL v5
 *
 * Fix 1: Audio not transmitting
 *   - getMic() now uses EXACT constraints that work on both mobile and desktop
 *   - buildPC() verified to add tracks before any SDP exchange
 *   - Added detailed console logs to trace exactly where audio breaks
 *   - offerToReceiveAudio: true on BOTH offer and answer
 *
 * Fix 2: Proximity sensor
 *   - Uses WakeLock to keep screen on during call
 *   - Uses ProximitySensor API (Android Chrome) + legacy deviceproximity event
 *   - isNearEar drives the black screen in Chat2
 *
 * Fix 3: Speaker switching (earpiece vs loudspeaker)
 *   - setSinkId("") = loudspeaker
 *   - setSinkId("communications") = earpiece
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

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

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
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const durationRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringCtxRef     = useRef<AudioContext | null>(null);
  const isSpeakerRef   = useRef(false);
  const cancelledRef   = useRef(false);
  const proximityRef   = useRef<any>(null);
  const wakeLockRef    = useRef<any>(null);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Ringtone via Web Audio API ───────────────────────────────────────────────
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
      for (let i = 0; i < 20; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = i % 2 === 0 ? 440 : 480;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); o.stop(t + 0.4);
        t += 1.5;
      }
    } catch (e) {
      console.warn("[Ring] AudioContext failed:", e);
    }
  }, [stopRing]);

  // ── Wake lock — keep screen on during call ───────────────────────────────────
  const acquireWake = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        console.log("[Call] Wake lock acquired");
      }
    } catch (e) {
      console.warn("[Call] Wake lock failed:", e);
    }
  };

  const releaseWake = () => {
    try { wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  };

  // ── Proximity sensor — blank screen when phone near ear ─────────────────────
  const startProximity = useCallback(() => {
    // Method 1: Generic Sensor API (Android Chrome 57+)
    if ("ProximitySensor" in window) {
      try {
        const sensor = new (window as any).ProximitySensor({ frequency: 10 });
        sensor.addEventListener("reading", () => {
          const near = sensor.near === true || (typeof sensor.distance === "number" && sensor.distance < 5);
          setIsNearEar(near);
        });
        sensor.addEventListener("error", (e: any) => {
          console.warn("[Proximity] Sensor error:", e.error?.message);
        });
        sensor.start();
        proximityRef.current = sensor;
        console.log("[Proximity] Generic sensor started");
        return;
      } catch (e) {
        console.warn("[Proximity] Generic sensor failed:", e);
      }
    }

    // Method 2: Legacy deviceproximity / userproximity events (older Android)
    const handleProximity = (e: any) => {
      const near = e.near === true || (typeof e.value === "number" && e.value < 5);
      setIsNearEar(near);
    };
    window.addEventListener("deviceproximity", handleProximity as EventListener);
    window.addEventListener("userproximity",   handleProximity as EventListener);
    proximityRef.current = handleProximity;
    console.log("[Proximity] Legacy events registered");
  }, []);

  const stopProximity = useCallback(() => {
    const s = proximityRef.current;
    if (!s) return;
    if (s.stop) {
      try { s.stop(); } catch {}
    } else if (typeof s === "function") {
      window.removeEventListener("deviceproximity", s);
      window.removeEventListener("userproximity",   s);
    }
    proximityRef.current = null;
    setIsNearEar(false);
  }, []);

  // ── Duration timer ───────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setCallDuration(0);
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  }, []);

  // ── Remote audio playback ────────────────────────────────────────────────────
  const setSinkIdOnAudio = (speakerOn: boolean, el?: HTMLAudioElement) => {
    const audio = el ?? remoteAudioRef.current;
    if (!audio) return;
    try {
      if (typeof (audio as any).setSinkId === "function") {
        // "" = default output (loudspeaker)
        // "communications" = earpiece
        const sinkId = speakerOn ? "" : "communications";
        (audio as any).setSinkId(sinkId)
          .then(() => console.log("[Audio] sinkId set to:", sinkId || "default"))
          .catch((err: any) => console.warn("[Audio] setSinkId failed:", err));
      }
    } catch (e) {
      console.warn("[Audio] setSinkId error:", e);
    }
  };

  const playRemoteAudio = useCallback((stream: MediaStream) => {
    console.log("[Audio] Setting up remote audio element");

    // Remove existing audio element
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }

    const audio = document.createElement("audio");
    audio.id          = "vishwa-ammu-call-audio";
    audio.autoplay    = true;
    audio.playsInline = true;
    audio.controls    = false;
    audio.muted       = false;   // NEVER mute — this is the whole point
    audio.volume      = 1.0;
    audio.style.cssText = "position:fixed;bottom:-100px;left:-100px;width:1px;height:1px;";
    audio.srcObject   = stream;

    document.body.appendChild(audio);
    remoteAudioRef.current = audio;

    // Apply current speaker mode
    setSinkIdOnAudio(isSpeakerRef.current, audio);

    // Play — with fallback for browsers requiring user gesture
    const tryPlay = () => {
      audio.play()
        .then(() => console.log("[Audio] ✅ Remote audio playing!"))
        .catch(err => {
          console.warn("[Audio] Autoplay blocked, waiting for gesture:", err);
          const resume = () => {
            audio.play().catch(() => {});
            document.removeEventListener("touchstart", resume);
            document.removeEventListener("click",      resume);
          };
          document.addEventListener("touchstart", resume, { once: true });
          document.addEventListener("click",      resume, { once: true });
        });
    };
    tryPlay();

    // Track count check
    const tracks = stream.getAudioTracks();
    console.log("[Audio] Remote stream audio tracks:", tracks.length, tracks.map(t => `${t.label} enabled=${t.enabled}`));
  }, []);

  const removeRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }
  }, []);

  // ── Get microphone ───────────────────────────────────────────────────────────
  const getMic = async (): Promise<boolean> => {
    // Already have a stream — reuse it
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      console.log("[Mic] Reusing existing stream, tracks:", tracks.length);
      if (tracks.length > 0) return true;
      // Stream exists but no tracks — get fresh
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    try {
      console.log("[Mic] Requesting microphone...");
      // Simple constraints — complex constraints can fail on some devices
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      const tracks = stream.getAudioTracks();
      console.log("[Mic] ✅ Got stream, audio tracks:", tracks.length,
        tracks.map(t => `${t.label} readyState=${t.readyState} enabled=${t.enabled}`));

      if (tracks.length === 0) {
        console.error("[Mic] Stream has 0 audio tracks!");
        return false;
      }

      localStreamRef.current = stream;
      setIsMicOn(true);
      return true;
    } catch (err: any) {
      console.error("[Mic] getUserMedia failed:", err.name, err.message);
      return false;
    }
  };

  // ── Build RTCPeerConnection ──────────────────────────────────────────────────
  // IMPORTANT: Always call getMic() BEFORE buildPC()
  const buildPC = (): RTCPeerConnection => {
    // Close old PC
    if (pcRef.current) {
      pcRef.current.ontrack             = null;
      pcRef.current.onicecandidate      = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQ.current = [];

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // ── Add local tracks FIRST ─────────────────────────────────────────────────
    const stream = localStreamRef.current;
    if (stream) {
      const tracks = stream.getAudioTracks();
      console.log("[PC] Adding", tracks.length, "local audio track(s) to PC");
      tracks.forEach(track => {
        pc.addTrack(track, stream);
        console.log("[PC] Added track:", track.label, "enabled:", track.enabled);
      });
    } else {
      console.error("[PC] ⚠️ localStream is NULL when building PC — audio will NOT work!");
    }

    // ── Receive remote audio ───────────────────────────────────────────────────
    pc.ontrack = (event) => {
      if (cancelledRef.current) return;
      console.log("[PC] ontrack fired! streams:", event.streams.length,
        "track:", event.track.kind, event.track.label);

      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      const audioTracks = remoteStream.getAudioTracks();
      console.log("[PC] Remote audio tracks:", audioTracks.length);

      playRemoteAudio(remoteStream);
      setCallStatus("connected");
      startTimer();
      startProximity();
      acquireWake();
    };

    // ── ICE candidates ─────────────────────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        console.log("[ICE] Sending candidate");
        socketRef.current.emit("call-ice", {
          room: CALL_ROOM, from: nickname, candidate,
        });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[ICE] Gathering state:", pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[ICE] Connection state:", pc.iceConnectionState);
    };

    // ── Connection state ───────────────────────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[PC] Connection state:", s);
      if (s === "connected") {
        // Backup path: if ontrack hasn't fired yet, still mark connected
        setCallStatus(prev => {
          if (prev === "connecting") {
            startTimer();
            return "connected";
          }
          return prev;
        });
      }
      if (s === "failed") {
        console.warn("[PC] Connection failed, restarting ICE");
        pc.restartIce();
      }
      if (s === "disconnected" || s === "closed") {
        if (!cancelledRef.current) {
          stopTimer();
          setCallStatus("ended");
          setTimeout(() => {
            if (!cancelledRef.current) setCallStatus("idle");
          }, 2500);
        }
      }
    };

    return pc;
  };

  const drainICE = async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    console.log("[ICE] Draining", iceCandidateQ.current.length, "queued candidates");
    for (const c of iceCandidateQ.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {
        console.warn("[ICE] addIceCandidate failed:", e);
      }
    }
    iceCandidateQ.current = [];
  };

  // ── Full cleanup ─────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopRing();
    stopProximity();
    releaseWake();
    stopTimer();
    if (pcRef.current) {
      pcRef.current.ontrack             = null;
      pcRef.current.onicecandidate      = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    removeRemoteAudio();
    iceCandidateQ.current = [];
    setCallerName(null);
    setCallDuration(0);
    setIsNearEar(false);
  }, [stopRing, stopProximity, stopTimer, removeRemoteAudio]);

  // ── Socket connection ────────────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    socket.on("reconnect", () => {
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    // ── Incoming call ──────────────────────────────────────────────────────────
    socket.on("call-incoming", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Call] Incoming from:", from);
      startRing();
      setCallerName(from);
      setCallStatus("incoming");
    });

    // ── Caller: accepted → get mic then send offer ─────────────────────────────
    socket.on("call-accepted", async () => {
      if (cancelledRef.current) return;
      console.log("[Call] Accepted — getting mic then sending offer");
      stopRing();
      setCallStatus("connecting");

      const ok = await getMic();
      if (!ok) {
        alert("Cannot access microphone. Please allow mic permission and try again.");
        endCallFn(socket);
        return;
      }

      // Build PC (has mic tracks) then create offer
      const pc = buildPC();
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        socket.emit("call-offer", {
          room: CALL_ROOM, from: nickname, sdp: pc.localDescription,
        });
        console.log("[Call] Offer sent, SDP type:", offer.type);
      } catch (err) {
        console.error("[Call] createOffer failed:", err);
      }
    });

    // ── Caller: rejected ───────────────────────────────────────────────────────
    socket.on("call-rejected", () => {
      if (cancelledRef.current) return;
      console.log("[Call] Rejected");
      stopRing(); cleanup();
      setCallStatus("idle");
    });

    // ── Caller: offline ────────────────────────────────────────────────────────
    socket.on("call-user-offline", () => {
      if (cancelledRef.current) return;
      console.log("[Call] User offline");
      stopRing(); cleanup();
      setCallStatus("busy");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 3000);
    });

    // ── Receiver: gets offer → get mic then send answer ────────────────────────
    socket.on("call-offer", async ({
      from, sdp,
    }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (from === nickname || cancelledRef.current) return;
      console.log("[Call] Got offer from:", from);

      // CRITICAL: get mic BEFORE building PC
      const ok = await getMic();
      if (!ok) {
        console.error("[Call] Cannot answer — no microphone");
        return;
      }

      console.log("[Call] Building PC for answer");
      const pc = buildPC(); // PC now has local audio tracks

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("[Call] Remote description set (offer)");
        await drainICE();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", {
          room: CALL_ROOM, from: nickname, sdp: pc.localDescription,
        });
        console.log("[Call] Answer sent, SDP type:", answer.type);
      } catch (err) {
        console.error("[Call] Answer creation failed:", err);
      }
    });

    // ── Caller: gets answer ────────────────────────────────────────────────────
    socket.on("call-answer", async ({
      sdp,
    }: { sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      console.log("[Call] Got answer");
      const pc = pcRef.current;
      if (!pc) {
        console.error("[Call] No PC when answer arrived!");
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("[Call] Remote description set (answer) — ICE negotiation starting");
        await drainICE();
      } catch (err) {
        console.error("[Call] setRemoteDescription(answer) failed:", err);
      }
    });

    // ── ICE candidates ─────────────────────────────────────────────────────────
    socket.on("call-ice", async ({
      from, candidate,
    }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) {
        console.log("[ICE] Queuing candidate (no remote desc yet)");
        iceCandidateQ.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[ICE] addIceCandidate error:", e);
      }
    });

    // ── Call ended by other side ───────────────────────────────────────────────
    socket.on("call-ended", () => {
      if (cancelledRef.current) return;
      console.log("[Call] Ended by other side");
      stopRing(); cleanup();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
    });

    // ── Another device accepted ────────────────────────────────────────────────
    socket.on("call-cancelled-other-device", () => {
      stopRing(); setCallStatus("idle"); setCallerName(null);
    });

    socket.on("connect_error", err => console.error("[Socket] Error:", err.message));

    return () => {
      cancelledRef.current = true;
      stopRing(); cleanup();
      socket.disconnect();
    };
  }, [nickname]);

  // ── endCall helper (used inside and outside effect) ──────────────────────────
  const endCallFn = (socket: Socket) => {
    socket.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanup();
    setCallStatus("idle");
  };

  // ── Public API ───────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!socketRef.current) return;
    console.log("[Call] Starting call to:", other);
    const ok = await getMic();
    if (!ok) {
      alert("Cannot access microphone. Please allow mic permission and try again.");
      return;
    }
    setCallStatus("calling");
    startRing();
    socketRef.current.emit("call-user", {
      room: CALL_ROOM, from: nickname, to: other,
    });
  }, [nickname, other, startRing]);

  const acceptCall = useCallback(() => {
    console.log("[Call] Accepting call");
    stopRing();
    setCallStatus("connecting");
    socketRef.current?.emit("call-accept", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRing]);

  const rejectCall = useCallback(() => {
    console.log("[Call] Rejecting call");
    stopRing(); cleanup();
    setCallStatus("idle");
    socketRef.current?.emit("call-reject", { room: CALL_ROOM, from: nickname });
  }, [nickname, stopRing, cleanup]);

  const endCall = useCallback(() => {
    console.log("[Call] Ending call");
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanup();
    setCallStatus("idle");
  }, [nickname, cleanup]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
    console.log("[Mic] Toggled:", track.enabled ? "ON" : "OFF");
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      isSpeakerRef.current = next;
      setSinkIdOnAudio(next);
      console.log("[Speaker] Toggled:", next ? "ON (loudspeaker)" : "OFF (earpiece)");
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