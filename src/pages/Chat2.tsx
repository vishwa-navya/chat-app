import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BookOpen, Send, LogOut, Plus, X, Sparkles, Camera, Smile } from 'lucide-react';
import InstagramPlusButton from '../components/InstagramPlusButton';
import MoodPicker from '../components/MoodPicker';
import MoodDisplay from '../components/MoodDisplay';
import ReplyToMoodPill from '../components/ReplyToMoodPill';
import { useChat } from '../hooks/useChat';
import { useMood } from '../hooks/useMood';
import { useOptimizedTyping } from '../hooks/useOptimizedTyping';
import { useOptimizedActivity, useOtherUserActivity } from '../hooks/useOptimizedActivity';
import KissEmojiRain from '../components/KissEmojiRain';
import RobotCloud from '../components/RobotCloud';
import MoodReactor from '../components/MoodReactor';
import { useMessageSeen } from '../hooks/useMessageSeen';
import { useTabVisibility } from '../hooks/useTabVisibility';
import TypingIndicator from '../components/TypingIndicator';
import { uploadImageToSupabase, uploadVideoToSupabase, uploadFileToSupabase, revokePreviewUrl } from '../lib/supabase';
import { shouldAddSpacing, calculateSpacingForAllMessages } from '../lib/messageSpacing';
import { onSnapshot, doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { lastSeenDb } from '../firebase-lastseen';
import { useMoodReactor } from '../hooks/useMoodReactor';
import { useHugDetection } from '../hooks/useHugDetection';
import { useLastSeen } from '../hooks/useLastSeen';
import PresenceIndicator from '../components/PresenceIndicator';
import PresenceDebugPanel from '../components/PresenceDebugPanel';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useCameraState } from '../hooks/useCameraState';
import CameraButton from '../components/CameraButton';
import EmojiPicker from '../components/EmojiPicker';
import EmojiMiniBar from '../components/EmojiMiniBar';
import { useFrequentEmojis } from '../hooks/useFrequentEmojis';
import VideoPreviewModal from '../components/VideoPreviewModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { useAmmeSafetyLogout } from '../hooks/useAmmeSafetyLogout';
import { VoiceRecordButton } from '../components/VoiceRecordButton';
import { VoiceMessagePreview } from '../components/VoiceMessagePreview';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import VoiceMessageInline from '../components/VoiceMessageInline';
import CoupleMemoryPage from '../components/ui/CoupleMemoryPage';
import { createDownscaledPreview, createPreviewUrl, detectDeviceCapabilities } from '../lib/imageCompression';

// ── NEW: Camera sharing imports ────────────────────────────────────────────────
import { useWebRTCCamera } from '../hooks/useWebRTCCamera';
import CameraShareOverlay from '../components/CameraShareOverlay';
import { useVoiceCall } from '../hooks/useVoiceCall';
import VoiceCallScreen from '../components/VoiceCallScreen';
import BookIconMenu from '../components/BookIconMenu';
// ──────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = "https://notification-production-bdd8.up.railway.app"; //// vishwanavyasree account 12/5/26


interface Chat2Props {
  nickname: 'Vishwa' | 'Ammu';
  onLogout: () => void;
  onSwitchToAIChat: () => void;
  onSwitchToChat3: () => void;
  onOpenCoupleMemory?: () => void;
}

/**
 * MEMORY-OPTIMIZED CHAT COMPONENT
 * 
 * Key Changes:
 * 1. Uses blob URLs instead of base64 for image previews (33% less memory)
 * 2. Properly cleans up blob URLs when no longer needed
 * 3. Processes camera images before showing preview
 * 4. Uses refs to track preview URLs for cleanup
 *
 * NEW: Camera sharing via book icon toggle (WebRTC + Socket.IO)
 */
function Chat2({ nickname, onLogout, onSwitchToAIChat, onSwitchToChat3, onOpenCoupleMemory }: Chat2Props) {
  const handleAIClick = () => {
    onSwitchToAIChat();
  };

  const [message, setMessage] = useState('');
  
  // 🔥 MEMORY OPTIMIZATION: Use refs to track preview URLs for cleanup
  const imagePreviewUrlRef = useRef<string | null>(null);
  const videoPreviewUrlRef = useRef<string | null>(null);
  const filePreviewUrlRef = useRef<string | null>(null);
  
  // State for selected files and previews
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showKissRain, setShowKissRain] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChat, setCurrentChat] = useState('chat2');
  const [selfTyping, setSelfTyping] = useState(false);
  const [useBlackText, setUseBlackText] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; by: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [replyToMood, setReplyToMood] = useState<{ emoji: string; partnerNickname: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── Camera sharing state ──────────────────────────────────────────────────
  const [isCameraSharing, setIsCameraSharing] = useState(false);

  const {
    localStream,
    remoteStream,
    status: camSharingStatus,
    errorMsg: camSharingError,
    audioEnabled: camAudioEnabled,
    toggleAudio: camToggleAudio,
    stop: stopCameraSharing,
  } = useWebRTCCamera({ nickname, isEnabled: isCameraSharing });

  const handleCameraShareClose = () => {
    stopCameraSharing();
    setIsCameraSharing(false);
  };

  // ── Voice call state ──────────────────────────────────────────────────────
  const {
    callStatus,
    remoteStream: callRemoteStream,
    localStream:  callLocalStream,
    isMicOn,
    isSpeakerOn,
    isNearEar,
    callerName,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleSpeaker,
  } = useVoiceCall(nickname);

  // Is a call screen visible? (calling, incoming, connected, ended, busy)
  // callStatus "calling" = small bar only (VoiceCallScreen handles this internally)

  // Book icon menu handlers
  const handleStartCamera = () => {
    setIsCameraSharing(prev => {
      if (prev) { stopCameraSharing(); return false; }
      return true;
    });
  };

  const handleStartCall = () => {
    // Check if other user is online before calling
    if (isOtherUserOnline === false) {
      alert(`${nickname === 'Vishwa' ? 'Ammu' : 'Vishwa'} is offline. Try again when they're online.`);
      return;
    }
    startCall();
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Memory state
  const [memoryState, setMemoryState] = useState<"closed" | "password" | "open">("closed");
  const [memoryPassword, setMemoryPassword] = useState("");
  const [memoryError, setMemoryError] = useState("");

  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecorder();

  const { isCameraOn, toggleCamera, setCameraOff, isLoading: isCameraStateLoading } = useCameraState(nickname);
  const handleFaceViolation = () => {
    console.log('🚨 Face violation detected, redirecting to Chat1...');
    setCameraOff();
    onSwitchToAIChat();
  };

  const { isLoading: isCameraLoading, faceCount } = useFaceDetection({
    isEnabled: isCameraOn,
    onViolation: handleFaceViolation,
    onToggle: setCameraOff
  });

  const { msgs, send, clear, deleteMessage, loading } = useChat('privateMessages', nickname);
  const { userMood, otherUserMood, setMood, deleteMood } = useMood(nickname);
  const { handleTyping, stopTyping } = useOptimizedTyping(nickname);
  useOptimizedActivity(nickname);
  const otherUserActive = useOtherUserActivity(nickname === 'Vishwa' ? 'Ammu' : 'Vishwa');

  // FIX: Only mark messages as seen when tab is active AND memory page is NOT open
  const isTabActive = useTabVisibility();
  const isChatActive = isTabActive && memoryState !== "open";

  const { updateFrequentEmojis } = useFrequentEmojis(nickname);
  const { isReactorActive, handleReactorComplete } = useMoodReactor({
    userMood,
    otherUserMood,
    nickname,
    selfTyping,
    lastMessageTimestamp: msgs.length > 0 ? msgs[msgs.length - 1].ts : null
  });

  const { pendingHugFrom, isPendingHug } = useHugDetection({
    messages: msgs,
    nickname,
    onHugSuccess: async () => {
      const partnerName = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
      const hugMessage = `You and ${partnerName} were hugged 🫂 Have a great chat!`;
      await send(hugMessage, 'system');
    }
  });
  useAmmeSafetyLogout({
    nickname,
    onLogout,
    isEnabled: true
  });
  
  const otherUser = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
  const { otherUserLastSeen, isOtherUserOnline, connectionStatus } = useLastSeen({
    userId: nickname,
    otherUserId: otherUser
  });

  // Pass the corrected chat active state to useMessageSeen
  const { socket } = useMessageSeen({
    nickname,
    messages: msgs,
    isTabActive: isChatActive // FIX: Use isChatActive instead of isTabActive
  });

  // 🔥 MEMORY CLEANUP: Cleanup all preview URLs on unmount
  useEffect(() => {
    return () => {
      // Cleanup all blob URLs when component unmounts
      if (imagePreviewUrlRef.current) {
        revokePreviewUrl(imagePreviewUrlRef.current);
      }
      if (videoPreviewUrlRef.current) {
        revokePreviewUrl(videoPreviewUrlRef.current);
      }
      if (filePreviewUrlRef.current) {
        revokePreviewUrl(filePreviewUrlRef.current);
      }
    };
  }, []);

  // Memory functions
  const handleOpenMemory = () => {
    setMemoryPassword("");
    setMemoryError("");
    setMemoryState("password");
  };

  const handleVerifyMemoryPassword = () => {
    const correct =
      (nickname === "Vishwa" && memoryPassword === "2004") ||
      (nickname === "Ammu" && memoryPassword === "2006");

    if (correct) {
      setMemoryError("");
      setMemoryState("open");
    } else {
      setMemoryError("Wrong password");
    }
  };

  useEffect(() => {
    const setChatContext = async () => {
      try {
        await setDoc(doc(lastSeenDb, 'userContext', nickname), {
          currentChat: 'chat2',
          timestamp: serverTimestamp(),
          userId: nickname
        });
      } catch (error) {
        console.error('Error setting chat context:', error);
      }
    };
    setChatContext();
  }, [nickname]);

  useEffect(() => {
    return () => {
      if (isCameraOn) {
        console.log('🚪 Exiting Chat2, turning off camera...');
        setCameraOff();
      }
      // Also stop camera sharing on unmount
      if (isCameraSharing) {
        stopCameraSharing();
      }
    };
  }, [isCameraOn, setCameraOff, isCameraSharing, stopCameraSharing]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const spacingMap = useMemo(() => {
    return calculateSpacingForAllMessages(msgs);
  }, [msgs]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom && msgs.length > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [msgs.length]);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const setupTypingListener = () => {
      const unsubscribe = onSnapshot(
        doc(lastSeenDb, 'typing', otherUser),
        (docSnap) => {
          retryCount = 0;
          if (!docSnap.exists()) {
            setIsTyping(false);
            return;
          }

          const data = docSnap.data();
          const isTypingRemote = data.isTyping;
          const timestamp = data.timestamp?.toDate?.() ?? new Date();
          const now = new Date();

          const isStillTyping = isTypingRemote && now.getTime() - timestamp.getTime() < 3000;
          setIsTyping(isStillTyping);
        },
        (error) => {
          console.error('Error listening to typing status:', error);
          setIsTyping(false);

          if (retryCount < maxRetries) {
            retryCount++;
            const retryDelay = Math.pow(2, retryCount) * 1000;
            console.log(`🔄 Retrying typing listener in ${retryDelay}ms (attempt ${retryCount})`);
            setTimeout(setupTypingListener, retryDelay);
          }
        }
      );

      return unsubscribe;
    };

    const unsubscribe = setupTypingListener();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [otherUser]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    return () => clearTimeout(timeout);
  }, [msgs]);

  useEffect(() => {
    if (!selfTyping) return;
    const t = setTimeout(() => setSelfTyping(false), 3000);
    return () => clearTimeout(t);
  }, [selfTyping]);

  let messageQueue: string[] = [];
  let isProcessing = false;

  const sendMessageNotification = async (messageText: string) => {
    if (nickname !== "Ammu") return;

    const safeMessage = (messageText ?? "").trim();

    if (!safeMessage) {
      console.log("⚠️ Empty message — recovering…");

      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1].text;
        if (last?.trim()) {
          messageQueue.push(last.trim());
          if (!isProcessing) processQueue();
          return;
        }
      }

      console.log("🚫 No recovery possible — skip");
      return;
    }

    if (isOtherUserOnline === undefined || isOtherUserOnline === null) {
      console.log("⏳ Status unknown — queued:", safeMessage);
      messageQueue.push(safeMessage);
      if (!isProcessing) processQueue();
      return;
    }

    if (isOtherUserOnline) {
      console.log("🟢 Vishwa online — skip");
      return;
    }

    messageQueue.push(safeMessage);
    if (!isProcessing) processQueue();
  };

  const processQueue = async () => {
    if (isProcessing) return;
    isProcessing = true;

    while (messageQueue.length > 0) {
      let nextMessage = messageQueue.shift();

      if (!nextMessage || !nextMessage.trim()) {
        console.log("⚠️ Skipped empty");
        continue;
      }

      nextMessage = nextMessage.trim();

      try {
        const res = await fetch(`${BACKEND_URL}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: nextMessage }),
        });

        let data = null;

        try {
          data = await res.json();
        } catch {
          data = { queued: true }; 
        }

        if (data.success) {
          console.log("📨 SENT:", nextMessage);
        } 
        else if (data.queued) {
          console.log("🔁 Backend queued:", nextMessage);
        } 
        else {
          console.warn("⚠️ Unexpected:", data);
          messageQueue.unshift(nextMessage);
        }
      } catch (err) {
        console.error("⚠️ Network issue — retrying…", err);
        await new Promise((r) => setTimeout(r, 1000));
        messageQueue.unshift(nextMessage);
      }

      await new Promise((r) => setTimeout(r, 1100));
    }

    isProcessing = false;
  };

  const handleReply = (messageId: string, text: string) => {
    const message = msgs.find(msg => msg.id === messageId);
    if (message) {
      setReplyTo({
        id: messageId,
        text: text,
        by: message.by
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const isMobile = () => {
    return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleEmojiButtonClick = () => {
    if (!isMobile()) {
      setShowEmojiPicker(!showEmojiPicker);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const currentMessage = message;
      const newMessage = currentMessage.slice(0, start) + emoji + currentMessage.slice(end);

      setMessage(newMessage);

      setTimeout(() => {
        const newCursorPosition = start + emoji.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        textarea.focus();
      }, 0);
    } else {
      setMessage(prev => prev + emoji);
    }
  };

  const handleEmojiInsert = (emoji: string) => {
    handleEmojiSelect(emoji);
  };

  const extractEmojisFromText = (text: string): string[] => {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return text.match(emojiRegex) || [];
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImage) {
      await handleSendImage();
    } else if (selectedVideo) {
      await handleSendVideo();
    } else if (selectedFile) {
      await handleSendFile();
    } else if (message.trim()) {
      const textToSend = message.trim();
      setMessage('');
      setReplyTo(null);
      setReplyToMood(null);
      setSelfTyping(false);
      stopTyping();

      let finalTextToSend = textToSend;
      if (nickname !== 'Vishwa' && nickname !== 'Ammu') {
        finalTextToSend = `🤖 ${textToSend}`;
      }

      const moodMetadata = replyToMood ? {
        moodEmoji: replyToMood.emoji,
        moodOwnerUserId: replyToMood.partnerNickname === 'Vishwa' ? 'Vishwa' : 'Ammu',
        moodSetAt: new Date(),
        isReplyToMood: true
      } : undefined;

      try {
        await send(finalTextToSend, 'text', undefined, undefined, moodMetadata, replyTo);
        await sendMessageNotification(finalTextToSend);

        const emojisInMessage = extractEmojisFromText(finalTextToSend);
        if (emojisInMessage.length > 0) {
          updateFrequentEmojis(emojisInMessage);
        }
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        textareaRef.current?.focus();
      }
    }
  };

  useEffect(() => {
    if (msgs.length > 0) {
      const latestMessage = msgs[msgs.length - 1];
      if (latestMessage.text?.includes('😘') && latestMessage.by === 'Vishwa' && nickname === 'Ammu') {
        setShowKissRain(true);
      }
    }
  }, [msgs, nickname]);

  const handleImageSelect = useCallback((file: File, previewUrl: string) => {
    // Clean up any existing preview URL
    if (imagePreviewUrlRef.current && imagePreviewUrlRef.current !== previewUrl) {
      revokePreviewUrl(imagePreviewUrlRef.current);
    }
    
    // Store the new preview URL
    imagePreviewUrlRef.current = previewUrl;
    
    setSelectedImage(file);
    setImagePreview(previewUrl);
  }, []);

  const handleSendImage = async () => {
    if (selectedImage && !isUploading) {
      setIsUploading(true);
      try {
        const timestamp = Date.now();
        const fileName = `${nickname}_${timestamp}_${selectedImage.name}`;

        const imageUrl = await uploadImageToSupabase(selectedImage, fileName);

        await send('', 'image', imageUrl, fileName, undefined, replyTo);

        // Add to coupleHotMemory collection
        await addDoc(collection(db, "coupleHotMemory"), {
          imageUrl: imageUrl,
          isHot: false,
          createdAt: serverTimestamp(),
        });

        await sendMessageNotification(`📷 ${nickname} sent a photo`);

        // 🔥 CLEANUP: Clear image state and revoke preview URL
        setSelectedImage(null);
        if (imagePreviewUrlRef.current) {
          revokePreviewUrl(imagePreviewUrlRef.current);
          imagePreviewUrlRef.current = null;
        }
        setImagePreview(null);
        setReplyTo(null);
      } catch (error) {
        console.error('Image upload failed:', error);
        alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelImage = () => {
    // 🔥 CLEANUP: Revoke preview URL when cancelling
    if (imagePreviewUrlRef.current) {
      revokePreviewUrl(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleVideoSelect = useCallback((file: File, previewUrl: string) => {
    // Clean up any existing preview URL
    if (videoPreviewUrlRef.current && videoPreviewUrlRef.current !== previewUrl) {
      revokePreviewUrl(videoPreviewUrlRef.current);
    }
    
    videoPreviewUrlRef.current = previewUrl;
    setSelectedVideo(file);
    setVideoPreview(previewUrl);
  }, []);

  const handleSendVideo = async () => {
    if (selectedVideo && !isUploading) {
      setIsUploading(true);
      try {
        const timestamp = Date.now();
        const fileName = `${nickname}_${timestamp}_${selectedVideo.name}`;

        const videoUrl = await uploadVideoToSupabase(selectedVideo, fileName);

        await send('', 'video', undefined, fileName, undefined, replyTo, videoUrl);
        await sendMessageNotification(`🎥 ${nickname} sent a video`);

        // 🔥 CLEANUP
        setSelectedVideo(null);
        if (videoPreviewUrlRef.current) {
          revokePreviewUrl(videoPreviewUrlRef.current);
          videoPreviewUrlRef.current = null;
        }
        setVideoPreview(null);
        setReplyTo(null);
      } catch (error) {
        console.error('Video upload failed:', error);
        alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelVideo = () => {
    // 🔥 CLEANUP
    if (videoPreviewUrlRef.current) {
      revokePreviewUrl(videoPreviewUrlRef.current);
      videoPreviewUrlRef.current = null;
    }
    setSelectedVideo(null);
    setVideoPreview(null);
  };

  const handleFileSelect = useCallback((file: File, previewUrl: string) => {
    setSelectedFile(file);
    setFilePreview(previewUrl || file.name); // Use filename if no preview
  }, []);

  const handleSendFile = async () => {
    if (selectedFile && !isUploading) {
      setIsUploading(true);
      try {
        const timestamp = Date.now();
        const fileName = `${nickname}_${timestamp}_${selectedFile.name}`;

        const fileUrl = await uploadFileToSupabase(selectedFile, fileName);

        await send('', 'file', undefined, selectedFile.name, undefined, replyTo, undefined, fileUrl, selectedFile.type);
        await sendMessageNotification(`📄 ${nickname} sent a file: ${selectedFile.name}`);

        setSelectedFile(null);
        setFilePreview(null);
        setReplyTo(null);
      } catch (error) {
        console.error('File upload failed:', error);
        alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    const active = !!value.trim();
    setSelfTyping(active);

    if (active) {
      handleTyping();
    } else {
      stopTyping();
    }
  };

  const getPlaceholderText = () => {
    if (replyToMood) {
      return `Reply to ${replyToMood.partnerNickname}'s mood...`;
    }
    return "Enter message...";
  };

  const handleClearOrDelete = async () => {
    if (selectedMessageForDelete) {
      deleteMessage(selectedMessageForDelete);
      setSelectedMessageForDelete(null);
      return;
    }

    const skip = (window as any).__AMMU_SKIP_LOGOUT__;
    skip?.start();

    const userConfirmed = window.confirm(
      `Are you sure ${nickname} wants to delete all messages?`
    );

    setTimeout(() => {
      skip?.stop();
    }, 800);

    if (userConfirmed) {
      try {
        await clear();
      } catch (e) {
        alert('Failed to delete messages. Please try again.');
        console.error('Clear failed:', e);
      }
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';

    const messageDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    const istOffset = 5.5 * 60 * 60 * 1000;
    const messageIST = new Date(messageDate.getTime() + istOffset);
    const nowIST = new Date(new Date().getTime() + istOffset);

    const todayStartIST = new Date(nowIST);
    todayStartIST.setHours(0, 0, 0, 0);

    const isToday = messageIST >= todayStartIST;

    if (isToday) {
      return messageIST.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });
    } else {
      return messageIST.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });
    }
  };

  const micVisible = (!message.trim() && !selectedImage && !selectedVideo && !selectedFile) || isRecording;

  const handleSendVoiceMessage = async (voiceBlob: Blob) => {
    if (isUploading) return;
    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${nickname}_${timestamp}_voice.webm`;
      const voiceFile = new File([voiceBlob], fileName, { type: 'audio/webm' });

      const fileUrl = await uploadFileToSupabase(voiceFile, fileName);

      await send('', 'file', undefined, fileName, undefined, replyTo, undefined, fileUrl, 'audio/webm');
      await sendMessageNotification(`🎤 ${nickname} sent a voice message`);

      resetRecording();
      setReplyTo(null);
    } catch (error) {
      console.error('Voice upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <KissEmojiRain show={showKissRain} onComplete={() => setShowKissRain(false)} />
      <MoodReactor isActive={isReactorActive} onComplete={handleReactorComplete} />

      {/* Voice call — "calling" shows small bar, all other statuses show full screen */}
      {callStatus !== "idle" && (
        <VoiceCallScreen
          callStatus={callStatus}
          callerName={callerName}
          nickname={nickname}
          isMicOn={isMicOn}
          isSpeakerOn={isSpeakerOn}
          isNearEar={isNearEar}
          callDuration={callDuration}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMic={toggleMic}
          onToggleSpeaker={toggleSpeaker}
        />
      )}

      {isCameraOn && (
        <CameraButton
          isCameraOn={isCameraOn}
          toggleCamera={toggleCamera}
          isLoading={isCameraLoading}
          faceCount={faceCount}
        />
      )}

      {/* ── NEW: Camera sharing overlay (WebRTC floating window) ── */}
      <CameraShareOverlay
        localStream={localStream}
        remoteStream={remoteStream}
        status={camSharingStatus}
        errorMsg={camSharingError}
        nickname={nickname}
        isEnabled={isCameraSharing}
        audioEnabled={camAudioEnabled}
        onToggleAudio={camToggleAudio}
        onClose={handleCameraShareClose}
      />

<style jsx>{`
  @keyframes swing {
    0%, 100% {
      transform: rotate(-4deg);
    }
    50% {
      transform: rotate(4deg);
    }
  }
`}</style>

      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-green-50/95 via-blue-50/95 to-purple-50/95 backdrop-blur-md px-4 py-4 z-50 shadow-lg border-b border-white/30">
        {/* ⭐ MEMORY STAR - Responsive & Always Visible */}
<div className="fixed right-4 sm:right-8 top-20 sm:top-24 z-[60] pointer-events-none">
  <button
    onClick={handleOpenMemory}
    className="relative bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-all duration-300 shadow-lg hover:shadow-xl rounded-full p-2 sm:p-3 pointer-events-auto"
    title="Open Memories"
    style={{
      animation: 'swing 4s ease-in-out infinite'
    }}
  >
    <span className="text-lg sm:text-xl">⭐</span>

    {/* Spark */}
    <span className="absolute -top-1 -right-1 animate-ping text-yellow-400 text-xs">
      ✨
    </span>
  </button>
</div>

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {/* ── Book icon → popup menu with Camera + Voice Call options ── */}
              <BookIconMenu
                isCameraSharing={isCameraSharing}
                isInCall={callStatus !== "idle"}
                onStartCamera={handleStartCamera}
                onStartCall={handleStartCall}
              />

              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent truncate">
                  AI Teacher
                </h1>
                <PresenceIndicator
                  isOnline={isOtherUserOnline}
                  lastSeen={otherUserLastSeen}
                  connectionStatus={connectionStatus}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="hidden sm:block flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={onSwitchToChat3}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  Moods
                </button>
                <MoodDisplay
                  userMood={userMood}
                  otherUserMood={otherUserMood}
                  nickname={nickname}
                  onOpenPicker={() => setShowMoodPicker(true)}
                  onReplyToMood={(emoji, partner) => setReplyToMood({ emoji, partnerNickname: partner })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2 flex-shrink-0">
              <button
                onClick={handleAIClick}
                className="px-3 py-2 sm:px-3 sm:py-2 rounded-full text-sm sm:text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                title="Switch to AI Chat"
              >
                AI
              </button>

              <button
                onClick={() => setUseBlackText(prev => !prev)}
                className={`px-3 py-2 sm:px-3 sm:py-2 rounded-full text-sm sm:text-xs font-semibold transition-colors ${
                  useBlackText
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle text color"
              >
                T
              </button>
              <button
                onClick={handleClearOrDelete}
                className={`px-3 py-2 sm:px-3 sm:py-2 rounded-full text-sm sm:text-xs font-semibold transition-colors ${
                  selectedMessageForDelete
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-200'
                }`}
                title={selectedMessageForDelete ? "Delete selected message" : "Clear all messages"}
              >
                🗑️
              </button>

              <button
                onClick={onLogout}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Exit</span>
              </button>

              <button
                onClick={onLogout}
                className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                title="Exit"
              >
                <LogOut className="w-5 h-5" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Moods */}
      <div className="sm:hidden fixed top-14 left-0 right-0 z-40 flex justify-center px-2 pt-2">
        <div className="flex flex-col items-center gap-1 bg-transparent rounded-b-3xl px-6 py-3">
          <button
            onClick={onSwitchToChat3}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            Moods
          </button>
          
          <MoodDisplay
            userMood={userMood}
            otherUserMood={otherUserMood}
            nickname={nickname}
            onOpenPicker={() => setShowMoodPicker(true)}
            onReplyToMood={(emoji, partner) =>
              setReplyToMood({ emoji, partnerNickname: partner })
            }
          />
        </div>
      </div>

      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="text-9xl opacity-10 text-gray-500">📚</div>
      </div>

      <div
        ref={messagesContainerRef}
        className="pt-20 sm:pt-20 pb-32 max-w-4xl mx-auto p-4 relative z-10 h-screen overflow-y-auto"
        style={{ paddingTop: window.innerWidth < 640 ? '160px' : '80px' }}
      >
        {loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-500">Loading messages...</p>
          </div>
        )}
        <div className="space-y-2">
          {msgs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚💬</div>
              <p className="text-gray-500 italic">Start your study discussion here...</p>
            </div>
          ) : (
            msgs.map((msg: any, idx: number) => {
              const isOwn = msg.by === nickname;
              const isAudio =
                (msg.mimeType && msg.mimeType.startsWith('audio/')) ||
                (msg.fileUrl && /\.(webm|mp3|m4a|ogg|wav)$/i.test(msg.fileUrl)) ||
                (msg.fileName && /\.(webm|mp3|m4a|ogg|wav)$/i.test(msg.fileName)) ||
                msg.type === 'audio';

              const hasSpacing = spacingMap[msg.id] || false;

              if (isAudio && (msg.fileUrl || msg.audioUrl)) {
                const src = msg.audioUrl || msg.fileUrl;
                return (
                  <RobotCloud
                    key={msg.id}
                    messageId={msg.id}
                    text=""
                    audioUrl={src}
                    isOwn={isOwn}
                    isUser={isOwn}
                    isAI={msg.by !== nickname && (msg.text?.startsWith('🤖') || msg.by === 'AI')}
                    type="voice"
                    currentUserNickname={nickname}
                    timestamp={formatMessageTime(msg.ts)}
                    useBlackText={useBlackText}
                    onReply={handleReply}
                    onDelete={handleDeleteMessage}
                    replyTo={msg.replyTo}
                    msg={msg}
                    hasSpacing={hasSpacing}
                  />
                );
              }

              return (
                <RobotCloud
                  key={msg.id}
                  messageId={msg.id}
                  text={msg.text}
                  imageUrl={msg.imageUrl}
                  videoUrl={msg.videoUrl}
                  fileUrl={msg.fileUrl}
                  fileName={msg.fileName}
                  mimeType={msg.mimeType}
                  isOwn={isOwn}
                  isUser={isOwn}
                  isAI={msg.by !== nickname && (msg.text?.startsWith('🤖') || msg.by === 'AI')}
                  type={msg.type}
                  currentUserNickname={nickname}
                  timestamp={formatMessageTime(msg.ts)}
                  useBlackText={useBlackText}
                  onReply={handleReply}
                  onDelete={handleDeleteMessage}
                  replyTo={msg.replyTo}
                  msg={msg}
                  hasSpacing={hasSpacing}
                />
              );
            })
          )}
          {isTyping && (
            <TypingIndicator nickname={otherUser} currentUserNickname={nickname} />
          )}
          <div ref={messagesEndRef} />
          <div className="h-24"></div>
        </div>
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-32 right-6 mb-4 bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-all z-40"
          title="Scroll to latest message"
        >
          💉
        </button>
      )}

      {imagePreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Send Image</h3>
              <button onClick={handleCancelImage} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-xl mb-4 max-h-64 object-cover" />
            <div className="flex gap-3">
              <button onClick={handleCancelImage} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSendImage} disabled={isUploading} className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                {isUploading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <VideoPreviewModal
        videoFile={selectedVideo}
        videoPreview={videoPreview}
        isOpen={!!videoPreview}
        onClose={handleCancelVideo}
        onSend={handleSendVideo}
        isUploading={isUploading}
      />

      <FilePreviewModal
        file={selectedFile}
        filePreview={filePreview}
        isOpen={!!filePreview}
        onClose={handleCancelFile}
        onSend={handleSendFile}
        isUploading={isUploading}
      />

      {audioUrl && audioBlob && !isRecording && (
        <VoiceMessagePreview
          audioUrl={audioUrl}
          audioBlob={audioBlob}
          onSend={handleSendVoiceMessage}
          onDelete={resetRecording}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-transparent p-4 z-50 ">
        {replyToMood && (
          <ReplyToMoodPill
            emoji={replyToMood.emoji}
            partnerNickname={replyToMood.partnerNickname}
            onCancel={() => setReplyToMood(null)}
          />
        )}

        {replyTo && (
          <div className="bg-blue-100 p-2 mb-1 rounded relative text-sm text-gray-800">
            <span className="font-bold text-blue-800">Replying to AI </span>
            <div className="truncate max-w-xs">
              {replyTo.text.split(' ').slice(0, 5).join(' ')}
              {replyTo.text.split(' ').length > 8 && '...'}
            </div>
            <button
              className="absolute top-1 left-1/2 transform -translate-x-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setReplyTo(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <InstagramPlusButton
              onImageSelect={handleImageSelect}
              onVideoSelect={handleVideoSelect}
              onFileSelect={handleFileSelect}
              theme="chat2"
            />

            {!isMobile() && (
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={handleEmojiButtonClick}
                  className={`p-3 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl ${
                    showEmojiPicker
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Add emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <EmojiPicker
                  isOpen={showEmojiPicker}
                  onClose={() => setShowEmojiPicker(false)}
                  onEmojiClick={handleEmojiSelect}
                  buttonRef={emojiButtonRef}
                />
              </div>
            )}

            <div className="flex-1">
              <EmojiMiniBar
                userId={nickname}
                currentText={message}
                onEmojiInsert={handleEmojiInsert}
                className="pl-0 "
              />

              <button
                onClick={toggleCamera}
                className={`fixed bottom-20 right-6 p-3 mb-2 rounded-full shadow-lg transition-all z-40 ${
                  isCameraOn
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                title={isCameraOn ? "Turn off camera" : "Turn on camera"}
              >
                <Camera className="w-6 h-6" />
              </button>

              <div className="relative">
                <textarea
                  value={message}
                  onChange={handleInputChange}
                  placeholder={getPlaceholderText()}
                  className={`w-full px-4 py-3 rounded-2xl border border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none resize-none transition-all bg-white shadow-sm overflow-y-auto ${micVisible ? 'pr-12' : ''}`}
                  rows={1}
                  style={{
                    minHeight: '48px',
                    maxHeight: '120px',
                    height: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain'
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  ref={(el) => {
                    textareaRef.current = el;
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    } else if (e.key === 'Escape') {
                      setSelfTyping(false);
                      stopTyping();
                      if (replyToMood) {
                        setReplyToMood(null);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!message.trim()) {
                      setSelfTyping(false);
                      stopTyping();
                    }
                  }}
                />

                <div className="absolute bottom-2 right-2 z-10">
                  <VoiceRecordButton
                    isRecording={isRecording}
                    recordingTime={recordingTime}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    isVisible={micVisible}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!message.trim() && !selectedImage && !selectedVideo && !selectedFile}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 rounded-full hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl z-10"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      <MoodPicker
        isOpen={showMoodPicker}
        onClose={() => setShowMoodPicker(false)}
        onSelectMood={setMood}
        onDeleteMood={deleteMood}
        currentMood={userMood?.emoji}
      />

      {memoryState === "password" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-gray-200">
            <h2 className="text-lg font-semibold text-center mb-4 text-gray-800">
              🔐 Enter Memory Password
            </h2>

            <input
              type="password"
              value={memoryPassword}
              onChange={(e) => setMemoryPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleVerifyMemoryPassword();
                }
              }}
            />

            {memoryError && (
              <p className="text-red-500 text-sm text-center mb-2">
                {memoryError}
              </p>
            )}

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setMemoryState("closed")}
                className="flex-1 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                onClick={handleVerifyMemoryPassword}
                className="flex-1 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600"
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}

      {memoryState === "open" && (
        <CoupleMemoryPage onExit={() => setMemoryState("closed")} />
      )}

      <div className={`fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-500 ${showKissRain || isReactorActive ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute top-20 left-10 text-blue-200 text-3xl animate-bounce">🩺</div>
        <div className="absolute top-32 right-20 text-green-200 text-2xl animate-pulse">👨‍⚕️</div>
        <div className="absolute bottom-40 left-32 text-purple-300 text-4xl animate-bounce">🩺</div>
        <div className="absolute bottom-20 right-16 text-indigo-300 text-2xl animate-pulse">👩‍⚕️</div>
        <div className="absolute top-60 right-32 text-pink-300 text-2xl animate-pulse">👨‍⚕️</div>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <PresenceDebugPanel
          userId={nickname}
          isOtherUserOnline={isOtherUserOnline}
          otherUserLastSeen={otherUserLastSeen}
          connectionStatus={connectionStatus}
        />
      )}
    </div>
  );
}

export default Chat2;