import React, { useState } from 'react';
import { Reply, Trash2, Star, Download, FileText } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useMemory } from '../hooks/useMemory';
import SystemMessage from './SystemMessage';
import { downloadVideo, downloadFile } from '../lib/supabase';
import VoiceMessageInline from './VoiceMessageInline';
import { getSpacingStyle } from '../lib/messageSpacing'; // NEW IMPORT

interface RobotCloudChat3Props {
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
  hasSpacing?: boolean; // NEW: spacing indicator
}

function RobotCloudChat3({
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
  hasSpacing = false // NEW
}: RobotCloudChat3Props) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { saveToMemory, removeFromMemory, isInMemory } = useMemory(currentUserNickname as 'Vishwa' | 'Ammu');
  const [isStarring, setIsStarring] = useState(false);

  const handleReply = () => {
    const replyText = type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'voice' ? 'Voice message' : type === 'file' ? fileName || 'File' : text;
    if (onReply) onReply(messageId, replyText);
  };

  const handleDelete = () => setShowDeleteModal(true);
  const handleConfirmDelete = () => onDelete && onDelete(messageId);
  const handleImageClick = () => imageUrl && setShowImageModal(true);

  const handleVideoDownload = async () => {
    if (videoUrl && fileName) {
      try { await downloadVideo(videoUrl, fileName); } 
      catch { alert('Failed to download video. Please try again.'); }
    }
  };

  const handleFileDownload = async () => {
    if (fileUrl && fileName) {
      try { await downloadFile(fileUrl, fileName); } 
      catch { alert('Failed to download file. Please try again.'); }
    }
  };

  const getFileIcon = () => {
    if (!fileName) return <FileText className="w-12 h-12" />;

    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') return <FileText className="w-12 h-12 text-red-500" />;
    if (['xls','xlsx'].includes(ext || '')) return <FileText className="w-12 h-12 text-green-600" />;
    if (['ppt','pptx'].includes(ext || '')) return <FileText className="w-12 h-12 text-orange-500" />;
    if (['doc','docx'].includes(ext || '')) return <FileText className="w-12 h-12 text-blue-600" />;

    return <FileText className="w-12 h-12 text-gray-500" />;
  };

  const handleStarClick = async () => {
    if (isStarring) return;
    setIsStarring(true);
    try { isInMemory(messageId) ? await removeFromMemory(messageId) : await saveToMemory(msg); }
    finally { setIsStarring(false); }
  };

  const handleReplyClick = () => {
    if (!replyTo?.id) return;
    const originalElement = document.querySelector(`[data-message-id="${replyTo.id}"]`);
    if (originalElement) {
      originalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      originalElement.classList.add('highlight-message');
      setTimeout(() => originalElement.classList.remove('highlight-message'), 2000);
    }
  };

  const getBubbleRadius = () => {
    if (isFirstInGroup && isLastInGroup) return 'rounded-2xl';
    if (isFirstInGroup) return isOwn ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';
    if (isLastInGroup) return isOwn ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md';
    if (isMiddleInGroup) return isOwn ? 'rounded-l-2xl rounded-r-md' : 'rounded-r-2xl rounded-l-md';
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
    const maxLineLength = Math.max(...lines.map(l => l.length));
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

  const profileImage = !isOwn ? (currentUserNickname === 'Vishwa' ? 'https://i.postimg.cc/SRGbptyj/Whats-App-Image-2025-08-15-at-22-32-21-9e7fdfe7.jpg' : 'https://i.postimg.cc/wTrF15j3/Whats-App-Image-2025-08-14-at-22-29-55-ed72594e.jpg') : null;

  const bgColor = isOwn ? 'bg-[#2F4F6F] border-none' : 'bg-[#FFD87A]';
  const textColor = isOwn ? 'text-white' : 'text-[#2F2F2F]';
  const dynamicWidth = getOptimalBubbleWidth();

  // NEW: Get spacing style
  const spacingStyle = getSpacingStyle(hasSpacing);

  if (type === 'system') return <SystemMessage message={text} theme="chat3" />;

  return (
    <div 
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in transition-all`} 
      data-message-id={messageId}
      style={spacingStyle}
    >
      <div className="flex items-end gap-2 max-w-[80vw] sm:max-w-[320px]">
        {!isOwn && profileImage && (
          <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover mb-1 flex-shrink-0" />
        )}
        <div className="flex flex-col">
          {replyTo && (
            <div className="flex flex-col text-xs pl-3 pr-3 mb-1 border-l-4 border-r-4 border-blue-400 bg-gray-100 rounded-xl p-1 shadow-md cursor-pointer hover:bg-gray-200 transition-colors" style={{ color: useBlackText ? '#000000' : '#374151', maxWidth: `${dynamicWidth}px` }} onClick={handleReplyClick}>
              <div className="text-[10px] text-blue-600 font-medium mb-0.5">Replying to {replyTo.by}</div>
              {msg?.replyTo?.imageUrl ? (
                <img src={msg.replyTo.imageUrl} alt="Reply preview" className="h-10 w-auto rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="text-[11px] leading-tight break-words">{replyTo.text && replyTo.text.length > 50 ? `${replyTo.text.substring(0, 50)}...` : replyTo.text}</div>
              )}
            </div>
          )}

          <div className={`message-bubble ${getBubbleRadius()} px-3 py-2 shadow-md ${isOwn ? 'border-none' : 'border'} relative group ${bgColor} ${textColor} inline-block overflow-hidden`} style={{ fontSize: '0.85rem', lineHeight: '1.2rem', width: `${dynamicWidth}px`, minWidth: '120px' }}>
            {msg?.moodMetadata && (
              <div className="pb-2 mb-2 border-b border-blue-300 bg-blue-50 -mx-3 px-3 py-2 rounded-t-xl">
                <div className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                  <span className="text-sm">{msg.moodMetadata.moodEmoji}</span>
                  <span>{isOwn ? `You replied to ${msg.moodMetadata.moodOwnerUserId === 'Vishwa' ? 'Vishwa' : 'Ammu'}'s mood` : `${msg.by === 'Vishwa' ? 'Vishwa' : 'Ammu'} replied to your mood`}</span>
                </div>
              </div>
            )}

            {type === 'image' && imageUrl ? (
              <div className="pb-2">
                <img src={imageUrl} alt={fileName || 'Shared image'} className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={handleImageClick} style={{ maxHeight: '300px', objectFit: 'cover' }} />
              </div>
            ) : type === 'video' && videoUrl ? (
              <div className="pb-2">
                <video src={videoUrl} controls className="max-w-full h-auto rounded-xl" style={{ maxHeight: '300px' }} preload="metadata">Your browser does not support the video tag.</video>
                <button onClick={handleVideoDownload} className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"><Download className="w-4 h-4" />Download Video</button>
              </div>
            ) : type === 'voice' && audioUrl ? (
              <div className="pb-2 w-full">
                <div className="w-full overflow-hidden">
                  <VoiceMessageInline src={audioUrl} accent="chat3" className="max-w-full" />
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
                <button onClick={handleFileDownload} className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"><Download className="w-4 h-4" />Download File</button>
              </div>
            ) : (
              <div className="pb-2">
                <p className={`text-sm whitespace-pre-wrap ${useBlackText ? 'text-black font-medium' : ''}`}>
                  {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) => part.match(/https?:\/\/[^\s]+/) ? (
                    <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={`underline break-words ${useBlackText ? 'text-black hover:text-black' : isOwn ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 hover:text-blue-800'
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
                <div className="flex" style={{ gap: '1px' }}>
                  <div 
                    className={`w-1 h-1 rounded-full transition-colors duration-300 ${
                      msg?.seenBy?.includes(currentUserNickname === 'Vishwa' ? 'Ammu' : 'Vishwa') 
                        ? 'bg-white' 
                        : 'border border-white bg-transparent'
                    }`}
                  />
                  <div 
                    className={`w-1 h-1 rounded-full transition-colors duration-300 ${
                      msg?.seenBy?.includes(currentUserNickname === 'Vishwa' ? 'Ammu' : 'Vishwa') 
                        ? 'bg-white' 
                        : 'border border-white bg-transparent'
                    }`}
                  />
                </div>
              )}
              {timestamp && (
                <span
                  style={{
                    fontSize: '0.55rem',
                    lineHeight: '0.7rem',
                    marginLeft: '3px',
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

            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={handleStarClick}
                disabled={isStarring}
                className={`p-1 rounded-full transition-colors ${
                  isInMemory(messageId)
                    ? 'bg-yellow-400 text-white hover:bg-yellow-500'
                    : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                }`}
                title={isInMemory(messageId) ? "Remove from memory" : "Save to memory"}
              >
                <Star 
                  className={`w-3 h-3 ${isInMemory(messageId) ? 'fill-current' : ''}`} 
                />
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
        messageContent={text || (type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'file' ? fileName || 'File' : '')}
        messageType={type as 'text' | 'image' | 'video' | 'file'}
      />
    </div>
  );
}

export default RobotCloudChat3;