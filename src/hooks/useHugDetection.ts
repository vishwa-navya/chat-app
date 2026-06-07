import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface HugDetectionProps {
  messages: any[];
  nickname: 'Vishwa' | 'Ammu';
  onHugSuccess: (partnerName: string) => void;
}

interface HugSyncData {
  hugId: string;
  initiator: string;
  responder: string;
  timestamp: number;
}
export function useHugDetection({ messages, nickname, onHugSuccess }: HugDetectionProps) {
  const [pendingHugFrom, setPendingHugFrom] = useState<string | null>(null);
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const processedHugs = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);
  const hugSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection for hug synchronization
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io('https://voice-call-server-b4l9.onrender.com', {
        transports: ['websocket', 'polling']
      });

      // Register user for hug sync
      socketRef.current.emit('register-user', nickname);

      // Listen for synchronized hug events
      socketRef.current.on('hug-sync-vibrate', (data: HugSyncData) => {
        console.log('🫂 Received synchronized hug vibration:', data);
        triggerSynchronizedVibration();
        
        // Show success message after vibration
        setTimeout(() => {
          const partnerName = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
          onHugSuccess(partnerName);
        }, 500); // Small delay after vibration
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (hugSyncTimeoutRef.current) {
        clearTimeout(hugSyncTimeoutRef.current);
      }
    };
  }, [nickname, onHugSuccess]);
  useEffect(() => {
    if (messages.length === 0) return;

    // Get the latest message
    const latestMessage = messages[messages.length - 1];
    
    // Skip if we already processed this message
    if (latestMessage.id === lastProcessedMessageId) return;
    setLastProcessedMessageId(latestMessage.id);

    // Skip system messages
    if (latestMessage.type === 'system') return;

    const messageText = latestMessage.text?.trim();
    const sender = latestMessage.by;
    
    // Check if message is exactly 🫂 emoji
    const isHugEmoji = messageText === '🫂';

    if (isHugEmoji && sender === 'Vishwa') {
      // Vishwa sent 🫂 - set pending hug
      console.log('🫂 Vishwa initiated hug, waiting for Ammu...');
      setPendingHugFrom('Vishwa');
      
      // Clear any previous pending state after 5 minutes (timeout)
      setTimeout(() => {
        setPendingHugFrom(null);
      }, 5 * 60 * 1000);
      
    } else if (isHugEmoji && sender === 'Ammu' && pendingHugFrom === 'Vishwa') {
      // Ammu responded with 🫂 to Vishwa's hug - SUCCESS!
      console.log('🎉 Hug successful! Both users sent 🫂');
      
      // Create unique hug ID to prevent duplicate processing
      const hugId = `${latestMessage.id}_hug`;
      if (processedHugs.current.has(hugId)) return;
      processedHugs.current.add(hugId);
      
      // Send synchronized hug event to server
      if (socketRef.current) {
        const hugSyncData: HugSyncData = {
          hugId,
          initiator: 'Vishwa',
          responder: 'Ammu',
          timestamp: Date.now()
        };
        
        console.log('🫂 Sending synchronized hug event:', hugSyncData);
        socketRef.current.emit('hug-sync-initiate', hugSyncData);
      }
      
      // Reset pending state
      setPendingHugFrom(null);
      
    } else if (sender === 'Ammu' && pendingHugFrom === 'Vishwa') {
      // Ammu sent something else instead of 🫂 - REJECT
      console.log('❌ Hug rejected: Ammu sent something other than 🫂');
      setPendingHugFrom(null);
      
    } else if (sender === 'Vishwa' && pendingHugFrom === 'Vishwa') {
      // Vishwa sent another message before Ammu could respond - REJECT
      console.log('❌ Hug rejected: Vishwa sent another message');
      setPendingHugFrom(null);
    }
  }, [messages, nickname, pendingHugFrom, lastProcessedMessageId, onHugSuccess]);

  return {
    pendingHugFrom,
    isPendingHug: !!pendingHugFrom
  };
}

function triggerSynchronizedVibration() {
  // Check if we're on a mobile device
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile && 'vibrate' in navigator) {
    try {
      // Synchronized vibration pattern: 400ms on, 200ms off, 400ms on
      navigator.vibrate([400, 200, 400]);
      console.log('📳 Synchronized hug vibration triggered');
    } catch (error) {
      console.log('Vibration not supported or failed:', error);
    }
  } else {
    console.log('💻 Desktop detected - no vibration for hug');
  }
}