import { useState, useEffect } from 'react';

export function useTabVisibility() {
  const [isTabActive, setIsTabActive] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
      console.log(`👁️ Tab visibility changed: ${!document.hidden ? 'ACTIVE' : 'HIDDEN'}`);
    };

    const handleFocus = () => {
      setIsTabActive(true);
      console.log('👁️ Window focused - Tab ACTIVE');
    };

    const handleBlur = () => {
      setIsTabActive(false);
      console.log('👁️ Window blurred - Tab HIDDEN');
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return isTabActive;
}