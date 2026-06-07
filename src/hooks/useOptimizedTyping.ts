import { useRef, useCallback, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

export function useOptimizedTyping(nickname: string) {
  const lastTypingUpdate = useRef(0);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTyping = useRef(false);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const listenerRef = useRef<(() => void) | null>(null);

  // Auto-reconnect mechanism for long sessions
  const setupReconnection = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    reconnectTimeout.current = setTimeout(() => {
      console.log('🔄 Refreshing typing connection for long session stability');
      updateTypingStatus(false);
      setupReconnection();
    }, 20 * 60 * 1000); // 20 minutes
  }, []);

  const updateTypingStatus = useCallback(
    async (typing: boolean) => {
      const now = Date.now();

      if (
        typing &&
        isCurrentlyTyping.current &&
        now - lastTypingUpdate.current < 1500
      )
        return;

      lastTypingUpdate.current = now;
      isCurrentlyTyping.current = typing;

      try {
        await setDoc(
          doc(lastSeenDb, 'typing', nickname),
          {
            isTyping: typing,

            // 🔥 CRITICAL FIX
            timestamp: serverTimestamp(), // ✅ authoritative clock

            sessionId: Date.now(),
            heartbeat: Date.now() + Math.random(), // forces snapshot refresh
          },
          { merge: true }
        );

        console.log(`⌨️ Typing status updated for ${nickname}: ${typing}`);
      } catch (error) {
        console.error('Error updating typing status:', error);
        setTimeout(() => {
          updateTypingStatus(typing);
        }, 1000);
      }
    },
    [nickname, setupReconnection]
  );

  // Setup connection monitoring
  useEffect(() => {
    setupReconnection();

    const healthCheck = setInterval(() => {
      if (isCurrentlyTyping.current) {
        updateTypingStatus(true);
      }
    }, 60000);

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      clearInterval(healthCheck);
    };
  }, [setupReconnection, updateTypingStatus]);

  const handleTyping = useCallback(() => {
    updateTypingStatus(true);

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  }, [updateTypingStatus]);

  const stopTyping = useCallback(() => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    updateTypingStatus(false);
  }, [updateTypingStatus]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (listenerRef.current) listenerRef.current();
      updateTypingStatus(false);
    };
  }, [updateTypingStatus]);

  return { handleTyping, stopTyping };
}
