/**
 * VoiceCallScreen.tsx
 *
 * Full-screen white call UI — 3 states:
 *  1. "calling"  — Ammu calling, waiting for Vishwa to pick up (with ringing animation)
 *  2. "incoming" — Vishwa sees this: green + red buttons to accept/reject
 *  3. "connected"— Both see: white screen, mic, speaker, red end-call button
 *                  Proximity sensor hides buttons when phone near ear
 */

import React, { useEffect, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, PhoneCall } from "lucide-react";
import type { CallStatus } from "../hooks/useVoiceCall";

interface VoiceCallScreenProps {
  callStatus:    CallStatus;
  callerName:    string | null;
  nickname:      "Vishwa" | "Ammu";
  isMicOn:       boolean;
  isSpeakerOn:   boolean;
  isNearEar:     boolean;
  onAccept:      () => void;
  onReject:      () => void;
  onEnd:         () => void;
  onToggleMic:   () => void;
  onToggleSpeaker: () => void;
}

// ── Ripple animation for ringing ──────────────────────────────────────────────
function RippleAvatar({ name }: { name: string }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 120, height: 120 }}>
      {/* Ripple rings */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 120 + i * 40,
          height: 120 + i * 40,
          borderRadius: "50%",
          background: "rgba(34,197,94,0.15)",
          animation: `ripple 2s ease-out ${i * 0.4}s infinite`,
        }} />
      ))}
      {/* Avatar circle */}
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        background: "linear-gradient(135deg, #10b981, #059669)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, fontWeight: 700, color: "#fff",
        boxShadow: "0 8px 32px rgba(16,185,129,0.4)",
        zIndex: 1, position: "relative",
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
      <style>{`
        @keyframes ripple {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Round button ──────────────────────────────────────────────────────────────
function RoundBtn({ onClick, bg, children, label, size = 64 }: {
  onClick: () => void; bg: string;
  children: React.ReactNode; label?: string; size?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button onClick={onClick} style={{
        width: size, height: size, borderRadius: "50%", border: "none",
        background: bg, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        transition: "transform .15s, box-shadow .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {children}
      </button>
      {label && <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return <span style={{ fontSize: 18, color: "#6b7280", fontWeight: 500, letterSpacing: 2 }}>{m}:{s}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VoiceCallScreen({
  callStatus, callerName, nickname,
  isMicOn, isSpeakerOn, isNearEar,
  onAccept, onReject, onEnd,
  onToggleMic, onToggleSpeaker,
}: VoiceCallScreenProps) {

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";
  const displayName = callerName ?? other;

  // Hide buttons when phone is near ear (proximity sensor)
  const hideButtons = isNearEar && callStatus === "connected";

  // ── Calling state (I called, waiting for answer) ──────────────────────────
  if (callStatus === "calling") {
    return (
      <div style={fullscreenStyle}>
        <div style={centerColStyle}>
          <RippleAvatar name={displayName} />
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: 0 }}>{displayName}</h2>
            <p style={{ fontSize: 16, color: "#6b7280", marginTop: 8 }}>Calling…</p>
          </div>
        </div>
        {/* End call button */}
        <div style={bottomBarStyle}>
          <RoundBtn onClick={onEnd} bg="#ef4444" size={72}>
            <PhoneOff size={28} color="#fff" />
          </RoundBtn>
          <span style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>End</span>
        </div>
      </div>
    );
  }

  // ── Incoming call (other person called me) ────────────────────────────────
  if (callStatus === "incoming") {
    return (
      <div style={fullscreenStyle}>
        <div style={centerColStyle}>
          <RippleAvatar name={displayName} />
          <div style={{ marginTop: 32, textAlign: "center" }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: 0 }}>{displayName}</h2>
            <p style={{ fontSize: 16, color: "#6b7280", marginTop: 8 }}>Incoming voice call…</p>
          </div>
        </div>

        {/* Accept / Reject */}
        <div style={{ ...bottomBarStyle, gap: 60 }}>
          {/* Reject */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <RoundBtn onClick={onReject} bg="#ef4444" size={72}>
              <PhoneOff size={28} color="#fff" />
            </RoundBtn>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Decline</span>
          </div>
          {/* Accept */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <RoundBtn onClick={onAccept} bg="#22c55e" size={72}>
              <Phone size={28} color="#fff" />
            </RoundBtn>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Accept</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Busy / offline ─────────────────────────────────────────────────────────
  if (callStatus === "busy") {
    return (
      <div style={fullscreenStyle}>
        <div style={centerColStyle}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PhoneOff size={40} color="#9ca3af" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#374151", marginTop: 24 }}>{displayName} is offline</h2>
          <p style={{ color: "#9ca3af", marginTop: 8 }}>Try again when they're online</p>
        </div>
        <div style={bottomBarStyle}>
          <RoundBtn onClick={onEnd} bg="#ef4444" size={64}>
            <PhoneOff size={24} color="#fff" />
          </RoundBtn>
        </div>
      </div>
    );
  }

  // ── Ended ──────────────────────────────────────────────────────────────────
  if (callStatus === "ended") {
    return (
      <div style={fullscreenStyle}>
        <div style={centerColStyle}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PhoneOff size={40} color="#9ca3af" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#374151", marginTop: 24 }}>Call Ended</h2>
        </div>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  if (callStatus === "connected") {
    return (
      <div style={fullscreenStyle}>
        {/* Top: name + timer */}
        <div style={{ ...centerColStyle, paddingTop: 80 }}>
          <div style={{
            width: 90, height: 90, borderRadius: "50%",
            background: "linear-gradient(135deg,#10b981,#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 700, color: "#fff",
            boxShadow: "0 4px 24px rgba(16,185,129,0.3)",
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 20, marginBottom: 8 }}>
            {displayName}
          </h2>
          <CallTimer />
        </div>

        {/* Bottom controls — hidden when near ear */}
        {!hideButtons && (
          <div style={{ ...bottomBarStyle, gap: 32, paddingBottom: 60 }}>
            {/* Mic */}
            <RoundBtn
              onClick={onToggleMic}
              bg={isMicOn ? "#f3f4f6" : "#374151"}
              label={isMicOn ? "Mute" : "Unmute"}
            >
              {isMicOn
                ? <Mic size={24} color="#374151" />
                : <MicOff size={24} color="#fff" />}
            </RoundBtn>

            {/* End call — big red in center */}
            <RoundBtn onClick={onEnd} bg="#ef4444" size={72} label="End">
              <PhoneOff size={28} color="#fff" />
            </RoundBtn>

            {/* Speaker */}
            <RoundBtn
              onClick={onToggleSpeaker}
              bg={isSpeakerOn ? "#10b981" : "#f3f4f6"}
              label={isSpeakerOn ? "Speaker" : "Earpiece"}
            >
              {isSpeakerOn
                ? <Volume2 size={24} color="#fff" />
                : <VolumeX size={24} color="#374151" />}
            </RoundBtn>
          </div>
        )}

        {/* Proximity hint */}
        {hideButtons && (
          <div style={{
            position: "absolute", bottom: 40, left: 0, right: 0,
            textAlign: "center", color: "#d1d5db", fontSize: 13,
          }}>
            Move phone away from ear to see controls
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const fullscreenStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "#ffffff",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "space-between",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const centerColStyle: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  paddingTop: 60,
};

const bottomBarStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: 40, paddingBottom: 48, width: "100%",
  flexDirection: "row",
};