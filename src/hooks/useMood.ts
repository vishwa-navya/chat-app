import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useChat } from './useChat';

export interface MoodData {
  emoji:     string;
  expiresAt: Date;
  updatedAt: Date;  // ← key field: changes every time user sets mood, even same emoji
}

export const MOOD_EMOJIS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🥺', label: 'Sad' },
  { emoji: '🔥', label: 'Lust' },
  { emoji: '❤️', label: 'Love talks' },
  { emoji: '😴', label: 'Sleepy' },
  { emoji: '😍', label: 'Romantic' },
  { emoji: '🤭', label: 'Shy' },
  { emoji: '🤒', label: 'Fever' },
  { emoji: '😔', label: 'Missing' },
  { emoji: '😣', label: 'Mind upset' },
  { emoji: '😠', label: 'Angry' },
  { emoji: '🥒', label: 'Aridichu' },
  { emoji: '🥳', label: 'Celebration' },
  { emoji: '📚', label: 'Study' },
  { emoji: '🏏', label: 'Cricket' },
  { emoji: '😩', label: 'Tired' },
  { emoji: '😡', label: 'Furious' },       // added
  { emoji: '🤧', label: 'Sick' },           // added
  { emoji: '💔', label: 'Heartbreak' },     // added
  { emoji: '🙃', label: 'Annoyed' },        // added
];

export function useMood(nickname: 'Vishwa' | 'Ammu') {
  const [userMood,      setUserMood]      = useState<MoodData | null>(null);
  const [otherUserMood, setOtherUserMood] = useState<MoodData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const { send } = useChat('privateMessages', nickname);

  const otherUser = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
  const chatId    = 'privateMessages';

  const isMoodExpired = (mood: MoodData | null): boolean => {
    if (!mood) return true;
    return new Date() > mood.expiresAt;
  };

  // ── Set mood ───────────────────────────────────────────────────────────────
  const setMood = async (emoji: string) => {
    try {
      const oldMood = userMood?.emoji || null;
      const now       = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // ← Use actual JS Date for updatedAt so it's always a fresh timestamp
      // serverTimestamp() is async and can be null on first read
      // We use new Date() so useMoodReactor can compare updatedAt immediately
      await setDoc(doc(db, 'moods', `${chatId}_${nickname}`), {
        chatId,
        userId:    nickname,
        emoji,
        expiresAt,
        updatedAt: serverTimestamp(), // Firestore server time
        // Also store client time for immediate comparison
        updatedAtClient: now.toISOString(),
      });

      if (oldMood && oldMood !== emoji) {
        await send(`${nickname} changed mood from ${oldMood} to ${emoji}`, 'system');
      } else if (!oldMood) {
        await send(`${nickname} set mood to ${emoji}`, 'system');
      } else {
        // Same mood re-selected — send system message too
        await send(`${nickname} is still feeling ${emoji}`, 'system');
      }

    } catch (error) {
      console.error('Failed to set mood:', error);
      throw error;
    }
  };

  // ── Delete mood ────────────────────────────────────────────────────────────
  const deleteMood = async () => {
    try {
      const oldMood = userMood?.emoji || null;
      await deleteDoc(doc(db, 'moods', `${chatId}_${nickname}`));
      if (oldMood) {
        await send(`${nickname} removed their ${oldMood} mood`, 'system');
      }
    } catch (error) {
      console.error('Failed to delete mood:', error);
      throw error;
    }
  };

  // ── Listen to own mood ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'moods', `${chatId}_${nickname}`),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.emoji && data.expiresAt) {
            const moodData: MoodData = {
              emoji:     data.emoji,
              expiresAt: data.expiresAt.toDate(),
              // Use client timestamp for immediate re-select detection
              updatedAt: data.updatedAtClient
                ? new Date(data.updatedAtClient)
                : (data.updatedAt?.toDate() || new Date()),
            };
            if (isMoodExpired(moodData)) {
              deleteMood().catch(console.error);
              setUserMood(null);
            } else {
              setUserMood(moodData);
            }
          } else {
            setUserMood(null);
          }
        } else {
          setUserMood(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to user mood:', error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [nickname, chatId]);

  // ── Listen to other user mood ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'moods', `${chatId}_${otherUser}`),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.emoji && data.expiresAt) {
            const moodData: MoodData = {
              emoji:     data.emoji,
              expiresAt: data.expiresAt.toDate(),
              updatedAt: data.updatedAtClient
                ? new Date(data.updatedAtClient)
                : (data.updatedAt?.toDate() || new Date()),
            };
            if (isMoodExpired(moodData)) {
              setOtherUserMood(null);
            } else {
              setOtherUserMood(moodData);
            }
          } else {
            setOtherUserMood(null);
          }
        } else {
          setOtherUserMood(null);
        }
      },
      (error) => console.error('Error listening to other user mood:', error)
    );
    return unsubscribe;
  }, [otherUser, chatId]);

  return {
    userMood:      isMoodExpired(userMood)      ? null : userMood,
    otherUserMood: isMoodExpired(otherUserMood) ? null : otherUserMood,
    setMood,
    deleteMood,
    loading,
  };
}