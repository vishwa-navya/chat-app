import React from 'react';
import { X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  username: string;
  messageContent: string;
  messageType?: 'text' | 'image';
}

function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  username, 
  messageContent,
  messageType = 'text'
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  // Truncate long messages for display
  const displayContent = messageType === 'image' 
    ? '📷 Image' 
    : messageContent.length > 100 
      ? `${messageContent.substring(0, 100)}...` 
      : messageContent;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Delete Message</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">
            <span className="font-medium text-gray-900">{username}</span>, are you sure you want to delete this message:
          </p>
          
          {/* Message Preview */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-red-400">
            <p className="text-sm text-gray-600 italic break-words">
              "{displayContent}"
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmationModal;