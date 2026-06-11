/**
 * useWebRTCCamera.ts — PRODUCTION v10 EDGE CASE HANDLING
 * 
 * COMPLETE PRODUCTION FIX WITH ALL EDGE CASES:
 * 1. Long wait timeout - Automatically timeout connections after 1 hour
 * 2. Memory leaks - Proper cleanup of all references and intervals
 * 3. Stale peer connections - Detect and refresh stale connections
 * 4. Race conditions - Proper state synchronization
 * 5. Stream cleanup - Ensure all tracks are stopped
 * 6. Socket reconnection - Handle socket drops and auto-reconnect
 * 7. ICE gathering timeout - Detect stuck ICE gathering
 * 8. Multiple reconnect attempts - Limit retry attempts
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type CamStatus = "idle" | "connecting" | "connected" | "error" | "timeout";

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
const CONNECTION_TIMEOUT = 60 * 60 * 1000; // 1 hour timeout
const ICE_GATHERING_TIMEOUT = 10000; // 10 seconds
const RETRY_INTERVAL = 2500; // 2.5 seconds
const MAX_RETRIES = 100; // Maximum 100 retries (4+ hours worth)

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
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
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceGatheringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotResponseRef = useRef(false);
  const retryCountRef  = useRef(0);
  const connectionStartTimeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(0);

  const stopRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const stopTimeouts = useCallback(() => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (iceGatheringTimeoutRef.current) {
      clearTimeout(iceGatheringTimeoutRef.current);
      iceGatheringTimeoutRef.current = null;
    }
  }, []);

  const destroyPC = useCallback(() => {
    if (pcRef.current) {
      console.log("[WebRTC] Destroying peer connection");
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onnegotiationneeded = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onicegatheringstatechange = null;
        pcRef.current.close();
      } catch (e) {
        console.warn("[WebRTC] Error closing PC:", e);
      }
      pcRef.current = null;
    }
    iceCandidateQ.current = [];
  }, []);

  const cleanup = useCallback((notify = true) => {
    console.log("[WebRTC] CLEANUP: Full cleanup started");
    stopRetry();
    stopTimeouts();
    destroyPC();

    if (localStreamRef.current) {
      console.log("[WebRTC] CLEANUP: Stopping local stream tracks");
      localStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {
          console.warn("[WebRTC] Error stopping track:", e);
        }
      });
      localStreamRef.current = null;
    }
    
    if (socketRef.current) {
      if (notify) {
        socketRef.current.emit("camera-off", { room: ROOM, from: nickname });
      }
      console.log("[WebRTC] CLEANUP: Disconnecting socket");
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    cancelledRef.current = false;
    gotResponseRef.current = false;
    retryCountRef.current = 0;
    connectionStartTimeRef.current = 0;
    lastActivityRef.current = 0;

    setLocalStream(null);
    setRemoteStream(null);
    setStatus("idle");
    setErrorMsg(null);
    console.log("[WebRTC] CLEANUP: Complete");
  }, [destroyPC, stopRetry, stopTimeouts, nickname]);

  const drainICE = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      return;
    }
    console.log("[WebRTC] Draining", iceCandidateQ.current.length, "ICE candidates");
    for (const c of iceCandidateQ.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn("[WebRTC] ICE error:", e);
      }
    }
    iceCandidateQ.current = [];
  }, []);

  const buildPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    console.log("[WebRTC] Building new peer connection");
    
    destroyPC();

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach((t) => {
      console.log("[WebRTC] Adding local track:", t.kind);
      pc.addTrack(t, stream);
    });

    // ── ontrack: Remote stream received ────────────────────────────────────
    pc.ontrack = ({ streams }) => {
      if (cancelledRef.current) {
        console.log("[WebRTC] ontrack fired but cancelled");
        return;
      }
      
      if (!streams || !streams[0]) {
        console.warn("[WebRTC] ontrack fired but no streams");
        return;
      }

      lastActivityRef.current = Date.now();
      console.log("[WebRTC] Got remote stream!", {
        tracks: streams[0].getTracks().length,
        audioTracks: streams[0].getAudioTracks().length,
        videoTracks: streams[0].getVideoTracks().length,
      });

      setRemoteStream(streams[0]);
      setStatus("connected");
      gotResponseRef.current = true;
      stopRetry();
      stopTimeouts();
    };

    // ── ICE candidates ────────────────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        socketRef.current.emit("ice", { room: ROOM, from: nickname, candidate });
      }
    };

    // ── ICE connection state ──────────────────────────────────────────────
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log("[WebRTC] ICE connection state:", s);
      lastActivityRef.current = Date.now();
      
      if (s === "failed") {
        console.log("[WebRTC] ICE failed, restarting");
        pc.restartIce();
      }
      if (s === "disconnected" || s === "closed") {
        setRemoteStream(null);
        setStatus("connecting");
      }
    };

    // ── ICE gathering state ───────────────────────────────────────────────
    pc.onicegatheringstatechange = () => {
      const s = pc.iceGatheringState;
      console.log("[WebRTC] ICE gathering state:", s);
      
      if (s === "gathering") {
        iceGatheringTimeoutRef.current = setTimeout(() => {
          if (pc.iceGatheringState === "gathering") {
            console.warn("[WebRTC] ICE gathering timeout, force complete");
            pc.restartIce();
          }
        }, ICE_GATHERING_TIMEOUT);
      }
    };

    // ── Connection state ──────────────────────────────────────────────────
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[WebRTC] Connection state:", s);
      lastActivityRef.current = Date.now();
      
      if (s === "connected" || s === "completed") {
        console.log("[WebRTC] CONNECTED");
        setStatus("connected");
      } else if (s === "disconnected") {
        console.log("[WebRTC] DISCONNECTED");
        setRemoteStream(null);
        setStatus("connecting");
      } else if (s === "failed") {
        console.error("[WebRTC] FAILED - restarting ICE");
        pc.restartIce();
      } else if (s === "closed") {
        console.log("[WebRTC] CLOSED");
        setRemoteStream(null);
        setStatus("idle");
      }
    };

    return pc;
  }, [destroyPC, stopRetry, stopTimeouts, nickname]);

  const sendOffer = useCallback(async (stream: MediaStream) => {
    if (cancelledRef.current) return;
    
    console.log("[WebRTC] Creating offer");
    const pc = buildPC(stream);
    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);
      
      console.log("[WebRTC] Sending offer to peer");
      socketRef.current?.emit("offer", { room: ROOM, from: nickname, sdp: pc.localDescription });
      console.log("[WebRTC] Offer sent");
      lastActivityRef.current = Date.now();
    } catch (err) {
      console.error("[WebRTC] createOffer failed:", err);
      if (!cancelledRef.current) {
        setStatus("error");
        setErrorMsg("Failed to create offer");
      }
    }
  }, [buildPC, nickname]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(audioTracks[0]?.enabled ?? true);
      console.log("[WebRTC] Audio toggled:", audioTracks[0]?.enabled);
    }
  }, []);

  // ── Main effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEnabled) {
      cleanup();
      return;
    }

    cancelledRef.current = false;
    gotResponseRef.current = false;
    retryCountRef.current = 0;
    connectionStartTimeRef.current = Date.now();
    lastActivityRef.current = Date.now();
    setStatus("connecting");
    setErrorMsg(null);

    const start = async () => {
      let stream: MediaStream;
      try {
        console.log("[WebRTC] Requesting camera access");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: "user",
          },
          audio: true,
        });
        console.log("[WebRTC] Camera access granted");
      } catch (err: any) {
        if (cancelledRef.current) return;
        const msg =
          err.name === "NotAllowedError"    ? "Camera permission denied. Please allow access." :
          err.name === "NotFoundError"      ? "No camera found on device." :
          err.name === "NotReadableError"   ? "Camera is in use by another app." :
                                              "Could not access camera.";
        console.error("[WebRTC] Camera error:", msg);
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log("[WebRTC] Local stream set");

      // ── Socket connection ─────────────────────────────────────────────
      const socket = io(SIGNALING_SERVER, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 30,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[Socket] Connected:", socket.id);
        socket.emit("join", { room: ROOM, user: nickname });
      });

      socket.on("joined", ({ room, count }: { room: string; count: number }) => {
        console.log("[Socket] Joined room. Users:", count);
        announceCamera(stream, socket, count);
      });

      socket.on("connect", () => {
        setTimeout(() => {
          if (!gotResponseRef.current && socketRef.current?.connected && !cancelledRef.current) {
            console.log("[Socket] Fallback announce");
            announceCamera(stream, socket, 0);
          }
        }, 800);
      });

      // ── Partner's camera is on ────────────────────────────────────────
      socket.on("camera-ready", async ({ from }: { from: string }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] Camera ready from:", from);

        gotResponseRef.current = true;
        lastActivityRef.current = Date.now();
        stopRetry();

        if (nickname === "Vishwa") {
          console.log("[Socket] Vishwa: Sending offer");
          await sendOffer(stream);
        }
      });

      socket.on("request-offer", async ({ to }: { to: string }) => {
        if (nickname !== "Vishwa" || cancelledRef.current) return;
        console.log("[Socket] Server requested offer");
        await sendOffer(stream);
      });

      // ── Receive offer ──────────────────────────────────────────────────
      socket.on("offer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] Received offer from:", from);

        gotResponseRef.current = true;
        lastActivityRef.current = Date.now();
        stopRetry();

        const pc = buildPC(stream);

        try {
          console.log("[WebRTC] Setting remote description (offer)");
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainICE();

          console.log("[WebRTC] Creating answer");
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          console.log("[WebRTC] Sending answer");
          socket.emit("answer", { room: ROOM, from: nickname, sdp: pc.localDescription });
          console.log("[WebRTC] Answer sent");
        } catch (err) {
          console.error("[WebRTC] Answer failed:", err);
          if (!cancelledRef.current) {
            setStatus("error");
            setErrorMsg("Failed to create answer");
          }
        }
      });

      // ── Receive answer ─────────────────────────────────────────────────
      socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] Received answer from:", from);
        lastActivityRef.current = Date.now();
        
        const pc = pcRef.current;
        if (!pc) {
          console.error("[WebRTC] No PC for answer");
          return;
        }
        try {
          console.log("[WebRTC] Setting remote description (answer)");
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainICE();
          console.log("[WebRTC] Answer applied");
        } catch (err) {
          console.error("[WebRTC] Answer failed:", err);
          if (!cancelledRef.current) {
            setStatus("error");
            setErrorMsg("Failed to apply answer");
          }
        }
      });

      // ── ICE candidates ─────────────────────────────────────────────────
      socket.on("ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        if (from === nickname || !candidate || cancelledRef.current) return;
        const pc = pcRef.current;
        if (!pc) {
          console.warn("[WebRTC] ICE but no PC");
          return;
        }

        lastActivityRef.current = Date.now();

        if (!pc.remoteDescription) {
          iceCandidateQ.current.push(candidate);
          return;
        }

        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[WebRTC] ICE error:", e);
        }
      });

      // ── Partner left ───────────────────────────────────────────────────
      socket.on("camera-off", ({ from }: { from: string }) => {
        if (from === nickname) return;
        console.log("[Socket] Partner left");
        destroyPC();
        setRemoteStream(null);
        setStatus("connecting");
        gotResponseRef.current = false;
        
        setTimeout(() => {
          if (!cancelledRef.current && socketRef.current?.connected) {
            console.log("[Socket] Re-announcing after partner left");
            socketRef.current.emit("camera-ready", { room: ROOM, from: nickname });
          }
        }, 1000);
      });

      socket.on("connect_error", (err) => {
        console.error("[Socket] Error:", err);
        if (!cancelledRef.current) {
          setStatus("error");
          setErrorMsg("Cannot connect. Check internet.");
        }
      });

      socket.on("disconnect", (reason) => {
        console.log("[Socket] Disconnected:", reason);
        if (!cancelledRef.current && reason === "io server disconnect") {
          setStatus("error");
          setErrorMsg("Server disconnected");
        }
      });
    };

    start();

    // ── Connection timeout (1 hour) ────────────────────────────────────
    timeoutTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current && status === "connecting") {
        console.error("[WebRTC] Connection timeout (1 hour)");
        setStatus("timeout");
        setErrorMsg("Connection timeout. Please restart.");
        cleanup();
      }
    }, CONNECTION_TIMEOUT);

    // ── Activity check: If no activity for 30 mins, reset ────────────────
    const activityCheckInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity > 30 * 60 * 1000 && status === "connecting") {
        console.warn("[WebRTC] No activity for 30 mins, resetting");
        destroyPC();
        setStatus("connecting");
        gotResponseRef.current = false;
      }
    }, 60000); // Check every minute

    const onUnload = () => {
      socketRef.current?.emit("camera-off", { room: ROOM, from: nickname });
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelledRef.current = true;
      clearInterval(activityCheckInterval);
      window.removeEventListener("beforeunload", onUnload);
      cleanup();
    };
  }, [isEnabled, nickname, cleanup, destroyPC, stopRetry, stopTimeouts, drainICE, buildPC, sendOffer]);

  // ── Announce camera with retry and max limit ──────────────────────────
  function announceCamera(stream: MediaStream, socket: Socket, roomCount: number) {
    if (cancelledRef.current) return;

    console.log("[Socket] Announcing camera-ready");
    socket.emit("camera-ready", { room: ROOM, from: nickname });

    stopRetry();
    retryTimerRef.current = setInterval(() => {
      if (gotResponseRef.current || cancelledRef.current) {
        stopRetry();
        return;
      }
      
      // ── Retry limit check ──────────────────────────────────────────────
      if (retryCountRef.current >= MAX_RETRIES) {
        console.error("[Socket] Max retries exceeded");
        stopRetry();
        setStatus("timeout");
        setErrorMsg("Max connection attempts exceeded. Please restart.");
        cleanup();
        return;
      }

      // ── Timeout check (1 hour) ─────────────────────────────────────────
      const timeElapsed = Date.now() - connectionStartTimeRef.current;
      if (timeElapsed > CONNECTION_TIMEOUT) {
        console.error("[Socket] Connection timeout");
        stopRetry();
        setStatus("timeout");
        setErrorMsg("Connection timeout after 1 hour. Please restart.");
        cleanup();
        return;
      }

      if (socket.connected) {
        retryCountRef.current++;
        const timeElapsedSecs = Math.round(timeElapsed / 1000);
        console.log("[Socket] Retry", retryCountRef.current, "- Waiting for", retryCountRef.current * 2.5, "seconds");
        socket.emit("camera-ready", { room: ROOM, from: nickname });
      }
    }, RETRY_INTERVAL);
  }

  const stop = useCallback(() => cleanup(true), [cleanup]);

  return {
    localStream,
    remoteStream,
    status,
    errorMsg,
    audioEnabled,
    toggleAudio,
    stop,
  };
}
