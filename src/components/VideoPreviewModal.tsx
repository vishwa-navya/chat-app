import React from 'react';
import { X, Send, Download } from 'lucide-react';

interface VideoPreviewModalProps {
  videoFile: File | null;
  videoPreview: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  isUploading: boolean;
}

function VideoPreviewModal({
  videoFile,
  videoPreview,
  isOpen,
  onClose,
  onSend,
  isUploading
}: VideoPreviewModalProps) {
  const handleDownload = () => {
    if (!videoPreview || !videoFile) return;

    const link = document.createElement('a');
    link.href = videoPreview;
    link.download = videoFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !videoPreview) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-5xl max-h-full w-full h-full flex flex-col items-center justify-center">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-xl shadow-md z-20">
          <h3 className="text-white font-medium truncate max-w-[80vw]">
            {videoFile?.name || 'Video'}
          </h3>
          <p className="text-xs text-white/70 text-center">
            {videoFile?.size ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
          </p>
        </div>

        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
          <button
            onClick={handleDownload}
            className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 transition-colors shadow-lg"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={onSend}
            disabled={isUploading}
            className="bg-green-500 text-white p-3 rounded-xl hover:bg-green-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 text-white p-2 rounded-xl hover:bg-white/30 transition-colors shadow-lg"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="max-w-full max-h-full p-4">
          <video
            src={videoPreview}
            controls
            className="max-w-full max-h-[calc(100vh-100px)] rounded-xl shadow-2xl"
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  );
}

export default VideoPreviewModal;
