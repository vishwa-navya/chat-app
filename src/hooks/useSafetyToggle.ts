import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

const SAFETY_DOC_ID = 'safetyToggle';
const SAFETY_COLLECTION = 'systemStatus';

export interface SafetyToggleData {
  isSafe: boolean;
  lastUpdated: any;
  updatedBy?: string;
}

export const useSafetyToggle = () => {
  const [isSafe, setIsSafe] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const docRef = doc(lastSeenDb, SAFETY_COLLECTION, SAFETY_DOC_ID);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SafetyToggleData;
          setIsSafe(data.isSafe ?? true);
        } else {
          setIsSafe(true);
        }
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error('Error listening to safety toggle:', err);
        setError(err.message);
        setLoading(false);
        setIsSafe(true);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up safety toggle listener:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setIsSafe(true);
    }
  }, []);

  const toggleSafety = async () => {
    try {
      const docRef = doc(lastSeenDb, SAFETY_COLLECTION, SAFETY_DOC_ID);
      const newState = !isSafe;

      await setDoc(docRef, {
        isSafe: newState,
        lastUpdated: serverTimestamp(),
        updatedBy: 'system',
      }, { merge: true });

      setIsSafe(newState);
      setError(null);
    } catch (err) {
      console.error('Error toggling safety:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle safety');
    }
  };

  return {
    isSafe,
    toggleSafety,
    loading,
    error,
  };
};
