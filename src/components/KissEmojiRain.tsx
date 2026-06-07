import React, { useEffect, useState } from 'react';

interface KissEmojiRainProps {
  show: boolean;
  onComplete: () => void;
}

function KissEmojiRain({ show, onComplete }: KissEmojiRainProps) {
  const [rainItems, setRainItems] = useState<Array<{ id: number; left: number; delay: number }>>([]);

  useEffect(() => {
    if (show) {
      // Generate 13-15 random positions for falling items
      const itemCount = Math.floor(Math.random() * 3) + 18; // Random between 13-15
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        left: Math.random() * 80 + 10, // Random position between 10% and 90%
        delay: Math.random() * 1500, // Random delay up to 1.5 seconds
      }));
      setRainItems(items);

      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        onComplete();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {rainItems.map((item) => (
        <div
          key={item.id}
          className="absolute animate-bounce"
          style={{
            left: `${item.left}%`,
            top: '-100px',
            animationDelay: `${item.delay}ms`,
            animationDuration: '4s',
            animationTimingFunction: 'ease-in',
            animationFillMode: 'forwards',
            transform: 'translateY(calc(100vh + 100px))',
          }}
        >
          <div className="bg-gradient-to-br from-pink-100 to-rose-100 rounded-2xl px-3 py-2 shadow-lg border border-pink-200 text-center">
            <div className="text-2xl">😘</div>
            <div className="text-xs font-medium text-pink-700 whitespace-nowrap">
              love u papa
            </div>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100px);
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 100px));
            opacity: 0;
          }
        }
        
        .animate-bounce {
          animation: fall 4s ease-in forwards;
        }
      `}</style>
    </div>
  );
}

export default KissEmojiRain;