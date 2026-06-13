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

export default MoodReactor;import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MoodData } from './useMood';

interface UseMoodReactorProps {
  userMood: MoodData | null;
  otherUserMood: MoodData | null;
  nickname: string;
  selfTyping: boolean;
  lastMessageTimestamp?: number;
}

export function useMoodReactor({
  userMood,
  otherUserMood,
  nickname,
  selfTyping,
}: UseMoodReactorProps) {
  const [isReactorActive, setIsReactorActive] = useState(false);
  const [hasSeenReactor, setHasSeenReactor] = useState(false);

  const lastMood = useRef<string | null>(null);
  const isRunningRef = useRef(false); // 🔒 LOCAL LOCK

  // 🔹 Listen Firestore status
  useEffect(() => {
    const ref = doc(db, 'moodReactorStatus', nickname);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHasSeenReactor(!!data.completed);
        lastMood.current = data.lastMood ?? null;
      }
    });

    return unsubscribe;
  }, [nickname]);

  // 🔹 Reset when mood changes
  useEffect(() => {
    if (!userMood?.emoji) return;

    if (lastMood.current !== userMood.emoji) {
      isRunningRef.current = false; // 🔓 UNLOCK
      setHasSeenReactor(false);

      setDoc(
        doc(db, 'moodReactorStatus', nickname),
        {
          lastMood: userMood.emoji,
          completed: false,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }, [userMood?.emoji, nickname]);

  // 🔹 MAIN TRIGGER (STABLE)
  useEffect(() => {
    if (isRunningRef.current) return; // ❌ BLOCK RE-RUN
    if (!userMood?.emoji || !otherUserMood?.emoji) return;
    if (userMood.emoji !== otherUserMood.emoji) return;

    const excluded = ['😡', '🤒', '🥺'];
    if (excluded.includes(userMood.emoji)) return;

    if (hasSeenReactor) return;
    if (selfTyping) return;

    // ✅ LOCK & START
    isRunningRef.current = true;
    setIsReactorActive(true);

    setDoc(
      doc(db, 'moodReactorStatus', nickname),
      {
        lastMood: userMood.emoji,
        completed: true,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

  }, [userMood, otherUserMood, hasSeenReactor, selfTyping, nickname]);

  const handleReactorComplete = () => {
    isRunningRef.current = false; // 🔓 UNLOCK AFTER COMPLETE
    setIsReactorActive(false);
  };

  return {
    isReactorActive,
    handleReactorComplete,
  };
}
