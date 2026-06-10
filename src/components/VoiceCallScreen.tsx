/**
 * VoiceCallScreen.tsx — FINAL
 * 
 * "calling"    → 52px green bar at top ONLY. NOT full screen. Chat still visible.
 * "incoming"   → full white screen with Accept + Reject
 * "connecting" → full white screen with spinner
 * "connected"  → full white screen with controls
 * "busy/ended" → full white screen with message
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

function Duration({ seconds }: { seconds: number }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return <span style={{ fontSize: 20, color: "#6b7280", fontWeight: 500, letterSpacing: 3 }}>{m}:{s}</span>;
}

function Avatar({ name, size = 88 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#10b981,#059669)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      boxShadow: "0 4px 24px rgba(16,185,129,0.3)",
      flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RippleAvatar({ name }: { name: string }) {
  return (
    <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 96 + i*34, height: 96 + i*34,
          borderRadius: "50%",
          background: "rgba(16,185,129,0.12)",
          animation: `rpl 2s ease-out ${i*0.4}s infinite`,
        }}/>
      ))}
      <Avatar name={name} size={92} />
      <style>{`@keyframes rpl{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(1.9);opacity:0}}`}</style>
    </div>
  );
}

function Btn({ onClick, bg, children, label, size=64 }: {
  onClick:()=>void; bg:string; children:React.ReactNode; label?:string; size?:number;
}) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <button onClick={onClick} style={{
        width:size, height:size, borderRadius:"50%", border:"none",
        background:bg, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 4px 16px rgba(0,0,0,0.13)", transition:"transform .12s",
      }}
      onMouseEnter={e=>{(e.currentTarget as any).style.transform="scale(1.08)"}}
      onMouseLeave={e=>{(e.currentTarget as any).style.transform="scale(1)"}}
      >{children}</button>
      {label && <span style={{ fontSize:11, color:"#9ca3af", fontWeight:500 }}>{label}</span>}
    </div>
  );
}

export default function VoiceCallScreen(props: VoiceCallScreenProps) {
  const {
    callStatus, callerName, nickname,
    isMicOn, isSpeakerOn, isNearEar, callDuration,
    onAccept, onReject, onEnd, onToggleMic, onToggleSpeaker,
  } = props;

  const other = nickname === "Vishwa" ? "Ammu" : "Vishwa";
  const name  = callerName ?? other;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "calling" = SMALL BAR ONLY — 52px at top, chat visible behind it
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "calling") {
    return (
      <div style={{
        position:   "fixed",
        top:        0,
        left:       0,
        right:      0,
        height:     52,          // ← ONLY 52px tall, NOT full screen
        zIndex:     9999,
        background: "linear-gradient(90deg,#10b981,#059669)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding:    "0 16px",
        boxShadow:  "0 2px 12px rgba(16,185,129,0.4)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {[0,1,2].map(i=>(
            <span key={i} style={{
              width:7, height:7, borderRadius:"50%", background:"rgba(255,255,255,0.9)",
              display:"inline-block",
              animation:`d 1.2s ${i*0.2}s infinite`,
            }}/>
          ))}
          <span style={{ color:"#fff", fontWeight:700, fontSize:14, marginLeft:4 }}>
            Calling {name}…
          </span>
        </div>
        <button onClick={onEnd} style={{
          background:"rgba(255,255,255,0.22)", border:"none",
          borderRadius:20, padding:"6px 16px",
          color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
        }}>Cancel</button>
        <style>{`@keyframes d{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}`}</style>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Proximity sensor — pure black, nothing pressable
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isNearEar && (callStatus === "connected" || callStatus === "connecting")) {
    return <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#000" }}/>;
  }

  // Full screen white base
  const Full: React.CSSProperties = {
    position:"fixed", inset:0, zIndex:9999,
    background:"#ffffff",
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"space-between",
    fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "incoming" — full white, accept/reject
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "incoming") {
    return (
      <div style={Full}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
          <RippleAvatar name={name}/>
          <h2 style={{ fontSize:26, fontWeight:700, color:"#111827", margin:0 }}>{name}</h2>
          <p style={{ fontSize:15, color:"#6b7280", margin:0 }}>Incoming voice call…</p>
        </div>
        <div style={{ display:"flex", gap:60, paddingBottom:56 }}>
          <Btn onClick={onReject} bg="#ef4444" size={72} label="Decline"><PhoneOff size={28} color="#fff"/></Btn>
          <Btn onClick={onAccept} bg="#22c55e" size={72} label="Accept"><Phone size={28} color="#fff"/></Btn>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "connecting" — full white, spinner
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "connecting") {
    return (
      <div style={Full}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
          <Avatar name={name} size={92}/>
          <h2 style={{ fontSize:26, fontWeight:700, color:"#111827", margin:0 }}>{name}</h2>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Loader2 size={18} color="#10b981" style={{ animation:"spin 1s linear infinite" }}/>
            <span style={{ fontSize:15, color:"#6b7280" }}>Connecting…</span>
          </div>
        </div>
        <div style={{ paddingBottom:56 }}>
          <Btn onClick={onEnd} bg="#ef4444" size={64} label="End"><PhoneOff size={24} color="#fff"/></Btn>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "connected" — full white, mic + end + speaker
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "connected") {
    return (
      <div style={Full}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
          <Avatar name={name} size={88}/>
          <h2 style={{ fontSize:26, fontWeight:700, color:"#111827", margin:0 }}>{name}</h2>
          <Duration seconds={callDuration}/>
          <span style={{ fontSize:12, color: isSpeakerOn ? "#10b981" : "#9ca3af", fontWeight:500 }}>
            {isSpeakerOn ? "🔊 Loudspeaker" : "🔇 Earpiece"}
          </span>
        </div>
        <div style={{ display:"flex", gap:28, paddingBottom:60, alignItems:"center" }}>
          <Btn onClick={onToggleMic} bg={isMicOn?"#f3f4f6":"#1f2937"} size={58} label={isMicOn?"Mute":"Unmute"}>
            {isMicOn?<Mic size={22} color="#374151"/>:<MicOff size={22} color="#fff"/>}
          </Btn>
          <Btn onClick={onEnd} bg="#ef4444" size={72} label="End">
            <PhoneOff size={28} color="#fff"/>
          </Btn>
          <Btn onClick={onToggleSpeaker} bg={isSpeakerOn?"#10b981":"#f3f4f6"} size={58} label={isSpeakerOn?"Speaker":"Earpiece"}>
            {isSpeakerOn?<Volume2 size={22} color="#fff"/>:<VolumeX size={22} color="#374151"/>}
          </Btn>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "busy" — offline
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "busy") {
    return (
      <div style={Full}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
          <div style={{ width:92, height:92, borderRadius:"50%", background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <PhoneOff size={38} color="#9ca3af"/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:700, color:"#374151", margin:0, marginTop:16 }}>{name}</h2>
          <p style={{ color:"#ef4444", margin:0, fontWeight:500 }}>is offline</p>
          <p style={{ color:"#9ca3af", fontSize:13 }}>Try again when they're online</p>
        </div>
        <div style={{ paddingBottom:56 }}>
          <Btn onClick={onEnd} bg="#ef4444" size={64} label="Close"><PhoneOff size={24} color="#fff"/></Btn>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // "ended"
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (callStatus === "ended") {
    return (
      <div style={Full}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
          <div style={{ width:92, height:92, borderRadius:"50%", background:"#f3f4f6", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <PhoneOff size={38} color="#9ca3af"/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:700, color:"#9ca3af", marginTop:16, marginBottom:0 }}>Call Ended</h2>
          {callDuration > 0 && <Duration seconds={callDuration}/>}
        </div>
      </div>
    );
  }

  return null;
}