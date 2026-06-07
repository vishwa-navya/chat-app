import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useEmergencyExit(nickname: 'Vishwa' | 'Ammu') {
  const ignoreNextBlur = useRef(false);

  useEffect(() => {
    if (nickname !== 'Ammu') return;

    const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
    if (isMobile) return;

    const emergencyLogout = async () => {
      await supabase.auth.signOut();
      window.location.replace('/login');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emergencyLogout();
      }
    };

    const handleBlur = () => {
      if (ignoreNextBlur.current) {
        ignoreNextBlur.current = false;
        return;
      }
      emergencyLogout();
    };

    const handleFileOpen = () => {
      ignoreNextBlur.current = true;
      setTimeout(() => {
        ignoreNextBlur.current = false;
      }, 1500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', () => (ignoreNextBlur.current = false));

    // 👇 IMPORTANT: mark file picker usage
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'file'
      ) {
        handleFileOpen();
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [nickname]);
}
