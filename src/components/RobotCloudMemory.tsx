import React, { useState } from 'react';
import { Trash2, Reply, Download, FileText } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useMemory } from '../hooks/useMemory';
import VoiceMessageInline from './VoiceMessageInline';

interface RobotCloudMemoryProps {
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
  replyTo?: { id: string; text: string; by: string } | null;
  msg?: any;
  originalSender: string;
  onRemoveFromMemory?: (messageId: string) => void;
  onMoveToFolder?: () => void;
}

function RobotCloudMemory({
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
  replyTo,
  msg,
  originalSender,
  onRemoveFromMemory,
  onMoveToFolder
}: RobotCloudMemoryProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { removeFromMemory } = useMemory(currentUserNickname as 'Vishwa' | 'Ammu');

  // ✅ EXACT LOGIC FROM CHAT3 - VOICE MESSAGE DETECTION
  const isAudio =
    (mimeType && mimeType.startsWith('audio/')) ||
    (fileUrl && /\.(webm|mp3|m4a|ogg|wav)$/i.test(fileUrl)) ||
    (fileName && /\.(webm|mp3|m4a|ogg|wav)$/i.test(fileName)) ||
    type === 'audio';

  // Determine content type based on available data
  const determineContentType = (): 'image' | 'video' | 'voice' | 'file' | 'text' => {
    // VOICE: Check using Chat3 logic first
    if (isAudio && (fileUrl || audioUrl)) {
      console.log('🎤 VOICE DETECTED using Chat3 logic:', { isAudio, fileUrl, audioUrl, fileName, mimeType });
      return 'voice';
    }

    // VIDEO
    if (videoUrl) {
      console.log('🎥 VIDEO DETECTED');
      return 'video';
    }

    // IMAGE
    if (imageUrl) {
      console.log('🖼️ IMAGE DETECTED');
      return 'image';
    }

    // FILE (only if not audio)
    if (fileUrl && !isAudio) {
      console.log('📄 FILE DETECTED');
      return 'file';
    }

    console.log('📝 TEXT DETECTED');
    return 'text';
  };

  const contentType = determineContentType();

  // ✅ Get audio source same as Chat3
  const getAudioSource = () => {
    return audioUrl || fileUrl;
  };

  const handleImageClick = () => {
    if (imageUrl && contentType === 'image') {
      setShowImageModal(true);
    }
  };

  const handleVideoDownload = () => {
    if (videoUrl && fileName) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileDownload = () => {
    if (fileUrl && fileName) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteFromMemory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await removeFromMemory(messageId);
      if (onRemoveFromMemory) {
        onRemoveFromMemory(messageId);
      }
    } catch (error) {
      console.error('Error removing from memory:', error);
      alert('Failed to remove from memory. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateTimestampWidth = () => {
    if (!timestamp) return 0;
    const charWidth = 6;
    const timestampWidth = timestamp.length * charWidth;
    const gap = 4;
    return timestampWidth + gap;
  };

  const calculateTextWidth = () => {
    if (contentType === 'image') return 200;
    if (contentType === 'video') return 220;
    if (contentType === 'voice') return 260;
    if (contentType === 'file') return 240;

    const avgCharWidth = 7;
    const lines = text.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    return Math.min(maxLineLength * avgCharWidth, 260);
  };

  const calculateReplyWidth = () => {
    if (!replyTo) return 0;
    const avgCharWidth = 6;
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

  // Get profile image based on original sender
  const getProfileImage = () => {
    if (!isOwn) {
      if (originalSender === 'Vishwa') {
        return 'https://i.postimg.cc/wTrF15j3/Whats-App-Image-2025-08-14-at-22-29-55-ed72594e.jpg';
      } else if (originalSender === 'Ammu') {
        return 'https://i.postimg.cc/SRGbptyj/Whats-App-Image-2025-08-15-at-22-32-21-9e7fdfe7.jpg';
      }
    }
    return null;
  };

  const getFileIcon = () => {
    if (!fileName) return <FileText className="w-5 h-5 text-gray-500" />;
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileText className="w-5 h-5 text-green-600" />;
    if (['ppt', 'pptx'].includes(ext || '')) return <FileText className="w-5 h-5 text-orange-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText className="w-5 h-5 text-blue-600" />;
    if (['txt'].includes(ext || '')) return <FileText className="w-5 h-5 text-gray-600" />;

    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const profileImage = getProfileImage();

  // Memory page uses Chat3 colors
  const bgColor = isOwn ? 'bg-[#2F4F6F] border-none' : 'bg-[#FFD87A]';
  const textColor = isOwn ? 'text-white' : 'text-[#2F2F2F]';

  const dynamicWidth = getOptimalBubbleWidth();

  // DEBUG LOG
  console.log('🔍 RobotCloudMemory DEBUG:', {
    messageId,
    contentType,
    isAudio,
    audioUrl: audioUrl ? '✅' : '❌',
    fileUrl: fileUrl ? '✅' : '❌',
    mimeType,
    fileName,
    type
  });

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}
      data-message-id={messageId}
    >
      <div className="flex items-end gap-2 max-w-[80vw] sm:max-w-[320px]">
        {!isOwn && profileImage && (
          <img
            src={profileImage}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover mb-1 flex-shrink-0"
          />
        )}

        <div className="flex flex-col w-full">
          {/* Reply preview */}
          {replyTo && (
            <div
              className="flex flex-col text-xs pl-3 pr-3 mb-1 border-l-4 border-r-4 border-blue-400 bg-gray-100 rounded-xl p-1 shadow-md"
              style={{ color: '#374151', maxWidth: `${dynamicWidth}px` }}
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
                    e.currentTarget.style.display = 'none';
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

          {/* Message bubble */}
          <div
            className={`message-bubble rounded-2xl px-3 py-2 shadow-md ${isOwn ? 'border-none' : 'border'} relative group ${bgColor} ${textColor} inline-block overflow-visible`}
            style={{
              fontSize: '0.85rem',
              lineHeight: '1.2rem',
              width: contentType === 'voice' ? 'fit-content' : `${dynamicWidth}px`,
              minWidth: '120px'
            }}
          >
            {/* Mood reply indicator */}
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

            {/* IMAGE TYPE */}
            {contentType === 'image' && imageUrl ? (
              <div className="pb-2">
                <img
                  src={imageUrl}
                  alt={fileName || 'Shared image'}
                  className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={handleImageClick}
                  style={{ maxHeight: '300px', objectFit: 'cover' }}
                />
              </div>
            ) : contentType === 'video' && videoUrl ? (
              /* VIDEO TYPE */
              <div className="pb-2 w-full">
                <div className="mb-2">
                  <video
                    src={videoUrl}
                    controls
                    className="max-w-full h-auto rounded-xl"
                    style={{ maxHeight: '300px', width: '100%' }}
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <button
                  onClick={handleVideoDownload}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </button>
              </div>
            ) : contentType === 'voice' ? (
              /* VOICE MESSAGE TYPE - ✅ EXACT CHAT3 LOGIC */
              <div className="w-full py-1">
                <VoiceMessageInline
                  src={getAudioSource() || ''}
                  accent="chat3"
                  className="w-full"
                />
              </div>
            ) : contentType === 'file' && fileUrl ? (
              /* FILE TYPE */
              <div className="pb-2 w-full">
                <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg mb-2">
                  {getFileIcon()}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-gray-900">
                      {fileName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleFileDownload}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>
            ) : (
              /* TEXT TYPE */
              <div className="pb-2">
                <p className="text-sm whitespace-pre-wrap">
                  {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
                    part.match(/https?:\/\/[^\s]+/) ? (
                      <a
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline break-words ${
                          isOwn
                            ? 'text-blue-200 hover:text-blue-100'
                            : 'text-blue-600 hover:text-blue-800'
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

            {/* Timestamp */}
            <div className="absolute bottom-1 right-2 flex items-center justify-end">
              {timestamp && (
                <span
                  style={{
                    fontSize: '0.55rem',
                    lineHeight: '0.7rem',
                    textShadow: '0 0 2px rgba(0,0,0,0.4)'
                  }}
                  className={`text-xs ${
                    isOwn ? 'text-gray-100' : 'text-gray-700'
                  }`}
                >
                  {timestamp}
                </span>
              )}
            </div>

            {/* Action buttons - same as Chat3 (hover to show) */}
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
              {/* Move to folder button (only show if callback provided) */}
              {onMoveToFolder && (
                <button
                  onClick={onMoveToFolder}
                  className="p-1 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow-md transition-colors"
                  title="Move to folder"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Delete button */}
              <button
                onClick={handleDeleteFromMemory}
                disabled={isDeleting}
                className="p-1 rounded-full bg-white hover:bg-gray-200 transition-colors text-black"
                title="Remove from memory"
              >
                <Trash2 className="w-3 h-3" />
              </button>
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
        messageContent={text || (contentType === 'image' ? 'Image' : contentType === 'video' ? 'Video' : contentType === 'file' ? fileName || 'File' : contentType === 'voice' ? 'Voice Message' : '')}
        messageType={contentType as 'text' | 'image' | 'video' | 'file'}
      />
    </div>
  );
}

export default RobotCloudMemory;
