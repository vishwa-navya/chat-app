// src/firebase-lastseen.ts
// ----------------------------------------------------------------------------
//  Separate Firebase project for Last Seen tracking
// ----------------------------------------------------------------------------
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// 1) Separate Firebase project config for Last Seen
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
// 2) Initialize separate Firebase app for Last Seen
// ---------------------------------------------------------------------------
export const lastSeenApp = initializeApp(lastSeenFirebaseConfig, 'lastSeenApp');
export const lastSeenDb = getFirestore(lastSeenApp);

// ---------------------------------------------------------------------------
// 3) Last Seen data structure
// ---------------------------------------------------------------------------
export interface LastSeenData {
  userId: string;
  timestamp: any; // Firestore timestamp
  isOnline: boolean;
  lastActivity: any;
}

// ---------------------------------------------------------------------------
// 4) Update user's last seen when going offline
// ---------------------------------------------------------------------------
export const updateLastSeen = async (userId: string, isOnline: boolean = false) => {
  try {
    const lastSeenData: Partial<LastSeenData> = {
      userId,
      timestamp: serverTimestamp(),
      isOnline,
      lastActivity: serverTimestamp()
    };

    await setDoc(doc(lastSeenDb, 'lastSeen', userId), lastSeenData, { merge: true });
    console.log(`✅ Last seen updated for ${userId}: ${isOnline ? 'online' : 'offline'}`);
  } catch (error) {
    console.error('❌ Error updating last seen:', error);
  }
};

// ---------------------------------------------------------------------------
// 5) Get user's last seen data
// ---------------------------------------------------------------------------
export const getLastSeen = async (userId: string): Promise<LastSeenData | null> => {
  try {
    const docSnap = await getDoc(doc(lastSeenDb, 'lastSeen', userId));
    
    if (docSnap.exists()) {
      return docSnap.data() as LastSeenData;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching last seen:', error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// 6) Format last seen timestamp
// ---------------------------------------------------------------------------
export const formatLastSeen = (lastSeenData: LastSeenData | null): string => {
  if (!lastSeenData || !lastSeenData.timestamp) {
    return '';
  }

  // If user is currently online, don't show last seen
  if (lastSeenData.isOnline) {
    return '';
  }

  try {
    // Convert Firestore timestamp to Date
    const lastSeenDate = lastSeenData.timestamp.toDate ? 
      lastSeenData.timestamp.toDate() : 
      new Date(lastSeenData.timestamp);

    // Work with local timezone for accurate "today" detection
    const now = new Date();

    // Get start of today in local timezone
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);


    // Check if last seen was today (after midnight)
    if (lastSeenDate >= todayStart) {
      // Show only time for today
      return lastSeenDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else {
      // Show date + time for yesterday and earlier
      const day = lastSeenDate.getDate();
      const month = lastSeenDate.toLocaleDateString('en-US', { 
        month: 'short'
      });
      const time = lastSeenDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `${day} ${month} ${time}`;
    }
  } catch (error) {
    console.error('Error formatting last seen:', error);
    return '';
  }
};

// ---------------------------------------------------------------------------
// 7) Set user online status
// ---------------------------------------------------------------------------
export const setUserOnline = async (userId: string) => {
  await updateLastSeen(userId, true);
};

// ---------------------------------------------------------------------------
// 8) Set user offline status
// ---------------------------------------------------------------------------
export const setUserOffline = async (userId: string) => {
  await updateLastSeen(userId, false);
};