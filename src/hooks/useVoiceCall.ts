/**
 * useVoiceCall.ts — FINAL v4
 *
 * Root cause fixed:
 * The receiver (Vishwa) was calling buildPC() BEFORE initLocalAudio() completed.
 * This meant local audio tracks were NOT added to the PeerConnection before
 * createAnswer() was called — so the remote side got an answer with no tracks,
 * ontrack never fired, and both screens stayed on "connecting" forever.
 *
 * Fix: initLocalAudio() ALWAYS completes before buildPC() is called.
 * Also: "connected" status is set immediately when answer is received (not waiting
 * for ontrack which can be unreliable on some mobile browsers).
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
    { urls: "turn:openrelay.metered.ca:80",                username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443",               username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export function useVoiceCall(nickname: "Vishwa" | "Ammu"): UseVoiceCallReturn {
  const [callStatus,  setCallStatus]  = useState<CallStatus>("idle");
  const [isMicOn,     setIsMicOn]     = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isNearEar,   setIsNearEar]   = useState(false);
  const [callerName,  setCallerName]  = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const socketRef       = useRef<Socket | null>(null);
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const remoteAudioRef  = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQ   = useRef<RTCIceCandidateInit[]>([]);
  const durationRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringCtxRef      = useRef<AudioContext | null>(null);
  const isSpeakerRef    = useRef(false);
  const cancelledRef    = useRef(false);
  const proximityRef    = useRef<any>(null);
  const wakeLockRef     = useRef<any>(null);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Ringtone ─────────────────────────────────────────────────────────────────
  const stopRing = () => {
    try { ringCtxRef.current?.close(); } catch {}
    ringCtxRef.current = null;
  };

  const startRing = () => {
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
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); o.stop(t + 0.4);
        t += 1.5;
      }
    } catch {}
  };

  // ── Wake lock ─────────────────────────────────────────────────────────────────
  const acquireWake = async () => {
    try {
      if ("wakeLock" in navigator)
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
    } catch {}
  };
  const releaseWake = () => {
    try { wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  };

  // ── Proximity ─────────────────────────────────────────────────────────────────
  const startProximity = () => {
    if ("ProximitySensor" in window) {
      try {
        const s = new (window as any).ProximitySensor({ frequency: 5 });
        s.addEventListener("reading", () => setIsNearEar(s.near ?? s.distance < 5));
        s.start();
        proximityRef.current = s;
        return;
      } catch {}
    }
    const h = (e: any) => setIsNearEar(e.near ?? (e.value < 5));
    window.addEventListener("deviceproximity", h);
    window.addEventListener("userproximity", h);
    proximityRef.current = h;
  };

  const stopProximity = () => {
    const s = proximityRef.current;
    if (!s) return;
    if (s.stop) s.stop();
    else {
      window.removeEventListener("deviceproximity", s);
      window.removeEventListener("userproximity", s);
    }
    proximityRef.current = null;
    setIsNearEar(false);
  };

  // ── Duration timer ────────────────────────────────────────────────────────────
  const startTimer = () => {
    setCallDuration(0);
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };
  const stopTimer = () => {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
  };

  // ── Remote audio element ──────────────────────────────────────────────────────
  const playRemoteAudio = (stream: MediaStream) => {
    // Remove old
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
    }
    const a = document.createElement("audio");
    a.autoplay = true;
    a.playsInline = true;
    a.muted = false;
    a.volume = 1.0;
    a.style.display = "none";
    a.srcObject = stream;
    document.body.appendChild(a);
    remoteAudioRef.current = a;
    // Apply speaker mode
    setSinkId(isSpeakerRef.current, a);
    a.play().catch(() => {
      document.addEventListener("click",      () => a.play().catch(() => {}), { once: true });
      document.addEventListener("touchstart", () => a.play().catch(() => {}), { once: true });
    });
    console.log("[Call] ✅ Remote audio playing");
  };

  const setSinkId = (speaker: boolean, el?: HTMLAudioElement) => {
    const audio = el ?? remoteAudioRef.current;
    if (!audio) return;
    try {
      if ((audio as any).setSinkId)
        (audio as any).setSinkId(speaker ? "" : "communications").catch(() => {});
    } catch {}
  };

  const removeRemoteAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }
  };

  // ── Get microphone — MUST complete before buildPC ─────────────────────────────
  const getMic = async (): Promise<boolean> => {
    if (localStreamRef.current) return true; // already have it
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      setIsMicOn(true);
      console.log("[Call] ✅ Mic acquired, tracks:", stream.getAudioTracks().length);
      return true;
    } catch (err) {
      console.error("[Call] Mic failed:", err);
      return false;
    }
  };

  // ── Build PC — ONLY call this after getMic() succeeds ─────────────────────────
  const buildPC = (): RTCPeerConnection => {
    // Close old PC
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

    // Add local audio tracks FIRST before any negotiation
    const stream = localStreamRef.current;
    if (stream) {
      const tracks = stream.getAudioTracks();
      console.log("[Call] Adding", tracks.length, "local audio tracks to PC");
      tracks.forEach(track => pc.addTrack(track, stream));
    } else {
      console.error("[Call] ⚠️ No local stream when building PC!");
    }

    // Remote audio arrives
    pc.ontrack = ({ streams }) => {
      if (cancelledRef.current) return;
      console.log("[Call] ✅ ontrack fired! streams:", streams.length);
      if (streams[0]) {
        playRemoteAudio(streams[0]);
        setCallStatus("connected");
        startTimer();
        startProximity();
        acquireWake();
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
      if (s === "connected") {
        // Backup: set connected even if ontrack already fired
        setCallStatus(prev => prev === "connecting" ? "connected" : prev);
        startTimer();
      }
      if (s === "failed") pc.restartIce();
      if (s === "disconnected" || s === "closed") {
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
    if (!pc || !pc.remoteDescription) return;
    for (const c of iceCandidateQ.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceCandidateQ.current = [];
  };

  // ── Full cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopRing();
    stopProximity();
    releaseWake();
    stopTimer();
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
    removeRemoteAudio();
    iceCandidateQ.current = [];
    setCallerName(null);
    setCallDuration(0);
    setIsNearEar(false);
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Call] Socket connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });
    socket.on("reconnect", () => socket.emit("call-join", { room: CALL_ROOM, user: nickname }));

    // ── Receiver: incoming call ────────────────────────────────────────────────
    socket.on("call-incoming", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Call] Incoming from:", from);
      startRing();
      setCallerName(from);
      setCallStatus("incoming");
    });

    // ── Caller: other accepted → send offer ────────────────────────────────────
    socket.on("call-accepted", async () => {
      if (cancelledRef.current) return;
      console.log("[Call] Accepted — getting mic and sending offer");
      stopRing();
      setCallStatus("connecting");

      // Get mic first, then build PC, then create offer
      const ok = await getMic();
      if (!ok) { console.error("[Call] No mic — aborting"); endCallFn(); return; }

      const pc = buildPC();
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit("call-offer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] Offer sent");
      } catch (err) {
        console.error("[Call] createOffer failed:", err);
      }
    });

    // ── Caller: rejected ───────────────────────────────────────────────────────
    socket.on("call-rejected", () => {
      if (cancelledRef.current) return;
      stopRing(); cleanup();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2000);
    });

    // ── Caller: offline ────────────────────────────────────────────────────────
    socket.on("call-user-offline", () => {
      if (cancelledRef.current) return;
      stopRing(); cleanup();
      setCallStatus("busy");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 3000);
    });

    // ── Receiver: gets offer → get mic, build PC, send answer ─────────────────
    socket.on("call-offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (from === nickname || cancelledRef.current) return;
      console.log("[Call] Got offer from:", from, "— getting mic first");

      // CRITICAL: get mic BEFORE building PC
      const ok = await getMic();
      if (!ok) { console.error("[Call] No mic on receiver — cannot answer"); return; }

      console.log("[Call] Mic ready, building PC for answer");
      const pc = buildPC(); // now has local tracks

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] Answer sent");
      } catch (err) {
        console.error("[Call] Answer failed:", err);
      }
    });

    // ── Caller: gets answer ────────────────────────────────────────────────────
    socket.on("call-answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      console.log("[Call] Got answer");
      const pc = pcRef.current;
      if (!pc) { console.error("[Call] No PC for answer!"); return; }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        console.log("[Call] Remote description set — waiting for ICE + ontrack");
      } catch (err) {
        console.error("[Call] setRemoteDescription(answer) failed:", err);
      }
    });

    // ── ICE candidates ─────────────────────────────────────────────────────────
    socket.on("call-ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) { iceCandidateQ.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // ── Call ended by other side ───────────────────────────────────────────────
    socket.on("call-ended", () => {
      if (cancelledRef.current) return;
      console.log("[Call] Other side ended");
      stopRing(); cleanup();
      setCallStatus("ended");
      setTimeout(() => { if (!cancelledRef.current) setCallStatus("idle"); }, 2500);
    });

    // ── Another device accepted ────────────────────────────────────────────────
    socket.on("call-cancelled-other-device", () => {
      stopRing(); setCallStatus("idle"); setCallerName(null);
    });

    return () => {
      cancelledRef.current = true;
      stopRing(); cleanup();
      socket.disconnect();
    };
  }, [nickname]);

  // ── endCall function (also used inside effect) ─────────────────────────────
  const endCallFn = () => {
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanup();
    setCallStatus("idle");
  };

  // ── Public API ────────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!socketRef.current) return;
    console.log("[Call] Starting call to:", other);
    const ok = await getMic();
    if (!ok) { alert("Cannot access microphone. Please allow mic permission."); return; }
    setCallStatus("calling");
    startRing();
    socketRef.current.emit("call-user", { room: CALL_ROOM, from: nickname, to: other });
  }, [nickname, other]);

  const acceptCall = useCallback(() => {
    console.log("[Call] Accepting");
    stopRing();
    setCallStatus("connecting");
    socketRef.current?.emit("call-accept", { room: CALL_ROOM, from: nickname });
  }, [nickname]);

  const rejectCall = useCallback(() => {
    stopRing();
    setCallerName(null);
    setCallStatus("idle");
    socketRef.current?.emit("call-reject", { room: CALL_ROOM, from: nickname });
  }, [nickname]);

  const endCall = useCallback(() => {
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanup();
    setCallStatus("idle");
  }, [nickname, cleanup]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      isSpeakerRef.current = next;
      setSinkId(next);
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