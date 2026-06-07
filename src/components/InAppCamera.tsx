import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Timer, Circle } from 'lucide-react';

interface InAppCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
  nickname?: string;
}

/**
 * 📷 IN-APP CAMERA COMPONENT
 * 
 * Features:
 * - Front/Back camera switching (MediaDevices API)
 * - 5-second timer for delayed capture
 * - Live camera preview
 * - Photo capture with countdown
 * 
 * Safety: Sets camera flags to prevent logout during use
 */
function InAppCamera({ isOpen, onClose, onCapture, nickname = 'unknown' }: InAppCameraProps) {
  // Camera state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Timer state
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerMode, setTimerMode] = useState<0 | 5>(0); // 0 = off, 5 = 5 seconds
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ============================================================
  // 🔒 CAMERA SAFETY FUNCTIONS
  // ============================================================
  
  const enterCameraMode = useCallback(() => {
    const now = Date.now();
    const win = window as any;
    
    win.__CAMERA_OPEN__ = true;
    win.__CAMERA_OPEN_TIME__ = now;
    win.__CAMERA_IN_FLOW__ = true;
    win.__AMMU_CAMERA_OPEN__ = true;
    win.__AMMU_CAMERA_OPEN_TIME__ = now;
    win.__AMMU_IN_CAMERA_FLOW__ = true;
    
    try {
      sessionStorage.setItem('__CAMERA_OPEN_SESSION__', 'true');
      sessionStorage.setItem('__AMMU_CAMERA_OPEN_SESSION__', 'true');
      sessionStorage.setItem('__CAMERA_TIME_SESSION__', now.toString());
      sessionStorage.setItem('__AMMU_CAMERA_TIME_SESSION__', now.toString());
    } catch (e) {
      console.warn('Camera: Could not save to sessionStorage');
    }
    
    if (win.__AMMU_SKIP_LOGOUT__?.start) win.__AMMU_SKIP_LOGOUT__.start();
    if (win.__CAMERA_SKIP_LOGOUT__?.start) win.__CAMERA_SKIP_LOGOUT__.start();
    
    console.log('📷 [InAppCamera] Camera mode ACTIVE');
  }, []);
  
  const exitCameraMode = useCallback(() => {
    const win = window as any;
    
    win.__CAMERA_OPEN__ = false;
    win.__AMMU_CAMERA_OPEN__ = false;
    win.__CAMERA_IN_FLOW__ = false;
    win.__AMMU_IN_CAMERA_FLOW__ = false;
    
    try {
      sessionStorage.removeItem('__CAMERA_OPEN_SESSION__');
      sessionStorage.removeItem('__AMMU_CAMERA_OPEN_SESSION__');
      sessionStorage.removeItem('__CAMERA_TIME_SESSION__');
      sessionStorage.removeItem('__AMMU_CAMERA_TIME_SESSION__');
    } catch (e) {
      // Ignore
    }
    
    if (win.__AMMU_SKIP_LOGOUT__?.stop) win.__AMMU_SKIP_LOGOUT__.stop();
    if (win.__CAMERA_SKIP_LOGOUT__?.stop) win.__CAMERA_SKIP_LOGOUT__.stop();
    
    console.log('📷 [InAppCamera] Camera mode EXITED');
  }, []);

  // ============================================================
  // 📷 CAMERA OPEN/CLOSE
  // ============================================================
  
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📷 Stopped track:', track.kind, track.label);
      });
      streamRef.current = null;
    }
  }, []);
  
  const openCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraReady(false);
    setCameraError(null);
    enterCameraMode();
    
    // Stop any existing stream first
    stopAllTracks();
    
    try {
      console.log(`📷 Requesting camera with facingMode: ${facingMode}`);
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('📷 Got media stream:', mediaStream.getTracks().map(t => `${t.kind}:${t.label}`));
      
      // Store in ref
      streamRef.current = mediaStream;
      
      // Attach to video element
      if (videoRef.current) {
        console.log('📷 Attaching stream to video element...');
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('📷 Video metadata loaded');
          videoRef.current?.play()
            .then(() => {
              console.log('📷 Video playing successfully');
              setCameraReady(true);
              setIsLoading(false);
            })
            .catch((err) => {
              console.error('📷 Video play error:', err);
              setCameraError('Failed to start video playback');
              setIsLoading(false);
            });
        };
        
        videoRef.current.onerror = (e) => {
          console.error('📷 Video element error:', e);
          setCameraError('Video element error');
          setIsLoading(false);
        };
      } else {
        console.error('📷 Video ref is null');
        setCameraError('Video element not ready');
        setIsLoading(false);
      }
      
    } catch (error: any) {
      console.error('📷 Camera error:', error);
      setIsLoading(false);
      
      if (error.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in settings and refresh.');
      } else if (error.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (error.name === 'NotReadableError') {
        setCameraError('Camera is being used by another app. Please close other apps using camera.');
      } else if (error.name === 'OverconstrainedError') {
        // Try again with basic constraints
        setCameraError(`Camera constraint error: ${error.message}. Trying basic camera...`);
        setTimeout(() => {
          openCamera();
        }, 1000);
      } else {
        setCameraError(`Camera error: ${error.message || 'Unknown error'}`);
      }
    }
  }, [facingMode, enterCameraMode, stopAllTracks]);

  const closeCamera = useCallback(() => {
    console.log('📷 Closing camera...');
    
    // Stop timer if active
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Stop all tracks
    stopAllTracks();
    
    exitCameraMode();
    onClose();
  }, [stopAllTracks, exitCameraMode, onClose]);

  // Open camera when component opens or facing mode changes
  useEffect(() => {
    if (isOpen) {
      openCamera();
    }
    
    return () => {
      stopAllTracks();
      exitCameraMode();
    };
  }, [isOpen, facingMode, openCamera, stopAllTracks, exitCameraMode]);

  // ============================================================
  // 🔄 CAMERA SWITCH (Front/Back)
  // ============================================================
  
  const switchCamera = useCallback(() => {
    if (timerActive) return;
    console.log('📷 Switching camera...');
    setCameraReady(false);
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [timerActive]);

  // ============================================================
  // ⏱️ TIMER TOGGLE
  // ============================================================
  
  const toggleTimer = useCallback(() => {
    if (timerActive) return;
    setTimerMode(prev => prev === 0 ? 5 : 0);
  }, [timerActive]);

  // ============================================================
  // 📸 CAPTURE PHOTO
  // ============================================================
  
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.error('📷 Video or canvas ref not ready');
      setCameraError('Capture failed - element not ready');
      return;
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('📷 Video dimensions are 0');
      setCameraError('Camera not ready. Please wait...');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('📷 Could not get canvas context');
      return;
    }
    
    console.log(`📷 Capturing photo: ${video.videoWidth}x${video.videoHeight}`);
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Flip horizontally for front camera (mirror effect)
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Reset transform
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('📷 Failed to create blob');
        setCameraError('Failed to capture image');
        return;
      }
      
      const timestamp = Date.now();
      const file = new File([blob], `photo_${timestamp}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      
      console.log(`📷 Photo captured: ${(file.size / 1024).toFixed(0)}KB, URL: ${previewUrl.substring(0, 30)}...`);
      
      // Stop tracks before calling onCapture
      stopAllTracks();
      exitCameraMode();
      
      // Call onCapture with the image
      onCapture(file, previewUrl);
      
      // Close the modal
      onClose();
      
    }, 'image/jpeg', 0.85);
  }, [facingMode, onCapture, onClose, stopAllTracks, exitCameraMode]);

  // ============================================================
  // ⏱️ CAPTURE WITH TIMER
  // ============================================================
  
  const startCapture = useCallback(() => {
    if (!cameraReady) {
      console.log('📷 Camera not ready yet');
      return;
    }
    
    if (timerMode === 0) {
      // No timer - capture immediately
      capturePhoto();
    } else {
      // Start timer countdown
      setTimerActive(true);
      setTimerSeconds(timerMode);
      
      let countdown = timerMode;
      
      timerIntervalRef.current = setInterval(() => {
        countdown -= 1;
        setTimerSeconds(countdown);
        
        if (countdown <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setTimerActive(false);
          capturePhoto();
        }
      }, 1000);
    }
  }, [timerMode, cameraReady, capturePhoto]);

  // ============================================================
  // 🎨 UI RENDER
  // ============================================================
  
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[200] flex flex-col"
    >
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 absolute top-0 left-0 right-0 z-10"
           style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
        <button
          onClick={closeCamera}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        
        <div className="text-white font-medium">
          {facingMode === 'user' ? '🤳 Front Camera' : '📷 Back Camera'}
        </div>
        
        {/* Timer Toggle Button */}
        <button
          onClick={toggleTimer}
          disabled={timerActive}
          className={`relative p-2 rounded-full transition-colors ${
            timerMode === 5 
              ? 'bg-yellow-500 text-white' 
              : 'bg-white/20 text-white hover:bg-white/30'
          } ${timerActive ? 'opacity-50' : ''}`}
        >
          <Timer className="w-6 h-6" />
          {timerMode === 5 && (
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              5
            </span>
          )}
        </button>
      </div>
      
      {/* Camera Preview */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {/* Always render video element but control visibility */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${(!cameraReady || cameraError) ? 'invisible' : ''}`}
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        
        {/* Loading Overlay */}
        {isLoading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white">Opening camera...</p>
            </div>
          </div>
        )}
        
        {/* Error Overlay */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📷❌</div>
              <p className="text-white text-lg mb-4">{cameraError}</p>
              <button
                onClick={openCamera}
                className="px-6 py-3 bg-white text-black rounded-full font-medium hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {/* Timer Countdown Overlay */}
        <AnimatePresence>
          {timerActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <div className="text-[120px] font-bold text-white drop-shadow-lg animate-pulse">
                {timerSeconds}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-8 p-6 bg-black/50 absolute bottom-0 left-0 right-0"
           style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}>
        
        {/* Switch Camera Button */}
        <button
          onClick={switchCamera}
          disabled={timerActive || isLoading}
          className={`p-4 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors ${
            timerActive || isLoading ? 'opacity-50' : ''
          }`}
        >
          <RotateCcw className="w-6 h-6" />
        </button>
        
        {/* Capture Button */}
        <button
          onClick={startCapture}
          disabled={!!cameraError || isLoading || timerActive || !cameraReady}
          className={`relative p-1 rounded-full transition-all ${
            cameraError || isLoading || !cameraReady ? 'opacity-50' : 'active:scale-95'
          }`}
        >
          <div className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center ${
            timerActive ? 'bg-red-500' : 'bg-white'
          }`}>
            {timerActive ? (
              <span className="text-2xl font-bold text-white">{timerSeconds}</span>
            ) : (
              <Circle className={`w-16 h-16 ${timerMode === 5 ? 'text-yellow-500' : 'text-gray-300'}`} fill={timerMode === 5 ? '#EAB308' : '#D1D5DB'} />
            )}
          </div>
        </button>
        
        {/* Timer Indicator (spacer for symmetry) */}
        <div className="w-14 h-14" />
      </div>
      
      {/* Timer Mode Indicator */}
      {timerMode === 5 && !timerActive && cameraReady && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-full text-sm font-medium">
          ⏱️ Timer: 5 seconds
        </div>
      )}
    </motion.div>
  );
}

export default InAppCamera;
