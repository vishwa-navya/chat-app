import React from 'react';
import { Wifi } from 'lucide-react';

interface PresenceIndicatorProps {
  isOnline: boolean;
  lastSeen?: string;
  connectionStatus?: 'online' | 'offline' | 'connecting';
  className?: string;
}

function PresenceIndicator({ 
  isOnline, 
  lastSeen, 
  connectionStatus = 'online',
  className = '' 
}: PresenceIndicatorProps) {
  const getStatusColor = () => {
    if (connectionStatus === 'connecting') {
      return 'text-yellow-500';
    }
    if (isOnline) {
      return 'text-green-500';
    }
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (connectionStatus === 'connecting') {
      return 'connecting...';
    }
    if (isOnline) {
      return 'Online';
    }
    return lastSeen || 'offline';
  };

  const getWifiIcon = () => {
    if (connectionStatus === 'connecting') {
      return <Wifi className="w-3 h-3 text-yellow-500 animate-pulse" />;
    }
    if (isOnline) {
      return <Wifi className="w-3 h-3 text-green-500" />;
    }
    return <Wifi className="w-3 h-3 text-gray-400" />;
  };

  return (
    <div className={`flex items-center gap-1 text-xs ${getStatusColor()} ${className}`}>
      {getWifiIcon()}
      <span className="truncate">
        {getStatusText()}
      </span>
    </div>
  );
}

export default PresenceIndicator;