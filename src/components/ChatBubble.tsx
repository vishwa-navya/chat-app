// src/components/ChatBubble.tsx
interface ChatBubbleProps {
  text: string;
  isOwn: boolean;
}

export default function ChatBubble({ text, isOwn }: ChatBubbleProps) {
  if (isOwn) {
    return (
      <div className="flex justify-end mb-4 animate-slide-in-right">
        <div className="max-w-[280px] bg-gradient-to-br from-blue-500 to-indigo-500 
                        text-white rounded-2xl rounded-tr-lg px-4 py-3 shadow-sm">
          <p className="text-sm">{text}</p>
        </div>
      </div>
    );
  }

  return null;
}