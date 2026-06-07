import { useEffect, useState, useCallback } from "react";
import { doc, setDoc, getDoc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { lastSeenDb } from "../firebase-lastseen";
import { supabase } from "../lib/supabase";

export interface CoupleMemoryItem {
  id: string;
  message_id: string;
  image_url: string;
  is_hot: boolean;
  created_at: string;
}

// Hot status is stored in Firebase lastSeen DB under "hotImages/{messageId}"
export const useCoupleMemory = () => {
  const [hotMap, setHotMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Fetch all hot statuses from Firebase
  const fetchAllHotStatuses = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(lastSeenDb, "hotImages"));
      const map: Record<string, boolean> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isHot) {
          map[docSnap.id] = true;
        }
      });
      setHotMap(map);
    } catch (error) {
      console.error("Error fetching hot statuses:", error);
    }
  }, []);

  // Toggle hot status in Firebase
  const toggleHot = async (messageId: string, imageUrl: string): Promise<boolean> => {
    try {
      const docRef = doc(lastSeenDb, "hotImages", messageId);
      const docSnap = await getDoc(docRef);

      let newHotStatus = true;
      if (docSnap.exists()) {
        newHotStatus = !docSnap.data().isHot;
      }

      await setDoc(docRef, {
        messageId,
        imageUrl,
        isHot: newHotStatus,
        updatedAt: new Date().toISOString(),
      });

      setHotMap((prev) => ({ ...prev, [messageId]: newHotStatus }));
      return newHotStatus;
    } catch (error) {
      console.error("Error toggling hot:", error);
      return false;
    }
  };

  // Check if a specific image is hot
  const isImageHot = useCallback(
    (messageId: string): boolean => {
      return !!hotMap[messageId];
    },
    [hotMap]
  );

  // Fetch all images from Supabase storage bucket "chat-images"
  const fetchAllStorageImages = useCallback(async (): Promise<
    { name: string; url: string; created_at: string }[]
  > => {
    setLoading(true);
    try {
      const allImages: { name: string; url: string; created_at: string }[] = [];
      let offset = 0;
      const limit = 1000;

      while (true) {
        const { data, error } = await supabase.storage
          .from("chat-images")
          .list("", { limit, offset, sortBy: { column: "created_at", order: "desc" } });

        if (error) {
          console.error("Error listing storage files:", error);
          break;
        }

        if (!data || data.length === 0) break;

        const imageFiles = data.filter((file) => {
          const ext = file.name.split(".").pop()?.toLowerCase();
          return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext || "");
        });

        for (const file of imageFiles) {
          const { data: urlData } = supabase.storage
            .from("chat-images")
            .getPublicUrl(file.name);
          if (urlData?.publicUrl) {
            allImages.push({
              name: file.name,
              url: urlData.publicUrl,
              created_at: file.created_at || "",
            });
          }
        }

        if (data.length < limit) break;
        offset += limit;
      }

      return allImages;
    } catch (error) {
      console.error("Error fetching storage images:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    hotMap,
    loading,
    fetchAllHotStatuses,
    fetchAllStorageImages,
    toggleHot,
    isImageHot,
    images: [] as CoupleMemoryItem[], // backward compat for RobotCloud
    fetchAllImages: fetchAllHotStatuses, // backward compat
  };
};
