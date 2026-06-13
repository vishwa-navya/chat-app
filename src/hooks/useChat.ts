import { useEffect, useState, useRef } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  limit,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export function useChat(collectionName: string, nickname?: string) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Realtime listener for messages
  useEffect(() => {
    if (!nickname) {
      setLoading(false);
      return;
    }

    // Cleanup previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);

    // Simple query to get all messages
    const q = query(
      collection(db, collectionName),
      orderBy("ts", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const allMsgs = snap.docs.map((d) => ({ 
          id: d.id, 
          ...d.data(),
          // Ensure timestamp exists
          ts: d.data().ts || serverTimestamp()
        }));

        // Reverse to show oldest first
        setMsgs([...allMsgs].reverse());
        setLoading(false);
      },
      (error) => {
        console.error("Chat listener error:", error);
        setMsgs([]);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [collectionName, nickname]);

  // Send message function
  const send = async (
    text: string,
    type: string = "text",
    imageUrl?: string,
    fileName?: string,
    moodMetadata?: any,
    replyTo?: { id: string; text: string; by: string },
    videoUrl?: string,
    fileUrl?: string,
    mimeType?: string
  ) => {
    try {
      console.log(`📤 Sending ${type} message from ${nickname}:`, text || type);

      const messageData: any = {
        by: type === "system" ? "System" : (nickname || "Anonymous"),
        type,
        ts: serverTimestamp(),
        to: "all",
        replyTo: replyTo || null,
        seenBy: [],
        moodMetadata: moodMetadata || null,
        clientTimestamp: new Date().toISOString(),
      };

      if (type === "image") {
        messageData.imageUrl = imageUrl;
        messageData.fileName = fileName;
        messageData.text = "";
      } else if (type === "video") {
        messageData.videoUrl = videoUrl;
        messageData.fileName = fileName;
        messageData.text = "";
      } else if (type === "file") {
        messageData.fileUrl = fileUrl;
        messageData.fileName = fileName;
        messageData.mimeType = mimeType;
        messageData.text = "";
      } else if (type === "system") {
        messageData.text = text;
        messageData.by = "System";
        messageData.replyTo = null;
        messageData.moodMetadata = null;
      } else {
        messageData.text = text;
      }

      const docRef = await addDoc(collection(db, collectionName), messageData);
      console.log(`✅ Message saved to Firestore with ID: ${docRef.id}`);

      return docRef.id;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  // Delete specific message
  const deleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, collectionName, messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  };

  const clear = async () => {
    // Unsubscribe from realtime listener to avoid race conditions
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const snapshot = await getDocs(collection(db, collectionName));
      if (snapshot.empty) {
        setMsgs([]);
        return;
      }

      // Use writeBatch for atomic bulk delete (max 500 per batch)
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((d) => batch.delete(doc(db, collectionName, d.id)));
        await batch.commit();
      }

      setMsgs([]);
    } catch (error) {
      console.error("Error clearing messages:", error);
      throw error;
    }
  };

  return { msgs, send, clear, deleteMessage, loading };
}