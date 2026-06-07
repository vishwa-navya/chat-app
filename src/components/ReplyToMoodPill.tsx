import React from 'react';
import { X } from 'lucide-react';

interface ReplyToMoodPillProps {
  emoji: string;
  partnerNickname: string;
  onCancel: () => void;
}

function ReplyToMoodPill({ emoji, partnerNickname, onCancel }: ReplyToMoodPillProps) {
  return (
    <div className="bg-blue-100 p-3 mb-2 rounded-lg relative text-sm text-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="font-medium text-blue-800">
          Replying to {partnerNickname}'s mood
        </span>
      </div>
      <button
        onClick={onCancel}
        className="p-1 hover:bg-blue-200 rounded-full transition-colors"
        aria-label="Cancel reply to mood"
      >
        <X className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}

export default ReplyToMoodPill;