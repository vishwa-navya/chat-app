import React, { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { lastSeenDb } from '../firebase-lastseen';

interface TypingIndicatorProps {
  nickname: string;
  currentUserNickname?: string;
}

function TypingIndicator({ nickname, currentUserNickname }: TypingIndicatorProps) {
  const [dots, setDots] = useState(1);
  const [partnerContext, setPartnerContext] = useState<string>('chat2');

  // Listen to partner's current chat context
  useEffect(() => {
    if (!currentUserNickname) return;
    
    const partnerNickname = currentUserNickname === 'Vishwa' ? 'Ammu' : 'Vishwa';
    
    const unsubscribe = onSnapshot(
      doc(lastSeenDb, 'userContext', partnerNickname),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPartnerContext(data.currentChat || 'chat2');
        }
      },
      (error) => {
        console.error('Error listening to partner context:', error);
        // Auto-retry on connection error
        setTimeout(() => {
          console.log('🔄 Retrying partner context connection...');
        }, 5000);
      }
    );

    return unsubscribe;
  }, [currentUserNickname]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev >= 3 ? 1 : prev + 1);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const renderDots = () => {
    return Array.from({ length: dots }, (_, i) => (
      <span key={i} className="text-lg animate-pulse">🩺</span>
    ));
  };

  return (
    <div className="flex justify-start mb-6 mt-4" style={{ 
      position: 'relative',
      zIndex: 1,
      minHeight: '60px',
      width: '100%',
      maxWidth: '100vw'
    }}>
      <div className="flex items-end gap-2">
        <div className="text-lg" style={{ flexShrink: 0 }}>
          {nickname === 'Vishwa' ? '👨‍⚕️' : nickname === 'Ammu' ? '👩‍⚕️' : '🤖'}
        </div>
        <div className="max-w-[70vw] sm:max-w-[280px]" style={{ 
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        }}>
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 
                          rounded-2xl px-3 py-2 shadow-lg border border-gray-200"
               style={{ minWidth: '80px' }}>
            <div className="flex items-center gap-1 h-5" style={{ justifyContent: 'flex-start' }}>
              {renderDots()}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1 px-2" style={{ 
            fontSize: '0.7rem',
            lineHeight: '1rem'
          }}>
            {partnerContext === 'chat3' && currentUserNickname ? 'typing from chat3...' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;