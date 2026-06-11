/**
 * useWebRTCCamera.ts — FIXED v3
 *
 * Root cause of v2 failure:
 *  1. "camera-ready" was emitted before socket confirmed join → other side missed it
 *  2. When second user turned on camera, first user's hook didn't react
 *  3. Race condition: offer sent before remote peer had a PeerConnection ready
 *
 * Fix strategy:
 *  - On connect: emit "join", wait for server's "joined" ack, THEN emit "camera-ready"
 *  - On "camera-ready": BOTH peers build a PC. Vishwa sends offer. Ammu waits for offer.
 *  - On "request-offer": server tells the late-joiner to request a fresh offer
 *  - Retry "camera-ready" every 2s until we get a response (handles timing gaps)
 *  - Full ICE candidate queuing
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

  const socketRef      = useRef<Socket | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQ  = useRef<RTCIceCandidateInit[]>([]);
  const cancelledRef   = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const gotResponseRef = useRef(false); // did the other side acknowledge our camera-ready?

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
    if (!pc || !pc.remoteDescription) return;
    for (const c of iceCandidateQ.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    iceCandidateQ.current = [];
  }, []);

  // ── Build a fresh RTCPeerConnection ───────────────────────────────────────
  const buildPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    destroyPC(); // always destroy old one first

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // Add our local tracks so peer receives our video
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Receive remote video
    pc.ontrack = ({ streams }) => {
      if (streams[0] && !cancelledRef.current) {
        console.log("[WebRTC] ✅ Got remote stream!");
        setRemoteStream(streams[0]);
        setStatus("connected");
        gotResponseRef.current = true;
        stopRetry();
      }
    };

    // Send ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        socketRef.current.emit("ice", { room: ROOM, from: nickname, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log("[WebRTC] state →", s);
      if (s === "failed") pc.restartIce();
      if (s === "disconnected") {
        setRemoteStream(null);
        setStatus("connecting");
      }
    };

    return pc;
  }, [destroyPC, stopRetry, nickname]);

  // ── Create and send an offer ──────────────────────────────────────────────
  const sendOffer = useCallback(async (stream: MediaStream) => {
    const pc = buildPC(stream);
    try {
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("offer", { room: ROOM, from: nickname, sdp: pc.localDescription });
      console.log("[WebRTC] 📡 Offer sent");
    } catch (err) {
      console.error("[WebRTC] createOffer failed:", err);
    }
  }, [buildPC, nickname]);

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
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width:  { ideal: 1280, max: 1920 },
            height: { ideal: 720,  max: 1080 },
            facingMode: "user",
          },
          audio: false,
        });
      } catch (err: any) {
        if (cancelledRef.current) return;
        const msg =
          err.name === "NotAllowedError"    ? "Camera permission denied. Please allow access and try again." :
          err.name === "NotFoundError"      ? "No camera found on this device." :
          err.name === "NotReadableError"   ? "Camera is in use by another app. Close it and try again." :
                                             "Could not access camera.";
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Connect to signaling server
      const socket = io(SIGNALING_SERVER, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      // ── Socket events ───────────────────────────────────────────────────

      // 3. On connect → join room, then announce camera
      socket.on("connect", () => {
        console.log("[Socket] ✅ Connected:", socket.id);
        socket.emit("join", { room: ROOM, user: nickname });

        // Wait for join confirmation before announcing camera
        // (server will emit "joined" or we wait 500ms as fallback)
      });

      // 4. Server confirms we joined → NOW announce camera
      socket.on("joined", ({ room, count }: { room: string; count: number }) => {
        console.log(`[Socket] Joined room. Users in room: ${count}`);
        announceCamera(stream, socket, count);
      });

      // Fallback: if server doesn't emit "joined", try after 800ms
      socket.on("connect", () => {
        setTimeout(() => {
          if (!gotResponseRef.current && socketRef.current?.connected) {
            console.log("[Socket] Fallback announce after 800ms");
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
          await sendOffer(stream);
        }
        // Ammu waits for Vishwa's offer (handled in "offer" event)
        // But if Ammu joined first and Vishwa is already there, Vishwa should offer
        // → server sends "request-offer" to Vishwa
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
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainICE();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", { room: ROOM, from: nickname, sdp: pc.localDescription });
          console.log("[WebRTC] 📡 Answer sent");
        } catch (err) {
          console.error("[WebRTC] answer failed:", err);
        }
      });

      // 8. Received answer (Vishwa receives this)
      socket.on("answer", async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
        if (from === nickname || cancelledRef.current) return;
        console.log("[Socket] 📨 Received answer from:", from);
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          await drainICE();
        } catch (err) {
          console.error("[WebRTC] setRemoteDescription(answer) failed:", err);
        }
      });

      // 9. ICE candidates
      socket.on("ice", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        if (from === nickname || !candidate) return;
        const pc = pcRef.current;
        if (!pc) return;

        if (!pc.remoteDescription) {
          iceCandidateQ.current.push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
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
            socketRef.current.emit("camera-ready", { room: ROOM, from: nickname });
          }
        }, 1000);
      });

      socket.on("connect_error", (err) => {
        console.error("[Socket] connect error:", err);
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
  }, [isEnabled, nickname]); // eslint-disable-line

  // ── Announce camera with retry until other side responds ──────────────────
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

  return { localStream, remoteStream, status, errorMsg, stop };
}