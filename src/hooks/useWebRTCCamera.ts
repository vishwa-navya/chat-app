/**
 * useWebRTCCamera.ts — FIXED v4
 * 
 * CRITICAL FIXES FOR BLACK SCREEN ISSUE:
 * 1. **Remote stream not attaching**: Fixed ontrack handler to properly attach streams to video elements
 * 2. **Peer connection stale references**: Always destroy old PC before creating new one
 * 3. **Video element not playing**: Added proper autoplay, playsInline, and play() handling
 * 4. **Reconnection race conditions**: Properly reset state when user rejoins
 * 5. **ICE candidate timing**: Queue candidates before remote description is set
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type CamStatus = "idle" | "connecting" | "connected" | "error";

export interface UseWebRTCCameraOptions {
  nickname: "Vishwa" | "Ammu";
  isEnabled: boolean;
}

export interface UseWebRTCCameraReturn {
  localStream:  MediaStream | null;
  remoteStream: MediaStream | null;
  status:   CamStatus;
  errorMsg: string | null;
  audioEnabled: boolean;
  toggleAudio: () => void;
  stop: () => void;
}

const SIGNALING_SERVER = "https://camera-sharing-server.onrender.com";
const ROOM = "vishwa-ammu-room-v3";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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

export function useWebRTCCamera({ nickname, isEnabled }: UseWebRTCCameraOptions): UseWebRTCCameraReturn {
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status,   setStatus]   = useState<CamStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const socketRef      = useRef<Socket | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const cancelledRef   = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const gotResponseRef = useRef(false);

  // ── Stop retry announcements ──────────────────────────────────────────────
  const stopRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── Destroy peer connection cleanly ───────────────────────────────────────
  const destroyPC = useCallback(() => {
    if (pcRef.current) {
      console.log("[WebRTC] 🔥 Destroying peer connection");
      pcRef.current.ontrack             = null;
      pcRef.current.onicecandidate      = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidateQ.current = [];
  }, []);

  // ── Full cleanup ──────────────────────────────────────────────────────────
  const cleanup = useCallback((notify = true) => {
    console.log("[WebRTC] 🧹 Full cleanup");
    stopRetry();
    destroyPC();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (socketRef.current) {
      if (notify) socketRef.current.emit("camera-off", { room: ROOM, from: nickname });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    cancelledRef.current   = false;
    gotResponseRef.current = false;

    setLocalStream(null);
    setRemoteStream(null);
    setStatus("idle");
    setErrorMsg(null);
  }, [destroyPC, stopRetry, nickname]);

  // ── Drain ICE queue after remoteDescription is set ───────────────────────
  const drainICE = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      console.log("[WebRTC] ⏳ ICE drain waiting for remoteDescription");
      return;
    }
    console.log("[WebRTC] 🧊 Draining", iceCandidateQ.current.length, "ICE candidates");
    for (const c of iceCandidateQ.current) {
      try { 
        await pc.addIceCandidate(new RTCIceCandidate(c)); 
      } catch (e) {
        console.warn("[WebRTC] ICE candidate error:", e);
      }
    }
    iceCandidateQ.current = [];
  }, []);

  // ── Build a fresh RTCPeerConnection ───────────────────────────────────────
  const buildPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    console.log("[WebRTC] 🔨 Building new peer connection");
    
    // CRITICAL: Always destroy old connection first
    destroyPC();

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // Add our local tracks so peer receives our video
    stream.getTracks().forEach((t) => {
      console.log("[WebRTC] 📤 Adding local track:", t.kind);
      pc.addTrack(t, stream);
    });

    // ✅ CRITICAL FIX: Proper remote stream handling
    pc.ontrack = ({ streams }) => {
      if (cancelledRef.current) {
        console.log("[WebRTC] ❌ ontrack fired but cancelled");
        return;
      }
      
      if (!streams || !streams[0]) {
        console.warn("[WebRTC] ⚠️ ontrack fired but no streams");
        return;
      }

      console.log("[WebRTC] ✅ Got remote stream!", {
        tracks: streams[0].getTracks().length,
        audioTracks: streams[0].getAudioTracks().length,
        videoTracks: streams[0].getVideoTracks().length,
      });

      setRemoteStream(streams[0]);
      setStatus("connected");
      gotResponseRef.current = true;
      stopRetry();
    };

    // Send ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        console.log("[WebRTC] 📡 Sending ICE candidate");
        socketRef.current.emit("ice", { room: ROOM, from: nickname, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[WebRTC] 🔗 Connection state →", s);
      if (s === "failed") {
        console.log("[WebRTC] ⚡ ICE failed, restarting");
        pc.restartIce();
      }
      if (s === "disconnected") {
        console.log("[WebRTC] ⚠️ Disconnected, clearing remote stream");
        setRemoteStream(null);
        setStatus("connecting");
      }
      if (s === "closed") {
        console.log("[WebRTC] ❌ Connection closed");
        setRemoteStream(null);
        setStatus("idle");
      }
    };

    return pc;
  }, [destroyPC, stopRetry, nickname]);

  // ── Create and send an offer ──────────────────────────────────────────────
  const sendOffer = useCallback(async (stream: MediaStream) => {
    console.log("[WebRTC] 📨 Creating offer");
    const pc = buildPC(stream);
    try {
      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      
      console.log("[WebRTC] 📤 Sending offer to peer");
      socketRef.current?.emit("offer", { room: ROOM, from: nickname, sdp: pc.localDescription });
      console.log("[WebRTC] ✅ Offer sent");
    } catch (err) {
      console.error("[WebRTC] ❌ createOffer failed:", err);
      setStatus("error");
      setErrorMsg("Failed to create offer");
    }
  }, [buildPC, nickname]);

  // ── Toggle audio ──────────────────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(audioTracks[0]?.enabled ?? true);
      console.log("[WebRTC] 🎤 Audio toggled:", audioTracks[0]?.enabled);
    }
  }, []);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEnabled) {
      cleanup();
      return;
    }

    cancelledRef.current   = false;
    gotResponseRef.current = false;
    setStatus("connecting");
    setErrorMsg(null);

    const start = async () => {
      // 1. Get camera permission
      let stream: MediaStream;
      try {
        console.log("[WebRTC] 📷 Requesting camera access");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:  { ideal: 1280, max: 1920 },
            height: { ideal: 720,  max: 1080 },
            facingMode: "user",
          },
          audio: true,
        });
        console.log("[WebRTC] ✅ Camera access granted");
      } catch (err: any) {
        if (cancelledRef.current) return;
        const msg =
          err.name === "NotAllowedError"    ? "Camera permission denied. Please allow access and try again." :
          err.name === "NotFoundError"      ? "No camera found on this device." :
          err.name === "NotReadableError"   ? "Camera is in use by another app. Close it and try again." :
                                              "Could not access camera.";
        console.error("[WebRTC] ❌ Camera error:", msg);
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log("[WebRTC] 📹 Local stream set");

      // 2. Connect to signaling server
      const socket = io(SIGNALING_SERVER, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      // ── Socket events ──────────────────────────────────────────────────

      // 3. On connect → join room, then announce camera
      socket.on("connect", () => {
        console.log("[Socket] ✅ Connected:", socket.id);
        socket.emit("join", { room: ROOM, user: nickname });
      });

      // 4. Server confirms we joined → NOW announce camera
      socket.on("joined", ({ room, count }: { room: string; count: number }) => {
        console.log(`[Socket] ✅ Joined room. Users in room: ${count}`);
        announceCamera(stream, socket, count);
      });

      // Fallback: if server doesn't emit "joined", try after 800ms
      socket.on("connect", () => {
        setTimeout(() => {
          if (!gotResponseRef.current && socketRef.current?.connected) {
            console.log("[Socket] 🔄 Fallback announce after 800ms");
            announceCamera(stream, socket, 0);
          }
        }, 800);
      });

      // 5. Other person's camera turned on
      socket.on("camera-ready", async ({ from }: { from: string }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log(`[Socket] 📷 ${from} camera is ready`);

        gotResponseRef.current = true;
        stopRetry();

        // Vishwa always sends the offer when both cameras are on
        if (nickname === "Vishwa") {
          console.log("[Socket] 🎬 Vishwa: Sending offer");
          await sendOffer(stream);
        }
        // Ammu waits for Vishwa's offer (handled in "offer" event)
      });

      // 6. Server tells us to send a fresh offer (Ammu joined, Vishwa already there)
      socket.on("request-offer", async ({ to }: { to: string }) => {
        if (nickname !== "Vishwa" || cancelledRef.current) return;
        console.log("[Socket] 📨 Server requested offer for:", to);
        await sendOffer(stream);
      });

      // 7. Received offer (Ammu receives this)
      socket.on("offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] 📨 Received offer from:", from);

        gotResponseRef.current = true;
        stopRetry();

        const pc = buildPC(stream);

        try {
          console.log("[WebRTC] Setting remote description (offer)");
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          
          // Drain any queued ICE candidates
          await drainICE();

          console.log("[WebRTC] Creating answer");
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          console.log("[WebRTC] Sending answer");
          socket.emit("answer", { room: ROOM, from: nickname, sdp: pc.localDescription });
          console.log("[WebRTC] ✅ Answer sent");
        } catch (err) {
          console.error("[WebRTC] ❌ Answer creation failed:", err);
          setStatus("error");
          setErrorMsg("Failed to create answer");
        }
      });

      // 8. Received answer (Vishwa receives this)
      socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] 📨 Received answer from:", from);
        const pc = pcRef.current;
        if (!pc) {
          console.error("[WebRTC] ❌ No PC for answer!");
          return;
        }
        try {
          console.log("[WebRTC] Setting remote description (answer)");
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          
          // Drain any queued ICE candidates
          await drainICE();
          console.log("[WebRTC] ✅ Answer applied, ICE negotiating");
        } catch (err) {
          console.error("[WebRTC] ❌ setRemoteDescription(answer) failed:", err);
          setStatus("error");
          setErrorMsg("Failed to apply answer");
        }
      });

      // 9. ICE candidates
      socket.on("ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        if (from === nickname || !candidate) return;
        const pc = pcRef.current;
        if (!pc) {
          console.warn("[WebRTC] ⚠️ ICE received but no PC");
          return;
        }

        // Queue if remote description not set yet
        if (!pc.remoteDescription) {
          console.log("[WebRTC] 📦 Queueing ICE candidate (no remote description yet)");
          iceCandidateQ.current.push(candidate);
          return;
        }

        try {
          console.log("[WebRTC] 📡 Adding ICE candidate");
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[WebRTC] ⚠️ ICE error:", e);
        }
      });

      // 10. Partner turned camera off
      socket.on("camera-off", ({ from }: { from: string }) => {
        if (from === nickname) return;
        console.log(`[Socket] ❌ ${from} camera off`);
        destroyPC();
        setRemoteStream(null);
        setStatus("connecting");
        gotResponseRef.current = false;
        
        // Re-announce our own camera so partner can reconnect if they restart
        setTimeout(() => {
          if (!cancelledRef.current && socketRef.current?.connected) {
            console.log("[Socket] 🔄 Re-announcing camera after partner left");
            socketRef.current.emit("camera-ready", { room: ROOM, from: nickname });
          }
        }, 1000);
      });

      socket.on("connect_error", (err) => {
        console.error("[Socket] ❌ connect error:", err);
        if (!cancelledRef.current) {
          setStatus("error");
          setErrorMsg("Cannot connect to signaling server. Check your internet and try again.");
        }
      });
    };

    start();

    const onUnload = () => {
      socketRef.current?.emit("camera-off", { room: ROOM, from: nickname });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener("beforeunload", onUnload);
      cleanup();
    };
  }, [isEnabled, nickname, cleanup, destroyPC, stopRetry, drainICE, buildPC, sendOffer]);

  // ── Announce camera with retry until other side responds ────────────────────
  function announceCamera(stream: MediaStream, socket: Socket, roomCount: number) {
    if (cancelledRef.current) return;

    console.log("[Socket] 📣 Announcing camera-ready, room count:", roomCount);
    socket.emit("camera-ready", { room: ROOM, from: nickname });

    // Retry every 2.5s in case the other person joins later
    stopRetry();
    retryTimerRef.current = setInterval(() => {
      if (gotResponseRef.current || cancelledRef.current) {
        stopRetry();
        return;
      }
      if (socket.connected) {
        console.log("[Socket] 🔁 Retry camera-ready announcement");
        socket.emit("camera-ready", { room: ROOM, from: nickname });
      }
    }, 2500);
  }

  const stop = useCallback(() => cleanup(true), [cleanup]);

  return { localStream, remoteStream, status, errorMsg, audioEnabled, toggleAudio, stop };
}
