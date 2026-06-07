import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Camera, Image, Video, Paperclip } from 'lucide-react';
import { Button } from './ui/button';
import {
  handleCameraImage,
  createPreviewUrl,
  detectDeviceCapabilities,
  compressImageLightweight,
} from '../lib/imageCompression';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import InAppCamera from './InAppCamera';

interface InstagramPlusButtonProps {
  onImageSelect: (file: File, previewUrl: string) => void;
  onVideoSelect?: (file: File, previewUrl: string) => void;
  onFileSelect?: (file: File, previewUrl: string) => void;
  className?: string;
  theme?: 'chat2' | 'chat3';
  nickname?: string;
}

// Session storage keys - MUST match useAmmeSafetyLogout.ts
const SESSION_KEYS = {
  CAMERA_OPEN: '__CAMERA_OPEN_SESSION__',
  AMMU_CAMERA_OPEN: '__AMMU_CAMERA_OPEN_SESSION__',
  CAMERA_USER: '__CAMERA_USER_SESSION__',
  AMMU_CAMERA_USER: '__AMMU_CAMERA_USER_SESSION__',
  CAMERA_TIME: '__CAMERA_TIME_SESSION__',
  AMMU_CAMERA_TIME: '__AMMU_CAMERA_TIME_SESSION__',
};

/**
 * 📱 INSTAGRAM-STYLE PLUS BUTTON
 * 
 * Features:
 * - In-App Camera with front/back switching & 5s timer
 * - Native Camera (Capacitor) for APK
 * - Gallery picker
 * - Video picker
 * - File picker
 * 
 * 🔒 CAMERA SAFETY: Sets flags to prevent logout during camera use
 */
function InstagramPlusButton({
  onImageSelect,
  onVideoSelect,
  onFileSelect,
  className = '',
  theme = 'chat2',
  nickname = 'unknown'
}: InstagramPlusButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showInAppCamera, setShowInAppCamera] = useState(false);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const inCameraFlowRef = useRef(false);
  
  const capabilities = detectDeviceCapabilities();

  const getThemeColors = () => {
    if (theme === 'chat3') {
      return {
        mainButton: 'bg-[#4A90E2] hover:bg-[#3A7BC8]',
        optionButton: 'bg-white/90 hover:bg-white text-gray-700 border border-gray-200',
        backdrop: 'bg-black/20'
      };
    }
    return {
      mainButton: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
      optionButton: 'bg-white/90 hover:bg-white text-gray-700 border border-gray-200',
      backdrop: 'bg-black/20'
    };
  };

  const colors = getThemeColors();

  // ============================================================
  // 🔒 CAMERA SAFETY FUNCTIONS
  // ============================================================

  const enterCameraMode = useCallback(() => {
    const now = Date.now();
    inCameraFlowRef.current = true;
    
    console.log(`📷 [Camera] ENTERING camera mode for ${nickname} at:`, now);
    
    const win = window as any;
    
    win.__CAMERA_OPEN__ = true;
    win.__CAMERA_OPEN_TIME__ = now;
    win.__CAMERA_IN_FLOW__ = true;
    win.__CAMERA_USER__ = nickname;
    
    win.__AMMU_CAMERA_OPEN__ = true;
    win.__AMMU_CAMERA_OPEN_TIME__ = now;
    win.__AMMU_IN_CAMERA_FLOW__ = true;
    
    if (win.__AMMU_SKIP_LOGOUT__?.start) win.__AMMU_SKIP_LOGOUT__.start();
    if (win.__CAMERA_SKIP_LOGOUT__?.start) win.__CAMERA_SKIP_LOGOUT__.start();
    
    try {
      sessionStorage.setItem(SESSION_KEYS.CAMERA_OPEN, 'true');
      sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_OPEN, 'true');
      sessionStorage.setItem(SESSION_KEYS.CAMERA_USER, nickname);
      sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_USER, nickname);
      sessionStorage.setItem(SESSION_KEYS.CAMERA_TIME, now.toString());
      sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_TIME, now.toString());
    } catch (e) {
      console.warn('📷 [Camera] Could not persist to sessionStorage:', e);
    }
    
    console.log('📷 [Camera] ✅ Camera mode ACTIVE');
  }, [nickname]);
  
  const exitCameraMode = useCallback((delay = 3000) => {
    console.log(`📷 [Camera] EXITING camera mode (delay: ${delay}ms)...`);
    
    inCameraFlowRef.current = false;
    
    const win = window as any;
    win.__CAMERA_IN_FLOW__ = false;
    win.__AMMU_IN_CAMERA_FLOW__ = false;
    
    setTimeout(() => {
      const win = window as any;
      
      win.__CAMERA_OPEN__ = false;
      win.__AMMU_CAMERA_OPEN__ = false;
      win.__CAMERA_OPEN_TIME__ = 0;
      win.__AMMU_CAMERA_OPEN_TIME__ = 0;
      win.__CAMERA_IN_FLOW__ = false;
      win.__AMMU_IN_CAMERA_FLOW__ = false;
      
      if (win.__AMMU_SKIP_LOGOUT__?.stop) win.__AMMU_SKIP_LOGOUT__.stop();
      if (win.__CAMERA_SKIP_LOGOUT__?.stop) win.__CAMERA_SKIP_LOGOUT__.stop();
      
      try {
        sessionStorage.removeItem(SESSION_KEYS.CAMERA_OPEN);
        sessionStorage.removeItem(SESSION_KEYS.AMMU_CAMERA_OPEN);
        sessionStorage.removeItem(SESSION_KEYS.CAMERA_USER);
        sessionStorage.removeItem(SESSION_KEYS.AMMU_CAMERA_USER);
        sessionStorage.removeItem(SESSION_KEYS.CAMERA_TIME);
        sessionStorage.removeItem(SESSION_KEYS.AMMU_CAMERA_TIME);
      } catch (e) {}
      
      console.log('📷 [Camera] ✅ Camera mode EXITED - All flags cleared');
    }, delay);
  }, []);

  /**
   * Retry helper
   */
  const withRetry = useCallback(async <T,>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; initialDelay?: number; onRetry?: (attempt: number, error: Error) => void } = {}
  ): Promise<T> => {
    const { maxRetries = 3, initialDelay = 500, onRetry } = options;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt <= maxRetries) {
          const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 10000);
          console.log(`🔄 Retry ${attempt}/${maxRetries} after ${delay}ms`);
          onRetry?.(attempt, lastError);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }, []);

  // ============================================================
  // 👁️ VISIBILITY CHANGE HANDLER
  // ============================================================
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      const win = window as any;
      
      if (document.visibilityState === 'visible') {
        if (inCameraFlowRef.current) {
          console.log('📷 [Camera] App visible - still in camera flow, re-setting flags');
          
          win.__CAMERA_OPEN__ = true;
          win.__AMMU_CAMERA_OPEN__ = true;
          
          if (win.__AMMU_SKIP_LOGOUT__?.start) win.__AMMU_SKIP_LOGOUT__.start();
          if (win.__CAMERA_SKIP_LOGOUT__?.start) win.__CAMERA_SKIP_LOGOUT__.start();
        }
      } else {
        if (inCameraFlowRef.current) {
          console.log('📷 [Camera] App going to background - persisting state');
          
          const now = Date.now();
          try {
            sessionStorage.setItem(SESSION_KEYS.CAMERA_OPEN, 'true');
            sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_OPEN, 'true');
            sessionStorage.setItem(SESSION_KEYS.CAMERA_USER, nickname);
            sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_USER, nickname);
            sessionStorage.setItem(SESSION_KEYS.CAMERA_TIME, now.toString());
            sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_TIME, now.toString());
          } catch (e) {}
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [nickname]);

  // ============================================================
  // 📄 PAGE HIDE HANDLER
  // ============================================================
  
  useEffect(() => {
    const handlePageHide = () => {
      if (inCameraFlowRef.current) {
        console.log('📷 [Camera] Page hide - persisting state for recovery');
        
        const now = Date.now();
        try {
          sessionStorage.setItem(SESSION_KEYS.CAMERA_OPEN, 'true');
          sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_OPEN, 'true');
          sessionStorage.setItem(SESSION_KEYS.CAMERA_USER, nickname);
          sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_USER, nickname);
          sessionStorage.setItem(SESSION_KEYS.CAMERA_TIME, now.toString());
          sessionStorage.setItem(SESSION_KEYS.AMMU_CAMERA_TIME, now.toString());
        } catch (e) {}
      }
    };
    
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [nickname]);

  // ============================================================
  // 📷 CAMERA IMAGE PROCESSING
  // ============================================================

  /**
   * Handle image from In-App Camera capture
   */
  const handleInAppCameraCapture = useCallback((file: File, previewUrl: string) => {
    console.log(`📷 In-App Camera capture: ${(file.size / 1024).toFixed(0)}KB`);
    setShowInAppCamera(false);
    onImageSelect(file, previewUrl);
    exitCameraMode(3000);
  }, [onImageSelect, exitCameraMode]);

  /**
   * Handle image from native camera capture (Capacitor)
   */
  const handleCameraImageCapture = useCallback(async (image: { webPath: string }) => {
    console.log('📷 Native camera capture via Capacitor');
    
    setIsProcessing(true);
    setProcessingMessage('Loading photo...');
    
    let blob: Blob | null = null;
    let file: File | null = null;
    
    try {
      console.log('📷 Fetching image from webPath...');
      const response = await fetch(image.webPath);
      blob = await response.blob();
      file = new File([blob], "photo.jpg", { type: blob.type || 'image/jpeg' });
      
      console.log(`📷 Camera capture: ${(file.size / 1024).toFixed(0)}KB`);
      setProcessingMessage('Processing photo...');
      
      const result = await withRetry(
        async () => {
          const processedResult = await handleCameraImage(file!, (stage) => {
            setProcessingMessage(stage);
          });
          return processedResult;
        },
        {
          maxRetries: 3,
          initialDelay: 500,
          onRetry: (attempt, error) => {
            console.log(`📷 Retry attempt ${attempt}: ${error.message}`);
            setProcessingMessage(`Retrying... (${attempt}/3)`);
          }
        }
      );
      
      console.log(`✅ Processed: ${(result.file.size / 1024).toFixed(0)}KB`);
      onImageSelect(result.file, result.previewUrl);
      
    } catch (err) {
      console.error('📷 Camera image processing failed:', err);
      
      if (blob && file) {
        try {
          console.log('📷 Using original file as fallback');
          const previewUrl = URL.createObjectURL(blob);
          onImageSelect(file, previewUrl);
        } catch (fallbackErr) {
          console.error('📷 Fallback failed:', fallbackErr);
          alert('Failed to process image. Please try again.');
        }
      } else {
        alert('Failed to load image. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      exitCameraMode(3000);
    }
  }, [onImageSelect, withRetry, exitCameraMode]);

  /**
   * Handle gallery image selection
   */
  const handleGalleryImageSelect = useCallback(async (file: File) => {
    console.log(`🖼️ Gallery: ${(file.size / 1024).toFixed(0)}KB`);
    
    setIsProcessing(true);
    setProcessingMessage('Preparing image...');
    
    try {
      const result = await withRetry(
        async () => {
          if (file.size > 500 * 1024 || capabilities.isLowMemory) {
            setProcessingMessage('Optimizing...');
            
            const bitmap = await createImageBitmap(file);
            const needsResize = bitmap.width > capabilities.maxDimension || 
                               bitmap.height > capabilities.maxDimension;
            bitmap.close();
            
            if (needsResize || file.size > 200 * 1024) {
              const processedFile = await compressImageLightweight(file, 100);
              const previewUrl = URL.createObjectURL(processedFile);
              return { file: processedFile, previewUrl };
            }
          }
          
          const previewUrl = createPreviewUrl(file);
          return { file, previewUrl };
        },
        {
          maxRetries: 2,
          initialDelay: 300,
          onRetry: (attempt) => {
            setProcessingMessage(`Retrying... (${attempt}/2)`);
          }
        }
      );
      
      onImageSelect(result.file, result.previewUrl);
      
    } catch (err) {
      console.error('🖼️ Gallery processing failed:', err);
      
      try {
        const previewUrl = createPreviewUrl(file);
        onImageSelect(file, previewUrl);
      } catch (fallbackErr) {
        alert('Failed to process image. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      exitCameraMode(3000);
    }
  }, [capabilities, onImageSelect, withRetry, exitCameraMode]);

  /**
   * Handle video selection
   */
  const handleVideoSelectInternal = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Preparing video...');
    
    try {
      const previewUrl = await withRetry(
        async () => createPreviewUrl(file),
        { maxRetries: 2, initialDelay: 300 }
      );
      onVideoSelect?.(file, previewUrl);
    } catch (err) {
      console.error('🎬 Video processing failed:', err);
      onVideoSelect?.(file, '');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      exitCameraMode(3000);
    }
  }, [onVideoSelect, withRetry, exitCameraMode]);

  /**
   * Handle file selection
   */
  const handleFileSelectInternal = useCallback((file: File) => {
    onFileSelect?.(file, '');
    exitCameraMode(3000);
  }, [onFileSelect, exitCameraMode]);

  /**
   * Main file input change handler
   */
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'gallery-image' | 'video' | 'file'
  ) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      console.log('📷 User cancelled picker');
      exitCameraMode(3000);
      return;
    }
    
    e.target.value = '';
    
    switch (type) {
      case 'gallery-image':
        await handleGalleryImageSelect(file);
        break;
      case 'video':
        await handleVideoSelectInternal(file);
        break;
      case 'file':
        handleFileSelectInternal(file);
        break;
    }
  };

  // ============================================================
  // BUTTON CLICK HANDLERS
  // ============================================================

  const handleQuickTap = () => {
    if (!isLongPress && !isExpanded && !isProcessing) {
      enterCameraMode();
      
      setTimeout(() => {
        galleryInputRef.current?.click();
      }, 100);
    }
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault();
    touchStartTimeRef.current = Date.now();
    setIsLongPress(false);

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      setIsExpanded(true);
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 300);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault();
    const pressDuration = Date.now() - touchStartTimeRef.current;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (pressDuration < 300 && !isExpanded && !isLongPress) {
      handleQuickTap();
    }

    setIsLongPress(false);
  };

  const handleBackdropClick = () => {
    if (!isProcessing) {
      setIsExpanded(false);
    }
  };

  /**
   * 📷 Open In-App Camera (with timer feature)
   */
  const handleInAppCameraClick = useCallback(() => {
    setIsExpanded(false);
    enterCameraMode();
    setShowInAppCamera(true);
  }, [enterCameraMode]);

  /**
   * 📱 Open native camera using Capacitor (for APK)
   */
  const handleNativeCameraClick = useCallback(async () => {
    setIsExpanded(false);
    
    enterCameraMode();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      console.log('📷 Opening Capacitor camera...');
      
      const image = await CapacitorCamera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true
      });

      if (!image.webPath) {
        console.log('📷 No image path returned');
        exitCameraMode(3000);
        return;
      }

      console.log('📷 Got image from camera:', image.webPath);
      await handleCameraImageCapture(image);

    } catch (error) {
      console.log('📷 Camera cancelled or failed:', error);
      exitCameraMode(3000);
    }
  }, [enterCameraMode, handleCameraImageCapture, exitCameraMode]);

  const handleGalleryClick = useCallback(() => {
    if (!isProcessing) {
      setIsExpanded(false);
      enterCameraMode();
      
      setTimeout(() => {
        galleryInputRef.current?.click();
      }, 100);
    }
  }, [isProcessing, enterCameraMode]);

  const handleVideoClick = useCallback(() => {
    if (!isProcessing) {
      setIsExpanded(false);
      enterCameraMode();
      
      setTimeout(() => {
        videoInputRef.current?.click();
      }, 100);
    }
  }, [isProcessing, enterCameraMode]);

  const handleFileClick = useCallback(() => {
    if (!isProcessing) {
      setIsExpanded(false);
      enterCameraMode();
      
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    }
  }, [isProcessing, enterCameraMode]);

  // ============================================================
  // ANIMATIONS
  // ============================================================

  const mainButtonVariants = {
    normal: { scale: 1, rotate: 0, transition: { duration: 0.2 } },
    expanded: { scale: 1.1, rotate: 45, transition: { duration: 0.3 } },
  };

  const optionsContainerVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, staggerChildren: 0.1 } },
  };

  const optionVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
  };

  // Check if running in Capacitor (native app)
  const isNativeApp = typeof window !== 'undefined' && 
    (window as any).Capacitor?.isNativePlatform?.();

  return (
    <div className={`relative ${className}`}>
      {/* In-App Camera Modal */}
      <InAppCamera
        isOpen={showInAppCamera}
        onClose={() => {
          setShowInAppCamera(false);
          exitCameraMode(1000);
        }}
        onCapture={handleInAppCameraCapture}
        nickname={nickname}
      />

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          >
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-700 font-medium">{processingMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && !isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 ${colors.backdrop}`}
            style={{ zIndex: 40 }}
            onClick={handleBackdropClick}
          />
        )}
      </AnimatePresence>

      {/* Option Buttons */}
      <AnimatePresence>
        {isExpanded && !isProcessing && (
          <motion.div
            variants={optionsContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute bottom-16 left-0 flex flex-col gap-3 items-center"
            style={{ zIndex: 60 }}
          >
            {/* In-App Camera (with Timer) - Primary */}
            <motion.div variants={optionVariants}>
              <Button
                onClick={handleInAppCameraClick}
                size="icon"
                className={`${colors.optionButton} shadow-lg rounded-full w-12 h-12 bg-green-500 text-white hover:bg-green-600`}
                title="In-App Camera (with Timer)"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </motion.div>

            {/* Native Camera (Capacitor) - Only show in native app */}
            {isNativeApp && (
              <motion.div variants={optionVariants}>
                <Button
                  onClick={handleNativeCameraClick}
                  size="icon"
                  className={`${colors.optionButton} shadow-lg rounded-full w-12 h-12`}
                  title="Native Camera"
                >
                  📱
                </Button>
              </motion.div>
            )}

            {/* Gallery */}
            <motion.div variants={optionVariants}>
              <Button
                onClick={handleGalleryClick}
                size="icon"
                className={`${colors.optionButton} shadow-lg rounded-full w-12 h-12`}
                title="Choose Image"
              >
                <Image className="w-5 h-5" />
              </Button>
            </motion.div>

            {/* Video */}
            {onVideoSelect && (
              <motion.div variants={optionVariants}>
                <Button
                  onClick={handleVideoClick}
                  size="icon"
                  className={`${colors.optionButton} shadow-lg rounded-full w-12 h-12`}
                  title="Upload Video"
                >
                  <Video className="w-5 h-5" />
                </Button>
              </motion.div>
            )}

            {/* File */}
            {onFileSelect && (
              <motion.div variants={optionVariants}>
                <Button
                  onClick={handleFileClick}
                  size="icon"
                  className={`${colors.optionButton} shadow-lg rounded-full w-12 h-12`}
                  title="Attach File"
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Plus Button */}
      <motion.button
        variants={mainButtonVariants}
        animate={isExpanded ? 'expanded' : 'normal'}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        className={`${colors.mainButton} text-white p-3 rounded-full shadow-lg transition-all duration-200 relative ${isProcessing ? 'opacity-50' : ''}`}
        style={{ zIndex: 70 }}
        title={isExpanded ? 'Close' : 'Add Media'}
        disabled={isProcessing}
      >
        <motion.div animate={{ rotate: isExpanded ? 45 : 0 }} transition={{ duration: 0.3 }}>
          {isExpanded ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </motion.div>
      </motion.button>

      {/* Hidden Inputs */}
      <input 
        ref={galleryInputRef} 
        type="file" 
        accept="image/*"
        onChange={(e) => handleFileSelect(e, 'gallery-image')} 
        className="hidden" 
      />
      
      <input 
        ref={videoInputRef} 
        type="file" 
        accept="video/*"
        onChange={(e) => handleFileSelect(e, 'video')} 
        className="hidden" 
      />
      
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt"
        onChange={(e) => handleFileSelect(e, 'file')} 
        className="hidden" 
      />
    </div>
  );
}

export default InstagramPlusButton;
