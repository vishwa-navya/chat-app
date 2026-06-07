import React from 'react';
import { X, Download } from 'lucide-react';
import { downloadImage } from '../lib/supabase';

interface ImagePreviewModalProps {
  imageUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

function ImagePreviewModal({ imageUrl, fileName, isOpen, onClose }: ImagePreviewModalProps) {
  const handleDownload = async () => {
    try {
      await downloadImage(imageUrl, fileName);
    } catch (error) {
      console.error('Download failed papa:', error);
      alert('cancel button click painnithuu again send painnu dii ammu net slow ahh erukuu papa');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-5xl max-h-full w-full h-full flex flex-col items-center justify-center">
        {/* File name header */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-6 py-2 rounded-xl shadow-md z-20">
          <h3 className="text-white font-medium truncate max-w-[80vw]">{fileName}</h3>
        </div>

        {/* Download button - center left */}
        <button
          onClick={handleDownload}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-colors shadow-lg"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Close button - center right */}
        <button
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/20 text-white p-2 rounded-xl hover:bg-white/30 transition-colors shadow-lg"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image */}
        <div className="max-w-full max-h-full p-4">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-[calc(100vh-100px)] object-contain rounded-xl shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewModal;
