import React, { useState, useRef, ChangeEvent } from 'react';
import { AspectRatio } from '../types';
import { ModelType } from '../services/geminiService';
import { PaperclipIcon, SendIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (prompt: string, files: File[], aspectRatio: AspectRatio, model: ModelType) => void;
  isLoading: boolean;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
}

const aspectRatios: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const models: { id: ModelType; name: string }[] = [
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash' }
];

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, model, onModelChange }) => {
  const [prompt, setPrompt] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [activeAspectRatio, setActiveAspectRatio] = useState<AspectRatio>("1:1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3);
      setFiles(selectedFiles);
    }
  };

  const handleSend = () => {
    if ((prompt.trim() || files.length > 0) && !isLoading) {
      onSendMessage(prompt, files, activeAspectRatio, model);
      setPrompt('');
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const infoText = model === 'imagen-4.0-generate-001'
    ? "Прикрепленные изображения не отправляются в модель (только для истории чата)."
    : "Прикрепленные изображения будут использованы моделью как референсы.";

  return (
    <div style={{ background: '#ffffff', padding: '16px', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', color: '#757575', fontWeight: 500, marginRight: '8px' }}>Модель:</span>
                {models.map(m => (
                    <button
                        key={m.id}
                        onClick={() => onModelChange(m.id)}
                        style={{
                            padding: '6px 12px',
                            fontSize: '14px',
                            borderRadius: '20px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: model === m.id ? '#4FC3F7' : '#f5f5f5',
                            color: model === m.id ? 'white' : '#333',
                            fontWeight: model === m.id ? 600 : 400
                        }}
                    >
                        {m.name}
                    </button>
                ))}
            </div>
            
            {model === 'imagen-4.0-generate-001' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', color: '#757575', fontWeight: 500, marginRight: '8px' }}>Соотношение:</span>
                  {aspectRatios.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setActiveAspectRatio(ratio)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '14px',
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeAspectRatio === ratio ? '#666' : '#f5f5f5',
                        color: activeAspectRatio === ratio ? 'white' : '#333',
                        fontWeight: activeAspectRatio === ratio ? 600 : 400
                      }}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
            )}
        </div>
        <div style={{ position: 'relative', background: '#f5f5f5', borderRadius: '12px', display: 'flex', alignItems: 'flex-end', padding: '8px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px',
              color: '#666',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            title={`Прикрепить до 3 файлов. Выбрано: ${files.length}`}
          >
            <PaperclipIcon className="w-6 h-6" />
            {files.length > 0 && (
              <span style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                marginBottom: '-4px',
                marginLeft: '-4px',
                background: '#4FC3F7',
                color: 'white',
                fontSize: '12px',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {files.length}
              </span>
            )}
          </button>
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите изображение, которое хотите создать..."
            style={{
              flex: 1,
              background: 'transparent',
              color: '#333',
              resize: 'none',
              maxHeight: '160px',
              padding: '8px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              minHeight: '24px'
            }}
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!prompt.trim() && files.length === 0)}
            style={{
              padding: '8px',
              borderRadius: '50%',
              background: isLoading || (!prompt.trim() && files.length === 0) ? '#ccc' : '#4FC3F7',
              color: 'white',
              border: 'none',
              cursor: isLoading || (!prompt.trim() && files.length === 0) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
          >
            {isLoading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            ) : (
              <SendIcon className="w-6 h-6" style={{ transform: 'rotate(90deg)' }} />
            )}
          </button>
        </div>
        <p style={{ fontSize: '12px', textAlign: 'center', color: '#999', marginTop: '8px' }}>
          {infoText}
        </p>
      </div>
    </div>
  );
};

export default ChatInput;

