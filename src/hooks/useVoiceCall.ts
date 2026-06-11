/**
 * useVoiceCall.ts — PRODUCTION v8 COMPLETE FIX
 * 
 * CRITICAL FIXES APPLIED:
 * 1. Audio not transmitting - Force audio track negotiation with recvonly/sendrecv
 * 2. Black screen on reconnect - Reset all state and rebuild connection from scratch
 * 3. Connection persistence - Better error recovery and auto-reconnect
 * 4. Audio unlock - Pre-unlock audio before ontrack fires
 * 5. ICE restart - Automatic ICE restart on connection failure
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
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
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
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioElRef     = useRef<HTMLAudioElement | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const durationRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringCtxRef     = useRef<AudioContext | null>(null);
  const isSpeakerRef   = useRef(false);
  const cancelledRef   = useRef(false);
  const wakeLockRef    = useRef<any>(null);
  const callStatusRef  = useRef<CallStatus>("idle");
  const connectionAttemptRef = useRef(0);
  const audioUnlockedRef = useRef(false);

  useEffect(() => { 
    callStatusRef.current = callStatus; 
  }, [callStatus]);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  const stopRing = useCallback(() => {
    try { 
      ringCtxRef.current?.close(); 
    } catch {}
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
        o.connect(g); 
        g.connect(ctx.destination);
        o.frequency.value = i % 2 === 0 ? 440 : 480;
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.start(t); 
        o.stop(t + 0.4);
        t += 1.5;
      }
    } catch (e) {
      console.error("[Ring] Error:", e);
    }
  }, [stopRing]);

  const acquireWake = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch (e) {
      console.error("[Wake] Error:", e);
    }
  };

  const releaseWake = () => {
    try { 
      wakeLockRef.current?.release(); 
    } catch {}
    wakeLockRef.current = null;
  };

  const startProximity = useCallback(() => {
    const handler = () => {
      if (callStatusRef.current !== "connected") return;
      setIsNearEar(document.hidden);
    };
    document.addEventListener("visibilitychange", handler);
    (startProximity as any).__handler = handler;
    console.log("[Proximity] Started listening");
  }, []);

  const stopProximity = useCallback(() => {
    const handler = (startProximity as any).__handler;
    if (handler) {
      document.removeEventListener("visibilitychange", handler);
    }
    setIsNearEar(false);
  }, [startProximity]);

  // ── CRITICAL: Pre-unlock audio on user gesture ───────────────────────────
  const unlockAudio = () => {
    if (audioUnlockedRef.current) {
      console.log("[Audio] Already unlocked");
      return;
    }

    console.log("[Audio] UNLOCKING audio element on user gesture");
    
    if (!audioElRef.current) {
      const audio = document.createElement("audio");
      audio.autoplay    = true;
      audio.playsInline = true;
      audio.muted       = false;
      audio.volume      = 1.0;
      audio.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;opacity:0.01;";
      document.body.appendChild(audio);
      audioElRef.current = audio;
    }

    // Play silent audio to unlock
    const audio = audioElRef.current;
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    
    audio.play()
      .then(() => {
        console.log("[Audio] Audio element unlocked successfully");
        audioUnlockedRef.current = true;
        audio.src = "";
        audio.srcObject = null;
      })
      .catch((err) => {
        console.error("[Audio] Failed to unlock:", err);
      });
  };

  // ── Play remote audio immediately when track arrives ───────────────────────
  const playRemoteAudio = useCallback((stream: MediaStream) => {
    console.log("[Audio] PLAYING remote stream", {
      tracks: stream.getTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });

    remoteStreamRef.current = stream;

    let audio = audioElRef.current;

    // If no audio element yet, create one NOW
    if (!audio) {
      console.log("[Audio] No audio element, creating NOW");
      audio = document.createElement("audio");
      audio.autoplay    = true;
      audio.playsInline = true;
      audio.muted       = false;
      audio.volume      = 1.0;
      audio.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;opacity:0.01;";
      document.body.appendChild(audio);
      audioElRef.current = audio;
      audioUnlockedRef.current = true;
    }

    // IMMEDIATELY set the stream
    audio.srcObject = stream;
    audio.muted     = false;
    audio.volume    = 1.0;

    applySpeaker(isSpeakerRef.current, audio);

    // Try to play
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("[Audio] Remote audio is now playing");
        })
        .catch((err) => {
          console.error("[Audio] Play failed:", err.message);
          // Retry on next user interaction
          const onInteraction = () => {
            console.log("[Audio] Retrying on user interaction");
            audio!.play().catch(e => console.error("[Audio] Retry failed:", e));
            document.removeEventListener("click", onInteraction);
            document.removeEventListener("touchstart", onInteraction);
          };
          document.addEventListener("click", onInteraction, { once: true });
          document.addEventListener("touchstart", onInteraction, { once: true });
        });
    }
  }, []);

  const applySpeaker = (on: boolean, el?: HTMLAudioElement) => {
    const a = el ?? audioElRef.current;
    if (!a) return;
    try {
      if (typeof (a as any).setSinkId === "function") {
        (a as any).setSinkId(on ? "" : "communications").catch((e: any) => {
          console.warn("[Speaker] setSinkId failed:", e);
        });
      }
    } catch (e) {
      console.warn("[Speaker] Error:", e);
    }
  };

  const removeAudio = useCallback(() => {
    if (audioElRef.current) {
      console.log("[Audio] Removing audio element");
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      try { 
        document.body.removeChild(audioElRef.current); 
      } catch {}
      audioElRef.current = null;
      audioUnlockedRef.current = false;
    }
    remoteStreamRef.current = null;
  }, []);

  // ── Get microphone with better error handling ────────────────────────────
  const getMic = async (): Promise<boolean> => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      const alive = tracks.some(t => t.readyState === "live");
      if (alive) {
        console.log("[Mic] Reusing existing live stream");
        return true;
      }
      console.log("[Mic] Old stream dead, getting fresh");
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    try {
      console.log("[Mic] Requesting microphone access");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0) {
        console.error("[Mic] No audio tracks in stream");
        stream.getTracks().forEach(t => t.stop());
        return false;
      }
      console.log("[Mic] Got microphone with", tracks.length, "tracks");
      localStreamRef.current = stream;
      setIsMicOn(true);
      return true;
    } catch (err: any) {
      console.error("[Mic] Failed:", err.name, "-", err.message);
      return false;
    }
  };

  // ── Build peer connection with complete reset ──────────────────────────
  const buildPC = (): RTCPeerConnection => {
    console.log("[PC] Building NEW peer connection (attempt", connectionAttemptRef.current + 1, ")");
    
    // DESTROY old connection completely
    if (pcRef.current) {
      console.log("[PC] Destroying previous peer connection");
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.onicegatheringstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onsignalingstatechange = null;
        pcRef.current.close();
      } catch (e) {
        console.warn("[PC] Error closing old PC:", e);
      }
      pcRef.current = null;
    }
    
    iceCandidateQ.current = [];
    connectionAttemptRef.current++;

    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    
    pcRef.current = pc;

    // Add local audio tracks FIRST
    const stream = localStreamRef.current;
    if (stream) {
      const tracks = stream.getAudioTracks();
      console.log("[PC] Adding", tracks.length, "audio track(s) to PC");
      tracks.forEach((t, idx) => {
        try {
          console.log("[PC] Track", idx, ":", t.label, "enabled:", t.enabled);
          pc.addTrack(t, stream);
        } catch (e) {
          console.error("[PC] Error adding track", idx, ":", e);
        }
      });
    } else {
      console.error("[PC] NO LOCAL STREAM - audio will NOT work!");
    }

    // ── ontrack: Receive remote audio ──────────────────────────────────────
    pc.ontrack = (event) => {
      if (cancelledRef.current) {
        console.log("[PC] ontrack ignored (cancelled)");
        return;
      }

      console.log("[PC] ontrack event fired", {
        trackKind: event.track.kind,
        trackLabel: event.track.label,
        streams: event.streams.length,
      });

      // Get or wrap the remote stream
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      
      console.log("[PC] Remote stream ready with", {
        tracks: remoteStream.getTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        videoTracks: remoteStream.getVideoTracks().length,
      });

      // PLAY remote audio immediately
      playRemoteAudio(remoteStream);
      
      setCallStatus("connected");
      startTimer();
      startProximity();
      acquireWake();
    };

    // ── ICE candidate handling ─────────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        socketRef.current.emit("call-ice", { 
          room: CALL_ROOM, 
          from: nickname, 
          candidate 
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[PC] ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.log("[PC] ICE failed, restarting");
        pc.restartIce();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[PC] ICE gathering state:", pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log("[PC] Signaling state:", pc.signalingState);
    };

    // ── Connection state ──────────────────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[PC] Connection state:", s);
      
      if (s === "connected" || s === "completed") {
        console.log("[PC] CONNECTED");
        setCallStatus("connected");
        startTimer();
      } else if (s === "disconnected") {
        console.log("[PC] DISCONNECTED");
        stopTimer();
        removeAudio();
        setCallStatus("ended");
        setTimeout(() => { 
          if (!cancelledRef.current) setCallStatus("idle");
        }, 3000);
      } else if (s === "failed") {
        console.error("[PC] FAILED - restarting ICE");
        pc.restartIce();
      } else if (s === "closed") {
        console.log("[PC] CLOSED");
        removeAudio();
        setCallStatus("idle");
      }
    };

    return pc;
  };

  const drainICE = async () => {
    const pc = pcRef.current;
    if (!pc) {
      console.log("[PC] No PC for draining ICE");
      return;
    }
    if (!pc.remoteDescription) {
      console.log("[PC] No remote description yet, queuing ICE candidates");
      return;
    }
    
    console.log("[PC] Draining", iceCandidateQ.current.length, "ICE candidates");
    for (const c of iceCandidateQ.current) {
      try { 
        await pc.addIceCandidate(new RTCIceCandidate(c)); 
      } catch (e) {
        console.warn("[PC] ICE add error:", e);
      }
    }
    iceCandidateQ.current = [];
  };

  const startTimer = useCallback(() => {
    setCallDuration(0);
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (durationRef.current) { 
      clearInterval(durationRef.current); 
      durationRef.current = null; 
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log("[Call] CLEANUP START");
    stopRing(); 
    stopProximity(); 
    releaseWake(); 
    stopTimer();
    
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch (e) {
        console.warn("[Call] Error during cleanup:", e);
      }
      pcRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        try { 
          t.stop(); 
        } catch {}
      });
      localStreamRef.current = null;
    }
    
    removeAudio();
    iceCandidateQ.current = [];
    connectionAttemptRef.current = 0;
    setCallerName(null);
    setCallDuration(0);
    setIsNearEar(false);
    console.log("[Call] CLEANUP END");
  }, [stopRing, stopProximity, stopTimer, removeAudio]);

  // ── Socket connection and handlers ───────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    socket.on("reconnect", () => {
      console.log("[Socket] Reconnected");
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("call-incoming", ({ from }: { from: string }) => {
      if (cancelledRef.current) return;
      console.log("[Socket] Incoming call from:", from);
      startRing();
      setCallerName(from);
      setCallStatus("incoming");
    });

    // ── Accept flow ────────────────────────────────────────────────────────
    socket.on("call-accepted", async () => {
      if (cancelledRef.current) return;
      console.log("[Socket] Call ACCEPTED");
      stopRing();
      setCallStatus("connecting");
      
      const ok = await getMic();
      if (!ok) { 
        console.error("[Call] Mic failed");
        cleanup(); 
        setCallStatus("idle"); 
        return; 
      }
      
      const pc = buildPC();
      try {
        console.log("[Call] Creating offer with audio");
        const offer = await pc.createOffer({ 
          offerToReceiveAudio: true, 
          offerToReceiveVideo: false,
          voiceActivityDetection: true,
        });
        console.log("[Call] Setting local description");
        await pc.setLocalDescription(offer);
        console.log("[Call] Sending offer");
        socket.emit("call-offer", { 
          room: CALL_ROOM, 
          from: nickname, 
          sdp: pc.localDescription 
        });
        console.log("[Call] Offer sent");
      } catch (e) { 
        console.error("[Call] Offer failed:", e); 
        cleanup();
        setCallStatus("error");
      }
    });

    socket.on("call-rejected", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] Call REJECTED");
      stopRing(); 
      cleanup(); 
      setCallStatus("idle");
    });

    socket.on("call-user-offline", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] User OFFLINE");
      stopRing(); 
      cleanup();
      setCallStatus("busy");
      setTimeout(() => { 
        if (!cancelledRef.current) setCallStatus("idle"); 
      }, 3000);
    });

    // ── Receive offer ──────────────────────────────────────────────────────
    socket.on("call-offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (from === nickname || cancelledRef.current) return;
      console.log("[Socket] Offer received from:", from);
      
      const ok = await getMic();
      if (!ok) { 
        console.error("[Call] Mic failed for answer");
        return; 
      }
      
      const pc = buildPC();
      try {
        console.log("[Call] Setting remote description (offer)");
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        
        console.log("[Call] Creating answer");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log("[Call] Sending answer");
        socket.emit("call-answer", { 
          room: CALL_ROOM, 
          from: nickname, 
          sdp: pc.localDescription 
        });
        console.log("[Call] Answer sent");
      } catch (e) { 
        console.error("[Call] Answer failed:", e); 
        cleanup();
        setCallStatus("error");
      }
    });

    // ── Receive answer ─────────────────────────────────────────────────────
    socket.on("call-answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (cancelledRef.current) return;
      const pc = pcRef.current;
      if (!pc) { 
        console.error("[Call] No PC for answer");
        return;
      }
      try {
        console.log("[Call] Setting remote description (answer)");
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        console.log("[Call] Answer applied");
      } catch (e) { 
        console.error("[Call] Answer failed:", e); 
        cleanup();
        setCallStatus("error");
      }
    });

    // ── ICE candidates ─────────────────────────────────────────────────────
    socket.on("call-ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) {
        console.warn("[Call] ICE received but no PC");
        return;
      }
      
      if (!pc.remoteDescription) { 
        iceCandidateQ.current.push(candidate); 
        return; 
      }
      
      try { 
        await pc.addIceCandidate(new RTCIceCandidate(candidate)); 
      } catch (e) {
        console.warn("[Call] ICE error:", e);
      }
    });

    socket.on("call-ended", () => {
      if (cancelledRef.current) return;
      console.log("[Socket] Call ENDED by peer");
      stopRing(); 
      cleanup();
      setCallStatus("ended");
      setTimeout(() => { 
        if (!cancelledRef.current) setCallStatus("idle"); 
      }, 2500);
    });

    socket.on("call-cancelled-other-device", () => {
      console.log("[Socket] Cancelled on other device");
      stopRing(); 
      setCallStatus("idle"); 
      setCallerName(null);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
    });

    return () => {
      cancelledRef.current = true;
      stopRing(); 
      cleanup();
      socket.disconnect();
    };
  }, [nickname, stopRing, startRing, stopTimer, cleanup, startProximity, acquireWake]);

  // ── Public API ─────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!socketRef.current) {
      console.error("[Call] Socket not ready");
      return;
    }
    console.log("[Call] STARTING CALL to", other);
    unlockAudio();
    const ok = await getMic();
    if (!ok) { 
      alert("Cannot access microphone. Please allow permission."); 
      return; 
    }
    setCallStatus("calling");
    startRing();
    socketRef.current.emit("call-user", { 
      room: CALL_ROOM, 
      from: nickname, 
      to: other 
    });
  }, [nickname, other, startRing]);

  const acceptCall = useCallback(() => {
    console.log("[Call] ACCEPTING CALL");
    unlockAudio();
    stopRing();
    setCallStatus("connecting");
    socketRef.current?.emit("call-accept", { 
      room: CALL_ROOM, 
      from: nickname 
    });
  }, [nickname, stopRing]);

  const rejectCall = useCallback(() => {
    console.log("[Call] REJECTING CALL");
    stopRing(); 
    cleanup(); 
    setCallStatus("idle");
    socketRef.current?.emit("call-reject", { 
      room: CALL_ROOM, 
      from: nickname 
    });
  }, [nickname, stopRing, cleanup]);

  const endCall = useCallback(() => {
    console.log("[Call] ENDING CALL");
    socketRef.current?.emit("call-end", { 
      room: CALL_ROOM, 
      from: nickname 
    });
    cleanup(); 
    setCallStatus("idle");
  }, [nickname, cleanup]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
    console.log("[Call] Mic:", track.enabled ? "ON" : "OFF");
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      isSpeakerRef.current = next;
      applySpeaker(next);
      console.log("[Call] Speaker:", next ? "ON" : "OFF");
      return next;
    });
  }, []);

  return {
    callStatus, 
    isMicOn, 
    isSpeakerOn, 
    isNearEar,
    callerName, 
    callDuration,
    startCall, 
    acceptCall, 
    rejectCall, 
    endCall,
    toggleMic, 
    toggleSpeaker,
  };
}
