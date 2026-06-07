import React from 'react';
import { Plus } from 'lucide-react';
import { MoodData } from '../hooks/useMood';

interface MoodDisplayProps {
  userMood: MoodData | null;
  otherUserMood: MoodData | null;
  nickname: 'Vishwa' | 'Ammu';
  onOpenPicker: () => void;
  onReplyToMood: (emoji: string, ownerNickname: string) => void;
}

function MoodDisplay({ userMood, otherUserMood, nickname, onOpenPicker, onReplyToMood }: MoodDisplayProps) {
  const isVishwa = nickname === 'Vishwa';
  const otherUserNickname = isVishwa ? 'Ammu' : 'Vishwa';
  
  // Determine what to show
  const hasAnyMood = userMood || otherUserMood;
  
  if (!hasAnyMood) {
    // State A: No emoji set by either user - single curved container with +
    return (
      <div className="flex justify-center">
        <div className="bg-gradient-to-r from-pink-100 to-blue-100 rounded-full px-6 py-2 shadow-sm border border-white/50">
          <button
            onClick={onOpenPicker}
            className="flex items-center justify-center transition-transform hover:scale-110"
            aria-label="Set your mood"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  // State B & C: At least one user has set an emoji - two curved containers
  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-1">
        {/* Other user's mood container */}
        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full px-3 py-2 shadow-sm border border-white/50">
          {otherUserMood ? (
            <button
              onClick={() => {
                onReplyToMood(otherUserMood.emoji, otherUserNickname);
              }}
              className="text-lg hover:scale-110 transition-transform"
              title={`Reply to ${otherUserNickname}'s mood`}
              aria-label={`Reply to ${otherUserNickname}'s mood`}
            >
              {otherUserMood.emoji}
            </button>
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200/50 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            </div>
          )}
        </div>

        {/* My mood container */}
        <div className="bg-gradient-to-r from-pink-100 to-rose-100 rounded-full px-3 py-2 shadow-sm border border-white/50">
          {userMood ? (
            <button
              onClick={onOpenPicker}
              className="text-lg hover:scale-110 transition-transform"
              title="Change your mood"
              aria-label="Change your mood"
            >
              {userMood.emoji}
            </button>
          ) : (
            <button
              onClick={onOpenPicker}
              className="flex items-center justify-center transition-transform hover:scale-110"
              aria-label="Set your mood"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MoodDisplay;