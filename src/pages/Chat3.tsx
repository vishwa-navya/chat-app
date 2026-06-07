import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BookOpen, Send, LogOut, Plus, X, Sparkles, Camera, Smile, Heart, AlertCircle } from 'lucide-react';
import InstagramPlusButton from '../components/InstagramPlusButton';
import MoodPicker from '../components/MoodPicker';
import MoodDisplay from '../components/MoodDisplay';
import ReplyToMoodPill from '../components/ReplyToMoodPill';
import { useChat } from '../hooks/useChat';
import { useMood } from '../hooks/useMood';
import { useOptimizedTyping } from '../hooks/useOptimizedTyping';
import { useOptimizedActivity, useOtherUserActivity } from '../hooks/useOptimizedActivity';
import KissEmojiRain from '../components/KissEmojiRain';
import RobotCloudChat3 from '../components/RobotCloudChat3';
import MoodReactor from '../components/MoodReactor';
import { useMessageSeen } from '../hooks/useMessageSeen';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { useEmergencyExit } from '../hooks/useEmergencyExit';
import TypingIndicatorChat3 from '../components/TypingIndicatorChat3';
import { uploadImageToSupabase, uploadVideoToSupabase, uploadFileToSupabase } from '../lib/supabase';
import { calculateSpacingForAllMessages } from '../lib/messageSpacing';
import { onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
import { VoiceRecordButton } from '../components/VoiceRecordButton';
import { VoiceMessagePreview } from '../components/VoiceMessagePreview';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import VoiceMessageInline from '../components/VoiceMessageInline';
import { useAmmeSafetyLogout } from '../hooks/useAmmeSafetyLogout';

const BACKEND_URL = "https://notification-production-bdd8.up.railway.app";

interface Chat3Props {
  nickname: 'Vishwa' | 'Ammu';
  onLogout: () => void;
  onSwitchToAIChat: () => void;
  onSwitchToChat2: () => void;
  onOpenMemory?: () => void;
}

function Chat3({ nickname, onLogout, onSwitchToAIChat, onSwitchToChat2, onOpenMemory }: Chat3Props) {
  useEmergencyExit(nickname);

  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showKissRain, setShowKissRain] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChat, setCurrentChat] = useState('chat3');
  const [selfTyping, setSelfTyping] = useState(false);
  const [useBlackText, setUseBlackText] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; by: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState<string | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [replyToMood, setReplyToMood] = useState<{ emoji: string; partnerNickname: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const imagePreviewUrlRef = useRef<string | null>(null);
  const videoPreviewUrlRef = useRef<string | null>(null);
  const uploadAbortController = useRef<AbortController | null>(null);

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

  useEffect(() => {
    const setChatContext = async () => {
      try {
        await setDoc(doc(lastSeenDb, 'userContext', nickname), {
          currentChat: 'chat3',
          timestamp: serverTimestamp(),
          userId: nickname
        });
      } catch (error) {
        console.error('Error setting chat context:', error);
      }
    };
    setChatContext();
  }, [nickname]);

  const isTabActive = useTabVisibility();
  const { socket } = useMessageSeen({
    nickname,
    messages: msgs,
    isTabActive
  });

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

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
      }
      if (videoPreviewUrlRef.current) {
        URL.revokeObjectURL(videoPreviewUrlRef.current);
      }
      if (uploadAbortController.current) {
        uploadAbortController.current.abort();
      }
      if (isCameraOn) {
        console.log('🚪 Exiting Chat3, turning off camera...');
        setCameraOff();
      }
    };
  }, [isCameraOn, setCameraOff]);

  const spacingMap = useMemo(() => {
    return calculateSpacingForAllMessages(msgs);
  }, [msgs]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

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

  const messageQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);

  const sendMessageNotification = async (messageText: string) => {
    if (nickname !== "Ammu") return;

    const safeMessage = (messageText ?? "").trim();

    if (!safeMessage) {
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1].text;
        if (last?.trim()) {
          messageQueueRef.current.push(last.trim());
          if (!isProcessingQueueRef.current) processQueue();
        }
      }
      return;
    }

    if (isOtherUserOnline === undefined || isOtherUserOnline === null) {
      messageQueueRef.current.push(safeMessage);
      if (!isProcessingQueueRef.current) processQueue();
      return;
    }

    if (isOtherUserOnline) {
      return;
    }

    messageQueueRef.current.push(safeMessage);
    if (!isProcessingQueueRef.current) processQueue();
  };

  const processQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (messageQueueRef.current.length > 0) {
      let nextMessage = messageQueueRef.current.shift();

      if (!nextMessage || !nextMessage.trim()) {
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
        } else if (data.queued) {
          console.log("🔁 Backend queued:", nextMessage);
        } else {
          messageQueueRef.current.unshift(nextMessage);
        }
      } catch (err) {
        await new Promise((r) => setTimeout(r, 1000));
        messageQueueRef.current.unshift(nextMessage);
      }

      await new Promise((r) => setTimeout(r, 1100));
    }

    isProcessingQueueRef.current = false;
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

  const handleImageSelect = useCallback((file: File) => {
    setCameraError(null);
    
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    
    if (!file || file.size === 0) {
      setCameraError('Invalid image file');
      return;
    }
    
    setSelectedImage(file);
    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrlRef.current = previewUrl;
    setImagePreview(previewUrl);
  }, []);

  const handleCameraImageSelect = useCallback(async (file: File, isBackCamera: boolean) => {
    setCameraError(null);
    
    try {
      if (!file || file.size === 0) {
        throw new Error('Camera returned empty file');
      }

      console.log(`📸 Photo taken:`, Math.round(file.size/1024), 'KB', isBackCamera ? '(Back)' : '(Front)');

      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
      
      setSelectedImage(file);
      
      const previewUrl = URL.createObjectURL(file);
      imagePreviewUrlRef.current = previewUrl;
      setImagePreview(previewUrl);
      
      console.log('✅ Preview created successfully');
      
    } catch (error: any) {
      console.error('Camera handling error:', error);
      setCameraError(error.message || 'Failed to process image');
      setSelectedImage(null);
      setImagePreview(null);
    }
  }, []);

  const handleCameraError = useCallback((errorMsg: string) => {
    setCameraError(errorMsg);
    setTimeout(() => setCameraError(null), 5000);
  }, []);

  const handleSendImage = async () => {
    if (!selectedImage || isUploading) return;
    
    setIsUploading(true);
    setCameraError(null);

    const fileToUpload = selectedImage;
    const fileName = `${nickname}_${Date.now()}_${fileToUpload.name || 'photo.jpg'}`;
    
    const isFromGallery = (fileToUpload as any).__isFromGallery === true;
    
    try {
      console.log('📤 Starting upload:', fileName, 'Size:', Math.round(fileToUpload.size/1024), 'KB', isFromGallery ? '(Gallery)' : '(Camera)');

      let imageUrl: string;
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        try {
          const isBackCamera = fileToUpload.size > 3 * 1024 * 1024 && !isFromGallery;
          
          imageUrl = await uploadImageToSupabase(
            fileToUpload, 
            fileName,
            isBackCamera,
            isFromGallery
          );
          
          console.log('✅ Upload success:', imageUrl);
          break;
          
        } catch (uploadError: any) {
          retries++;
          console.warn(`Upload attempt ${retries} failed:`, uploadError.message);
          
          if (retries >= maxRetries) {
            throw new Error('Upload failed after ' + maxRetries + ' attempts. Please try again.');
          }
          
          await new Promise(r => setTimeout(r, 2000 * retries));
        }
      }

      await send('', 'image', imageUrl!, fileName, undefined, replyTo);
      await sendMessageNotification(`📷 ${nickname} sent a photo`);

      setSelectedImage(null);
      setImagePreview(null);
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
      
      setReplyTo(null);

    } catch (error: any) {
      console.error('Image upload failed:', error);
      
      let errorMsg = 'Upload failed. Please try again.';
      if (error?.message?.includes('memory') || error?.name === 'NotReadableError') {
        errorMsg = 'Phone memory full! Please close other apps and try again.';
      } else if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        errorMsg = 'Network too slow! Please move to better signal area.';
      }
      
      setCameraError(errorMsg);
      setTimeout(() => setCameraError(null), 8000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelImage = async () => {
    if (uploadAbortController.current) {
      uploadAbortController.current.abort();
      uploadAbortController.current = null;
    }
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    
    setSelectedImage(null);
    setImagePreview(null);
    setCameraError(null);
  };

  const handleVideoSelect = useCallback((file: File) => {
    setCameraError(null);
    
    if (videoPreviewUrlRef.current) {
      URL.revokeObjectURL(videoPreviewUrlRef.current);
    }
    
    setSelectedVideo(file);
    const previewUrl = URL.createObjectURL(file);
    videoPreviewUrlRef.current = previewUrl;
    setVideoPreview(previewUrl);
  }, []);

  const handleSendVideo = async () => {
    if (!selectedVideo || isUploading) return;
    
    setIsUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `${nickname}_${timestamp}_${selectedVideo.name}`;

      const videoUrl = await uploadVideoToSupabase(selectedVideo, fileName);

      await send('', 'video', undefined, fileName, undefined, replyTo, videoUrl);
      await sendMessageNotification(`🎥 ${nickname} sent a video`);

      if (videoPreviewUrlRef.current) {
        URL.revokeObjectURL(videoPreviewUrlRef.current);
        videoPreviewUrlRef.current = null;
      }
      
      setSelectedVideo(null);
      setVideoPreview(null);
      setReplyTo(null);

    } catch (error: any) {
      console.error('Video upload failed:', error);
      const skip = (window as any).__AMMU_SKIP_LOGOUT__;
      skip?.start();
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      setTimeout(() => skip?.stop(), 800);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelVideo = () => {
    if (videoPreviewUrlRef.current) {
      URL.revokeObjectURL(videoPreviewUrlRef.current);
      videoPreviewUrlRef.current = null;
    }
    setSelectedVideo(null);
    setVideoPreview(null);
  };

  const handleFileSelect = useCallback((file: File) => {
    setCameraError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSendFile = async () => {
    if (!selectedFile || isUploading) return;
    
    setIsUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `${nickname}_${timestamp}_${selectedFile.name}`;

      const fileUrl = await uploadFileToSupabase(selectedFile, fileName);

      await send(
        '',
        'file',
        undefined,
        selectedFile.name,
        undefined,
        replyTo,
        undefined,
        fileUrl,
        selectedFile.type
      );

      await sendMessageNotification(`📄 ${nickname} sent a file: ${selectedFile.name}`);

      setSelectedFile(null);
      setFilePreview(null);
      setReplyTo(null);

    } catch (error: any) {
      console.error('File upload failed:', error);
      const skip = (window as any).__AMMU_SKIP_LOGOUT__;
      skip?.start();
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      setTimeout(() => skip?.stop(), 800);
    } finally {
      setIsUploading(false);
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
    <div
      className="h-[100dvh] w-full relative overflow-hidden"
      style={{
        backgroundImage: 'url(https://i.postimg.cc/tT43g7W9/Whats-App-Image-2025-08-14-at-22-04-13-2b4f9f06.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
        minHeight: '100dvh',
      }}
    >
      <div className="absolute inset-0 bg-black/10"></div>

      <KissEmojiRain show={showKissRain} onComplete={() => setShowKissRain(false)} />
      <MoodReactor isActive={isReactorActive} onComplete={handleReactorComplete} />

      {isCameraOn && (
        <CameraButton
          isCameraOn={isCameraOn}
          toggleCamera={toggleCamera}
          isLoading={isCameraLoading}
          faceCount={faceCount}
        />
      )}

      {cameraError && (
        <div className="fixed top-20 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg z-50 flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{cameraError}</span>
          <button 
            onClick={() => setCameraError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 bg-transparent backdrop-blur-md px-4 py-4 z-50 shadow-lg border-b border-white/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {isOtherUserOnline ? (
                <span className="w-17 h-17 sm:w-8 sm:h-8 text-red-500">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0 fill-white" />
                </span>
              ) : (
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0 fill-red" />
              )}

              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-white truncate">
                  VIS & NAV
                </h1>
                <PresenceIndicator
                  isOnline={isOtherUserOnline}
                  lastSeen={otherUserLastSeen}
                  connectionStatus={connectionStatus}
                  className="text-xs text-white"
                />
              </div>
            </div>

            <div className="hidden sm:block flex-shrink-0">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={onSwitchToChat2}
                  className="text-xs font-medium text-blue-200 hover:text-white transition-colors cursor-pointer"
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
                onClick={onSwitchToAIChat}
                className="px-3 py-2 sm:px-3 sm:py-2 rounded-full text-sm sm:text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                title="Switch to AI Chat"
              >
                AI
              </button>

              <button
                onClick={onOpenMemory}
                className="px-3 py-2 sm:px-3 sm:py-2 rounded-full text-sm sm:text-xs font-semibold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                title="Open Memory"
              >
                <Sparkles className="w-4 h-4" />
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

          <div className="sm:hidden flex justify-center mt-3 pb-1">
            <button
              onClick={onSwitchToChat2}
              className="text-xs font-medium text-blue-200 hover:text-white transition-colors cursor-pointer"
            >
              Moods
            </button>
          </div>
        </div>
      </div>

      <div className="sm:hidden fixed top-16 left-0 right-0 z-40 flex justify-center px-4">
        <div className="flex justify-center">
          <div className="bg-transparent backdrop-blur-sm rounded-b-3xl px-6 py-2 shadow-lg border border-white/30 border-t-0 mt-4">
            <div className="flex justify-center mb-1">
              <span className="text-xs font-medium text-blue-200">Moods</span>
            </div>
            <MoodDisplay
              userMood={userMood}
              otherUserMood={otherUserMood}
              nickname={nickname}
              onOpenPicker={() => setShowMoodPicker(true)}
              onReplyToMood={(emoji, partner) => setReplyToMood({ emoji, partnerNickname: partner })}
            />
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="pt-20 sm:pt-20 pb-32 max-w-4xl mx-auto p-4 relative z-10 h-screen overflow-y-auto"
        style={{ paddingTop: window.innerWidth < 640 ? '180px' : '80px' }}
      >
        {loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-white">Loading messages...</p>
          </div>
        )}
        <div className="space-y-2">
          {msgs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚💬</div>
              <p className="text-white italic">Start your study discussion here...</p>
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
                  <RobotCloudChat3
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
                <RobotCloudChat3
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
            <TypingIndicatorChat3 nickname={otherUser} currentUserNickname={nickname} />
          )}
          <div ref={messagesEndRef} />
          <div className="h-24"></div>
        </div>
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-32 right-6 mb-4 bg-[#4A6FA5] text-white p-3 rounded-full shadow-lg hover:bg-[#3A5F95] transition-all z-40"
          title="Scroll to latest message"
        >
          💘
        </button>
      )}

      {selectedImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">
                Send Image
              </h3>
              <button 
                onClick={handleCancelImage} 
                disabled={isUploading}
                className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {imagePreview && (
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-full h-auto rounded-xl mb-4 max-h-64 object-cover" 
              />
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={handleCancelImage}
                disabled={isUploading}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendImage} 
                disabled={isUploading} 
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  '⚡ Send'
                )}
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

      <div className="fixed bottom-0 left-0 right-0 bg-transparent p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {replyToMood && (
          <ReplyToMoodPill
            emoji={replyToMood.emoji}
            partnerNickname={replyToMood.partnerNickname}
            onCancel={() => setReplyToMood(null)}
          />
        )}

        {replyTo && (
          <div className="bg-blue-100 p-2 mb-1 rounded relative text-sm text-gray-800">
            <span className="font-bold text-blue-800">Replying to {replyTo.by} </span>
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
              onCameraImageSelect={handleCameraImageSelect}
              onCameraError={handleCameraError}
              theme="chat3"
            />

            {!isMobile() && (
              <div className="relative">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={handleEmojiButtonClick}
                  className={`p-3 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl ${
                    showEmojiPicker
                      ? 'bg-[#4A90E2] text-white'
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
                className="pl-0"
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
                  className={`w-full px-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all bg-white shadow-sm text-black placeholder-black overflow-y-auto ${micVisible ? 'pr-12' : ''}`}
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
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl z-10"
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
    </div>
  );
}

export default Chat3;