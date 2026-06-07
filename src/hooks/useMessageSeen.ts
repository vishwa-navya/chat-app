import { useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { io, Socket } from 'socket.io-client';

interface UseMessageSeenProps {
  nickname: string;
  messages: any[];
  isTabActive: boolean;
}

export function useMessageSeen({ nickname, messages, isTabActive }: UseMessageSeenProps) {
  const socketRef = useRef<Socket | null>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const isTabActiveRef = useRef(isTabActive); // ⭐ NEW: Track current value

  // ⭐ NEW: Keep ref in sync with prop
  useEffect(() => {
    isTabActiveRef.current = isTabActive;
  }, [isTabActive]);

  // Initialize socket connection
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io('https://voice-call-server-b4l9.onrender.com ', {
        transports: ['websocket', 'polling']
      });

      // Register user
      socketRef.current.emit('register-user', nickname);

      // Listen for message seen confirmations
      socketRef.current.on('message-seen-confirmation', (data: { messageIds: string[] }) => {
        console.log('📖 Message seen confirmation received:', data.messageIds);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [nickname]);

  // Mark messages as seen when tab is active and messages are visible
  const markMessagesAsSeen = useCallback(async () => {
    // ⭐ FIX: Use ref to get CURRENT value, not stale closure value
    if (!isTabActiveRef.current || !messages.length || !socketRef.current) return;

    // Find unread messages from other users
    const unreadMessages = messages.filter(msg => {
      // Only process messages from other users that haven't been seen by current user
      const isFromOtherUser = msg.by !== nickname;
      const notSeenByMe = !msg.seenBy?.includes(nickname);
      const notProcessed = !processedMessagesRef.current.has(msg.id);
      
      return isFromOtherUser && notSeenByMe && notProcessed;
    });

    if (unreadMessages.length === 0) return;

    console.log(`📖 Marking ${unreadMessages.length} messages as seen by ${nickname}`);

    try {
      // Update Firebase for each message
      const updatePromises = unreadMessages.map(async (msg) => {
        await updateDoc(doc(db, 'privateMessages', msg.id), {
          seenBy: arrayUnion(nickname)
        });
        
        // Mark as processed to avoid duplicate updates
        processedMessagesRef.current.add(msg.id);
        
        return msg.id;
      });

      const messageIds = await Promise.all(updatePromises);

      // Emit socket event to notify sender
      socketRef.current.emit('messages-read', {
        messageIds,
        readBy: nickname,
        senderIds: [...new Set(unreadMessages.map(msg => msg.by))]
      });

      console.log('✅ Messages marked as seen in Firebase and socket event emitted');

    } catch (error) {
      console.error('❌ Error marking messages as seen:', error);
    }
  }, [messages, nickname]); // ⭐ Removed isTabActive from dependencies - using ref instead

  // Trigger seen marking when conditions are met
  useEffect(() => {
    if (isTabActive && messages.length > 0) {
      // Small delay to ensure messages are rendered and visible
      const timer = setTimeout(markMessagesAsSeen, 1000);
      return () => clearTimeout(timer);
    }
  }, [isTabActive, messages.length, markMessagesAsSeen]);

  return {
    socket: socketRef.current
  };
}