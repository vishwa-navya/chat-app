/**
 * CameraShareOverlay.tsx — v7 (FIXED: Remote stream attachment)
 *
 * CRITICAL FIXES:
 * - Remote video element now properly attaches streams immediately on ontrack
 * - Fixed black screen issue by ensuring autoPlay, playsInline, and proper srcObject binding
 * - Speaker (🔊) button toggles remote audio
 * - Mic button (🎤) toggles your microphone
 * - Both default to OFF for privacy
 * - Draggable on mouse + touch
 * - Remote video plays with zero-buffer autoplay
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize2, Minimize2, X, Video, VideoOff,
  Loader2, WifiOff, Volume2, VolumeX, Mic, MicOff,
} from "lucide-react";
import type { CamStatus } from "../hooks/useWebRTCCamera";

interface CameraShareOverlayProps {
  localStream:  MediaStream | null;
  remoteStream: MediaStream | null;
  status:       CamStatus;
  errorMsg:     string | null;
  nickname:     "Vishwa" | "Ammu";
  isEnabled:    boolean;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onClose:       () => void;
}

// ─── Toast ────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, background: "linear-gradient(135deg,#10b981,#059669)",
      color: "#fff", padding: "8px 18px", borderRadius: 999, fontSize: 13,
      fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "toastIn .3s ease", whiteSpace: "nowrap", pointerEvents: "none",
    }}>
      <Video style={{ width: 14, height: 14 }} />
      {msg}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ─── Video element — FIXED for proper stream attachment ─────────────────────

function Vid({ stream, muted = false, style, label }: {
  stream: MediaStream | null; muted?: boolean;
  style?: React.CSSProperties; label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    console.log("[Vid] Setting stream:", {
      hasStream: !!stream,
      tracks: stream?.getTracks().length ?? 0,
      videoTracks: stream?.getVideoTracks().length ?? 0,
      audioTracks: stream?.getAudioTracks().length ?? 0,
    });

    if (stream) {
      // CRITICAL: Set srcObject
      el.srcObject = stream;

      // Ensure attributes are correct
      el.autoplay = true;
      el.playsInline = true;
      el.controls = false;

      // Play immediately
      el.play().then(() => {
        console.log("[Vid] ✅ Video playing");
      }).catch((err) => {
        console.warn("[Vid] ⚠️ play() error:", err);
      });
    } else {
      console.log("[Vid] Clearing stream");
      el.srcObject = null;
      el.pause();
    }
  }, [stream]);

  // When muted prop changes, update the element directly
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.muted = muted;
      console.log("[Vid] Muted updated:", muted);
    }
  }, [muted]);

  return (
    <div style={{ position: "relative", ...style }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          backgroundColor: "#000",
        }}
      />
      {label && (
        <span style={{
          position: "absolute", bottom: 4, left: 6, fontSize: 10,
          color: "rgba(255,255,255,0.9)", background: "rgba(0,0,0,0.5)",
          borderRadius: 4, padding: "1px 6px", pointerEvents: "none", fontWeight: 600,
        }}>{label}</span>
      )}
    </div>
  );
}

// ─── No-remote placeholder ────────────────────────────────────────────────────

function NoRemote({ status, errorMsg, other }: { status: CamStatus; errorMsg: string | null; other: string }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10, padding: 16, textAlign: "center",
    }}>
      {status === "connecting" ? (
        <>
          <Loader2 size={32} color="#22c55e" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Waiting for {other} to turn on camera…</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
      ) : status === "error" ? (
        <>
          <WifiOff size={28} color="#f87171" />
          <span style={{ color: "#fca5a5", fontSize: 11, lineHeight: 1.4 }}>{errorMsg}</span>
        </>
      ) : (
        <>
          <VideoOff size={28} color="rgba(255,255,255,0.2)" />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{other} hasn't turned camera on yet</span>
        </>
      )}
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────

function Btn({ children, onClick, title, danger = false, active = false }: {
  children: React.ReactNode; onClick: () => void;
  title?: string; danger?: boolean; active?: boolean;
}) {
  const bg = danger
    ? "rgba(239,68,68,0.85)"
    : active
    ? "rgba(34,197,94,0.85)"
    : "rgba(255,255,255,0.22)";

  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, borderRadius: "50%", border: "none", cursor: "pointer",
      background: bg, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, transition: "background .15s, transform .1s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CameraShareOverlay({
  localStream, remoteStream, status, errorMsg,
  nickname, isEnabled,
  audioEnabled, onToggleAudio,
  onClose,
}: CameraShareOverlayProps) {

  const [speakerOn, setSpeakerOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized,  setMinimized]  = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";

  // ── Drag ───────────────────────────────────────────────────────────────────
  const boxRef     = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0 });
  const boxStart   = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const getDefaultPos = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    const W = isMobile ? 240 : 280;
    const H = Math.round(W * 3 / 4);
    return isMobile
      ? { x: Math.round((window.innerWidth - W) / 2), y: window.innerHeight - H - 140 }
      : { x: window.innerWidth - W - 20,              y: Math.round((window.innerHeight - H) / 2) };
  }, []);

  useEffect(() => {
    if (isEnabled && !fullscreen && !minimized) setPos(p => p ?? getDefaultPos());
  }, [isEnabled, fullscreen, minimized, getDefaultPos]);

  useEffect(() => { if (!fullscreen) setPos(getDefaultPos()); }, [fullscreen, getDefaultPos]);

  const clamp = useCallback((x: number, y: number) => {
    const W = boxRef.current?.offsetWidth  ?? 280;
    const H = boxRef.current?.offsetHeight ?? 210;
    return {
      x: Math.max(0, Math.min(x, window.innerWidth  - W)),
      y: Math.max(0, Math.min(y, window.innerHeight - H)),
    };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, y: e.clientY };
    boxStart.current   = pos ?? getDefaultPos();
  }, [pos, getDefaultPos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPos(clamp(boxStart.current.x + e.clientX - dragStart.current.x,
                   boxStart.current.y + e.clientY - dragStart.current.y));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [clamp]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const t = e.touches[0];
    isDragging.current = true;
    dragStart.current  = { x: t.clientX, y: t.clientY };
    boxStart.current   = pos ?? getDefaultPos();
  }, [pos, getDefaultPos]);

  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      setPos(clamp(boxStart.current.x + t.clientX - dragStart.current.x,
                   boxStart.current.y + t.clientY - dragStart.current.y));
    };
    const onEnd = () => { isDragging.current = false; };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onEnd);
    return () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
  }, [clamp]);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const prevRemote  = useRef<MediaStream | null>(null);
  const prevEnabled = useRef(false);

  useEffect(() => {
    if (isEnabled && !prevEnabled.current) setToast(`${nickname} started camera sharing`);
    prevEnabled.current = isEnabled;
  }, [isEnabled, nickname]);

  useEffect(() => {
    if (remoteStream  && !prevRemote.current) setToast(`${other} started camera sharing`);
    if (!remoteStream &&  prevRemote.current) setToast(`${other} stopped camera sharing`);
    prevRemote.current = remoteStream;
  }, [remoteStream, other]);

  const handleClose = () => { setToast(`${nickname} stopped camera sharing`); setTimeout(onClose, 300); };

  if (!isEnabled && !localStream && !remoteStream) return null;

  const dotColor =
    status === "connected" && remoteStream ? "#22c55e" :
    status === "connecting"               ? "#facc15" :
    status === "error"                    ? "#ef4444" : "#9ca3af";

  // ── Shared control bar ─────────────────────────────────────────────────────
  const ControlBar = ({ inFullscreen = false }: { inFullscreen?: boolean }) => (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: inFullscreen ? "12px 14px" : "7px 8px",
      background: "linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)",
    }}>
      {/* Status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block",
          boxShadow: status === "connected" && remoteStream ? "0 0 6px #22c55e" : "none",
        }} />
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: inFullscreen ? 13 : 11, fontWeight: 600 }}>
          {status === "connected" && remoteStream ? "Live"
            : status === "connecting" ? "Connecting…"
            : status === "error"      ? "Error"
            : "Camera On"}
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: inFullscreen ? 8 : 4, alignItems: "center" }}>

        {/* 🎤 Mic button — toggles YOUR microphone */}
        <Btn
          title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={onToggleAudio}
          active={audioEnabled}
        >
          {audioEnabled ? <Mic size={12} /> : <MicOff size={12} />}
        </Btn>

        {/* 🔊 Speaker button — toggles hearing the other person */}
        <Btn
          title={speakerOn ? "Mute speaker" : "Turn on speaker to hear other person"}
          onClick={() => setSpeakerOn(s => !s)}
          active={speakerOn}
        >
          {speakerOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </Btn>

        {/* Fullscreen / exit fullscreen */}
        {!inFullscreen ? (
          <Btn title="Fullscreen" onClick={() => { setFullscreen(true); setMinimized(false); }}>
            <Maximize2 size={12} />
          </Btn>
        ) : (
          <Btn title="Exit fullscreen" onClick={() => setFullscreen(false)}>
            <Minimize2 size={12} />
          </Btn>
        )}

        {/* Minimize (only in floating mode) */}
        {!inFullscreen && (
          <Btn title="Minimize" onClick={() => { setMinimized(true); setFullscreen(false); }}>
            <Minimize2 size={12} />
          </Btn>
        )}

        {/* Close */}
        <Btn title="Stop camera sharing" onClick={handleClose} danger>
          <X size={12} />
        </Btn>
      </div>
    </div>
  );

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <>
        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#000", display: "flex", flexDirection: "column" }}>
          <ControlBar inFullscreen />
          <div style={{ flex: 1, position: "relative" }}>
            {remoteStream
              ? <Vid stream={remoteStream} muted={!speakerOn}
                     style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                     label={other} />
              : <NoRemote status={status} errorMsg={errorMsg} other={other} />}
          </div>
          {localStream && (
            <div style={{
              position: "absolute", bottom: 20, right: 20,
              width: 130, height: 98, borderRadius: 10, overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.35)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}>
              <Vid stream={localStream} muted style={{ width: 130, height: 98 }} label="You" />
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Minimized pill ────────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <>
        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
        <div
          onClick={() => setMinimized(false)}
          title="Expand camera"
          style={{
            position: "fixed",
            top: pos?.y ?? undefined, left: pos?.x ?? undefined,
            bottom: pos ? undefined : 110, right: pos ? undefined : 20,
            zIndex: 500,
            background: "linear-gradient(135deg,#10b981,#059669)",
            borderRadius: 999, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", userSelect: "none",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)" }}>
            {localStream ? <Vid stream={localStream} muted style={{ width: 28, height: 28 }} /> : <Video size={14} color="#fff" />}
          </div>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>Camera</span>
          {remoteStream && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block" }} />}
        </div>
      </>
    );
  }

  // ── Floating draggable window ──────────────────────────────────────────────
  const W = window.innerWidth < 768 ? 240 : 280;
  const defaultPos = getDefaultPos();

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      <div
        ref={boxRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "fixed",
          left: pos?.x ?? defaultPos.x,
          top:  pos?.y ?? defaultPos.y,
          width: W,
          zIndex: 500,
          cursor: "grab",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <div style={{
          borderRadius: 16, overflow: "hidden",
          background: "#0f172a",
          boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.15)",
          aspectRatio: "4/3",
          position: "relative",
        }}>
          <ControlBar />

          {/* Remote stream — muted when speaker is OFF */}
          {remoteStream
            ? <Vid stream={remoteStream} muted={!speakerOn}
                   style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                   label={other} />
            : <NoRemote status={status} errorMsg={errorMsg} other={other} />}

          {/* PiP: own camera — always muted (we don't want to hear ourselves) */}
          {localStream && (
            <div style={{
              position: "absolute", bottom: 8, right: 8,
              width: 64, height: 48, borderRadius: 8, overflow: "hidden",
              border: "1.5px solid rgba(255,255,255,0.35)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 4,
            }}>
              <Vid stream={localStream} muted style={{ width: 64, height: 48 }} label="You" />
            </div>
          )}

          {/* Audio status badge */}
          {remoteStream && !speakerOn && (
            <div style={{
              position: "absolute", bottom: 8, left: 8, zIndex: 5,
              background: "rgba(0,0,0,0.6)", borderRadius: 99,
              padding: "3px 8px", display: "flex", alignItems: "center", gap: 4,
            }}>
              <VolumeX size={10} color="#fbbf24" />
              <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 600 }}>Speaker off</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
