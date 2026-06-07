import { useAdvancedPresence } from './useAdvancedPresence';

interface UseLastSeenProps {
  userId: string;
  otherUserId: string;
}

export function useLastSeen({ userId, otherUserId }: UseLastSeenProps) {
  // Use the new advanced presence system
  const {
    isOtherUserOnline,
    otherUserLastSeen,
    connectionStatus,
    setOnline,
    setOffline
  } = useAdvancedPresence({ userId, otherUserId });

  return {
    otherUserLastSeen,
    isOtherUserOnline,
    connectionStatus,
    setOnline,
    setOffline
  };
}