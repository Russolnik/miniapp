import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AspectRatio, MessageRole } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageComponent from './components/ChatMessage';
import ImageModal from './components/ImageModal';
import { fileToBase64 } from './utils/fileUtils';
import { generateImage, ModelType } from './services/geminiService';
import './App.css';

// Получение API ключа
async function getUserApiKey(): Promise<string | null> {
  try {
    // Пробуем получить из window.ENV (встроенный через HTML скрипт)
    if (typeof window !== 'undefined' && (window as any).ENV?.GEMINI_API_KEY) {
      const envKey = (window as any).ENV.GEMINI_API_KEY;
      const maskedKey = `***${envKey.slice(-4)}`;
      console.log(`✅ API ключ получен из window.ENV: ${maskedKey}`);
      return envKey;
    }
    
    // Пробуем получить из import.meta.env
    try {
      const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (viteKey && viteKey.trim() !== '') {
        const maskedKey = `***${viteKey.slice(-4)}`;
        console.log(`✅ API ключ получен из import.meta.env: ${maskedKey}`);
        return viteKey;
      }
    } catch (e) {
      console.log('⚠️ import.meta.env не доступен:', e);
    }
    
    // Fallback - явный ключ
    const fallbackKey = 'AIzaSyBscpJYM-ZPFmvihUrbnaupQhEOjAAlyjo';
    const maskedFallback = `***${fallbackKey.slice(-4)}`;
    console.log(`⚠️ Использую fallback API ключ: ${maskedFallback}`);
    return fallbackKey;
  } catch (e) {
    console.error('❌ Ошибка получения API ключа:', e);
    return 'AIzaSyBscpJYM-ZPFmvihUrbnaupQhEOjAAlyjo';
  }
}

const GenerationApp: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [model, setModel] = useState<ModelType>('imagen-4.0-generate-001');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{is_active: boolean} | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Инициализация Telegram WebApp и получение API ключа
  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        if (typeof tg.setHeaderColor === 'function') { tg.setHeaderColor('#81D4FA'); }
      } catch (e) {}
      try {
        if (typeof tg.setBackgroundColor === 'function') { tg.setBackgroundColor('#F5F5F0'); }
      } catch (e) {}
    }

    // Получаем API ключ
    getUserApiKey().then(key => {
      setApiKey(key);
      setApiKeyLoading(false);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);
  
  const handleSendMessage = async (prompt: string, files: File[], aspectRatio: AspectRatio, selectedModel: ModelType) => {
    if (!apiKey) {
      const errorMessage: ChatMessage = {
        role: MessageRole.ERROR,
        content: 'API ключ не найден. Пожалуйста, обновите страницу.',
      };
      setChatHistory(prev => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);

    const referenceImages = await Promise.all(files.map(fileToBase64));
    
    const userMessage: ChatMessage = {
      role: MessageRole.USER,
      prompt,
      referenceImages,
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      if (!apiKey) {
        throw new Error('API ключ не найден');
      }
      const generatedImages = await generateImage(apiKey, prompt, aspectRatio, selectedModel, referenceImages);
      const modelMessage: ChatMessage = {
        role: MessageRole.MODEL,
        generatedImages,
      };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: MessageRole.ERROR,
        content: error instanceof Error ? error.message : "Произошла неизвестная ошибка.",
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setModalImage(imageUrl);
  };

  const goBack = () => {
    window.location.href = 'main.html';
  };

  if (apiKeyLoading) {
    return (
      <div className="generation-app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4FC3F7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: '#666' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="generation-app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
      {/* Заголовок с кнопкой назад */}
      <header className="generation-header" style={{ padding: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.1)', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          className="back-button" 
          onClick={goBack}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#333',
            padding: '8px'
          }}
        >
          ← Назад
        </button>
        <h1 className="generation-title" style={{ flex: 1, margin: 0, fontSize: '20px', fontWeight: 600, color: '#333' }}>
          🎨 Генерация изображений
        </h1>
      </header>

      {/* Основной контент */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {chatHistory.map((msg, index) => (
            <ChatMessageComponent key={index} message={msg} onImageClick={handleImageClick} />
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ 
                background: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  border: '4px solid #f3f3f3', 
                  borderTop: '4px solid #4FC3F7', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                <span style={{ color: '#666' }}>Генерация...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>
      
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
        model={model}
        onModelChange={setModel}
      />
      <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GenerationApp;
