import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useChat } from './useChat';

export interface MoodData {
  emoji: string;
  expiresAt: Date;
  updatedAt: Date;
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
];

export function useMood(nickname: 'Vishwa' | 'Ammu') {
  const [userMood, setUserMood] = useState<MoodData | null>(null);
  const [otherUserMood, setOtherUserMood] = useState<MoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousMood, setPreviousMood] = useState<string | null>(null);
  const { send } = useChat('privateMessages', nickname);

  const otherUser = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
  const chatId = 'privateMessages'; // Using same chat ID as your existing chat

  // Check if mood is expired
  const isMoodExpired = (mood: MoodData | null): boolean => {
    if (!mood) return true;
    return new Date() > mood.expiresAt;
  };

  // Set user's mood
  const setMood = async (emoji: string) => {
    try {
      // Store previous mood for system message
      const oldMood = userMood?.emoji || null;
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      await setDoc(doc(db, 'moods', `${chatId}_${nickname}`), {
        chatId,
        userId: nickname,
        emoji,
        expiresAt,
        updatedAt: serverTimestamp()
      });

      // Send system message about mood change
      if (oldMood && oldMood !== emoji) {
        const systemMessage = `${nickname} changed mood from ${oldMood} to ${emoji}`;
        await send(systemMessage, 'system');
      } else if (!oldMood) {
        const systemMessage = `${nickname} set mood to ${emoji}`;
        await send(systemMessage, 'system');
      }
      
      // Update previous mood tracking
      setPreviousMood(emoji);
    } catch (error) {
      console.error('Failed to set mood:', error);
      throw error;
    }
  };

  // Delete user's mood
  const deleteMood = async () => {
    try {
      const oldMood = userMood?.emoji || null;
      
      await deleteDoc(doc(db, 'moods', `${chatId}_${nickname}`));
      
      // Send system message about mood deletion
      if (oldMood) {
        const systemMessage = `${nickname} removed their ${oldMood} mood`;
        await send(systemMessage, 'system');
      }
      
      setPreviousMood(null);
    } catch (error) {
      console.error('Failed to delete mood:', error);
      throw error;
    }
  };

  // Listen to user's own mood
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'moods', `${chatId}_${nickname}`),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.emoji && data.expiresAt) {
            const moodData: MoodData = {
              emoji: data.emoji,
              expiresAt: data.expiresAt.toDate(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            };

            if (isMoodExpired(moodData)) {
              // Auto-delete expired mood
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

  // Listen to other user's mood
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'moods', `${chatId}_${otherUser}`),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.emoji && data.expiresAt) {
            const moodData: MoodData = {
              emoji: data.emoji,
              expiresAt: data.expiresAt.toDate(),
              updatedAt: data.updatedAt?.toDate() || new Date()
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
      (error) => {
        console.error('Error listening to other user mood:', error);
      }
    );

    return unsubscribe;
  }, [otherUser, chatId]);

  return {
    userMood: isMoodExpired(userMood) ? null : userMood,
    otherUserMood: isMoodExpired(otherUserMood) ? null : otherUserMood,
    setMood,
    deleteMood,
    loading
  };
}