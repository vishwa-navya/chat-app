/**
 * BookIconMenu.tsx — v3
 * Vertical layout: Phone (top) then Camera (below)
 * Positioned to never overflow off-screen on any device
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { BookOpen, Phone, Camera } from "lucide-react";

interface BookIconMenuProps {
  isCameraSharing: boolean;
  isInCall:        boolean;
  onStartCamera:   () => void;
  onStartCall:     () => void;
}

export default function BookIconMenu({
  isCameraSharing, isInCall, onStartCamera, onStartCall,
}: BookIconMenuProps) {
  const [open, setOpen]       = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef      = useRef<HTMLDivElement>(null);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown",  close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown",  close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  // Calculate safe position after menu renders
  const calcPosition = useCallback(() => {
    if (!containerRef.current || !menuRef.current) return;

    const btnRect  = containerRef.current.getBoundingClientRect();
    const menuW    = menuRef.current.offsetWidth  || 80;
    const menuH    = menuRef.current.offsetHeight || 120;
    const vw       = window.innerWidth;
    const vh       = window.innerHeight;
    const gap      = 8;

    // Default: open below the button, centered on it
    let top  = btnRect.bottom + gap;
    let left = btnRect.left + btnRect.width / 2 - menuW / 2;

    // Clamp horizontally — never go off left or right edge
    left = Math.max(8, Math.min(left, vw - menuW - 8));

    // If not enough space below, open above
    if (top + menuH > vh - 8) {
      top = btnRect.top - menuH - gap;
    }

    setMenuStyle({ position: "fixed", top, left, zIndex: 300 });
  }, []);

  useEffect(() => {
    if (open) {
      // Wait one frame for menu to render, then position it
      requestAnimationFrame(calcPosition);
    }
  }, [open, calcPosition]);

  const isActive = isCameraSharing || isInCall;

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>

      {/* ── Book icon ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Call or Camera"
        style={{
          width: 32, height: 32,
          borderRadius: "50%",
          border: "none",
          background: isActive ? "#10b981" : "transparent",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s",
          position: "relative",
          padding: 0,
        }}
      >
        <BookOpen
          style={{ width: 20, height: 20, color: isActive ? "#fff" : "#16a34a" }}
          strokeWidth={2}
        />
        {isActive && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            width: 8, height: 8, borderRadius: "50%",
            background: "#ef4444", border: "2px solid #fff",
          }} />
        )}
      </button>

      {/* ── Vertical popup menu ── */}
      {open && (
        <div
          ref={menuRef}
          style={{
            ...menuStyle,
            background: "#fff",
            borderRadius: 16,
            padding: "10px 8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
            border: "1px solid rgba(0,0,0,0.07)",
            display: "flex",
            flexDirection: "column",   /* ← VERTICAL */
            alignItems: "center",
            gap: 6,
            minWidth: 70,
            animation: "menuPop .15s ease",
          }}
        >
          <style>{`
            @keyframes menuPop {
              from { opacity: 0; transform: scale(0.9); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>

          {/* Voice Call */}
          <MenuItem
            icon={<Phone size={17} color={isInCall ? "#fff" : "#10b981"} />}
            label="Call"
            bg={isInCall ? "#10b981" : "#f0fdf4"}
            onClick={() => { setOpen(false); onStartCall(); }}
          />

          {/* Camera */}
          <MenuItem
            icon={<Camera size={17} color={isCameraSharing ? "#fff" : "#3b82f6"} />}
            label="Camera"
            bg={isCameraSharing ? "#3b82f6" : "#eff6ff"}
            onClick={() => { setOpen(false); onStartCamera(); }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, bg, onClick }: {
  icon: React.ReactNode; label: string; bg: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4,
        background: "transparent", border: "none",
        cursor: "pointer", padding: "2px 4px",
        width: "100%",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform .12s",
        flexShrink: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}