import { useEffect, useState, useRef, useCallback } from "react";
import { Flame, Download, X, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "../../hooks/use-mobile";
import { useCoupleMemory } from "../../hooks/useCoupleMemory";

interface Props {
  nickname?: "Vishwa" | "Ammu";
  onNavigateToChat1?: () => void;
  onNavigateToChat2?: () => void;
  onExit: () => void;
}

interface StorageImage {
  name: string;
  url: string;
  created_at: string;
}

export default function CoupleMemoryPage({
  nickname,
  onNavigateToChat1,
  onNavigateToChat2,
  onExit,
}: Props) {
  const [allImages, setAllImages] = useState<StorageImage[]>([]);
  const [isHotMode, setIsHotMode] = useState(false);
  const [index, setIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<StorageImage | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollPositionRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    hotMap,
    loading,
    fetchAllHotStatuses,
    fetchAllStorageImages,
    toggleHot,
  } = useCoupleMemory();

  // Load images from Supabase storage + hot statuses from Firebase
  useEffect(() => {
    const load = async () => {
      await fetchAllHotStatuses();
      const imgs = await fetchAllStorageImages();
      setAllImages(imgs);
    };
    load();
  }, [fetchAllHotStatuses, fetchAllStorageImages]);

  // Filter images based on mode
  const filteredImages = isHotMode
    ? allImages.filter((img) => hotMap[img.name] === true)
    : allImages.filter((img) => !hotMap[img.name]);

  // Auto slide - 3 second interval (respects pause state)
  useEffect(() => {
    if (!filteredImages.length || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % filteredImages.length);
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [filteredImages.length, isPaused]);

  // Reset index when mode changes
  useEffect(() => {
    setIndex(0);
  }, [isHotMode]);

  // Clamp index
  useEffect(() => {
    if (filteredImages.length > 0 && index >= filteredImages.length) {
      setIndex(Math.max(0, filteredImages.length - 1));
    }
  }, [filteredImages.length, index]);

  const currentImage = filteredImages[index];
  const prevImage = filteredImages.length > 1
    ? filteredImages[(index - 1 + filteredImages.length) % filteredImages.length]
    : null;
  const nextImage = filteredImages.length > 1
    ? filteredImages[(index + 1) % filteredImages.length]
    : null;

  // Toggle mode (single button)
  const handleToggleMode = () => {
    setIsHotMode((prev) => !prev);
  };

  // Manual navigation - resets timer
  const handleNext = useCallback(() => {
    if (filteredImages.length === 0) return;
    setIndex((prev) => (prev + 1) % filteredImages.length);
    // Reset timer by briefly pausing and resuming
    if (!isPaused && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % filteredImages.length);
      }, 3000);
    }
  }, [filteredImages.length, isPaused]);

  const handlePrev = useCallback(() => {
    if (filteredImages.length === 0) return;
    setIndex((prev) => (prev - 1 + filteredImages.length) % filteredImages.length);
    // Reset timer by briefly pausing and resuming
    if (!isPaused && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % filteredImages.length);
      }, 3000);
    }
  }, [filteredImages.length, isPaused]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Toggle hot for an image
  const handleToggleHot = async (image: StorageImage) => {
    await toggleHot(image.name, image.url);
    await fetchAllHotStatuses();
    // If in fullscreen and image was un-hotted while in hot mode, close fullscreen
    if (fullscreenImage?.name === image.name && isHotMode) {
      setFullscreenImage(null);
    }
  };

  // Download image
  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `memory-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download image.");
    }
  };

  const openFullscreen = (image: StorageImage) => {
    if (containerRef.current) {
      scrollPositionRef.current = containerRef.current.scrollTop;
    }
    setFullscreenImage(image);
    setIsPaused(true); // Pause slideshow when viewing fullscreen
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
    setIsPaused(false); // Resume slideshow when closing fullscreen
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  };

  const isCurrentImageHot = (imgName: string) => hotMap[imgName] === true;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col transition-all duration-700 ${
        isHotMode
          ? "bg-gradient-to-br from-red-600 via-orange-500 to-yellow-400"
          : "bg-gradient-to-br from-sky-300 via-sky-100 to-white"
      }`}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center px-4 py-3 bg-white/30 backdrop-blur-md">
        <div className="text-lg font-semibold text-white drop-shadow">
          ❤️ Our Memories ✨
        </div>
        <div className="flex gap-2">
          {onNavigateToChat1 && (
            <button
              onClick={onNavigateToChat1}
              className="px-3 py-1 bg-white text-black rounded-full shadow text-sm"
            >
              1
            </button>
          )}
          {onNavigateToChat2 && (
            <button
              onClick={onNavigateToChat2}
              className="px-3 py-1 bg-white text-black rounded-full shadow text-sm"
            >
              2
            </button>
          )}
          <button
            onClick={onExit}
            className="px-3 py-1 bg-white text-black rounded-full shadow text-sm"
          >
            Exit
          </button>
        </div>
      </div>

      {/* SINGLE TOGGLE BUTTON */}
      <div className="flex justify-center mt-4">
        <button
          onClick={handleToggleMode}
          className={`px-6 py-2 rounded-full text-white font-bold text-sm transition-all duration-500 shadow-xl transform hover:scale-105 ${
            isHotMode
              ? "bg-gradient-to-r from-red-700 to-yellow-500"
              : "bg-gradient-to-r from-blue-500 to-sky-400"
          }`}
        >
          {isHotMode ? "🔥 HOT" : "✨ NORMAL"}
        </button>
      </div>

      {/* IMAGE DISPLAY - Book style on desktop, simple on mobile */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-4">
        {loading ? (
          <div className="text-white text-lg font-semibold opacity-70 animate-pulse">
            Loading images... ⏳
          </div>
        ) : currentImage ? (
          isMobile ? (
            /* MOBILE: Full width image with compact controls */
            <div className="relative w-full max-w-[95%] flex flex-col items-center">
              <div className="relative w-full">
                <img
                  src={currentImage.url}
                  alt=""
                  className="w-full h-auto max-h-[70vh] rounded-2xl shadow-2xl transition-all duration-700 cursor-pointer object-contain"
                  onClick={() => openFullscreen(currentImage)}
                />
                {/* Counter on image - top right */}
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {index + 1} / {filteredImages.length}
                </div>
              </div>
              
              {/* Compact Navigation Controls - Below image */}
              <div className="flex justify-center items-center gap-4 mt-3">
                {/* Previous Button - Small */}
                <button
                  onClick={handlePrev}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 shadow-md transition-all active:scale-95"
                  title="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Pause/Play Button - Small */}
                <button
                  onClick={togglePause}
                  className={`flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-all active:scale-95 ${
                    isPaused
                      ? "bg-sky-500 text-white"
                      : "bg-white/90 text-gray-700 hover:bg-white"
                  }`}
                  title={isPaused ? "Play" : "Pause"}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 ml-0.5" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </button>

                {/* Next Button - Small */}
                <button
                  onClick={handleNext}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 shadow-md transition-all active:scale-95"
                  title="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* DESKTOP: Book-style 3-panel carousel with counter on center image */
            <div className="flex items-center justify-center gap-0 w-full max-w-[90%] h-[75%] relative">
              {/* LEFT PAGE - upcoming/next image (blurred) */}
              <div className="flex-shrink-0 w-[22%] h-full flex items-center justify-end overflow-hidden">
                {prevImage ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={prevImage.url}
                      alt=""
                      className="max-h-[85%] max-w-[90%] rounded-2xl object-contain transition-all duration-700"
                      style={{
                        filter: "blur(3px) brightness(0.7)",
                        opacity: 0.5,
                        transform: "perspective(800px) rotateY(15deg) scale(0.85)",
                      }}
                    />
                  </div>
                ) : <div className="w-full" />}
              </div>

              {/* CENTER PAGE - current image (clear) with counter */}
              <div
                className="flex-shrink-0 w-[50%] h-full flex items-center justify-center z-10 cursor-pointer relative"
                onClick={() => openFullscreen(currentImage)}
              >
                <div
                  className="relative bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-3 flex items-center justify-center transition-all duration-700"
                  style={{ maxHeight: "100%", maxWidth: "100%" }}
                >
                  <img
                    src={currentImage.url}
                    alt=""
                    className="max-h-[65vh] max-w-full rounded-2xl object-contain shadow-lg transition-all duration-700"
                  />
                  {/* Counter on image - bottom right */}
                  <div className="absolute bottom-5 right-5 bg-white/80 backdrop-blur-sm text-black text-xs font-medium px-2 py-1 rounded-full shadow">
                    {index + 1} / {filteredImages.length}
                  </div>
                </div>
              </div>

              {/* RIGHT PAGE - past/previous image (blurred) */}
              <div className="flex-shrink-0 w-[22%] h-full flex items-center justify-start overflow-hidden">
                {nextImage ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={nextImage.url}
                      alt=""
                      className="max-h-[85%] max-w-[90%] rounded-2xl object-contain transition-all duration-700"
                      style={{
                        filter: "blur(3px) brightness(0.7)",
                        opacity: 0.5,
                        transform: "perspective(800px) rotateY(-15deg) scale(0.85)",
                      }}
                    />
                  </div>
                ) : <div className="w-full" />}
              </div>
            </div>
          )
        ) : (
          <div className="text-white text-xl font-semibold opacity-70">
            {isHotMode ? "No hot images yet 🔥" : "No images yet ✨"}
          </div>
        )}

        {/* FLOATING EMOJIS */}
        <div className="absolute inset-0 pointer-events-none">
          {(isHotMode
            ? ["🔥", "💋", "😈", "❤️‍🔥", "💄", "💃", "💞", "🫦"]
            : ["⭐", "✨", "💖", "🌸", "🍃", "🦋", "☁️", "💫"]
          ).map((emoji, i) => (
            <span
              key={i}
              className="absolute animate-pulse text-2xl opacity-70"
              style={{
                left: `${10 + (i * 11) % 80}%`,
                top: `${10 + (i * 13) % 80}%`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      {/* DESKTOP NAVIGATION CONTROLS - Below image */}
      {!isMobile && filteredImages.length > 0 && (
        <div className="flex justify-center items-center gap-6 pb-6">
          {/* Previous Button */}
          <button
            onClick={handlePrev}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-lg transition-all duration-300 hover:scale-110"
            title="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Pause/Play Button - Sky blue */}
          <button
            onClick={togglePause}
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 hover:scale-110 ${
              isPaused
                ? "bg-sky-500 text-white hover:bg-sky-600"
                : "bg-white/80 hover:bg-white text-gray-700"
            }`}
            title={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? (
              <Play className="w-7 h-7 ml-1" />
            ) : (
              <Pause className="w-7 h-7" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={handleNext}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-lg transition-all duration-300 hover:scale-110"
            title="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* FULLSCREEN IMAGE VIEW */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <img
            src={fullscreenImage.url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />

          {/* Overlay buttons */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6">
            {/* 🔥 Hot toggle */}
            <button
              onClick={() => handleToggleHot(fullscreenImage)}
              className={`p-4 rounded-full shadow-lg transition-all ${
                isCurrentImageHot(fullscreenImage.name)
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-white/90 text-gray-700 hover:bg-white"
              }`}
              title={
                isCurrentImageHot(fullscreenImage.name)
                  ? "Remove from Hot"
                  : "Mark as Hot"
              }
            >
              <Flame
                className={`w-6 h-6 ${
                  isCurrentImageHot(fullscreenImage.name) ? "fill-current" : ""
                }`}
              />
            </button>

            {/* ⬇ Download */}
            <button
              onClick={() => handleDownload(fullscreenImage.url)}
              className="p-4 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-lg transition-all"
              title="Download"
            >
              <Download className="w-6 h-6" />
            </button>

            {/* ❌ Close */}
            <button
              onClick={closeFullscreen}
              className="p-4 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-lg transition-all"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}