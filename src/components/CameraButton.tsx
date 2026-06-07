// src/components/CameraButton.tsx
import React from 'react';
import { Camera } from 'lucide-react';

interface CameraButtonProps {
  isOn: boolean;
  isLoading: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
  className?: string;
}

function CameraButton({ isOn, isLoading, onClick, variant, className = '' }: CameraButtonProps) {
  const getButtonStyles = () => {
    const baseStyles = "transition-all duration-200 flex items-center justify-center";
    
    if (variant === 'desktop') {
      return `${baseStyles} px-3 py-2 rounded-full text-xs font-semibold ${
        isOn 
          ? 'bg-red-100 text-red-600 hover:bg-red-200' 
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      } ${className}`;
    } else {
      return `${baseStyles} w-12 h-12 rounded-full shadow-lg ${
        isOn 
          ? 'bg-red-500 text-white hover:bg-red-600' 
          : 'bg-gray-500 text-white hover:bg-gray-600'
      } ${className}`;
    }
  };

  const getIconSize = () => {
    return variant === 'desktop' ? 'w-4 h-4' : 'w-6 h-6';
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={getButtonStyles()}
      title={`Camera ${isOn ? 'ON' : 'OFF'} - Face detection ${isOn ? 'active' : 'inactive'}`}
    >
      <Camera 
        className={`${getIconSize()} ${isLoading ? 'animate-pulse' : ''}`} 
      />
      {variant === 'desktop' && (
        <span className="ml-1 hidden md:inline">
          {isLoading ? 'Loading...' : (isOn ? 'ON' : 'OFF')}
        </span>
      )}
    </button>
  );
}

export default CameraButton;
