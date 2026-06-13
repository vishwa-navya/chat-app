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
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";

export function useChat(collectionName: string, nickname?: string) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isClearingRef  = useRef(false);

  // ── Subscribe ─────────────────────────────────────────────────────────────
  const subscribe = () => {
    if (isClearingRef.current) return;
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const q = query(
      collection(db, collectionName),
      orderBy("ts", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (isClearingRef.current) return;

        const allMsgs = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
            ts: d.data().ts || serverTimestamp(),
          }))
          // Header dustbin = per-user delete (deletedFor field)
          // Only filter out messages deleted by this user via header dustbin
          .filter((msg: any) => {
            if (!msg.deletedFor) return true;
            return !msg.deletedFor.includes(nickname);
          });

        setMsgs([...allMsgs].reverse());
        setLoading(false);
      },
      (error) => {
        console.error("Chat listener error:", error);
        if (!isClearingRef.current) {
          setMsgs([]);
          setLoading(false);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;
  };

  useEffect(() => {
    if (!nickname) { setLoading(false); return; }
    subscribe();
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [collectionName, nickname]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async (
    text: string,
    type: string = "text",
    imageUrl?: string,
    fileName?: string,
    moodMetadata?: any,
    replyTo?: { id: string; text: string; by: string } | null,
    videoUrl?: string,
    fileUrl?: string,
    mimeType?: string
  ) => {
    try {
      const messageData: any = {
        by:              type === "system" ? "System" : (nickname || "Anonymous"),
        type,
        ts:              serverTimestamp(),
        to:              "all",
        replyTo:         replyTo || null,
        seenBy:          [],
        moodMetadata:    moodMetadata || null,
        clientTimestamp: new Date().toISOString(),
        deletedFor:      [], // used only by header dustbin (per-user delete)
      };

      if (type === "image") {
        messageData.imageUrl = imageUrl;
        messageData.fileName = fileName;
        messageData.text     = "";
      } else if (type === "video") {
        messageData.videoUrl = videoUrl;
        messageData.fileName = fileName;
        messageData.text     = "";
      } else if (type === "file") {
        messageData.fileUrl  = fileUrl;
        messageData.fileName = fileName;
        messageData.mimeType = mimeType;
        messageData.text     = "";
      } else if (type === "system") {
        messageData.text         = text;
        messageData.by           = "System";
        messageData.replyTo      = null;
        messageData.moodMetadata = null;
      } else {
        messageData.text = text;
      }

      const docRef = await addDoc(collection(db, collectionName), messageData);
      return docRef.id;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  // ── Delete single message — HARD DELETE for BOTH users ───────────────────
  // This is triggered by the per-message dustbin icon
  // It permanently deletes the document so NEITHER user sees it anymore
  const deleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, collectionName, messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  };

  // ── Clear ALL messages — SOFT DELETE for THIS user only ──────────────────
  // This is triggered by the header dustbin icon
  // It adds nickname to deletedFor so only THIS user's view is cleared
  // The other user still sees all their messages
  const clear = async () => {
    isClearingRef.current = true;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Clear UI immediately for this user
    setMsgs([]);

    try {
      const snapshot = await getDocs(collection(db, collectionName));

      if (!snapshot.empty) {
        console.log(`Marking ${snapshot.docs.length} messages as deleted for ${nickname}`);

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((d) => {
            batch.update(doc(db, collectionName, d.id), {
              deletedFor: arrayUnion(nickname),
            });
          });
          await batch.commit();
        }
        console.log(`✅ All messages hidden for ${nickname} only`);
      }

      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      console.error("Error clearing messages:", error);
      setMsgs([]);
      throw error;
    } finally {
      isClearingRef.current = false;
      subscribe();
      setLoading(false);
    }
  };

  return { msgs, send, clear, deleteMessage, loading };
}