import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Send, LogOut, ChevronDown } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useOptimizedTyping } from '../hooks/useOptimizedTyping';
import RobotCloud from '../components/RobotCloud';
import TypingIndicator from '../components/TypingIndicator';
import { aiResponses } from '../data/aiResponses';
import { correctTypos } from '../utils/typoCorrection';
import { onSnapshot, doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Chat1Props {
  nickname: string;
  onLogout: () => void;
}

function Chat1({ nickname, onLogout }: Chat1Props) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; by: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { msgs, send, deleteMessage, loading } = useChat('publicMessages', nickname);
  const { handleTyping, stopTyping } = useOptimizedTyping(nickname);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom && msgs.length > 0);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [msgs.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // Listen for AI typing status
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'typing', 'AI'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const timestamp = data.timestamp?.toDate();
          const now = new Date();
          const isRecentTyping = timestamp &&
            (now.getTime() - timestamp.getTime()) < 5000;
          setIsTyping(data.isTyping && isRecentTyping);
        } else {
          setIsTyping(false);
        }
      },
      (error) => {
        console.error('Error listening to AI typing:', error);
        setIsTyping(false);
      }
    );
    return unsubscribe;
  }, []);

  const updateAITypingStatus = async (typing: boolean) => {
    try {
      await setDoc(doc(db, 'typing', 'AI'), {
        isTyping: typing,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error updating AI typing status:', error);
    }
  };

  const getAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase().trim();
    const correctedMessage = correctTypos(lowerMessage);

    if (aiResponses[correctedMessage]) {
      return aiResponses[correctedMessage];
    }
    for (const [key, value] of Object.entries(aiResponses)) {
      if (
        correctedMessage.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(correctedMessage)
      ) {
        return value;
      }
    }
    if (
      correctedMessage.startsWith('another word of ') ||
      correctedMessage.startsWith('meaning of ')
    ) {
      for (const [key, value] of Object.entries(aiResponses)) {
        if (key.toLowerCase() === correctedMessage) {
          return value;
        }
      }
    }
    return "Hmm… I'm thinking of your answer 🤖";
  };

  const handleReply = (messageId: string, text: string) => {
    const msg = msgs.find((m) => m.id === messageId);
    if (msg) {
      setReplyTo({ id: messageId, text, by: msg.by });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  const handleCancelReply = () => setReplyTo(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = message.trim();
    const currentReplyTo = replyTo;

    // 1️⃣ Send user message — stored with by: nickname (handled by useChat hook)
    await send(userMessage, 'text', undefined, undefined, undefined, currentReplyTo);

    setMessage('');
    setReplyTo(null);
    stopTyping();

    // 2️⃣ Show AI typing indicator
    await updateAITypingStatus(true);

    const thinkingTime = Math.random() * 2000 + 1000; // 1–3 seconds

    setTimeout(async () => {
      const aiResponse = getAIResponse(userMessage);

      // 3️⃣ Save AI message directly with by: 'AI'
      // We use addDoc directly (NOT the send() hook) because send() always sets
      // by: nickname. We need by: 'AI' so after refresh the message still renders
      // on the LEFT side correctly.
      try {
        await addDoc(collection(db, 'publicMessages'), {
          text: `🤖 ${aiResponse}`,
          by: 'AI',
          type: 'text',
          ts: serverTimestamp(),
          replyTo: currentReplyTo || null,
        });
      } catch (error) {
        console.error('Error saving AI message:', error);
      }

      await updateAITypingStatus(false);
    }, thinkingTime);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    if (value.trim()) {
      handleTyping();
    } else {
      stopTyping();
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    const messageDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const messageIST = new Date(messageDate.getTime() + istOffset);
    const nowIST = new Date(new Date().getTime() + istOffset);
    const todayStartIST = new Date(nowIST);
    todayStartIST.setHours(0, 0, 0, 0);
    const isToday = messageIST >= todayStartIST;
    if (isToday) {
      return messageIST.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });
    } else {
      return messageIST.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* FIXED HEADER with safe-area support for Android */}
      <div 
        className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-green-200 px-4 z-50 shadow-sm"
        style={{ 
          paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)',
          paddingBottom: '12px'
        }}
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              AI Teacher 📚
            </h1>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>

      {/* Book Background Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="text-9xl opacity-15 text-gray-500">📚</div>
      </div>

      {/* MESSAGES LIST */}
      <div
        ref={messagesContainerRef}
        className="max-w-2xl mx-auto p-4 relative z-10 h-screen overflow-y-auto"
        style={{ 
          paddingTop: 'calc(max(env(safe-area-inset-top, 16px), 16px) + 70px)',
          paddingBottom: '100px'
        }}
      >
        {loading && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <p className="text-gray-500">Loading messages...</p>
          </div>
        )}
        <div className="space-y-6">
          {msgs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚💡</div>
              <p className="text-gray-500 italic">
                Welcome to Doctors Study Portal! Ask me anything about your medical subjects...
              </p>
            </div>
          ) : (
            msgs.map((msg: any) => {
              // ✅ THE CORE FIX for Chat1:
              //
              // Chat1 has NO concept of "my nickname vs someone else's nickname".
              // The only rule is:
              //   msg.by === 'AI'  →  LEFT side  (isOwn=false, isAI=true)
              //   anything else   →  RIGHT side  (isOwn=true,  isAI=false)
              //
              // This works correctly even after refresh because we check msg.by
              // from Firestore, not from the current session's nickname.
              const isAIMessage = msg.by === 'AI' || msg.text?.startsWith('🤖');

              return (
                <RobotCloud
                  key={msg.id}
                  messageId={msg.id}
                  text={msg.text}
                  isOwn={!isAIMessage}   // human message → right side
                  isAI={isAIMessage}     // AI message   → left side
                  isUser={!isAIMessage}
                  type={msg.type}
                  currentUserNickname={nickname}
                  onReply={handleReply}
                  onDelete={handleDeleteMessage}
                  replyTo={msg.replyTo}
                  timestamp={formatMessageTime(msg.ts)}
                />
              );
            })
          )}
          {isTyping && <TypingIndicator nickname="AI" />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-32 right-6 bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-all z-40"
          title="Scroll to latest message"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Message Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-green-200 p-4 z-50 shadow-lg">
        {replyTo && (
          <div className="max-w-2xl mx-auto mb-3">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 font-medium">Replying to AI</div>
                <div className="text-sm text-gray-700 truncate">{replyTo.text}</div>
              </div>
              <button
                onClick={handleCancelReply}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                value={message}
                onChange={handleInputChange}
                placeholder="Ask me anything..."
                className="w-full px-4 py-3 rounded-2xl border border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none resize-none transition-all bg-white shadow-sm"
                rows={1}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  } else if (e.key === 'Escape') {
                    stopTyping();
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-3 rounded-2xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl z-10"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Floating Study Icons */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-5 text-green-200 text-2xl animate-bounce">🩺</div>
        <div className="absolute top-40 right-8 text-emerald-200 text-xl animate-pulse">👨‍⚕️</div>
        <div className="absolute bottom-32 left-12 text-teal-300 text-3xl animate-bounce">🩺</div>
        <div className="absolute top-60 right-20 text-green-300 text-2xl animate-pulse">👩‍⚕️</div>
        <div className="absolute bottom-60 left-20 text-emerald-300 text-xl animate-bounce">🩺</div>
        <div className="absolute top-80 left-40 text-blue-300 text-2xl animate-pulse">👨‍⚕️</div>
      </div>
    </div>
  );
}

export default Chat1;
