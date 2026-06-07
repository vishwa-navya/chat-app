import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export interface MemoryMessage {
  id: string;
  originalMessageId: string;
  text: string;
  imageUrl?: string;
  fileName?: string;
  videoUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  mimeType?: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice';
  originalSender: string; // Who originally sent the message
  savedBy: string; // Who saved it to memory
  savedAt: any;
  originalTimestamp: any;
  replyTo?: { id: string; text: string; by: string } | null;
  moodMetadata?: any;
}

export function useMemory(nickname: 'Vishwa' | 'Ammu') {
  const [memoryMessages, setMemoryMessages] = useState<MemoryMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to user's memory messages
  useEffect(() => {
    const memoryRef = collection(db, 'memory', nickname, 'messages');
    const q = query(memoryRef, orderBy('savedAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages: MemoryMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messages.push({
            id: doc.id,
            ...data
          } as MemoryMessage);
        });
        setMemoryMessages(messages);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to memory messages:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [nickname]);

  // Save message to memory
  const saveToMemory = async (message: any) => {
    try {
      // Determine message type
      let messageType: 'text' | 'image' | 'video' | 'file' | 'voice' = 'text';
      if (message.type === 'image') messageType = 'image';
      else if (message.type === 'video') messageType = 'video';
      else if (message.type === 'voice' || message.type === 'audio') messageType = 'voice';
      else if (message.type === 'file') messageType = 'file';

      // Base memory message
      const memoryMessage: any = {
        originalMessageId: message.id,
        type: messageType,
        originalSender: message.by,
        savedBy: nickname,
        savedAt: serverTimestamp(),
        originalTimestamp: message.ts
      };

      // Add text content
      if (message.text !== undefined && message.text !== null) {
        memoryMessage.text = message.text;
      } else if (messageType === 'image') {
        memoryMessage.text = 'Image';
      } else if (messageType === 'video') {
        memoryMessage.text = 'Video';
      } else if (messageType === 'voice') {
        memoryMessage.text = 'Voice Message';
      } else if (messageType === 'file') {
        memoryMessage.text = message.fileName || 'File';
      } else {
        memoryMessage.text = '';
      }

      // Add media URLs
      if (messageType === 'image' && message.imageUrl) {
        memoryMessage.imageUrl = message.imageUrl;
        memoryMessage.fileName = message.fileName;
      }

      if (messageType === 'video' && message.videoUrl) {
        memoryMessage.videoUrl = message.videoUrl;
        memoryMessage.fileName = message.fileName;
      }

      if (messageType === 'voice' && message.audioUrl) {
        memoryMessage.audioUrl = message.audioUrl;
        memoryMessage.fileName = message.fileName || 'voice_message.wav';
      }

      if (messageType === 'file' && message.fileUrl) {
        memoryMessage.fileUrl = message.fileUrl;
        memoryMessage.fileName = message.fileName;
        memoryMessage.mimeType = message.mimeType;
      }

      // Add reply info if exists
      if (message.replyTo !== undefined && message.replyTo !== null) {
        memoryMessage.replyTo = message.replyTo;
      }

      // Add mood metadata if exists
      if (message.moodMetadata !== undefined && message.moodMetadata !== null) {
        memoryMessage.moodMetadata = message.moodMetadata;
      }

      // Save to Firebase
      await setDoc(
        doc(db, 'memory', nickname, 'messages', message.id),
        memoryMessage
      );

      console.log('✅ Message saved to memory:', messageType);
      return true;
    } catch (error) {
      console.error('❌ Error saving to memory:', error);
      throw error;
    }
  };

  // Remove message from memory
  const removeFromMemory = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'memory', nickname, 'messages', messageId));
      console.log('✅ Message removed from memory');
      return true;
    } catch (error) {
      console.error('❌ Error removing from memory:', error);
      throw error;
    }
  };

  // Check if message is saved in memory
  const isInMemory = (messageId: string) => {
    return memoryMessages.some(msg => msg.originalMessageId === messageId);
  };

  return {
    memoryMessages,
    loading,
    saveToMemory,
    removeFromMemory,
    isInMemory
  };
}
