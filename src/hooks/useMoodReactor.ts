import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MoodData } from './useMood';

interface UseMoodReactorProps {
  userMood: MoodData | null;
  otherUserMood: MoodData | null;
  nickname: string;
  selfTyping: boolean;
  lastMessageTimestamp?: any;
}

// ── Moods that should NEVER trigger celebration ───────────────────────────────
// Negative / non-celebratory moods
const EXCLUDED_MOODS = new Set([
  '🥺', // Sad
  '🤒', // Fever
  '😔', // Missing
  '😣', // Mind upset
  '😠', // Angry
  '😡', // Angry (alt)
  '😩', // Tired
  '😴', // Sleepy — neutral/not celebratory
]);

export function useMoodReactor({
  userMood,
  otherUserMood,
  nickname,
  selfTyping,          // NOTE: only used to PAUSE, not to re-trigger
}: UseMoodReactorProps) {
  const [isReactorActive, setIsReactorActive] = useState(false);

  // Firestore-persisted state
  const [celebrationDone, setCelebrationDone] = useState(false);
  const [celebrationMood, setCelebrationMood] = useState<string | null>(null);

  // Local refs — stable, don't trigger re-renders
  const isRunningRef       = useRef(false);
  const pausedForTypingRef = useRef(false);
  const firestoreLoadedRef = useRef(false);

  // ── Load celebration status from Firestore ──────────────────────────────────
  // This persists across re-logins and tab refreshes
  useEffect(() => {
    const ref = doc(db, 'moodReactorStatus', nickname);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCelebrationDone(!!data.completed);
        setCelebrationMood(data.lastMood ?? null);
      }
      firestoreLoadedRef.current = true;
    });
    return unsub;
  }, [nickname]);

  // ── Detect when user RE-SELECTS same mood (manual re-trigger) ──────────────
  // useMood sends updatedAt timestamp — when user clicks same mood again,
  // updatedAt changes even if emoji is the same
  const prevUpdatedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!userMood?.emoji || !firestoreLoadedRef.current) return;
    const newUpdatedAt = userMood.updatedAt;
    const prevUpdatedAt = prevUpdatedAtRef.current;

    // If updatedAt changed but emoji is the same = user re-selected same mood
    if (
      prevUpdatedAt &&
      newUpdatedAt &&
      newUpdatedAt.getTime() !== prevUpdatedAt.getTime()
    ) {
      const moodChanged = userMood.emoji !== celebrationMood;
      const reselectedSame = userMood.emoji === celebrationMood;

      if (moodChanged || reselectedSame) {
        // Reset celebration so it can fire again
        isRunningRef.current = false;
        setCelebrationDone(false);
        setDoc(
          doc(db, 'moodReactorStatus', nickname),
          {
            lastMood:  userMood.emoji,
            completed: false,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
        console.log('[MoodReactor] Mood re-selected — celebration reset');
      }
    }

    prevUpdatedAtRef.current = newUpdatedAt;
  }, [userMood?.updatedAt?.getTime(), nickname]);

  // ── MAIN TRIGGER ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!firestoreLoadedRef.current) return;  // wait for Firestore to load
    if (isRunningRef.current) return;          // already running
    if (!userMood?.emoji || !otherUserMood?.emoji) return;
    if (userMood.emoji !== otherUserMood.emoji) return;  // moods must match
    if (EXCLUDED_MOODS.has(userMood.emoji)) return;      // skip negative moods
    if (celebrationDone) return;                          // already celebrated this mood
    // NOTE: selfTyping does NOT block trigger — it only pauses the animation
    // The trigger fires, but MoodReactor component handles the pause internally

    // ✅ All conditions met — fire celebration
    isRunningRef.current = true;
    setIsReactorActive(true);

    // Mark as done in Firestore — prevents re-show on re-login
    setDoc(
      doc(db, 'moodReactorStatus', nickname),
      {
        lastMood:  userMood.emoji,
        completed: true,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

    console.log('[MoodReactor] 🎉 Celebration started for mood:', userMood.emoji);
  }, [
    userMood?.emoji,
    otherUserMood?.emoji,
    celebrationDone,
    firestoreLoadedRef.current,
    // NOTE: selfTyping intentionally NOT in deps — typing should never re-trigger
  ]);

  const handleReactorComplete = () => {
    isRunningRef.current = false;
    setIsReactorActive(false);
    console.log('[MoodReactor] Celebration complete');
  };

  return { isReactorActive, handleReactorComplete };
}