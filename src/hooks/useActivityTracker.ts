import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useActivityTracker(nickname: string) {
  const [isActive, setIsActiveState] = useState<boolean>(false);

  useEffect(() => {
    let activityTimer: NodeJS.Timeout;

    const setActive = async () => {
      try {
        await setDoc(
          doc(db, 'users', nickname),
          { isActive: true },
          { merge: true }
        );
        setIsActiveState(true);
        console.log(`🔥 ${nickname} ACTIVE`);
      } catch (error) {
        console.error('Error setting active:', error);
      }
    };

    const setInactive = async () => {
      try {
        await setDoc(
          doc(db, 'users', nickname),
          { isActive: false },
          { merge: true }
        );
        setIsActiveState(false);
        console.log(`❄️ ${nickname} INACTIVE`);
      } catch (error) {
        console.error('Error setting inactive:', error);
      }
    };

    // Immediately mark user active (avoids undefined state)
    setActive();

    const resetTimer = () => {
      clearTimeout(activityTimer);
      setActive();

      activityTimer = setTimeout(() => {
        setInactive();
      }, 8 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => document.addEventListener(event, resetTimer, true));

    return () => {
      clearTimeout(activityTimer);
      setInactive();
      events.forEach((event) =>
        document.removeEventListener(event, resetTimer, true)
      );
    };
  }, [nickname]);

  return { isActive };
}
