import React, { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

interface VoiceRecordButtonProps {
  isRecording: boolean;
  recordingTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isVisible: boolean;
}

export const VoiceRecordButton: React.FC<VoiceRecordButtonProps> = ({
  isRecording,
  recordingTime,
  onStartRecording,
  onStopRecording,
  isVisible,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseDown = () => {
    if (isTouchDevice) return;
    isRecording ? onStopRecording() : onStartRecording();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onStartRecording();
    }, 200);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressRef.current && isRecording) onStopRecording();
    isLongPressRef.current = false;
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressRef.current = false;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <>
      {isRecording && (
  <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
    <div className="relative w-64 h-64">
      {/* Outer waveform ring - animated bars */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-full h-full animate-spin-slow" viewBox="0 0 200 200">
          {[...Array(60)].map((_, i) => {
            const angle = (i * 360) / 60;
            const radians = (angle * Math.PI) / 180;
            const length = 15 + Math.sin((i + recordingTime * 10) / 3) * 10;
            const startRadius = 75;
            const x1 = 100 + Math.cos(radians) * startRadius;
            const y1 = 100 + Math.sin(radians) * startRadius;
            const x2 = 100 + Math.cos(radians) * (startRadius + length);
            const y2 = 100 + Math.sin(radians) * (startRadius + length);
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(59, 130, 246, 0.6)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>

      {/* Middle waveform ring */}
      <div className="absolute inset-8 flex items-center justify-center">
        <svg className="w-full h-full -rotate-12" viewBox="0 0 200 200">
          {[...Array(40)].map((_, i) => {
            const angle = (i * 360) / 40;
            const radians = (angle * Math.PI) / 180;
            const length = 12 + Math.cos((i + recordingTime * 8) / 2) * 8;
            const startRadius = 65;
            const x1 = 100 + Math.cos(radians) * startRadius;
            const y1 = 100 + Math.sin(radians) * startRadius;
            const x2 = 100 + Math.cos(radians) * (startRadius + length);
            const y2 = 100 + Math.sin(radians) * (startRadius + length);
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(59, 130, 246, 0.8)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>

      {/* Inner circle with timer */}
      <div className="absolute inset-16 rounded-full bg-white flex items-center justify-center shadow-2xl border-4 border-blue-100">
        <span className="text-3xl font-bold text-gray-800">{formatTime(recordingTime)}</span>
      </div>

      {/* Outer glow effect */}
      <div className="absolute inset-0 rounded-full bg-blue-400 opacity-5 blur-3xl animate-pulse" />
    </div>
  </div>
)}

<button
  ref={buttonRef}
  type="button"
  onClick={handleMouseDown}
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onTouchCancel={handleTouchCancel}
  className={`relative p-3 rounded-full transition-all duration-300 bg-transparent ${
    isRecording
      ? 'bg-red-400 hover:bg-red-500 text-white scale-110 shadow-2xl shadow-red-300'
      : 'bg-transparent hover:bg-gray-50 text-gray-700 hover:scale-105 '
  }`}
>
  <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} />
  
  {/* Button ring effect when recording */}
  {isRecording && (
    <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-75" />
  )}
</button>

<style jsx>{`
  @keyframes spin-slow {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }
`}</style>

    </>
  );
};
