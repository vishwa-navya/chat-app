import React, { useState } from 'react';
import { Bug, X, Trash2 } from 'lucide-react';
import { usePresenceDebugger } from '../hooks/usePresenceDebugger';

interface PresenceDebugPanelProps {
  userId: string;
  isOtherUserOnline: boolean;
  otherUserLastSeen: string;
  connectionStatus: string;
}

function PresenceDebugPanel({ 
  userId, 
  isOtherUserOnline, 
  otherUserLastSeen, 
  connectionStatus 
}: PresenceDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  
  const { events, isVisible, clearEvents } = usePresenceDebugger(userId, debugEnabled);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Open Presence Debug Panel"
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm w-full z-50 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Presence Debug
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status Overview */}
      <div className="space-y-2 mb-3 pb-3 border-b text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">User:</span>
          <span className="font-medium">{userId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Page Visible:</span>
          <span className={`font-medium ${isVisible ? 'text-green-600' : 'text-red-600'}`}>
            {isVisible ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Connection:</span>
          <span className={`font-medium ${
            connectionStatus === 'online' ? 'text-green-600' : 
            connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {connectionStatus}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Other User:</span>
          <span className={`font-medium ${isOtherUserOnline ? 'text-green-600' : 'text-gray-600'}`}>
            {isOtherUserOnline ? 'online' : (otherUserLastSeen || 'offline')}
          </span>
        </div>
      </div>

      {/* Debug Controls */}
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={debugEnabled}
            onChange={(e) => setDebugEnabled(e.target.checked)}
            className="rounded"
          />
          Enable Logging
        </label>
        <button
          onClick={clearEvents}
          className="p-1 hover:bg-gray-100 rounded-full"
          title="Clear Events"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Events Log */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-xs font-medium text-gray-600 mb-2">Recent Events:</h4>
        <div className="space-y-1 text-xs">
          {events.length === 0 ? (
            <p className="text-gray-400 italic">No events logged yet...</p>
          ) : (
            events.slice().reverse().map((event, index) => (
              <div key={index} className="bg-gray-50 rounded p-2">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-800">{event.event}</span>
                  <span className="text-gray-500 text-xs">{event.timestamp}</span>
                </div>
                <p className="text-gray-600 mt-1">{event.details}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default PresenceDebugPanel;