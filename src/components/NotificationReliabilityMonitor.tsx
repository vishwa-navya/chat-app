import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface NotificationLog {
  id: string;
  timestamp: string;
  type: 'text' | 'image';
  message: string;
  status: 'pending' | 'success' | 'failed' | 'retried';
  response?: any;
}

interface NotificationReliabilityMonitorProps {
  nickname: string;
}

function NotificationReliabilityMonitor({ nickname }: NotificationReliabilityMonitorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    successRate: 0
  });

  // Only show for Ammu (the sender)
  if (nickname !== 'Ammu') return null;

  // Listen for notification events
  useEffect(() => {
    const handleNotificationEvent = (event: CustomEvent) => {
      const { type, message, status, response } = event.detail;
      
      const newLog: NotificationLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        status,
        response
      };
      
      setLogs(prev => [newLog, ...prev.slice(0, 19)]); // Keep last 20 logs
      
      // Update stats
      setStats(prev => {
        const newTotal = prev.total + 1;
        const newSuccessful = status === 'success' ? prev.successful + 1 : prev.successful;
        const newFailed = status === 'failed' ? prev.failed + 1 : prev.failed;
        
        return {
          total: newTotal,
          successful: newSuccessful,
          failed: newFailed,
          successRate: newTotal > 0 ? Math.round((newSuccessful / newTotal) * 100) : 0
        };
      });
    };

    // Listen for custom notification events
    window.addEventListener('notificationEvent', handleNotificationEvent as EventListener);
    
    return () => {
      window.removeEventListener('notificationEvent', handleNotificationEvent as EventListener);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case 'retried':
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      default:
        return <Bell className="w-3 h-3 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'retried':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
        title="Notification Monitor"
      >
        <Bell className="w-4 h-4" />
        {stats.total > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {stats.failed}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-sm w-full z-50 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notification Monitor
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b text-xs">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{stats.total}</div>
          <div className="text-gray-600">Total Sent</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${stats.successRate >= 90 ? 'text-green-600' : stats.successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {stats.successRate}%
          </div>
          <div className="text-gray-600">Success Rate</div>
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-xs font-medium text-gray-600 mb-2">Recent Notifications:</h4>
        <div className="space-y-1 text-xs">
          {logs.length === 0 ? (
            <p className="text-gray-400 italic">No notifications sent yet...</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`rounded p-2 ${getStatusColor(log.status)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(log.status)}
                    <span className="font-medium capitalize">{log.status}</span>
                  </div>
                  <span className="text-gray-500">{log.timestamp}</span>
                </div>
                <p className="mt-1 truncate">{log.message}</p>
                {log.type === 'image' && (
                  <span className="text-xs text-gray-500">📷 Image</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationReliabilityMonitor;