import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

interface PresenceData {
  isOnline: boolean;
  lastSeen: any;
  lastActivity: any;
  deviceInfo?: {
    userAgent: string;
    isMobile: boolean;
    platform: string;
  };
  clientTimestamp?: string;
}

interface UseAdvancedPresenceProps {
  userId: string;
  otherUserId: string;
}

// 🔥 Rules for reliable notification:
// We consider other user ONLINE only if:
// - isOnline = true,
// - AND lastActivity < 40 seconds old.
// In ALL other cases → treat as OFFLINE.
const ONLINE_WINDOW_MS = 40 * 1000;

export function useAdvancedPresence({ userId, otherUserId }: UseAdvancedPresenceProps) {
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');

  // Self-presence trackers
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const lastPresenceUpdate = useRef(0);
  const isCurrentlyOnline = useRef(false);
  const isPageVisible = useRef(!document.hidden);
  const hasBeenOnline = useRef(false);

  // Cache for other user presence to avoid flickering states
  const lastKnownOtherOnline = useRef(false);
  const lastKnownOtherLastSeen = useRef('');

  // Device info
  const getDeviceInfo = useCallback(() => {
    const userAgent = navigator.userAgent;
    const isMobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    return {
      userAgent,
      isMobile,
      platform: navigator.platform || 'Unknown'
    };
  }, []);

  // ---------- SELF PRESENCE UPDATE ----------
  const updatePresence = useCallback(
    async (isOnline: boolean, force = false) => {
      const now = Date.now();

      // Reduce write operations to Firestore
      if (!force && now - lastPresenceUpdate.current < 5000 && isCurrentlyOnline.current === isOnline) {
        return;
      }

      lastPresenceUpdate.current = now;
      isCurrentlyOnline.current = isOnline;

      try {
        await setDoc(
          doc(lastSeenDb, 'presence', userId),
          {
            isOnline,
            lastSeen: serverTimestamp(),
            lastActivity: serverTimestamp(),
            deviceInfo: getDeviceInfo(),
            clientTimestamp: new Date().toISOString()
          },
          { merge: true }
        );

        setConnectionStatus(isOnline ? 'online' : 'offline');

        if (isOnline) hasBeenOnline.current = true;

        // Legacy system support
        await setDoc(
          doc(db, 'users', userId),
          {
            isActive: isOnline,
            lastUpdate: new Date(),
            presenceTimestamp: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (err) {
        console.error('❌ Error updating presence:', err);
      }
    },
    [userId, getDeviceInfo]
  );

  const setOnline = useCallback(() => {
    if (isPageVisible.current) updatePresence(true);
  }, [updatePresence]);

  const setOffline = useCallback(() => {
    updatePresence(false, true);
  }, [updatePresence]);

  // ---------- HEARTBEAT (Every 30 sec to maintain online) ----------
  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

    heartbeatInterval.current = setInterval(() => {
      if (isPageVisible.current) updatePresence(true);
    }, 30000);
  }, [updatePresence]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  // ---------- VISIBILITY EVENTS ----------
  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      isPageVisible.current = visible;

      if (visible) {
        setOnline();
        startHeartbeat();
      } else {
        setOffline();
        stopHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [setOnline, setOffline, startHeartbeat, stopHeartbeat]);

  // ---------- FOCUS / BLUR ----------
  useEffect(() => {
    const handleFocus = () => {
      if (isPageVisible.current) {
        setOnline();
        startHeartbeat();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [setOnline, startHeartbeat]);

  // ---------- UNLOAD ----------
  useEffect(() => {
    const handleUnload = () => {
      if (navigator.sendBeacon && hasBeenOnline.current) {
        const presenceData = {
          isOnline: false,
          lastSeen: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          deviceInfo: getDeviceInfo()
        };

        const blob = new Blob([JSON.stringify(presenceData)], {
          type: 'application/json'
        });

        navigator.sendBeacon(`/api/presence/${userId}`, blob);
      }

      setOffline();
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [setOffline, userId, getDeviceInfo]);

  // ---------- NETWORK ----------
  useEffect(() => {
    const handleOnline = () => {
      if (isPageVisible.current) {
        setOnline();
        startHeartbeat();
      }
    };

    const handleOffline = () => {
      setConnectionStatus('offline');
      stopHeartbeat();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline, startHeartbeat, stopHeartbeat]);

  // ---------- INIT SELF ----------
  useEffect(() => {
    if (isPageVisible.current) {
      setOnline();
      startHeartbeat();
    }

    return () => {
      stopHeartbeat();
      setOffline();
    };
  }, [setOnline, setOffline, startHeartbeat, stopHeartbeat]);

  // ---------- OTHER USER PRESENCE LISTENER (VERY IMPORTANT BLOCK) ----------
  useEffect(() => {
    const unsub = onSnapshot(
      doc(lastSeenDb, 'presence', otherUserId),
      docSnap => {
        if (!docSnap.exists()) {
          // No document means definitely offline
          setIsOtherUserOnline(false);
          setOtherUserLastSeen('');
          lastKnownOtherOnline.current = false;
          lastKnownOtherLastSeen.current = '';
          return;
        }

        const data = docSnap.data() as PresenceData;

        let isOnline = false;
        let formattedLastSeen = '';

        try {
          const lastActivity = data.lastActivity?.toDate
            ? data.lastActivity.toDate()
            : data.lastActivity
            ? new Date(data.lastActivity)
            : null;

          const now = Date.now();

          // Strong online detection
          if (
            data.isOnline &&
            lastActivity &&
            now - lastActivity.getTime() <= ONLINE_WINDOW_MS
          ) {
            isOnline = true;
          } else {
            isOnline = false;
          }

          if (!isOnline && data.lastSeen) {
            formattedLastSeen = formatLastSeen(data.lastSeen);
          }
        } catch (_) {
          isOnline = false;
        }

        // Save to cache
        lastKnownOtherOnline.current = isOnline;
        lastKnownOtherLastSeen.current = formattedLastSeen;

        // Update hook state
        setIsOtherUserOnline(isOnline);
        setOtherUserLastSeen(formattedLastSeen);
      },
      err => {
        // On Firestore error → fallback to cached state
        setIsOtherUserOnline(lastKnownOtherOnline.current);
        setOtherUserLastSeen(lastKnownOtherLastSeen.current);
      }
    );

    return unsub;
  }, [otherUserId]);

  // ---------- ACTIVITY ----------
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    const handleActivity = () => {
      if (timeout) clearTimeout(timeout);

      if (isPageVisible.current) setOnline();

      timeout = setTimeout(() => {
        if (isPageVisible.current) updatePresence(true);
      }, 5 * 60 * 1000);
    };

    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [setOnline, updatePresence]);

  return {
    isOtherUserOnline,
    otherUserLastSeen,
    connectionStatus,
    setOnline,
    setOffline,
    forceUpdate: () => updatePresence(true, true)
  };
}

// ---------- FORMAT LAST SEEN ----------
function formatLastSeen(ts: any): string {
  if (!ts) return '';

  let date: Date;
  try {
    date = ts.toDate ? ts.toDate() : new Date(ts);
  } catch {
    return '';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date >= today) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  return (
    date.getDate() +
    ' ' +
    date.toLocaleDateString('en-US', { month: 'short' }) +
    ' ' +
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  );
}
