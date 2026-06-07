import { useCallback } from 'react';
import { doc, setDoc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

export function useFrequentEmojis(userId: string) {
  // Track emoji usage - called when message is SENT
  const trackEmojiUsage = useCallback(async (emoji: string) => {
    if (!userId || !emoji) return;

    try {
      const docRef = doc(lastSeenDb, 'frequentEmojis', userId);
      
      // Use increment to atomically update count
      await setDoc(docRef, {
        [`emojis.${emoji}.emoji`]: emoji,
        [`emojis.${emoji}.count`]: increment(1),
        [`emojis.${emoji}.lastUsed`]: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      console.log(`📊 Tracked emoji usage: ${emoji} for ${userId}`);
    } catch (error) {
      console.error('Error tracking emoji usage:', error);
    }
  }, [userId]);

  // Update frequent emojis for multiple emojis in a message
  const updateFrequentEmojis = useCallback(async (emojisUsedInMessage: string[]) => {
    if (!userId || !emojisUsedInMessage.length) return;

    try {
      const docRef = doc(lastSeenDb, 'frequentEmojis', userId);
      const updateData: any = {
        lastUpdated: serverTimestamp()
      };

      // Update each emoji's count
      for (const emoji of emojisUsedInMessage) {
        updateData[`emojis.${emoji}.emoji`] = emoji;
        updateData[`emojis.${emoji}.count`] = increment(1);
        updateData[`emojis.${emoji}.lastUsed`] = serverTimestamp();
      }

      await setDoc(docRef, updateData, { merge: true });
      console.log(`📊 Updated frequent emojis for ${userId}:`, emojisUsedInMessage);
    } catch (error) {
      console.error('Error updating frequent emojis:', error);
    }
  }, [userId]);

  return {
    trackEmojiUsage,
    updateFrequentEmojis
  };
}