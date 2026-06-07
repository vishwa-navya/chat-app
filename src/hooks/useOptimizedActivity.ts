import { useEffect, useRef, useCallback, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useOptimizedActivity(nickname: string) {
  const activityTimer = useRef<NodeJS.Timeout | null>(null);
  const lastActivityUpdate = useRef(0);
  const isCurrentlyActive = useRef(false);

  const setActive = useCallback(async () => {
    const now = Date.now();
    
    // Prevent excessive activity updates (max once every 30 seconds)
    if (isCurrentlyActive.current && now - lastActivityUpdate.current < 30000) {
      return;
    }

    lastActivityUpdate.current = now;
    isCurrentlyActive.current = true;

    try {
      await setDoc(doc(db, 'users', nickname), {
        isActive: true,
        lastUpdate: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error setting active:', error);
    }
  }, [nickname]);

  const setInactive = useCallback(async () => {
    isCurrentlyActive.current = false;
    
    try {
      await setDoc(doc(db, 'users', nickname), {
        isActive: false,
        lastUpdate: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error setting inactive:', error);
    }
  }, [nickname]);

  const resetTimer = useCallback(() => {
    if (activityTimer.current) {
      clearTimeout(activityTimer.current);
    }
    
    setActive();
    
    activityTimer.current = setTimeout(() => {
      setInactive();
    }, 5 * 60 * 1000); // 5 minutes instead of 8
  }, [setActive, setInactive]);

  useEffect(() => {
    resetTimer();

    // Reduce the number of events that trigger activity updates
    const events = ['mousedown', 'keypress', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (activityTimer.current) {
        clearTimeout(activityTimer.current);
      }
      setInactive();
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer, setInactive]);

  return { resetTimer };
}

export function useOtherUserActivity(otherUser: string) {
  const [isActive, setIsActive] = useState(false);
  const listenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Cleanup previous listener
    if (listenerRef.current) {
      listenerRef.current();
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', otherUser),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const lastUpdate = data.lastUpdate?.toDate();
          const now = new Date();
          
          // Consider user active if last update was within 3 minutes (more strict)
          const isRecentlyActive = lastUpdate && 
            (now.getTime() - lastUpdate.getTime()) < 3 * 60 * 1000;
          
          setIsActive(data.isActive && isRecentlyActive);
          
          // Log activity status for debugging notifications
          console.log(`👤 ${otherUser} activity status:`, {
            isActive: data.isActive,
            isRecentlyActive,
            finalStatus: data.isActive && isRecentlyActive,
            lastUpdate: lastUpdate?.toLocaleTimeString()
          });
        } else {
          setIsActive(false);
        }
      },
      (error) => {
        console.error('Error listening to user activity:', error);
        setIsActive(false);
      }
    );

    listenerRef.current = unsubscribe;

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [otherUser]);

  return isActive;
}