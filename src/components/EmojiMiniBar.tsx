import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

interface EmojiUsage {
  emoji: string;
  count: number;
  lastUsed: any;
}

interface FrequentEmojisData {
  emojis: { [emoji: string]: EmojiUsage };
  lastUpdated: any;
}

interface EmojiMiniBarProps {
  userId: string;
  currentText: string;
  onEmojiInsert: (emoji: string) => void;
  className?: string;
}

// Lightweight keyword-to-emoji mapping for auto-detection
const EMOJI_KEYWORDS: { [key: string]: string } = {
  // Emotions & expressions
  'love': '❤️', 'heart': '❤️', 'hearts': '💕',
  'hot': '🔥', 'fire': '🔥', 'lit': '🔥',
  'happy': '😊', 'smile': '😊', 'joy': '😊',
  'sad': '😢', 'cry': '😭', 'tears': '😭',
  'laugh': '😂', 'lol': '😂', 'funny': '😂',
  'angry': '😠', 'mad': '😡', 'rage': '😡',
  'cool': '😎', 'awesome': '😎', 'nice': '👍',
  'kiss': '😘', 'kisses': '💋', 'muah': '😘',
  'wink': '😉', 'flirt': '😉', 'cute': '🥰',
  'thinking': '🤔', 'hmm': '🤔', 'wonder': '🤔',
  'surprised': '😲', 'wow': '😲', 'omg': '😱',
  'tired': '😴', 'sleepy': '😴', 'sleep': '💤',
  'sick': '🤒', 'ill': '🤒', 'fever': '🤒',
  
  // Food & drinks
  'cake': '🎂', 'birthday': '🎂', 'celebrate': '🎉',
  'pizza': '🍕', 'food': '🍽️', 'hungry': '🍽️',
  'coffee': '☕', 'tea': '🍵', 'drink': '🥤',
  'beer': '🍺', 'wine': '🍷', 'cheers': '🥂',
  'chocolate': '🍫', 'candy': '🍬', 'sweet': '🍭',
  'apple': '🍎', 'fruit': '🍎', 'healthy': '🥗',
  
  // Activities & objects
  'party': '🎉', 'celebration': '🎊', 'fun': '🎉',
  'music': '🎵', 'song': '🎶', 'dance': '💃',
  'work': '💼', 'job': '💼', 'office': '🏢',
  'study': '📚', 'book': '📖', 'learn': '📚',
  'phone': '📱', 'call': '📞', 'mobile': '📱',
  'car': '🚗', 'drive': '🚗', 'travel': '✈️',
  'home': '🏠', 'house': '🏡', 'family': '👨‍👩‍👧‍👦',
  'money': '💰', 'cash': '💵', 'rich': '💎',
  'gift': '🎁', 'present': '🎁', 'surprise': '🎁',
  
  // Nature & weather
  'sun': '☀️', 'sunny': '☀️', 'bright': '☀️',
  'rain': '🌧️', 'rainy': '🌧️', 'wet': '🌧️',
  'snow': '❄️', 'cold': '❄️', 'winter': '❄️',
  'flower': '🌸', 'flowers': '🌺', 'spring': '🌸',
  'tree': '🌳', 'nature': '🌿', 'green': '🌿',
  'ocean': '🌊', 'sea': '🌊', 'beach': '🏖️',
  'star': '⭐', 'stars': '✨', 'night': '🌙',
  
  // Medical (for doctor app)
  'doctor': '👨‍⚕️', 'nurse': '👩‍⚕️', 'medical': '⚕️',
  'hospital': '🏥', 'health': '🏥', 'medicine': '💊',
  'injection': '💉', 'vaccine': '💉', 'shot': '💉',
  'pill': '💊', 'tablet': '💊', 'drug': '💊',
  'thermometer': '🌡️', 'temperature': '🌡️',
  'bandage': '🩹', 'wound': '🩹', 'hurt': '🤕',
  'stethoscope': '🩺', 'checkup': '🩺', 'exam': '🩺',
  
  // Common responses
  'yes': '✅', 'ok': '👍', 'good': '👍',
  'no': '❌', 'bad': '👎', 'wrong': '❌',
  'thanks': '🙏', 'thank': '🙏', 'please': '🙏',
  'sorry': '😔', 'apologize': '😔', 'oops': '😅',
  'congratulations': '🎉', 'congrats': '🎉', 'well done': '👏',
  'hello': '👋', 'hi': '👋', 'hey': '👋',
  'bye': '👋', 'goodbye': '👋', 'see you': '👋',
  'time': '⏰', 'clock': '⏰', 'late': '⏰',
  'question': '❓', 'help': '❓', 'confused': '😕'
};

function EmojiMiniBar({ userId, currentText, onEmojiInsert, className = '' }: EmojiMiniBarProps) {
  const [frequentEmojis, setFrequentEmojis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoDetectedEmoji, setAutoDetectedEmoji] = useState<string>('');
  const [lastDetectedWord, setLastDetectedWord] = useState<string>('');

  // Check if device is laptop/desktop (>= 1024px)
  const [isLaptop, setIsLaptop] = useState(() => {
    return window.innerWidth >= 1024 && !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newIsLaptop = window.innerWidth >= 1024 && !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsLaptop(newIsLaptop);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to user's frequent emojis from LastSeen Firebase
  useEffect(() => {
    if (!userId || !isLaptop) return;

    const unsubscribe = onSnapshot(
      doc(lastSeenDb, 'frequentEmojis', userId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as FrequentEmojisData;
          
          // Sort emojis by usage count and last used time
          const sortedEmojis = Object.entries(data.emojis || {})
            .sort(([, a], [, b]) => {
              // First sort by count (descending)
              if (b.count !== a.count) {
                return b.count - a.count;
              }
              // Then by last used time (most recent first)
              const aTime = a.lastUsed?.toDate?.() || new Date(0);
              const bTime = b.lastUsed?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime();
            })
            .slice(0, 3) // Take top 3
            .map(([emoji]) => emoji);
          
          setFrequentEmojis(sortedEmojis);
        } else {
          setFrequentEmojis([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to frequent emojis:', error);
        setFrequentEmojis([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, isLaptop]);

  // Auto-detect emoji based on current text
  useEffect(() => {
    if (!currentText || currentText.trim().length === 0) {
      setAutoDetectedEmoji('');
      setLastDetectedWord('');
      return;
    }

    // Convert text to lowercase for matching
    const lowerText = currentText.toLowerCase();
    
    // Find the best matching emoji
    let bestMatch = '';
    let bestMatchLength = 0;
    let matchedWord = '';

    // Check for exact word matches first
    const words = lowerText.split(/\s+/);
    for (const word of words) {
      if (EMOJI_KEYWORDS[word] && word.length > bestMatchLength) {
        bestMatch = EMOJI_KEYWORDS[word];
        bestMatchLength = word.length;
        matchedWord = word;
      }
    }

    // If no exact word match, check for partial matches
    if (!bestMatch) {
      for (const [keyword, emoji] of Object.entries(EMOJI_KEYWORDS)) {
        if (lowerText.includes(keyword) && keyword.length > bestMatchLength) {
          bestMatch = emoji;
          bestMatchLength = keyword.length;
          matchedWord = keyword;
        }
      }
    }

    setAutoDetectedEmoji(bestMatch);
    setLastDetectedWord(matchedWord);
  }, [currentText]);

  // Handle emoji click - insert at cursor position
  const handleEmojiClick = useCallback((emoji: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (emoji && onEmojiInsert) {
      onEmojiInsert(emoji);
    }
  }, [onEmojiInsert]);

  // Handle 4th circle click with text replacement
  const handlePredictiveEmojiClick = useCallback((emoji: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!emoji || !onEmojiInsert || !lastDetectedWord) return;
    
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) {
      onEmojiInsert(emoji);
      return;
    }
    
    // Find and replace the last occurrence of the detected word
    const text = textarea.value;
    const lastIndex = text.toLowerCase().lastIndexOf(lastDetectedWord.toLowerCase());
    
    if (lastIndex !== -1) {
      const beforeWord = text.substring(0, lastIndex);
      const afterWord = text.substring(lastIndex + lastDetectedWord.length);
      const newText = beforeWord + emoji + afterWord;
      
      textarea.value = newText;
      textarea.focus();
      
      // Set cursor position after the emoji
      const newCursorPosition = lastIndex + emoji.length;
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      
      // Trigger input event to update React state
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
    } else {
      // Fallback to normal insertion if word not found
      onEmojiInsert(emoji);
    }
  }, [onEmojiInsert, lastDetectedWord]);

  // Track emoji usage when clicked (for frequent emojis)
  const trackEmojiUsage = useCallback(async (emoji: string) => {
    if (!userId || !emoji) return;

    try {
      const docRef = doc(lastSeenDb, 'frequentEmojis', userId);
      
      // Use increment to atomically update count
      await setDoc(docRef, {
        [`emojis.${emoji}.emoji`]: emoji,
        [`emojis.${emoji}.count`]: increment(1),
        [`emojis.${emoji}.lastUsed`]: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      console.log(`📊 Tracked emoji usage: ${emoji} for ${userId}`);
    } catch (error) {
      console.error('Error tracking emoji usage:', error);
    }
  }, [userId]);

  // Handle frequent emoji click (circles 1-3)
  const handleFrequentEmojiClick = useCallback((emoji: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (emoji && onEmojiInsert) {
      onEmojiInsert(emoji);
      // Track usage for future frequent emoji updates
      trackEmojiUsage(emoji);
    }
  }, [onEmojiInsert, trackEmojiUsage]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((emoji: string, event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      
      if (emoji && onEmojiInsert) {
        onEmojiInsert(emoji);
      }
    }
  }, [onEmojiInsert]);

  // Don't render on mobile/tablet
  if (!isLaptop) {
    return null;
  }

  return (
    <div className={`emoji-mini-bar flex items-center gap-3 mb-3 ${className}`}>


      {/* Fourth circle: Auto-detecting emoji */}
      <button
        type="button"
        onClick={(e) => handlePredictiveEmojiClick(autoDetectedEmoji, e)}
        onKeyDown={(e) => handleKeyDown(autoDetectedEmoji, e)}
        className={`w-10 h-10 rounded-full border-2 border-green-400  hover:bg-green-50 transition-all duration-200 flex items-center justify-center text-lg shadow-sm ${
          autoDetectedEmoji ? 'hover:scale-110 cursor-pointer shadow-sm hover:shadow-md' : 'cursor-default opacity-50'
        }`}
        disabled={!autoDetectedEmoji}
        aria-label={autoDetectedEmoji ? `Replace "${lastDetectedWord}" with ${autoDetectedEmoji}` : 'No suggestion'}
        title={autoDetectedEmoji ? `Replace "${lastDetectedWord}" with ${autoDetectedEmoji}` : 'No suggestion'}
      >
        {autoDetectedEmoji || ''}
      </button>
    </div>
  );
}

export default EmojiMiniBar;