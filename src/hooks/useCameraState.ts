import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

interface CameraStateData {
  isCameraOn: boolean;
  timestamp: any;
  userId: string;
}

export function useCameraState(userId: string) {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to camera state changes in Firebase
  useEffect(() => {
    if (!userId) return;

    const cameraStateRef = doc(lastSeenDb, 'cameraState', userId);
    
    const unsubscribe = onSnapshot(
      cameraStateRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as CameraStateData;
          setIsCameraOn(data.isCameraOn || false);
          console.log(`📷 Camera state loaded for ${userId}: ${data.isCameraOn ? 'ON' : 'OFF'}`);
        } else {
          setIsCameraOn(false);
          console.log(`📷 No camera state found for ${userId}, defaulting to OFF`);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error listening to camera state:', error);
        setIsCameraOn(false);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  // Update camera state in Firebase
  const updateCameraState = useCallback(async (newState: boolean) => {
    if (!userId) return;

    try {
      const cameraStateRef = doc(lastSeenDb, 'cameraState', userId);
      await setDoc(cameraStateRef, {
        isCameraOn: newState,
        timestamp: serverTimestamp(),
        userId: userId
      });
      console.log(`📷 Camera state updated in Firebase for ${userId}: ${newState ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.error('Error updating camera state:', error);
    }
  }, [userId]);

  const toggleCamera = useCallback(() => {
    const newState = !isCameraOn;
    updateCameraState(newState);
  }, [isCameraOn, updateCameraState]);

  const setCameraOff = useCallback(() => {
    updateCameraState(false);
  }, [updateCameraState]);

  const setCameraOn = useCallback(() => {
    updateCameraState(true);
  }, [updateCameraState]);

  return {
    isCameraOn,
    isLoading,
    toggleCamera,
    setCameraOff,
    setCameraOn
  };
}

// Export function to reset camera state when user logs out
export const resetCameraState = async (userId: string) => {
  if (!userId) return;
  
  try {
    const cameraStateRef = doc(lastSeenDb, 'cameraState', userId);
    await setDoc(cameraStateRef, {
      isCameraOn: false,
      timestamp: serverTimestamp(),
      userId: userId
    });
    console.log(`🔄 Camera state reset to OFF for ${userId}`);
  } catch (error) {
    console.error('Error resetting camera state:', error);
  }
};