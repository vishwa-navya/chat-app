import { useState, useEffect } from 'react';

interface PresenceEvent {
  timestamp: string;
  event: string;
  details: string;
  userId: string;
}

export function usePresenceDebugger(userId: string, enabled: boolean = false) {
  const [events, setEvents] = useState<PresenceEvent[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  const logEvent = (event: string, details: string) => {
    if (!enabled) return;
    
    const newEvent: PresenceEvent = {
      timestamp: new Date().toLocaleTimeString(),
      event,
      details,
      userId
    };
    
    setEvents(prev => [...prev.slice(-19), newEvent]); // Keep last 20 events
    console.log(`🔍 [${userId}] ${event}: ${details}`);
  };

  useEffect(() => {
    if (!enabled) return;

    // Track page visibility
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      logEvent('VISIBILITY_CHANGE', `Page ${visible ? 'visible' : 'hidden'}`);
    };

    // Track window focus/blur
    const handleFocus = () => {
      logEvent('WINDOW_FOCUS', 'Window gained focus');
    };

    const handleBlur = () => {
      logEvent('WINDOW_BLUR', 'Window lost focus');
    };

    // Track page lifecycle
    const handleBeforeUnload = () => {
      logEvent('BEFORE_UNLOAD', 'Page about to unload');
    };

    const handleUnload = () => {
      logEvent('UNLOAD', 'Page unloaded');
    };

    // Track network status
    const handleOnline = () => {
      logEvent('NETWORK_ONLINE', 'Network connection restored');
    };

    const handleOffline = () => {
      logEvent('NETWORK_OFFLINE', 'Network connection lost');
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    logEvent('DEBUGGER_INIT', `Presence debugger started for ${userId}`);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, userId]);

  const clearEvents = () => setEvents([]);

  return {
    events,
    isVisible,
    logEvent,
    clearEvents
  };
}