import React, { useRef, useEffect } from 'react';
import { X, Smile } from 'lucide-react';
import EmojiPickerReact, { EmojiClickData } from 'emoji-picker-react';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiClick: (emoji: string) => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

function EmojiPicker({ isOpen, onClose, onEmojiClick, buttonRef }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside the picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        // Check if clicked on textarea to close picker
        const target = event.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.closest('textarea')) {
          onClose();
        } else {
          // Close if clicked outside but not on textarea
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    console.log('Emoji clicked:', emojiData); // Debug log
    console.log('Emoji string:', emojiData.emoji); // Debug log
    onEmojiClick(emojiData.emoji);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-16 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{
        width: '350px',
        height: '400px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Smile className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Emojis</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          title="Close emoji picker"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Emoji picker */}
      <div className="h-full">
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          width="100%"
          height="350px"
          searchDisabled={false}
          skinTonesDisabled={false}
          previewConfig={{
            showPreview: false
          }}
          lazyLoadEmojis={true}
        />
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default EmojiPicker;