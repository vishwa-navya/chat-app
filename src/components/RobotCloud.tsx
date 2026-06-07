import React, { useState, useEffect } from 'react';
import { Reply, Trash2, Star, Download, FileText, Flame } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useMemory } from '../hooks/useMemory';
import { useCoupleMemory } from '../hooks/useCoupleMemory';
import SystemMessage from './SystemMessage';
import { downloadVideo, downloadFile } from '../lib/supabase';
import VoiceMessageInline from './VoiceMessageInline';
import MessageSeenDots from './MessageSeenDots';
import { getSpacingStyle } from '../lib/messageSpacing';

interface RobotCloudProps {
  messageId: string;
  text: string;
  imageUrl?: string;
  fileName?: string;
  videoUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  mimeType?: string;
  isOwn: boolean;
  isUser: boolean;
  isAI: boolean;
  type?: string;
  currentUserNickname?: string;
  timestamp?: string;
  useBlackText?: boolean;
  onReply?: (messageId: string, text: string) => void;
  onDelete?: (messageId: string) => void;
  replyTo?: { id: string; text: string; by: string } | null;
  msg?: any;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isMiddleInGroup?: boolean;
  hasSpacing?: boolean;
}

function RobotCloud({
  messageId,
  text,
  imageUrl,
  fileName,
  videoUrl,
  fileUrl,
  audioUrl,
  mimeType,
  isOwn,
  isUser,
  isAI,
  type = 'text',
  currentUserNickname,
  timestamp,
  useBlackText = false,
  onReply,
  onDelete,
  replyTo,
  msg,
  isFirstInGroup = false,
  isLastInGroup = false,
  isMiddleInGroup = false,
  hasSpacing = false
}: RobotCloudProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { saveToMemory, removeFromMemory, isInMemory } = useMemory(currentUserNickname as 'Vishwa' | 'Ammu');
  const { toggleHot, fetchAllHotStatuses, hotMap } = useCoupleMemory();
  const [isStarring, setIsStarring] = useState(false);
  const [isTogglingHot, setIsTogglingHot] = useState(false);
  const [localIsHot, setLocalIsHot] = useState(false);

  // Sync local hot state with Firebase hotMap
  useEffect(() => {
    if (type === 'image' && imageUrl) {
      const parts = imageUrl.split('/');
      const storageFileName = decodeURIComponent(parts[parts.length - 1]);
      setLocalIsHot(!!hotMap[storageFileName]);
    }
  }, [hotMap, imageUrl, type]);

  // Fetch hot statuses on mount
  useEffect(() => {
    if (type === 'image' && imageUrl) {
      fetchAllHotStatuses();
    }
  }, [type, imageUrl, fetchAllHotStatuses]);

  const handleReply = () => {
    const replyText =
      type === 'image'
        ? 'Image'
        : type === 'video'
        ? 'Video'
        : type === 'voice'
        ? 'Voice message'
        : type === 'file'
        ? fileName || 'File'
        : text;
    if (onReply) onReply(messageId, replyText);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(messageId);
    }
  };

  const handleImageClick = () => {
    if (imageUrl) setShowImageModal(true);
  };

  const handleStarClick = async () => {
    if (isStarring) return;

    setIsStarring(true);
    try {
      const isCurrentlyInMemory = isInMemory(messageId);

      if (isCurrentlyInMemory) {
        await removeFromMemory(messageId);
      } else {
        await saveToMemory(msg);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    } finally {
      setIsStarring(false);
    }
  };

  // 🔥 Fire toggle - exactly like star logic
  const getStorageFileName = (url: string): string => {
    // Extract filename from Supabase storage URL
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  };

  const handleFireClick = async () => {
    if (isTogglingHot || !imageUrl) return;

    setIsTogglingHot(true);
    try {
      const fileName = getStorageFileName(imageUrl);
      const newHotStatus = await toggleHot(fileName, imageUrl);
      setLocalIsHot(newHotStatus);
    } catch (error) {
      console.error('Error toggling hot:', error);
    } finally {
      setIsTogglingHot(false);
    }
  };

  const handleReplyClick = () => {
    if (!replyTo?.id) return;

    const originalElement = document.querySelector(`[data-message-id="${replyTo.id}"]`);
    if (originalElement) {
      originalElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      originalElement.classList.add('highlight-message');

      setTimeout(() => {
        originalElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  const handleVideoDownload = async () => {
    if (videoUrl && fileName) {
      try {
        await downloadVideo(videoUrl, fileName);
      } catch (error) {
        console.error('Video download failed:', error);
        alert('Failed to download video. Please try again.');
      }
    }
  };

  const handleFileDownload = async () => {
    if (fileUrl && fileName) {
      try {
        await downloadFile(fileUrl, fileName);
      } catch (error) {
        console.error('File download failed:', error);
        alert('Failed to download file. Please try again.');
      }
    }
  };

  const getFileIcon = () => {
    if (!fileName) return <FileText className="w-12 h-12" />;

    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-12 h-12 text-red-500" />;
    } else if (['xls', 'xlsx'].includes(ext || '')) {
      return <FileText className="w-12 h-12 text-green-600" />;
    } else if (['ppt', 'pptx'].includes(ext || '')) {
      return <FileText className="w-12 h-12 text-orange-500" />;
    } else if (['doc', 'docx'].includes(ext || '')) {
      return <FileText className="w-12 h-12 text-blue-600" />;
    }
    return <FileText className="w-12 h-12 text-gray-500" />;
  };

  const getBubbleRadius = () => {
    if (isFirstInGroup && isLastInGroup) {
      return 'rounded-2xl';
    } else if (isFirstInGroup) {
      return isOwn ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';
    } else if (isLastInGroup) {
      return isOwn ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md';
    } else if (isMiddleInGroup) {
      return isOwn ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md';
    }
    return 'rounded-2xl';
  };

  const calculateTimestampWidth = () => {
    if (!timestamp) return 0;
    const charWidth = 6;
    const timestampWidth = timestamp.length * charWidth;
    const seenIndicatorsWidth = isOwn ? 12 : 0;
    const gap = 4;
    return timestampWidth + seenIndicatorsWidth + gap;
  };

  const calculateTextWidth = () => {
    if (type === 'image' || type === 'video') return 200;
    if (type === 'file') return 220;
    if (type === 'voice') return 200;
    const avgCharWidth = 7;
    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    return Math.min(maxLineLength * avgCharWidth, 260);
  };

  const calculateReplyWidth = () => {
    if (!replyTo) return 0;
    const avgCharWidth = 7;
    const replyTextLength = replyTo.text.length > 50 ? 50 : replyTo.text.length;
    return Math.min(replyTextLength * avgCharWidth + 40, 260);
  };

  const getOptimalBubbleWidth = () => {
    const textWidth = calculateTextWidth();
    const timestampWidth = calculateTimestampWidth();
    const replyWidth = calculateReplyWidth();
    const padding = 24;
    const minWidthForTimestamp = timestampWidth + padding + 8;
    const optimalWidth = Math.max(textWidth + padding, replyWidth + padding, minWidthForTimestamp);
    return Math.min(Math.max(optimalWidth, 120), 300);
  };

  const getEmoji = () => {
    if (!isOwn) return '🤖';
    return '';
  };

  const bgColor = isOwn ? 'bg-blue-100 border-blue-200' : 'bg-green-100 border-green-200';
  const textColor = useBlackText ? 'text-black' : isOwn ? 'text-[#94bde6]' : 'text-[#b5d4f2]';

  const dynamicWidth = getOptimalBubbleWidth();

  const spacingStyle = getSpacingStyle(hasSpacing);

  if (type === 'system') {
    return <SystemMessage message={text} theme="chat2" />;
  }

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in transition-all`}
      data-message-id={messageId}
      style={spacingStyle}
    >
      <div className="flex items-end gap-2 max-w-[80vw] sm:max-w-[320px]">
        {!isOwn && <div className="text-2xl mb-1">{getEmoji()}</div>}

        <div className="flex flex-col">
          {replyTo && (
            <div
              className="flex flex-col text-xs pl-3 pr-3 mb-1 border-l-4 border-r-4 border-blue-400 bg-gray-100 rounded-xl p-1 shadow-md cursor-pointer hover:bg-gray-200 transition-colors"
              style={{ color: useBlackText ? '#000000' : '#374151', maxWidth: `${dynamicWidth}px` }}
              onClick={handleReplyClick}
            >
              <div className="text-[10px] text-blue-600 font-medium mb-0.5">
                Replying to {replyTo.by}
              </div>
              {msg?.replyTo?.imageUrl ? (
                <img
                  src={msg.replyTo.imageUrl}
                  alt="Reply preview"
                  className="h-10 w-auto rounded object-cover"
                  onError={(e) => {
                    console.log('Image failed to load:', msg?.replyTo?.imageUrl);
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-[11px] leading-tight break-words">
                  {replyTo.text && replyTo.text.length > 50
                    ? `${replyTo.text.substring(0, 50)}...`
                    : replyTo.text}
                </div>
              )}
            </div>
          )}

          <div
            className={`message-bubble ${getBubbleRadius()} px-3 py-2 shadow-md border relative group ${bgColor} ${textColor} inline-block overflow-hidden`}
            style={{
              fontSize: '0.85rem',
              lineHeight: '1.2rem',
              width: `${dynamicWidth}px`,
              minWidth: '120px'
            }}
          >
            {msg?.moodMetadata && (
              <div className="pb-2 mb-2 border-b border-blue-300 bg-blue-50 -mx-3 px-3 py-2 rounded-t-xl">
                <div className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                  <span className="text-sm">{msg.moodMetadata.moodEmoji}</span>
                  <span>
                    {isOwn
                      ? `You replied to ${msg.moodMetadata.moodOwnerUserId === 'Vishwa' ? 'Vishwa' : 'Ammu'}'s mood`
                      : `${msg.by === 'Vishwa' ? 'Vishwa' : 'Ammu'} replied to your mood`}
                  </span>
                </div>
              </div>
            )}

            {type === 'image' && imageUrl ? (
              <div className="pb-2">
                <img
                  src={imageUrl}
                  alt={fileName || 'Shared image'}
                  className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={handleImageClick}
                  style={{ maxHeight: '300px', objectFit: 'cover' }}
                />
              </div>
            ) : type === 'video' && videoUrl ? (
              <div className="pb-2">
                <video
                  src={videoUrl}
                  controls
                  className="max-w-full h-auto rounded-xl"
                  style={{ maxHeight: '300px' }}
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
                <button
                  onClick={handleVideoDownload}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            ) : type === 'voice' && audioUrl ? (
              <div className="pb-2 w-full">
                <div className="w-full overflow-hidden">
                  <VoiceMessageInline 
                    src={audioUrl} 
                    accent="chat2" 
                    className="max-w-full"
                    style={{
                      width: '100%',
                      maxWidth: `${dynamicWidth - 24}px`
                    }}
                  />
                </div>
              </div>
            ) : type === 'file' && fileUrl ? (
              <div className="pb-2">
                <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                  {getFileIcon()}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-gray-900">{fileName}</div>
                    <div className="text-xs text-gray-500">{mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</div>
                  </div>
                </div>
                <button
                  onClick={handleFileDownload}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            ) : (
              <div className="pb-2">
                <p className={`text-sm whitespace-pre-wrap ${useBlackText ? 'text-black font-medium' : ''}`}>
                  {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
                    part.match(/https?:\/\/[^\s]+/) ? (
                      <a
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline break-words ${
                          useBlackText ? 'text-black hover:text-black' : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        {part}
                      </a>
                    ) : (
                      <span key={index}>{part}</span>
                    )
                  )}
                </p>
              </div>
            )}

            <div className="absolute bottom-1 right-2 flex items-center justify-end" style={{ gap: '2px' }}>
              {isOwn && (
                <MessageSeenDots
                  messageId={messageId}
                  senderId={msg?.by || ''}
                  currentUserId={currentUserNickname || ''}
                  seenBy={msg?.seenBy || []}
                  timestamp={timestamp}
                />
              )}
              {timestamp && !isOwn && (
                <span
                  style={{ fontSize: '0.65rem', lineHeight: '0.9rem', marginLeft: '3px' }}
                  className={`text-xs ${useBlackText ? 'text-gray-600' : 'text-gray-500'}`}
                >
                  {timestamp}
                </span>
              )}
            </div>

            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              {onReply && (
                <button
                  onClick={handleReply}
                  className="p-1 rounded-full bg-white hover:bg-gray-200 transition-colors text-black"
                  title="Reply"
                >
                  <Reply className="w-3 h-3" />
                </button>
              )}
              {onDelete && isOwn && (
                <button
                  onClick={handleDelete}
                  className="p-1 rounded-full bg-white hover:bg-gray-200 transition-colors text-black"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              {/* ⭐ Star button */}
              <button
                onClick={handleStarClick}
                disabled={isStarring}
                className={`p-1 rounded-full transition-colors ${
                  isInMemory(messageId)
                    ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                    : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                }`}
                title={isInMemory(messageId) ? 'Remove from memory' : 'Save to memory'}
              >
                <Star className={`w-3 h-3 ${isInMemory(messageId) ? 'fill-current' : ''}`} />
              </button>
              
              {/* 🔥 Fire button - for image messages only */}
              {type === 'image' && imageUrl && (
                <button
                  onClick={handleFireClick}
                  disabled={isTogglingHot}
                  className={`p-1 rounded-full transition-colors ${
                    localIsHot
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                  }`}
                  title={localIsHot ? 'Remove from Hot' : 'Mark as Hot'}
                >
                  <Flame className={`w-3 h-3 ${localIsHot ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {imageUrl && (
        <ImagePreviewModal
          imageUrl={imageUrl}
          fileName={fileName || 'Image'}
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        username={currentUserNickname || 'User'}
        messageContent={
          text ||
          (type === 'image'
            ? 'Image'
            : type === 'video'
            ? 'Video'
            : type === 'file'
            ? fileName || 'File'
            : '')
        }
        messageType={type as 'text' | 'image' | 'video' | 'file'}
      />
    </div>
  );
}

export default RobotCloud;
