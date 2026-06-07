import React from 'react';
import { X, Delete, Send } from 'lucide-react';

interface VirtualKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyPress: (key: string) => void;
  onSend: () => void;
}

const KEYS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M']
];

export default function VirtualKeyboard({
  isOpen,
  onClose,
  onKeyPress,
  onSend
}: VirtualKeyboardProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-4 w-[520px] max-w-[90%] relative">

        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100"
          title="Close keyboard"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* LETTER KEYS */}
        <div className="space-y-2 mt-4">
          {KEYS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-2">
              {row.map((key) => (
                <button
                  key={key}
                  onClick={() => onKeyPress(key)}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium shadow-sm"
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ACTION ROW */}
        <div className="flex items-center justify-between gap-3 mt-4">

          {/* DELETE – LEFT */}
          <button
            onClick={() => onKeyPress('BACK')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 font-medium shadow"
          >
            <Delete className="w-4 h-4" />
            Delete
          </button>

          {/* SPACE – CENTER */}
          <button
            onClick={() => onKeyPress('SPACE')}
            className="flex-1 px-6 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium shadow"
          >
            Space
          </button>

          {/* SEND – RIGHT */}
          <button
            onClick={onSend}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 font-medium shadow"
          >
            <Send className="w-4 h-4" />
            Send
          </button>

        </div>
      </div>
    </div>
  );
}
