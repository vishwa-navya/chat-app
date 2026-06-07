import React from 'react';
import { X } from 'lucide-react';
import { MOOD_EMOJIS } from '../hooks/useMood';

interface MoodPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMood: (emoji: string) => void;
  onDeleteMood: () => void;
  currentMood?: string | null;
}

function MoodPicker({ isOpen, onClose, onSelectMood, onDeleteMood, currentMood }: MoodPickerProps) {
  if (!isOpen) return null;

  const handleMoodSelect = (emoji: string) => {
    onSelectMood(emoji);
    onClose();
  };

  const handleDelete = () => {
    onDeleteMood();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Choose Your Mood</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close mood picker"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="grid grid-cols-5 gap-2 mb-4">
          {MOOD_EMOJIS.map(({ emoji, label }) => (
            <button
              key={emoji}
              onClick={() => handleMoodSelect(emoji)}
              className={`flex flex-col items-center p-4 m-2 rounded-xl hover:bg-gray-50 transition-colors group min-h-[60px] ${
                currentMood === emoji ? 'bg-blue-50 ring-2 ring-blue-200' : ''
              }`}
              title={label}
              aria-label={label}
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                {emoji}
              </span>
              <span className="text-xs text-gray-600 font-medium text-center leading-tight">
                {label.split(' / ')[0]}
              </span>
            </button>
          ))}
        </div>
        
        {currentMood && (
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <span className="text-lg">❌</span>
            <span className="font-medium">Delete my emoji</span>
          </button>
        )}
        
        <p className="text-xs text-gray-500 text-center mt-3">
          Your mood will be visible for 24 hours
        </p>
      </div>
    </div>
  );
}

export default MoodPicker;