/**
 * VoiceCallScreen.tsx — v3
 *
 * callStatus "calling"    → small floating bar at top only (caller sees chat still)
 * callStatus "incoming"   → full white screen: Accept + Reject
 * callStatus "connecting" → full white screen: spinner "Connecting..."
 * callStatus "connected"  → full white screen: Mic + End + Speaker + timer
 * callStatus "busy"       → full white screen: offline message
 * callStatus "ended"      → full white screen: "Call Ended"
 * isNearEar = true        → pure black screen, nothing pressable
 */

import React from "react";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Phone, Loader2 } from "lucide-react";
import type { CallStatus } from "../hooks/useVoiceCall";

interface VoiceCallScreenProps {
  callStatus:      CallStatus;
  callerName:      string | null;
  nickname:        "Vishwa" | "Ammu";
  isMicOn:         boolean;
  isSpeakerOn:     boolean;
  isNearEar:       boolean;
  callDuration:    number;
  onAccept:        () => void;
  onReject:        () => void;
  onEnd:           () => void;
  onToggleMic:     () => void;
  onToggleSpeaker: () => void;
}

// ── Ripple avatar ─────────────────────────────────────────────────────────────
function RippleAvatar({ name, color = "#10b981" }: { name: string; color?: string }) {
  return (
    <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 100 + i * 36, height: 100 + i * 36,
          borderRadius: "50%",
          background: color + "22",
          animation: `rpl 2.2s ease-out ${i * 0.45}s infinite`,
        }} />
      ))}
      <div style={{
        width: 96, height: 96, borderRadius: "50%", zIndex: 1, position: "relative",
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 38, fontWeight: 800, color: "#fff",
        boxShadow: `0 8px 32px ${color}44`,
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <style>{`
        @keyframes rpl {
          0%   { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.9);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Round button ──────────────────────────────────────────────────────────────
function RoundBtn({ onClick, bg, children, label, size = 62 }: {
  onClick: () => void; bg: string; children: React.ReactNode; label?: string; size?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <button onClick={onClick} style={{
        width: size, height: size, borderRadius: "50%", border: "none",
        background: bg, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 18px rgba(0,0,0,0.13)",
        transition: "transform .12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        {children}
      </button>
      {label && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

// ── Duration ──────────────────────────────────────────────────────────────────
function Duration({ seconds }: { seconds: number }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return <span style={{ fontSize: 20, color: "#6b7280", fontWeight: 500, letterSpacing: 3 }}>{m}:{s}</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VoiceCallScreen({
  callStatus, callerName, nickname,
  isMicOn, isSpeakerOn, isNearEar, callDuration,
  onAccept, onReject, onEnd, onToggleMic, onToggleSpeaker,
}: VoiceCallScreenProps) {

  const other       = nickname === "Vishwa" ? "Ammu" : "Vishwa";
  const displayName = callerName ?? other;

  // ── "calling" = small top bar only — caller still sees the chat ───────────────
  // This is the KEY fix: caller does NOT get full white screen
  if (callStatus === "calling") {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 1000,
        background: "linear-gradient(135deg, #10b981, #059669)",
        padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 16px rgba(16,185,129,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Animated calling dots */}
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: "#fff",
                display: "inline-block",
                animation: `dot 1.2s ${i * 0.2}s infinite ease-in-out`,
              }} />
            ))}
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
            Calling {displayName}…
          </span>
        </div>
        {/* Cancel button */}
        <button onClick={onEnd} style={{
          background: "rgba(255,255,255,0.2)", border: "none",
          borderRadius: 20, padding: "6px 16px", color: "#fff",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          Cancel
        </button>
        <style>{`
          @keyframes dot {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40%            { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // ── Proximity sensor: pure black ───────────────────────────────────────────────
  if (isNearEar && (callStatus === "connected" || callStatus === "connecting")) {
    return <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000" }} />;
  }

  // ── Incoming call ──────────────────────────────────────────────────────────────
  if (callStatus === "incoming") {
    return (
      <div style={FULL}>
        <div style={CENTER}>
          <RippleAvatar name={displayName} color="#10b981" />
          <h2 style={NAME}>{displayName}</h2>
          <p style={SUB}>Incoming voice call…</p>
        </div>
        <div style={{ ...BOTTOM, gap: 60 }}>
          <RoundBtn onClick={onReject} bg="#ef4444" size={72} label="Decline">
            <PhoneOff size={28} color="#fff" />
          </RoundBtn>
          <RoundBtn onClick={onAccept} bg="#22c55e" size={72} label="Accept">
            <Phone size={28} color="#fff" />
          </RoundBtn>
        </div>
      </div>
    );
  }

  // ── Connecting (WebRTC negotiating after accept) ───────────────────────────────
  if (callStatus === "connecting") {
    return (
      <div style={FULL}>
        <div style={CENTER}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "linear-gradient(135deg,#10b981,#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 38, fontWeight: 800, color: "#fff",
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ ...NAME, marginTop: 20 }}>{displayName}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Loader2 size={18} color="#10b981" style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ ...SUB, margin: 0 }}>Connecting…</p>
          </div>
        </div>
        <div style={BOTTOM}>
          <RoundBtn onClick={onEnd} bg="#ef4444" size={64} label="End">
            <PhoneOff size={24} color="#fff" />
          </RoundBtn>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────────
  if (callStatus === "connected") {
    return (
      <div style={FULL}>
        <div style={{ ...CENTER, paddingTop: 80, gap: 12 }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg,#10b981,#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 24px rgba(16,185,129,0.3)",
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h2 style={NAME}>{displayName}</h2>
          <Duration seconds={callDuration} />
          <span style={{ fontSize: 12, color: isSpeakerOn ? "#10b981" : "#9ca3af", fontWeight: 500 }}>
            {isSpeakerOn ? "🔊 Loudspeaker" : "🔇 Earpiece"}
          </span>
        </div>
        <div style={{ ...BOTTOM, gap: 28, paddingBottom: 60 }}>
          <RoundBtn onClick={onToggleMic} bg={isMicOn ? "#f3f4f6" : "#1f2937"} label={isMicOn ? "Mute" : "Unmute"} size={58}>
            {isMicOn ? <Mic size={22} color="#374151" /> : <MicOff size={22} color="#fff" />}
          </RoundBtn>
          <RoundBtn onClick={onEnd} bg="#ef4444" size={72} label="End">
            <PhoneOff size={28} color="#fff" />
          </RoundBtn>
          <RoundBtn onClick={onToggleSpeaker} bg={isSpeakerOn ? "#10b981" : "#f3f4f6"} label={isSpeakerOn ? "Speaker" : "Earpiece"} size={58}>
            {isSpeakerOn ? <Volume2 size={22} color="#fff" /> : <VolumeX size={22} color="#374151" />}
          </RoundBtn>
        </div>
      </div>
    );
  }

  // ── Busy / offline ─────────────────────────────────────────────────────────────
  if (callStatus === "busy") {
    return (
      <div style={FULL}>
        <div style={CENTER}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PhoneOff size={38} color="#9ca3af" />
          </div>
          <h2 style={{ ...NAME, marginTop: 20 }}>{displayName}</h2>
          <p style={{ ...SUB, color: "#ef4444" }}>is offline</p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Try again when they're online</p>
        </div>
        <div style={BOTTOM}>
          <RoundBtn onClick={onEnd} bg="#ef4444" size={64} label="Close">
            <PhoneOff size={24} color="#fff" />
          </RoundBtn>
        </div>
      </div>
    );
  }

  // ── Ended ──────────────────────────────────────────────────────────────────────
  if (callStatus === "ended") {
    return (
      <div style={FULL}>
        <div style={CENTER}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PhoneOff size={38} color="#9ca3af" />
          </div>
          <h2 style={{ ...NAME, marginTop: 20, color: "#9ca3af" }}>Call Ended</h2>
          {callDuration > 0 && <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 6 }}>Duration: <Duration seconds={callDuration} /></p>}
        </div>
      </div>
    );
  }

  return null;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const FULL:   React.CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const CENTER: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 };
const BOTTOM: React.CSSProperties = { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, paddingBottom: 52, width: "100%" };
const NAME:   React.CSSProperties = { fontSize: 26, fontWeight: 700, color: "#111827", margin: 0 };
const SUB:    React.CSSProperties = { fontSize: 15, color: "#6b7280", margin: 0 };