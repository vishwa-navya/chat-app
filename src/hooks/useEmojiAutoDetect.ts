import { useState, useEffect } from 'react';

// Emoji mapping for auto-detection
const EMOJI_KEYWORDS: { [key: string]: string } = {
  // Emotions
  'happy': '😊',
  'sad': '😢',
  'love': '❤️',
  'heart': '❤️',
  'angry': '😠',
  'laugh': '😂',
  'cry': '😭',
  'smile': '😊',
  'kiss': '😘',
  'wink': '😉',
  'hot':'🔥',
  'cool': '😎',
  'excited': '🤩',
  'surprised': '😲',
  'worried': '😟',
  'tired': '😴',
  'sick': '🤒',
  'thinking': '🤔',
  'confused': '😕',
  'nervous': '😰',
  'embarrassed': '😳',

  // Food
  'cake': '🎂',
  'pizza': '🍕',
  'burger': '🍔',
  'coffee': '☕',
  'tea': '🍵',
  'beer': '🍺',
  'wine': '🍷',
  'food': '🍽️',
  'apple': '🍎',
  'banana': '🍌',
  'strawberry': '🍓',
  'chocolate': '🍫',
  'ice cream': '🍦',
  'donut': '🍩',
  'cookie': '🍪',

  // Activities
  'party': '🎉',
  'celebration': '🎊',
  'music': '🎵',
  'dance': '💃',
  'sport': '⚽',
  'football': '⚽',
  'basketball': '🏀',
  'tennis': '🎾',
  'swimming': '🏊',
  'running': '🏃',
  'gym': '💪',
  'workout': '💪',
  'study': '📚',
  'work': '💼',
  'meeting': '👥',
  'travel': '✈️',
  'vacation': '🏖️',
  'shopping': '🛍️',
  'movie': '🎬',
  'game': '🎮',

  // Nature & Weather
  'sun': '☀️',
  'rain': '🌧️',
  'snow': '❄️',
  'cloud': '☁️',
  'thunder': '⛈️',
  'rainbow': '🌈',
  'flower': '🌸',
  'tree': '🌳',
  'ocean': '🌊',
  'mountain': '⛰️',
  'fire': '🔥',
  'star': '⭐',
  'moon': '🌙',

  // Objects
  'phone': '📱',
  'computer': '💻',
  'car': '🚗',
  'house': '🏠',
  'money': '💰',
  'gift': '🎁',
  'book': '📖',
  'pen': '✏️',
  'key': '🔑',
  'lock': '🔒',
  'clock': '⏰',
  'calendar': '📅',
  'camera': '📷',
  'music': '🎵',

  // Animals
  'cat': '🐱',
  'dog': '🐶',
  'bird': '🐦',
  'fish': '🐟',
  'elephant': '🐘',
  'lion': '🦁',
  'tiger': '🐯',
  'bear': '🐻',
  'rabbit': '🐰',
  'mouse': '🐭',
  'cow': '🐄',
  'pig': '🐷',
  'chicken': '🐔',

  // Symbols
  'check': '✅',
  'cross': '❌',
  'warning': '⚠️',
  'question': '❓',
  'exclamation': '❗',
  'plus': '➕',
  'minus': '➖',
  'arrow': '➡️',
  'up': '⬆️',
  'down': '⬇️',
  'left': '⬅️',
  'right': '➡️',

  // Medical (for your doctor app)
  'doctor': '👨‍⚕️',
  'nurse': '👩‍⚕️',
  'hospital': '🏥',
  'medicine': '💊',
  'injection': '💉',
  'thermometer': '🌡️',
  'stethoscope': '🩺',
  'bandage': '🩹',
  'pill': '💊',
  'syringe': '💉',
  'ambulance': '🚑',
  'health': '🏥',
  'medical': '⚕️',

  // Common words
  'yes': '✅',
  'no': '❌',
  'ok': '👍',
  'good': '👍',
  'bad': '👎',
  'great': '👏',
  'awesome': '🤩',
  'perfect': '💯',
  'thanks': '🙏',
  'please': '🙏',
  'sorry': '😔',
  'congratulations': '🎉',
  'birthday': '🎂',
  'welcome': '👋',
  'goodbye': '👋',
  'hello': '👋',
  'hi': '👋',
  'bye': '👋',
  'night': '🌙',
  'morning': '🌅',
  'evening': '🌆',
  'time': '⏰',
  'today': '📅',
  'tomorrow': '📅',
  'yesterday': '📅',
  'week': '📅',
  'month': '📅',
  'year': '📅'
};

export function useEmojiAutoDetect(text: string) {
  const [suggestedEmoji, setSuggestedEmoji] = useState<string>('');

  useEffect(() => {
    if (!text || text.trim().length === 0) {
      setSuggestedEmoji('');
      return;
    }

    // Convert text to lowercase for matching
    const lowerText = text.toLowerCase();
    
    // Find the best matching emoji
    let bestMatch = '';
    let bestMatchLength = 0;

    // Check for exact word matches first
    const words = lowerText.split(/\s+/);
    for (const word of words) {
      if (EMOJI_KEYWORDS[word] && word.length > bestMatchLength) {
        bestMatch = EMOJI_KEYWORDS[word];
        bestMatchLength = word.length;
      }
    }

    // If no exact word match, check for partial matches
    if (!bestMatch) {
      for (const [keyword, emoji] of Object.entries(EMOJI_KEYWORDS)) {
        if (lowerText.includes(keyword) && keyword.length > bestMatchLength) {
          bestMatch = emoji;
          bestMatchLength = keyword.length;
        }
      }
    }

    setSuggestedEmoji(bestMatch);
  }, [text]);

  return suggestedEmoji;
}