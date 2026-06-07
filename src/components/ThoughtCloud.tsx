// src/components/ThoughtCloud.tsx
interface ThoughtCloudProps {
  text: string;
  isRobot?: boolean;
  isOwn?: boolean;
}

export default function ThoughtCloud({ text, isRobot = false, isOwn = false }: ThoughtCloudProps) {
  const robotEmoji = "🤖";
  const userEmoji = isOwn ? "👨🏻" : "👩🏻";
  
  return (
    <div className={`relative flex flex-col mb-6 animate-fade-in ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className="relative">
        <div className={`absolute -top-16 max-w-[280px] bg-gradient-to-br from-blue-100 to-indigo-100 
                        rounded-3xl px-5 py-3 text-sm shadow-lg border border-blue-200
                        before:content-[''] before:absolute before:top-full 
                        before:border-l-[15px] before:border-l-transparent 
                        before:border-r-[15px] before:border-r-transparent 
                        before:border-t-[15px] before:border-t-blue-100 ${
                          isOwn ? 'right-8 before:right-8' : 'left-8 before:left-8'
                        }`}>
          <p className="text-gray-700 font-medium italic">
            {isRobot && "🤖 "}{text}
          </p>
        </div>
        <div className="w-28 h-32 bg-gradient-to-b from-blue-200 to-indigo-300 rounded-full 
                        flex items-center justify-center shadow-xl border-4 border-white">
          <div className="text-4xl">{isRobot ? robotEmoji : userEmoji}</div>
        </div>
      </div>
    </div>
  );
}