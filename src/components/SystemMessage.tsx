import React from 'react';

interface SystemMessageProps {
  message: string;
  theme?: 'chat2' | 'chat3';
}

function SystemMessage({ message, theme = 'chat2' }: SystemMessageProps) {
  const getThemeStyles = () => {
    if (theme === 'chat3') {
      return {
        text: 'text-white',
        icon: '✨'
      };
    }
    return {
      text: 'text-gray-700',
      icon: '💫'
    };
  };

  const styles = getThemeStyles();

  return (
    <div className="flex justify-center my-1 px-2">
      <div className="flex items-center justify-center gap-1">
        <span className={`text-[10px] ${styles.text}`}>{styles.icon}</span>
        <p className={`text-[10px] font-medium leading-tight ${styles.text}`}>
          {message}
        </p>
        <span className={`text-[10px] ${styles.text}`}>{styles.icon}</span>
      </div>
    </div>
  );
}

export default SystemMessage;
