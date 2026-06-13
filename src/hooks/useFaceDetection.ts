import { useRef, useCallback, useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

interface UseFaceDetectionProps {
  isEnabled: boolean;
  onViolation: () => void;
  onToggle: () => void;
}

export function useFaceDetection({ isEnabled, onViolation, onToggle }: UseFaceDetectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const modelsLoadedRef = useRef(false);
  const violationCountRef = useRef(0);
  const isProcessingRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;
    
    try {
      setIsLoading(true);
      
      // Load face detection models from CDN (lighter models for better performance)
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
      
      // Only load essential models to reduce memory usage
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      ]);
      
      modelsLoadedRef.current = true;
      console.log('✅ Face detection models loaded');
    } catch (error) {
      console.error('❌ Error loading face detection models:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load models first
      await loadModels();
      
      // Get user media (front camera with lower resolution for better performance)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 620 },
          height: { ideal: 540 }
        }
      });
      
      streamRef.current = stream;
      
      // Create video element if it doesn't exist
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.display = 'none'; // Hidden video element
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        document.body.appendChild(video);
        videoRef.current = video;
      }
      
      videoRef.current.srcObject = stream;
      
      // Handle play() promise properly to avoid interruption errors
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        try {
          await playPromise;
        } catch (error) {
          console.warn('Video play interrupted:', error);
          // Don't throw error, just log it
        }
      }
      
      startDetection();
      
      console.log('📹 Camera started, face detection active');
    } catch (error) {
      console.error('❌ Error starting camera:', error);
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startDetection = useCallback(() => {
    if (detectionIntervalRef.current) return;
    
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !modelsLoadedRef.current || isProcessingRef.current) return;
      
      try {
        isProcessingRef.current = true;
        
        // Use requestAnimationFrame to avoid blocking the main thread
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Detect faces using TinyFaceDetector only (faster, less memory)
        // InputSize must be divisible by 32 - changed from 190 to 192
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({
            inputSize: 192, // Must be divisible by 32 (192 = 32 × 6)
            scoreThreshold: 0.5
          }));
        
        const currentFaceCount = detections.length;
        setFaceCount(currentFaceCount);
        
        // Check for violations (0 faces or 2+ faces)
        if (currentFaceCount === 0 || currentFaceCount >= 2) {
          violationCountRef.current++;
          console.log(`🚨 Face violation detected: ${currentFaceCount} faces (violation #${violationCountRef.current})`);
          
          // Trigger violation after 2 consecutive violations (2 seconds)
          if (violationCountRef.current >= 2) {
            console.log('🚨 Multiple violations detected, redirecting to Chat1');
            stopCamera();
            onViolation();
            return;
          }
        } else if (currentFaceCount === 1) {
          // Reset violation count when exactly 1 face is detected
          violationCountRef.current = 0;
          console.log('✅ Single face detected, staying in chat');
        }
      } catch (error) {
        console.error('❌ Face detection error:', error);
      } finally {
        isProcessingRef.current = false;
      }
    }, 1000); // Check every second
  }, [onViolation]);

  const stopCamera = useCallback(() => {
    // Stop detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Remove video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
      }
      videoRef.current = null;
    }
    
    // Reset states
    setFaceCount(0);
    violationCountRef.current = 0;
    isProcessingRef.current = false;
    setIsLoading(false);
    
    console.log('📹 Camera stopped, face detection disabled');
  }, []);

  // Handle enable/disable
  useEffect(() => {
    if (isEnabled) {
      startCamera().catch((error) => {
        console.error('Failed to start camera:', error);
        onToggle(); // Turn off camera if failed to start
      });
    } else {
      stopCamera();
    }

    // Cleanup on unmount or disable
    return () => {
      stopCamera();
    };
  }, [isEnabled, startCamera, stopCamera, onToggle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    isLoading,
    faceCount
  };
}