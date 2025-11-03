import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AspectRatio, MessageRole } from './types';
import ChatInput from './components/ChatInput';
import ChatMessageComponent from './components/ChatMessage';
import ImageModal from './components/ImageModal';
import { fileToBase64 } from './utils/fileUtils';
import { generateImage, ModelType } from './services/geminiService';
import './App.css';

// Получение API URL (сначала localhost, потом production)
async function getApiUrlForSubscription(): Promise<string> {
  const productionUrl = (window as any).API_URL || 'https://tg-ai-f9rj.onrender.com';
  const localUrl = 'http://localhost:5000';
  
  // ВСЕГДА сначала проверяем localhost
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${localUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Локальный сервер доступен для проверки подписки');
      return localUrl;
    }
  } catch (e) {
    console.log('⚠️ Локальный сервер недоступен, используем production');
  }
  
  return productionUrl;
}

// Проверка статуса подписки перед использованием Generation
async function checkSubscriptionStatus(): Promise<{is_active: boolean; is_trial?: boolean} | null> {
  try {
    // Сначала получаем API URL (localhost приоритет)
    const apiUrl = await getApiUrlForSubscription();
    
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    const initData = tg?.initData || '';
    
    if (!tg?.initDataUnsafe?.user?.id) {
      console.warn('⚠️ Не удалось получить ID пользователя для проверки подписки');
      return null;
    }
    
    const telegramId = tg.initDataUnsafe.user.id;
    
    const response = await fetch(`${apiUrl}/api/user/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegram_id: telegramId,
        initData: initData
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.subscription || null;
    } else {
      console.warn('⚠️ Ошибка проверки подписки:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке подписки:', error);
    return null;
  }
}

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
  const [subscriptionStatus, setSubscriptionStatus] = useState<{is_active: boolean; is_trial?: boolean} | null>(null);
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
    
    // Проверяем подписку (сначала localhost, потом production)
    (async () => {
      const status = await checkSubscriptionStatus();
      setSubscriptionStatus(status);
      setSubscriptionChecked(true);
      
      if (!status || (!status.is_active && !status.is_trial)) {
        const message = '🚫 **Доступ ограничен**\n\n' +
          'Для использования генерации изображений требуется активная подписка.\n\n' +
          'Используйте команду /subscription в боте для оформления подписки.';
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(message);
        } else {
          alert(message);
        }
      }
    })();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);
  
  const handleSendMessage = async (prompt: string, files: File[], aspectRatio: AspectRatio, selectedModel: ModelType) => {
    // Generation пока в разработке для всех
    const message = '🚫 **Доступ ограничен**\n\n' +
      'Генерация изображений временно недоступна.\n\n' +
      'Мы работаем над этим функционалом.';
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(message);
    } else {
      alert(message);
    }
    return;
    
    // Проверяем подписку перед отправкой сообщения
    if (!subscriptionChecked || !subscriptionStatus || (subscriptionStatus && !subscriptionStatus.is_active && !subscriptionStatus.is_trial)) {
      const status = await checkSubscriptionStatus();
      setSubscriptionStatus(status);
      setSubscriptionChecked(true);
      
      if (!status || (status && !status.is_active && !status.is_trial)) {
        const errorMsg = '🚫 **Доступ ограничен**\n\n' +
          'Для использования генерации изображений требуется активная подписка.\n\n' +
          'Используйте команду /subscription в боте для оформления подписки.';
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(errorMsg);
        } else {
          alert(errorMsg);
        }
        return;
      }
    }
    
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
      const generatedImages = await generateImage(apiKey, prompt, aspectRatio, selectedModel, referenceImages);
      const modelMessage: ChatMessage = {
        role: MessageRole.MODEL,
        generatedImages,
      };
      setChatHistory(prev => [...prev, modelMessage]);
    } catch (error: unknown) {
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
