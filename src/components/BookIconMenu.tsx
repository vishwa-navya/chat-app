/**
 * BookIconMenu.tsx
 *
 * Replaces the plain BookOpen icon in Chat2 header.
 * One tap → shows a small popup with two round buttons:
 *   📞 Voice Call   📷 Camera Share
 * Tapping outside closes it.
 */

import React, { useRef, useEffect, useState } from "react";
import { BookOpen, Phone, Camera } from "lucide-react";

interface BookIconMenuProps {
  isCameraSharing: boolean;
  isInCall:        boolean;
  onStartCamera:   () => void;
  onStartCall:     () => void;
}

export default function BookIconMenu({
  isCameraSharing,
  isInCall,
  onStartCamera,
  onStartCall,
}: BookIconMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const isActive = isCameraSharing || isInCall;

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      {/* Book icon button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Camera or Voice Call"
        style={{
          background:   isActive ? "#10b981" : "transparent",
          border:       "none",
          cursor:       "pointer",
          padding:      "4px",
          borderRadius: "50%",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          transition:   "background .2s",
          position:     "relative",
        }}
      >
        <BookOpen
          style={{
            width: 22, height: 22,
            color: isActive ? "#fff" : "#16a34a",
            transition: "color .2s",
          }}
          fill={isActive ? "currentColor" : "none"}
        />
        {/* Active dot */}
        {isActive && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            width: 9, height: 9, borderRadius: "50%",
            background: "#ef4444", border: "2px solid #fff",
            animation: "pulse 1s infinite",
          }} />
        )}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </button>

      {/* Popup menu — slides up from below the icon */}
      {open && (
        <div style={{
          position:    "absolute",
          top:         "calc(100% + 10px)",
          left:        "50%",
          transform:   "translateX(-50%)",
          background:  "#fff",
          borderRadius: 20,
          boxShadow:   "0 8px 32px rgba(0,0,0,0.18)",
          padding:     "16px 20px",
          display:     "flex",
          gap:         20,
          zIndex:      200,
          animation:   "menuIn .2s ease",
          border:      "1px solid rgba(0,0,0,0.06)",
          whiteSpace:  "nowrap",
        }}>
          <style>{`
            @keyframes menuIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>

          {/* Voice Call option */}
          <MenuOption
            icon={<Phone size={20} color={isInCall ? "#fff" : "#10b981"} />}
            label="Voice Call"
            active={isInCall}
            activeBg="#10b981"
            onClick={() => { setOpen(false); onStartCall(); }}
          />

          {/* Camera option */}
          <MenuOption
            icon={<Camera size={20} color={isCameraSharing ? "#fff" : "#3b82f6"} />}
            label="Camera"
            active={isCameraSharing}
            activeBg="#3b82f6"
            onClick={() => { setOpen(false); onStartCamera(); }}
          />
        </div>
      )}
    </div>
  );
}

function MenuOption({ icon, label, active, activeBg, onClick }: {
  icon: React.ReactNode; label: string;
  active: boolean; activeBg: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            8,
        background:     "transparent",
        border:         "none",
        cursor:         "pointer",
        padding:        0,
      }}
    >
      <div style={{
        width:          52,
        height:         52,
        borderRadius:   "50%",
        background:     active ? activeBg : "#f3f4f6",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      active ? `0 4px 14px ${activeBg}66` : "none",
        transition:     "background .2s, box-shadow .2s",
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{label}</span>
    </button>
  );
}