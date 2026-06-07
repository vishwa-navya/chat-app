interface Message {
  id: string;
  by: string; // sender nickname
  ts: any; // timestamp (firebase or date)
  type?: string;
  text?: string;
}

/**
 * Convert Firebase timestamp to Date
 */
function getMessageDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

/**
 * Calculate time gap in milliseconds between two messages
 */
function getTimeGapMs(msg1: Message, msg2: Message): number {
  const date1 = getMessageDate(msg1.ts);
  const date2 = getMessageDate(msg2.ts);
  return Math.abs(date2.getTime() - date1.getTime());
}

/**
 * Check if other user replied between two message indices
 * Returns true if other user sent at least one message between msg1 and msg2
 */
function didOtherUserReplyBetween(
  currentMsgIndex: number,
  previousMsgIndex: number,
  allMessages: Message[],
  currentUserSender: string
): boolean {
  // If no previous message, no reply in between
  if (previousMsgIndex === -1) return false;

  const otherUser = currentUserSender === 'Vishwa' ? 'Ammu' : 'Vishwa';

  // Check all messages between previous and current
  for (let i = previousMsgIndex + 1; i < currentMsgIndex; i++) {
    if (allMessages[i].by === otherUser) {
      return true;
    }
  }

  return false;
}

/**
 * Find the index of the previous message from the same sender
 */
function findPreviousMessageFromSameSender(
  currentIndex: number,
  allMessages: Message[],
  sender: string
): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (allMessages[i].by === sender) {
      return i;
    }
  }
  return -1;
}

/**
 * Main spacing logic - Instagram DM style
 * 
 * Spacing should appear ONLY IF:
 * 1. Same user sends multiple messages
 * 2. Time gap between current and previous message from same user > 1 hour
 * 3. Other user did NOT reply in between
 * 4. Spacing only appears on ONE user's side at a time (never both)
 */
export function shouldAddSpacing(
  currentMessage: Message,
  previousMessage: Message | null,
  allMessages: Message[],
  currentUserId?: string
): boolean {
  // No spacing for first message
  if (!previousMessage) return false;

  // No spacing if different senders
  if (currentMessage.by !== previousMessage.by) return false;

  // Calculate time gap in hours
  const timeGapMs = getTimeGapMs(currentMessage, previousMessage);
  const ONE_HOUR_MS = 60 * 60 * 1000;
  
  // No spacing if gap is less than 1 hour
  if (timeGapMs <= ONE_HOUR_MS) return false;

  // Get current message index
  const currentIndex = allMessages.findIndex(m => m.id === currentMessage.id);
  if (currentIndex === -1) return false;

  // Get previous message from same sender index
  const prevSameUserIndex = findPreviousMessageFromSameSender(
    currentIndex,
    allMessages,
    currentMessage.by
  );

  if (prevSameUserIndex === -1) return false;

  // Check if other user replied between previous and current
  const otherUserReplied = didOtherUserReplyBetween(
    currentIndex,
    prevSameUserIndex,
    allMessages,
    currentMessage.by
  );

  // No spacing if other user replied in between
  if (otherUserReplied) return false;

  // ✅ All conditions met - add spacing
  return true;
}

/**
 * Batch calculate spacing for all messages (optimized)
 * Returns a map of messageId -> shouldHaveSpacing
 */
export function calculateSpacingForAllMessages(
  messages: Message[]
): Record<string, boolean> {
  const spacingMap: Record<string, boolean> = {};

  messages.forEach((msg, index) => {
    const previousMsg = index > 0 ? messages[index - 1] : null;
    spacingMap[msg.id] = shouldAddSpacing(msg, previousMsg, messages);
  });

  return spacingMap;
}

/**
 * Get spacing value in pixels
 * Can be customized: 4-8px typical, 12-16px for more emphasis
 */
export function getSpacingPixels(hasSpacing: boolean): string {
  return hasSpacing ? '3vh' : '5px';
}

/**
 * Debug helper: log spacing decisions for a message
 */
export function debugMessageSpacing(
  message: Message,
  previousMessage: Message | null,
  allMessages: Message[]
): void {
  console.log(`\n📊 Message Spacing Debug:`, {
    messageId: message.id,
    sender: message.by,
    time: getMessageDate(message.ts).toLocaleTimeString(),
    hasPrevious: !!previousMessage,
    sameSender: previousMessage?.by === message.by,
    timeGap: previousMessage
      ? `${Math.round(getTimeGapMs(message, previousMessage) / 1000 / 60)} minutes`
      : 'N/A',
    shouldSpacing: shouldAddSpacing(message, previousMessage, allMessages),
  });
}

/**
 * Get the spacing style object
 */
export function getSpacingStyle(hasSpacing: boolean): React.CSSProperties {
  return {
    marginTop: hasSpacing ? '3vh' : '5px',
    transition: 'margin-top 200ms ease-in-out',
  };
}