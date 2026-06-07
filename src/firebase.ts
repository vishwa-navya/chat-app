// src/firebase.ts
// ----------------------------------------------------------------------------
//  Firebase core setup  |  Firestore  |  Cloud-Messaging helpers
// ----------------------------------------------------------------------------
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  onMessage,
  Messaging,
} from 'firebase/messaging';

// ---------------------------------------------------------------------------
// 1) Firebase project config (UPDATED)
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: 'AIzaSyAK3dhL0n32MqWfDavhV6jf1vHHDSH30uo',
  authDomain: 'nxtwave-67c07.firebaseapp.com',
  projectId: 'nxtwave-67c07',
  storageBucket: 'nxtwave-67c07.firebasestorage.app',
  messagingSenderId: '960247652489',
  appId: '1:960247652489:web:0eb635009b4f1497cae658',
  measurementId: 'G-BJQHECBER0',
};

// ---------------------------------------------------------------------------
// 2) Browser compatibility checks
// ---------------------------------------------------------------------------
const isModernBrowser = () => {
  try {
    return !!(
      window.Promise &&
      window.fetch &&
      window.localStorage &&
      window.sessionStorage &&
      'serviceWorker' in navigator
    );
  } catch (error) {
    return false;
  }
};

const isStackBlitzEnvironment = () => {
  return (
    window.location.hostname.includes('stackblitz') ||
    window.location.hostname.includes('webcontainer') ||
    window.location.hostname.includes('bolt.new')
  );
};

// ---------------------------------------------------------------------------
// 3) Initialise SDKs with error handling
// ---------------------------------------------------------------------------
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize messaging with fallback
let messaging: Messaging | null = null;
try {
  if (isModernBrowser() && !isStackBlitzEnvironment()) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase messaging not available:', error);
}

export { messaging };

// ---------------------------------------------------------------------------
// 4) Register service-worker (runs once). Works on https:// or localhost.
// ---------------------------------------------------------------------------
const swPromise: Promise<ServiceWorkerRegistration | null> = (async () => {
  // Skip Service Worker registration in StackBlitz environment
  if (isStackBlitzEnvironment()) {
    console.log('⚠️ Service Worker skipped: Not supported in StackBlitz environment');
    return null;
  }

  if (!isModernBrowser() || !('serviceWorker' in navigator)) {
    console.log('⚠️ Service Worker not supported in this browser');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );
    console.log('✅ firebase-messaging-sw.js registered:', reg.scope);
    return reg;
  } catch (err) {
    console.error('❌ SW registration failed:', err);
    return null;
  }
})();

// ---------------------------------------------------------------------------
// 5) Public VAPID key (UPDATED)
// ---------------------------------------------------------------------------
const VAPID_KEY =
  'BCDcA3m_WEZAPxGdHl9SRetRRagpM7pBDcjTkKmwkXLrHsiXseSskWKbfy6zwLvhVoCT8xe6j9ZeQt5dHaWPLh4';

// ---------------------------------------------------------------------------
// 6) Helper: Get / refresh the FCM token with enhanced compatibility
// ---------------------------------------------------------------------------
export async function requestFCMToken(): Promise<string | null> {
  try {
    // Skip FCM in development or if not supported
    if (
      window.location.hostname.includes('localhost') ||
      isStackBlitzEnvironment() ||
      !messaging
    ) {
      console.log('⚠️ FCM skipped: Development environment or not supported');
      return null;
    }

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('⚠️ Notifications not supported in this browser');
      return null;
    }

    // Ask permission if we don't have it yet
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return null;
    }
    if (Notification.permission !== 'granted') return null;

    // Ensure service-worker is ready
    const registration = await swPromise;
    if (!registration) throw new Error('Service-worker not registered');

    // Fetch (or re-use cached) token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('🎯 FCM token:', token);
      return token;
    }
    console.warn('⚠️ getToken returned null');
    return null;
  } catch (err) {
    console.error('❌ FCM token error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 7) Helper: foreground message listener with fallback
// ---------------------------------------------------------------------------
export const onForegroundMessage = (cb: (payload: any) => unknown) => {
  if (!messaging) {
    console.warn('⚠️ Messaging not available for foreground messages');
    return () => {}; // Return empty cleanup function
  }
  
  try {
    return onMessage(messaging, cb);
  } catch (error) {
    console.error('❌ Error setting up foreground message listener:', error);
    return () => {};
  }
};

// ---------------------------------------------------------------------------
// 8) Enhanced compatibility helpers
// ---------------------------------------------------------------------------
export const isFirebaseSupported = () => {
  return !!(app && db);
};

export const isMessagingSupported = () => {
  return !!(messaging && isModernBrowser());
};

// Polyfill for older browsers
if (!window.Promise) {
  console.warn('⚠️ Promise not supported, some features may not work');
}

// Enhanced error handling for Firestore operations
export const safeFirestoreOperation = async (operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Firestore operation failed:', error);
    // Could implement retry logic here
    throw error;
  }
};