// components/VoiceMessageInline.tsx
import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface VoiceMessageInlineProps {
  src: string;
  accent?: "chat2" | "chat3";
  className?: string;
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const VoiceMessageInline: React.FC<VoiceMessageInlineProps> = ({
  src,
  accent = "chat2",
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    const pauseOthers = (e: Event) => {
      if (e.target !== audio && audio && !audio.paused) {
        audio.pause();
        setIsPlaying(false);
      }
    };
    document.addEventListener("play", pauseOthers, true);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      document.removeEventListener("play", pauseOthers, true);
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio play failed:", err);
      }
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl shadow-sm p-3 ${
        accent === "chat3" ? "bg-[#e8f1ff]" : "bg-[#dbefff]"
      } ${className || ""}`}
      style={{
        width: "fit-content",
        maxWidth: "95%",
        minWidth: "180px",
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* ▶️ / ⏸ Button */}
      <button
        type="button"
        onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow transition-transform hover:scale-105 ${
          accent === "chat3"
            ? "bg-[#4A90E2] text-white"
            : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
        }`}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      {/* Progress + time */}
      <div className="flex-1 min-w-[100px] max-w-[200px]">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-[width] ease-linear ${
              accent === "chat3" ? "bg-[#4A90E2]" : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ✅ Live left timer (updates) + fixed total on right */}
        <div className="mt-1 flex justify-between text-xs text-gray-600 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "0:00"}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessageInline;
