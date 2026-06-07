import React, { useState, useEffect, useRef } from 'react';

interface MessageSeenDotsProps {
  messageId: string;
  senderId: string;
  currentUserId: string;
  seenBy?: string[];
  timestamp?: string;
  theme?: "chat2" | "chat3";     // ⭐ NEW: theme support
}

interface Particle {
  id: string;
  angle: number;
  distance: number;
  dotIndex: number;
}

function MessageSeenDots({
  messageId,
  senderId,
  currentUserId,
  seenBy = [],
  timestamp,
  theme = "chat2"                 // default = chat2
}: MessageSeenDotsProps) {

  const [particles, setParticles] = useState<Particle[]>([]);
  const [triggerBlast, setTriggerBlast] = useState(false);
  const [hasSeenBefore, setHasSeenBefore] = useState(false);
  const prevSeenRef = useRef(false);

  if (senderId !== currentUserId) return null;

  const otherUser = currentUserId === "Vishwa" ? "Ammu" : "Vishwa";
  const isSeenByOther = seenBy.includes(otherUser);

  const isChat3 = theme === "chat3";

  // color rules
  const dotColorNotSeen = isChat3 ? "border border-blue-400 bg-transparent" : "bg-gray-400";
  const dotColorSeen = isChat3 ? "bg-white border border-blue-600" : "bg-green-600";

  const particleColor = isChat3 ? "background-color: #4fa2ff;" : "background-color: #9ca3af;";

  useEffect(() => {
    if (isSeenByOther && !prevSeenRef.current && !hasSeenBefore) {
      setHasSeenBefore(true);
      triggerBlastAnimation();
    }
    prevSeenRef.current = isSeenByOther;
  }, [isSeenByOther, hasSeenBefore]);

  const triggerBlastAnimation = () => {
    setTriggerBlast(true);

    const newParticles: Particle[] = [];
    const particleCount = 5; // stronger blast

    for (let dot = 0; dot < 2; dot++) {
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 45;
        newParticles.push({
          id: `${messageId}-particle-${dot}-${i}`,
          angle,
          distance,
          dotIndex: dot
        });
      }
    }

    setParticles(newParticles);
    setTimeout(() => setTriggerBlast(false), 200);
    setTimeout(() => setParticles([]), 1500);
  };

  return (
    <div className="flex items-center justify-end gap-1 mt-1 relative">
      <div className="flex gap-0.5 relative">

        {/* DOT 1 */}
        <div
          className={`w-1 h-1 rounded-full transition-all duration-200 relative ${
            isSeenByOther ? dotColorSeen : dotColorNotSeen
          } ${triggerBlast ? "seen-dots-blast" : ""}`}
        />

        {/* DOT 2 */}
        <div
          className={`w-1 h-1 rounded-full transition-all duration-200 relative ${
            isSeenByOther ? dotColorSeen : dotColorNotSeen
          } ${triggerBlast ? "seen-dots-blast" : ""}`}
        />

        {/* PARTICLES */}
        {particles.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => {
              const offsetX = Math.cos(p.angle) * p.distance;
              const offsetY = Math.sin(p.angle) * p.distance;

              return (
                <div
                  key={p.id}
                  className="seen-particle"
                  style={{
                    "--particle-x": `${offsetX}px`,
                    "--particle-y": `${offsetY}px`,
                    ...(isChat3
                      ? { backgroundColor: "#4fa2ff" }
                      : { backgroundColor: "rgb(156,163,175)" })
                  } as React.CSSProperties}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* TIMESTAMP */}
      {timestamp && (
        <span className="text-[10px] text-gray-400 ml-1">{timestamp}</span>
      )}
    </div>
  );
}

export default MessageSeenDots;
