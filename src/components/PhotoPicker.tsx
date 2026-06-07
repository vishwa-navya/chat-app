import React, { useRef } from 'react';
import { Plus } from 'lucide-react';

interface PhotoPickerProps {
  onImageSelect: (file: File) => void;
}

function PhotoPicker({ onImageSelect }: PhotoPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // 🔥 IMAGE COMPRESSION FUNCTION (MEMORY SAFE)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }

            const compressedFile = new File(
              [blob],
              file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg'),
              { type: 'image/jpeg' }
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          0.7 // ✅ QUALITY (70%)
        );

        // 🔥 FREE MEMORY IMMEDIATELY
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  };

  // 🔥 UPDATED HANDLER (ASYNC + SAFE)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file && file.type.startsWith('image/')) {
      try {
        const compressedImage = await compressImage(file);
        onImageSelect(compressedImage);
      } catch (error) {
        console.error('Image processing failed:', error);
        alert('Image is too large. Please try again or select from gallery.');
      }
    }

    // 🔥 RESET INPUT (IMPORTANT)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="bg-gradient-to-r from-green-500 to-emerald-500 text-white 
                   p-3 rounded-2xl hover:from-green-600 hover:to-emerald-600 
                   transform hover:scale-105 transition-all duration-200 
                   shadow-lg hover:shadow-xl"
        title="Send image"
      >
        <Plus className="w-5 h-5" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}

export default PhotoPicker;
