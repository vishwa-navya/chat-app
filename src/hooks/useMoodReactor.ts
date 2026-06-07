import { useState, useEffect, useRef } from 'react';
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
