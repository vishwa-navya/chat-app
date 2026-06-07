import React, { useEffect, useState, useRef } from 'react';
import { Heart, LogOut, Camera, ChevronDown, Plus, Folder, ArrowLeft, Trash2, ArrowRight } from 'lucide-react';
import { useMemory } from '../hooks/useMemory';
import { useMemoryFolders } from '../hooks/useMemoryFolders';
import { useLastSeen } from '../hooks/useLastSeen';
import RobotCloudMemory from './RobotCloudMemory';
import PresenceIndicator from './PresenceIndicator';
import PresenceDebugPanel from './PresenceDebugPanel';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useCameraState } from '../hooks/useCameraState';
import CameraButton from '../components/CameraButton';

interface MemoryPageProps {
  nickname: 'Vishwa' | 'Ammu';
  onClose: () => void;
  onNavigateToChat1: () => void;
  onNavigateToChat2: () => void;
  onNavigateToChat3: () => void;
}

function MemoryPage({
  nickname,
  onClose,
  onNavigateToChat1,
  onNavigateToChat2,
  onNavigateToChat3
}: MemoryPageProps) {
  const { memoryMessages, loading } = useMemory(nickname);
  const {
    folders,
    createFolder,
    moveToFolder,
    deleteFolder,
    deleteMemoryFromFolder,
    loading: foldersLoading
  } = useMemoryFolders(nickname);

  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isMovingMemory, setIsMovingMemory] = useState(false);

  const { isCameraOn, toggleCamera, setCameraOff } = useCameraState(nickname);

  const handleFaceViolation = () => {
    console.log('🚨 Face violation detected, redirecting to Chat1...');
    setCameraOff();
    onNavigateToChat1();
  };

  const { isLoading: isCameraLoading, faceCount } = useFaceDetection({
    isEnabled: isCameraOn,
    onViolation: handleFaceViolation,
    onToggle: setCameraOff
  });

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      alert('Please enter a folder name');
      return;
    }

    try {
      setIsCreatingFolder(true);
      await createFolder(folderName);
      setFolderName('');
      setShowCreateFolderModal(false);
    } catch (error) {
      alert('Failed to create folder');
      console.error(error);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleMoveToFolder = async (folderId: string) => {
    if (!selectedMemoryId) return;

    try {
      setIsMovingMemory(true);
      await moveToFolder(selectedMemoryId, folderId);
      setShowMoveToFolderModal(false);
      setSelectedMemoryId(null);
    } catch (error) {
      alert('Failed to move memory');
      console.error(error);
    } finally {
      setIsMovingMemory(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('Delete this folder and all its memories?')) {
      try {
        await deleteFolder(folderId);
        setCurrentFolderId(null);
      } catch (error) {
        alert('Failed to delete folder');
        console.error(error);
      }
    }
  };

  const handleDeleteMemory = async (messageId: string) => {
    if (!confirm('Delete this memory?')) return;

    try {
      if (currentFolderId) {
        await deleteMemoryFromFolder(messageId, currentFolderId);
      }
    } catch (error) {
      alert('Failed to delete memory');
      console.error(error);
    }
  };

  const displayedMemories = currentFolderId
    ? memoryMessages.filter(msg => {
      const folder = folders.find(f => f.id === currentFolderId);
      return folder?.items?.includes(msg.id);
    })
    : memoryMessages.filter(msg => {
      return !folders.some(folder => folder.items?.includes(msg.id));
    });

  useEffect(() => {
    return () => {
      if (isCameraOn) {
        console.log('🚪 Exiting MemoryPage, turning off camera...');
        setCameraOff();
      }
    };
  }, [isCameraOn, setCameraOff]);

  const otherUser = nickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
  const { otherUserLastSeen, isOtherUserOnline, connectionStatus } = useLastSeen({
    userId: nickname,
    otherUserId: otherUser
  });

  useEffect(() => {
    if (memoryMessages.length > 0 && !loading) {
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [memoryMessages.length, loading]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom && memoryMessages.length > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [memoryMessages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
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

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: 'url(https://i.postimg.cc/tT43g7W9/Whats-App-Image-2025-08-14-at-22-04-13-2b4f9f06.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div
        ref={messagesContainerRef}
        className="relative h-full w-full overflow-y-auto overflow-x-hidden"
      >
        {isCameraOn && (
          <CameraButton
            isCameraOn={isCameraOn}
            toggleCamera={toggleCamera}
            isLoading={isCameraLoading}
            faceCount={faceCount}
          />
        )}

{/* ================= HEADER ================= */}
<div className="sticky top-0 left-0 right-0 bg-transparent backdrop-blur-md px-4 py-4 z-50 shadow-lg border-b border-white/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
  <div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
        <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-bold text-white truncate">
            {nickname}'s Memories ✨
          </h1>
          <PresenceIndicator
            isOnline={isOtherUserOnline}
            lastSeen={otherUserLastSeen}
            connectionStatus={connectionStatus}
            className="text-xs text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2 flex-shrink-0">
        <button
          onClick={onNavigateToChat1}
          className="px-3 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        >
          1
        </button>
        <button
          onClick={onNavigateToChat2}
          className="px-3 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
        >
          2
        </button>
        <button
          onClick={onNavigateToChat3}
          className="px-3 py-2 rounded-full text-sm font-semibold bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors"
        >
          3
        </button>

        <button
          onClick={onClose}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-gray-200 text-gray-700"
        >
          <LogOut className="w-4 h-4" />
          Exit
        </button>

        <button
          onClick={onClose}
          className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-200 text-gray-700"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</div>

{/* ================= FOLDER SECTION (SEPARATE & TRANSPARENT) ================= */}
{/* ================= FOLDER BAR ================= */}
<div className="sticky top-[80px] z-40 px-4 py-2 bg-transparent">
  <div className="max-w-4xl mx-auto flex items-center gap-2">

    {/* PLUS ICON — FIXED */}
    <button
      onClick={() => setShowCreateFolderModal(true)}
      className="flex-shrink-0 p-2 rounded-full bg-white text-black hover:bg-gray-100 shadow"
      title="Create new folder"
    >
      <Plus className="w-5 h-5 text-black" />
    </button>

    {/* SCROLLABLE FOLDERS */}
    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
      {folders.map(folder => (
        <button
          key={folder.id}
          onClick={() => setCurrentFolderId(folder.id)}
          className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 shadow ${
            currentFolderId === folder.id
              ? 'bg-white text-black border border-black'
              : 'bg-white text-black hover:bg-gray-100 border border-gray-300'
          }`}
        >
          <Folder className="w-4 h-4 text-black" />
          {folder.name}
        </button>
      ))}
    </div>

  </div>
</div>


{/* ================= FOLDER ACTION BAR ================= */}
{currentFolderId && (
  <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/20 to-transparent backdrop-blur-md px-4 py-4 z-40 flex items-center justify-between border-t border-white/20">
    <button
      onClick={() => handleDeleteFolder(currentFolderId)}
      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
    >
      Delete Folder
    </button>
    <button
      onClick={() => setCurrentFolderId(null)}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-300 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-400"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  </div>
)}

        <div className="max-w-4xl mx-auto p-4 relative z-10 min-h-screen">
          {loading && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">✨</div>
              <p className="text-white">Loading memories...</p>
            </div>
          )}

          <div className={`space-y-2 pb-8 ${currentFolderId ? 'pb-40' : ''}`}>
            {displayedMemories.length === 0 && !loading ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✨💭</div>
                <p className="text-white italic">
                  {currentFolderId ? 'No memories in this folder' : 'No memories saved yet...'}
                </p>
                {!currentFolderId && (
                  <p className="text-white/70 text-sm mt-2">
                    Star messages in Chat2 or Chat3 to save them here
                  </p>
                )}
              </div>
            ) : (
              displayedMemories.map((msg) => (
                <RobotCloudMemory
                  key={msg.id}
                  messageId={msg.originalMessageId}
                  text={msg.text || ''}
                  imageUrl={msg.imageUrl}
                  fileName={msg.fileName}
                  videoUrl={msg.videoUrl}
                  fileUrl={msg.fileUrl}
                  audioUrl={msg.audioUrl}
                  mimeType={msg.mimeType}
                  isOwn={msg.originalSender === nickname}
                  isUser={msg.originalSender === nickname}
                  isAI={false}
                  type={msg.type}
                  currentUserNickname={nickname}
                  timestamp={formatMessageTime(msg.originalTimestamp)}
                  useBlackText={false}
                  replyTo={msg.replyTo}
                  msg={msg}
                  originalSender={msg.originalSender}
                  onRemoveFromMemory={() => {}}
                  onMoveToFolder={!currentFolderId ? () => {
                    setSelectedMemoryId(msg.id);
                    setShowMoveToFolderModal(true);
                  } : undefined}
                />
              ))
            )}
            <div ref={messagesEndRef} />
            <div className="h-8"></div>
          </div>
        </div>

        <div className="fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-500 z-30">
          <div className="absolute top-20 left-10 text-pink-300 text-3xl animate-bounce">
            ✨
          </div>
          <div className="absolute top-32 right-20 text-yellow-300 text-2xl animate-pulse">
            💫
          </div>
          <div className="absolute bottom-40 left-32 text-purple-300 text-4xl animate-bounce">
            ⭐
          </div>
          <div className="absolute bottom-20 right-16 text-blue-300 text-2xl animate-pulse">
            🌟
          </div>
          <div className="absolute top-60 right-32 text-pink-300 text-2xl animate-pulse">
            ✨
          </div>
        </div>
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-32 right-6 mb-4 bg-[#4A6FA5] text-white p-3 rounded-full shadow-lg hover:bg-[#3A5F95] transition-all z-40"
          title="Scroll to latest memory"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      )}

      <button
        onClick={toggleCamera}
        className={`fixed bottom-20 right-6 p-3 mb-2 rounded-full shadow-lg transition-all z-40 ${
          isCameraOn
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
        title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
      >
        <Camera className="w-6 h-6" />
      </button>

      {process.env.NODE_ENV === 'development' && (
        <PresenceDebugPanel
          userId={nickname}
          isOtherUserOnline={isOtherUserOnline}
          otherUserLastSeen={otherUserLastSeen}
          connectionStatus={connectionStatus}
        />
      )}

      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-11/12">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Create New Folder</h2>
            <input
              type="text"
              placeholder="Enter Folder Name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isCreatingFolder && handleCreateFolder()}
              disabled={isCreatingFolder}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setFolderName('');
                }}
                disabled={isCreatingFolder}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={isCreatingFolder}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                {isCreatingFolder ? 'Creating...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveToFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-6 shadow-2xl max-w-sm w-11/12 max-h-96 overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Move to Folder</h2>
            {folders.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No folders yet. Create one first.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveToFolder(folder.id)}
                    disabled={isMovingMemory}
                    className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 text-gray-800 hover:bg-cyan-200 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                  >
                    <Folder className="w-4 h-4" />
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setShowMoveToFolderModal(false);
                setSelectedMemoryId(null);
              }}
              disabled={isMovingMemory}
              className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition-colors disabled:opacity-50"
            >
              {isMovingMemory ? 'Moving...' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryPage;
