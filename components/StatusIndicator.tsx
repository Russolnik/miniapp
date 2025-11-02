import React from 'react';

interface StatusIndicatorProps {
  isConnecting: boolean;
  isConnected: boolean;
  isModelSpeaking: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isConnecting, isConnected, isModelSpeaking }) => {
  let statusText = 'Отключено';
  let colorClass = 'bg-red-500';

  if (isConnecting) {
    statusText = 'Подключение...';
    colorClass = 'bg-yellow-500 animate-pulse';
  } else if (isConnected && isModelSpeaking) {
    statusText = 'AI говорит';
    colorClass = 'bg-purple-500 animate-pulse';
  } else if (isConnected) {
    statusText = 'Подключено';
    colorClass = 'bg-green-500';
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${colorClass} transition-colors duration-300`}></div>
      <span className="status-text text-sm font-medium">{statusText}</span>
    </div>
  );
};

