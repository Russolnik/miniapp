import React from 'react';
import { ChatMessage, MessageRole } from '../types';
import { DownloadIcon, ExpandIcon } from './Icons';

interface ChatMessageProps {
  message: ChatMessage;
  onImageClick: (imageUrl: string) => void;
}

const ImageWithActions: React.FC<{ imageUrl: string; onImageClick: (url: string) => void }> = ({ imageUrl, onImageClick }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageClick(imageUrl);
  };

  return (
    <div 
      style={{ position: 'relative', cursor: 'pointer' }}
      onClick={() => onImageClick(imageUrl)}
      className="image-wrapper"
    >
      <img 
        src={imageUrl} 
        alt="Generated content" 
        style={{
          borderRadius: '8px',
          maxWidth: '300px',
          width: '100%',
          height: 'auto'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0)',
          transition: 'all 0.3s',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: '8px',
          opacity: 0,
          borderRadius: '8px'
        }}
        className="image-overlay"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0)';
          e.currentTarget.style.opacity = '0';
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={handleDownload} 
            style={{
              background: 'rgba(55, 65, 81, 0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Скачать изображение"
          >
            <DownloadIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={handleExpand} 
            style={{
              background: 'rgba(55, 65, 81, 0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Полноэкранный просмотр"
          >
            <ExpandIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, onImageClick }) => {
  const isUser = message.role === MessageRole.USER;
  const isModel = message.role === MessageRole.MODEL;
  const isError = message.role === MessageRole.ERROR;

  if (isError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '8px',
          maxWidth: '800px'
        }}>
          <p><strong>Ошибка:</strong> {message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        borderRadius: '12px',
        maxWidth: '800px',
        background: isUser ? 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)' : '#f5f5f5',
        color: isUser ? 'white' : '#333'
      }}>
        {isUser && <p style={{ margin: 0 }}>{message.prompt}</p>}
        {isUser && message.referenceImages.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {message.referenceImages.map((img, index) => (
              <img 
                key={index} 
                src={img} 
                alt={`Reference ${index + 1}`} 
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '2px solid rgba(255, 255, 255, 0.5)'
                }}
              />
            ))}
          </div>
        )}
        {isModel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {message.generatedImages.map((img, index) => (
              <ImageWithActions key={index} imageUrl={img} onImageClick={onImageClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageComponent;

