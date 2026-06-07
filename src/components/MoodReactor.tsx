import React, { useEffect, useState } from 'react';

interface MoodReactorProps {
  isActive: boolean;
  onComplete: () => void;
}

function MoodReactor({ isActive, onComplete }: MoodReactorProps) {
  const [phase, setPhase] = useState<'emojis' | 'text'>('emojis');
  const [emojiElements, setEmojiElements] = useState<
    Array<{ id: number; left: number; delay: number; emoji: string }>
  >([]);
  const [textElements, setTextElements] = useState<
    Array<{ id: number; left: number; delay: number }>
  >([]);

  useEffect(() => {
    if (!isActive) return;

    // 🔹 RESET STATE ONLY ON FIRST ACTIVATE
    setPhase('emojis');

    const emojis = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4000,
      emoji: Math.random() > 0.5 ? '🥳' : '🎉',
    }));

    setEmojiElements(emojis);

    // Phase 1 → Phase 2
    const emojiTimer = setTimeout(() => {
      setPhase('text');

      const texts = Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        left: Math.random() * 80 + 10,
        delay: Math.random() * 6000,
      }));

      setTextElements(texts);
    }, 4000);

    // COMPLETE
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 10000);

    return () => {
      clearTimeout(emojiTimer);
      clearTimeout(completeTimer);
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {phase === 'emojis' &&
        emojiElements.map((emoji) => (
          <div
            key={emoji.id}
            className="absolute text-4xl animate-fall-emoji"
            style={{
              left: `${emoji.left}%`,
              top: '-60px',
              animationDelay: `${emoji.delay}ms`,
              animationDuration: '3s',
              animationFillMode: 'forwards',
            }}
          >
            {emoji.emoji}
          </div>
        ))}

      {phase === 'text' &&
        textElements.map((text) => (
          <div
            key={text.id}
            className="absolute animate-fall-text"
            style={{
              left: `${text.left}%`,
              top: '-100px',
              animationDelay: `${text.delay}ms`,
              animationDuration: '4s',
              animationFillMode: 'forwards',
            }}
          >
            <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-full shadow-xl border-2 border-pink-300 backdrop-blur-sm">
              <p className="text-sm font-serif text-pink-800 font-semibold italic whitespace-nowrap">
                Both hearts in sync, enjoy this moment ✨
              </p>
            </div>
          </div>
        ))}
    </div>
  );
}

export default MoodReactor;
