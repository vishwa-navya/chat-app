// This component is now replaced by EmojiMiniBar.tsx
// Keeping this file for backward compatibility but it's deprecated

import React from 'react';
import EmojiMiniBar from './EmojiMiniBar';

interface EmojiQuickAccessProps {
  userId: string;
  currentText: string;
  onEmojiClick: (emoji: string) => void;
  className?: string;
}

function EmojiQuickAccess({ userId, currentText, onEmojiClick, className = '' }: EmojiQuickAccessProps) {
  // Redirect to new EmojiMiniBar component
  return (
    <EmojiMiniBar
      userId={userId}
      currentText={currentText}
      onEmojiInsert={onEmojiClick}
      className={className}
    />
  );
}

export default EmojiQuickAccess;