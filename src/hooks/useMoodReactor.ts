import React, { useEffect, useRef, useState } from 'react';

interface MoodReactorProps {
  isActive: boolean;
  onComplete: () => void;
}

function MoodReactor({ isActive, onComplete }: MoodReactorProps) {
  const [phase, setPhase] = useState<'idle' | 'emojis' | 'text'>('idle');
  const [emojiElements, setEmojiElements] = useState<
    Array<{ id: number; left: number; delay: number; emoji: string }>
  >([]);
  const [textElements, setTextElements] = useState<
    Array<{ id: number; left: number; delay: number }>
  >([]);

  // Use refs for timers so they survive re-renders without restarting
  const emojiTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef       = useRef(false);

  useEffect(() => {
    // Only start once when isActive becomes true
    if (!isActive || startedRef.current) return;
    startedRef.current = true;

    // Phase 1: emoji rain
    setPhase('emojis');
    setEmojiElements(
      Array.from({ length: 40 }).map((_, i) => ({
        id:    i,
        left:  Math.random() * 100,
        delay: Math.random() * 4000,
        emoji: Math.random() > 0.5 ? '🥳' : '🎉',
      }))
    );

    // Phase 2: text banners (after 4s)
    emojiTimerRef.current = setTimeout(() => {
      setPhase('text');
      setTextElements(
        Array.from({ length: 12 }).map((_, i) => ({
          id:    i,
          left:  Math.random() * 80 + 10,
          delay: Math.random() * 6000,
        }))
      );
    }, 4000);

    // Complete (after 10s total)
    completeTimerRef.current = setTimeout(() => {
      setPhase('idle');
      startedRef.current = false;
      onComplete();
    }, 10000);

    // Cleanup timers if component unmounts mid-animation
    // But DON'T reset on every re-render — this was the bug
    return () => {
      // Only cleanup on actual unmount (isActive going false)
    };
  }, [isActive]); // ← ONLY depends on isActive, NOT onComplete or selfTyping

  // When isActive goes false (e.g. component disabled), clean up
  useEffect(() => {
    if (!isActive) {
      if (emojiTimerRef.current)    clearTimeout(emojiTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      setPhase('idle');
      startedRef.current = false;
    }
  }, [isActive]);

  if (!isActive || phase === 'idle') return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      // pointer-events-none = NEVER blocks typing or clicks
    >
      {/* Phase 1: Emoji rain */}
      {phase === 'emojis' &&
        emojiElements.map((item) => (
          <div
            key={item.id}
            className="absolute text-4xl"
            style={{
              left:               `${item.left}%`,
              top:                '-60px',
              animationName:      'fallEmoji',
              animationDuration:  '3s',
              animationDelay:     `${item.delay}ms`,
              animationFillMode:  'forwards',
              animationTimingFunction: 'ease-in',
              // No pointer-events — user can type freely
            }}
          >
            {item.emoji}
          </div>
        ))}

      {/* Phase 2: Text banners */}
      {phase === 'text' &&
        textElements.map((item) => (
          <div
            key={item.id}
            className="absolute"
            style={{
              left:               `${item.left}%`,
              top:                '-100px',
              animationName:      'fallText',
              animationDuration:  '4s',
              animationDelay:     `${item.delay}ms`,
              animationFillMode:  'forwards',
              animationTimingFunction: 'ease-in',
            }}
          >
            <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-full shadow-xl border-2 border-pink-300">
              <p className="text-sm font-serif text-pink-800 font-semibold italic whitespace-nowrap">
                Both hearts in sync, enjoy this moment ✨
              </p>
            </div>
          </div>
        ))}

      {/* Keyframe animations injected inline */}
      <style>{`
        @keyframes fallEmoji {
          0%   { transform: translateY(0)    rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        @keyframes fallText {
          0%   { transform: translateY(0);    opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default MoodReactor;