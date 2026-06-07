import React from 'react';
import { X, Send, Download, FileText, FileSpreadsheet, File as FileIcon } from 'lucide-react';

interface FilePreviewModalProps {
  file: File | null;
  filePreview: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  isUploading: boolean;
}

function FilePreviewModal({
  file,
  filePreview,
  isOpen,
  onClose,
  onSend,
  isUploading
}: FilePreviewModalProps) {
  const handleDownload = () => {
    if (!filePreview || !file) return;

    const link = document.createElement('a');
    link.href = filePreview;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = () => {
    if (!file) return <FileIcon className="w-12 h-12 text-gray-400" />;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      return <FileText className="w-12 h-12 text-red-500" />;
    } else if (['xls', 'xlsx'].includes(ext || '')) {
      return <FileSpreadsheet className="w-12 h-12 text-green-600" />;
    } else if (['ppt', 'pptx'].includes(ext || '')) {
      return <FileText className="w-12 h-12 text-orange-500" />;
    } else if (['doc', 'docx'].includes(ext || '')) {
      return <FileText className="w-12 h-12 text-blue-600" />;
    }

    return <FileIcon className="w-12 h-12 text-gray-400" />;
  };

  const getFileExtension = () => {
    return file?.name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Modal box */}
      <div className="relative w-[88%] max-w-[380px] sm:max-w-[400px] md:max-w-[420px] bg-white rounded-2xl p-7 shadow-2xl flex flex-col h-[75vh] sm:h-[70vh] md:h-[65vh]">
        
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Send File</h3>
          <p className="text-sm text-gray-500">Preview and confirm before sending</p>
        </div>

        {/* File Info */}
        <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center justify-start flex-grow overflow-hidden">
          <div className="mb-3">{getFileIcon()}</div>
          <div className="text-center mb-3">
            <div className="text-sm font-medium text-gray-600">{getFileExtension()}</div>
            <div className="text-base font-semibold text-gray-900 max-w-[230px] truncate">
              {file.name}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>

          {/* PDF Preview Area - taller now */}
          {file.type === 'application/pdf' && filePreview && (
            <div className="mt-2 w-full h-[280px] sm:h-[300px] md:h-[320px]">
              <iframe
                src={filePreview}
                className="w-full h-full border border-gray-300 rounded-lg"
                title="PDF Preview"
              />
            </div>
          )}
        </div>

        {/* Bottom Buttons - compact */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-blue-500 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download
          </button>

          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>

          <button
            onClick={onSend}
            disabled={isUploading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
