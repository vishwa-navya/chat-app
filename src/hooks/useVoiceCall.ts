/**
 * useVoiceCall.ts
 * WebRTC audio-only call hook
 *
 * Flow:
 *  Caller clicks phone → emits "call-user" → Receiver sees incoming call UI
 *  Receiver accepts    → emits "call-accepted" → Caller creates offer
 *  WebRTC offer/answer/ICE exchange → audio streams peer-to-peer
 *
 * Proximity sensor: uses DeviceProximity / userproximity event to detect
 * phone near ear → screen dims (we emit a state for UI to hide buttons)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type CallStatus =
  | "idle"
  | "calling"       // we are calling, waiting for other to pick up
  | "incoming"      // other person is calling us
  | "connected"     // in call
  | "ended"
  | "busy"          // other user is offline
  | "error";

export interface UseVoiceCallReturn {
  callStatus:    CallStatus;
  remoteStream:  MediaStream | null;
  localStream:   MediaStream | null;
  isMicOn:       boolean;
  isSpeakerOn:   boolean;
  isNearEar:     boolean;       // proximity sensor — hide UI when true
  callerName:    string | null; // who is calling us
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
    { urls: "turn:openrelay.metered.ca:80",    username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443",   username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export function useVoiceCall(nickname: "Vishwa" | "Ammu"): UseVoiceCallReturn {
  const [callStatus,   setCallStatus]   = useState<CallStatus>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [isMicOn,      setIsMicOn]      = useState(true);   // mic ON by default
  const [isSpeakerOn,  setIsSpeakerOn]  = useState(false);  // speaker OFF by default
  const [isNearEar,    setIsNearEar]    = useState(false);
  const [callerName,   setCallerName]   = useState<string | null>(null);

  const socketRef      = useRef<Socket | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudioRef   = useRef<HTMLAudioElement | null>(null);
  const cancelledRef   = useRef(false);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Ring sound ─────────────────────────────────────────────────────────────
  const startRinging = () => {
    try {
      if (!ringAudioRef.current) {
        ringAudioRef.current = new Audio();
        // Simple beep pattern using Web Audio API as fallback
        ringAudioRef.current.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA..."; 
      }
      ringAudioRef.current.loop = true;
      ringAudioRef.current.play().catch(() => {});
    } catch {}
  };

  const stopRinging = () => {
    try {
      if (ringAudioRef.current) {
        ringAudioRef.current.pause();
        ringAudioRef.current.currentTime = 0;
      }
    } catch {}
  };

  // ── Proximity sensor (screen near ear → hide UI) ───────────────────────────
  useEffect(() => {
    const handleProximity = (e: any) => {
      // near = true means phone is near face
      setIsNearEar(e.near ?? (e.value < 5));
    };

    // Modern API
    if ("ProximitySensor" in window) {
      try {
        const sensor = new (window as any).ProximitySensor();
        sensor.addEventListener("reading", () => {
          setIsNearEar(sensor.near);
        });
        sensor.start();
        return () => sensor.stop();
      } catch {}
    }

    // Legacy API
    window.addEventListener("deviceproximity", handleProximity);
    window.addEventListener("userproximity",   handleProximity);
    return () => {
      window.removeEventListener("deviceproximity", handleProximity);
      window.removeEventListener("userproximity",   handleProximity);
    };
  }, []);

  // ── Setup socket (persistent connection) ──────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    const socket = io(SIGNALING_SERVER, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Call Socket] Connected:", socket.id);
      socket.emit("call-join", { room: CALL_ROOM, user: nickname });
    });

    // ── Incoming call ────────────────────────────────────────────────────────
    socket.on("call-incoming", ({ from }: { from: string }) => {
      console.log("[Call] Incoming from:", from);
      stopRinging();
      startRinging();
      setCallerName(from);
      setCallStatus("incoming");
    });

    // ── Caller: other user accepted ──────────────────────────────────────────
    socket.on("call-accepted", async ({ from }: { from: string }) => {
      console.log("[Call] Accepted by:", from);
      stopRinging();
      // Caller creates offer
      await initLocalAudio();
      await createAndSendOffer();
    });

    // ── Caller: other user rejected ──────────────────────────────────────────
    socket.on("call-rejected", () => {
      console.log("[Call] Rejected");
      stopRinging();
      cleanupCall();
      setCallStatus("ended");
      setTimeout(() => setCallStatus("idle"), 3000);
    });

    // ── Caller: other user is offline ────────────────────────────────────────
    socket.on("call-user-offline", () => {
      console.log("[Call] User offline");
      stopRinging();
      cleanupCall();
      setCallStatus("busy");
      setTimeout(() => setCallStatus("idle"), 3000);
    });

    // ── WebRTC offer (receiver gets this) ────────────────────────────────────
    socket.on("call-offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      console.log("[Call] Offer from:", from);
      await initLocalAudio();
      const pc = buildPC();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
        console.log("[Call] Answer sent");
      } catch (err) {
        console.error("[Call] Answer error:", err);
      }
    });

    // ── WebRTC answer (caller gets this) ─────────────────────────────────────
    socket.on("call-answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      console.log("[Call] Answer from:", from);
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainICE();
      } catch (err) {
        console.error("[Call] setRemoteDescription(answer) error:", err);
      }
    });

    // ── ICE candidate ────────────────────────────────────────────────────────
    socket.on("call-ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from === nickname || !candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription) { iceCandidateQ.current.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // ── Call ended by other side ─────────────────────────────────────────────
    socket.on("call-ended", ({ from }: { from: string }) => {
      console.log("[Call] Ended by:", from);
      stopRinging();
      cleanupCall();
      setCallStatus("ended");
      setTimeout(() => setCallStatus("idle"), 2000);
    });

    return () => {
      cancelledRef.current = true;
      stopRinging();
      cleanupCall();
      socket.disconnect();
    };
  }, [nickname]);

  // ── Get microphone ─────────────────────────────────────────────────────────
  const initLocalAudio = async () => {
    if (localStreamRef.current) return; // already have it
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          latency:          0,
          channelCount:     1,
          sampleRate:       48000,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMicOn(true);
      console.log("[Call] Got local audio stream");
    } catch (err) {
      console.error("[Call] Mic access failed:", err);
    }
  };

  // ── Build RTCPeerConnection ────────────────────────────────────────────────
  const buildPC = (): RTCPeerConnection => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQ.current = [];

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // Add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    }

    // Receive remote audio
    pc.ontrack = ({ streams }) => {
      if (streams[0] && !cancelledRef.current) {
        console.log("[Call] ✅ Remote audio stream received!");
        setRemoteStream(streams[0]);
        setCallStatus("connected");
        playRemoteAudio(streams[0]);
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
      if (s === "disconnected") {
        setCallStatus("ended");
        setTimeout(() => setCallStatus("idle"), 2000);
      }
    };

    return pc;
  };

  // ── Play remote audio through <audio> element ─────────────────────────────
  const playRemoteAudio = (stream: MediaStream) => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      // Auto-attach to DOM for better browser support
      remoteAudioRef.current.style.display = "none";
      document.body.appendChild(remoteAudioRef.current);
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.muted = !isSpeakerOn; // respect speaker state
    remoteAudioRef.current.play().catch(console.error);
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
    const pc = buildPC();
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("call-offer", { room: CALL_ROOM, from: nickname, sdp: pc.localDescription });
      console.log("[Call] Offer sent");
    } catch (err) {
      console.error("[Call] createOffer error:", err);
    }
  };

  const cleanupCall = () => {
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
  };

  // ── Public actions ─────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!socketRef.current) return;
    console.log("[Call] Starting call to:", other);
    setCallStatus("calling");
    startRinging();
    socketRef.current.emit("call-user", { room: CALL_ROOM, from: nickname, to: other });
    await initLocalAudio();
  }, [nickname, other]);

  const acceptCall = useCallback(async () => {
    console.log("[Call] Accepting call");
    stopRinging();
    setCallStatus("connected");
    socketRef.current?.emit("call-accept", { room: CALL_ROOM, from: nickname });
  }, [nickname]);

  const rejectCall = useCallback(() => {
    console.log("[Call] Rejecting call");
    stopRinging();
    setCallStatus("idle");
    setCallerName(null);
    socketRef.current?.emit("call-reject", { room: CALL_ROOM, from: nickname });
  }, [nickname]);

  const endCall = useCallback(() => {
    console.log("[Call] Ending call");
    stopRinging();
    socketRef.current?.emit("call-end", { room: CALL_ROOM, from: nickname });
    cleanupCall();
    setCallStatus("idle");
  }, [nickname]);

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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !next;
        // On mobile: switch between earpiece and speaker
        if ((remoteAudioRef.current as any).setSinkId) {
          (remoteAudioRef.current as any).setSinkId(next ? "default" : "earpiece").catch(() => {});
        }
      }
      console.log("[Call] Speaker:", next ? "ON" : "OFF");
      return next;
    });
  }, []);

  return {
    callStatus, remoteStream, localStream,
    isMicOn, isSpeakerOn, isNearEar, callerName,
    startCall, acceptCall, rejectCall, endCall,
    toggleMic, toggleSpeaker,
  };
}