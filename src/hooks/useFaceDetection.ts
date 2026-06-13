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

  const videoRef             = useRef<HTMLVideoElement | null>(null);
  const streamRef            = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const modelsLoadedRef      = useRef(false);
  const violationCountRef    = useRef(0);
  const isProcessingRef      = useRef(false);
  const isMountedRef         = useRef(true);

  // ── How many consecutive bad frames before redirect ───────────────────────
  // At 500ms interval × 8 frames = 4 seconds before redirect
  // This handles: dark rooms, movement, walking, running, phone shake
  // Only triggers if face is TRULY gone for 4 straight seconds
  const VIOLATION_THRESHOLD = 8;
  const DETECTION_INTERVAL  = 500; // ms between checks

  // ── Load models ───────────────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;
    try {
      setIsLoading(true);
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      modelsLoadedRef.current = true;
      console.log('✅ Face models loaded');
    } catch (error) {
      console.error('❌ Model load error:', error);
      throw error;
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  // ── Detection loop ────────────────────────────────────────────────────────
  const startDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    detectionIntervalRef.current = setInterval(async () => {
      if (
        !videoRef.current ||
        !modelsLoadedRef.current ||
        isProcessingRef.current ||
        videoRef.current.readyState < 2
      ) return;

      try {
        isProcessingRef.current = true;

        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize:      224,   // larger = better detection in low light
            scoreThreshold: 0.2    // very low = catches faces in dark, blur, movement
          })
        );

        if (!isMountedRef.current) return;

        const count = detections.length;
        setFaceCount(count);

        if (count === 0 || count >= 2) {
          violationCountRef.current += 1;
          console.log(`🚨 Violation ${violationCountRef.current}/${VIOLATION_THRESHOLD} — faces: ${count}`);

          if (violationCountRef.current >= VIOLATION_THRESHOLD) {
            console.log('🚨 CONFIRMED violation — redirecting');
            violationCountRef.current = 0;
            stopCamera();
            onViolation();
          }
        } else {
          // Exactly 1 face — valid, reset counter completely
          if (violationCountRef.current > 0) {
            console.log('✅ Face back — reset violation counter');
          }
          violationCountRef.current = 0;
        }

      } catch {
        // Skip bad frames silently — never count errors as violations
      } finally {
        isProcessingRef.current = false;
      }

    }, DETECTION_INTERVAL);

  }, [onViolation]);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      await loadModels();
      if (!isMountedRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
        }
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay    = true;
        video.muted       = true;
        video.playsInline = true;
        video.style.cssText = 'display:none;position:fixed;top:-9999px;';
        document.body.appendChild(video);
        videoRef.current = video;
      }

      videoRef.current.srcObject = stream;

      try {
        await videoRef.current.play();
      } catch (e) {
        console.warn('Video play interrupted:', e);
      }

      startDetection();
      console.log(`📹 Face detection active (${DETECTION_INTERVAL}ms, threshold ${VIOLATION_THRESHOLD})`);

    } catch (error) {
      console.error('❌ Camera start error:', error);
      if (isMountedRef.current) {
        setIsLoading(false);
        onToggle();
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [loadModels, startDetection, onToggle]);

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      try {
        if (videoRef.current.parentNode) {
          videoRef.current.parentNode.removeChild(videoRef.current);
        }
      } catch {}
      videoRef.current = null;
    }
    violationCountRef.current = 0;
    isProcessingRef.current   = false;
    if (isMountedRef.current) {
      setFaceCount(0);
      setIsLoading(false);
    }
    console.log('📹 Face detection stopped');
  }, []);

  // ── Enable / disable ──────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    if (isEnabled) {
      startCamera().catch(err => {
        console.error('startCamera failed:', err);
        if (isMountedRef.current) onToggle();
      });
    } else {
      stopCamera();
    }

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [isEnabled]);

  return { isLoading, faceCount };
}