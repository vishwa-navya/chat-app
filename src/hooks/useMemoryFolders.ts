// src/hooks/useMemoryFolders.ts
import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export interface MemoryFolder {
  id: string;
  name: string;
  items: string[];
  createdAt: Timestamp | null;
}

export function useMemoryFolders(nickname: 'Vishwa' | 'Ammu') {
  const [folders, setFolders] = useState<MemoryFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------------------------- */
  /* Listen to folders (USER ISOLATED) */
  /* -------------------------------------------------- */
  useEffect(() => {
    const foldersRef = collection(db, 'memoryFolders', nickname, 'folders');

    const unsubscribe = onSnapshot(
      foldersRef,
      (snapshot) => {
        const list: MemoryFolder[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          list.push({
            id: docSnap.id,
            name: data.name,
            items: Array.isArray(data.items) ? data.items : [],
            createdAt: data.createdAt ?? null
          });
        });

        // ✅ FIFO — oldest first
        list.sort((a, b) => {
          if (!a.createdAt && !b.createdAt) return 0;
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return a.createdAt.toMillis() - b.createdAt.toMillis();
        });

        setFolders(list);
        setLoading(false);
      },
      (err) => {
        console.error('❌ Folder listener error:', err);
        setError('Failed to load folders');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [nickname]);

  /* -------------------------------------------------- */
  /* Create folder */
  /* -------------------------------------------------- */
  const createFolder = useCallback(
    async (folderName: string) => {
      if (!folderName.trim()) {
        throw new Error('Folder name required');
      }

      const folderRef = doc(
        collection(db, 'memoryFolders', nickname, 'folders')
      );

      await setDoc(folderRef, {
        name: folderName.trim(),
        items: [],
        createdAt: serverTimestamp()
      });

      return folderRef.id;
    },
    [nickname]
  );

  /* -------------------------------------------------- */
  /* Move memory to folder */
  /* -------------------------------------------------- */
  const moveToFolder = useCallback(
    async (memoryId: string, folderId: string) => {
      const folderRef = doc(db, 'memoryFolders', nickname, 'folders', folderId);

      await updateDoc(folderRef, {
        items: arrayUnion(memoryId)
      });
    },
    [nickname]
  );

  /* -------------------------------------------------- */
  /* Remove memory from folder */
  /* -------------------------------------------------- */
  const deleteMemoryFromFolder = useCallback(
    async (memoryId: string, folderId: string) => {
      const folderRef = doc(db, 'memoryFolders', nickname, 'folders', folderId);

      await updateDoc(folderRef, {
        items: arrayRemove(memoryId)
      });
    },
    [nickname]
  );

  /* -------------------------------------------------- */
  /* Delete folder */
  /* -------------------------------------------------- */
  const deleteFolder = useCallback(
    async (folderId: string) => {
      await deleteDoc(
        doc(db, 'memoryFolders', nickname, 'folders', folderId)
      );
    },
    [nickname]
  );

  return {
    folders,
    loading,
    error,
    createFolder,
    moveToFolder,
    deleteFolder,
    deleteMemoryFromFolder
  };
}
