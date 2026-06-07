// src/hooks/useMemoryManager.ts
import { useEffect, useRef, useCallback } from 'react';

/**
 * Aggressive memory management for cold start issues
 * Pre-allocates and releases memory to defrag heap before camera use
 */
export const useMemoryManager = () => {
  const lastCameraUseRef = useRef<number>(0);
  const isWarmingRef = useRef(false);

  // Check if this is a cold start (> 2 minutes since last camera use)
  const isColdStart = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastUse = now - lastCameraUseRef.current;
    return timeSinceLastUse > 2 * 60 * 1000; // 2 minutes
  }, []);

  // Aggressive memory defragmentation
  const defragMemory = useCallback(async (): Promise<void> => {
    if (isWarmingRef.current) return;
    isWarmingRef.current = true;

    console.log('🧹 Starting memory defrag...');

    try {
      // Step 1: Clear all object URLs
      const urls = performance.getEntriesByType('resource')
        .filter(r => r.name.startsWith('blob:'))
        .map(r => r.name);
      
      urls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch(e) {}
      });

      // Step 2: Touch IndexedDB to wake it up
      const dbs = await window.indexedDB.databases?.().catch(() => []);
      console.log('📦 IndexedDB warmed:', dbs?.length || 0, 'databases');

      // Step 3: Create and release memory blocks (forces defrag)
      const blocks: ArrayBuffer[] = [];
      for (let i = 0; i < 3; i++) {
        blocks.push(new ArrayBuffer(5 * 1024 * 1024)); // 5MB each
      }
      // Release immediately
      blocks.length = 0;

      // Step 4: Canvas warm-up (GPU memory)
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 2048, 2048);
        // Draw something complex to wake up GPU
        ctx.beginPath();
        ctx.arc(1024, 1024, 500, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      canvas.width = 0;
      canvas.height = 0;

      // Step 5: Force GC if available (Chrome Android with flags)
      if ((window as any).gc) {
        (window as any).gc();
      }

      // Step 6: Clear image cache
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src.startsWith('blob:')) {
          img.src = '';
        }
      });

      console.log('✅ Memory defrag complete');
    } catch (e) {
      console.log('Defrag error (non-critical):', e);
    } finally {
      isWarmingRef.current = false;
    }
  }, []);

  // Call this BEFORE opening camera
  const prepareForCamera = useCallback(async (): Promise<number> => {
    const cold = isColdStart();
    
    if (cold) {
      console.log('❄️ Cold start detected, aggressive warm-up...');
      await defragMemory();
      // Return longer delay for cold start
      return 800; // 800ms for cold start
    } else {
      // Warm start - minimal delay
      return 100; // 100ms for warm start
    }
  }, [isColdStart, defragMemory]);

  // Call this AFTER successful camera use
  const markCameraUsed = useCallback(() => {
    lastCameraUseRef.current = Date.now();
  }, []);

  // Initial warm-up on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      defragMemory();
    }, 1000); // 1 second after mount
    
    return () => clearTimeout(timer);
  }, [defragMemory]);

  return {
    prepareForCamera,
    markCameraUsed,
    isColdStart
  };
};