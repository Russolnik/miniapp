import React, { useState, useRef, useCallback } from 'react';
// FIX: Removed non-exported 'LiveSession' type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Speaker, TranscriptEntry } from './types';
import { encode, decode, decodeAudioData } from './utils/audioUtils';
import { StatusIndicator } from './components/StatusIndicator';
import { TranscriptView } from './components/TranscriptView';
import './App.css';

const AVAILABLE_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;
type Voice = typeof AVAILABLE_VOICES[number];

// Русские названия голосов для отображения
const VOICE_NAMES: Record<Voice, string> = {
  'Zephyr': 'Зефир',
  'Puck': 'Пак',
  'Charon': 'Харон',
  'Kore': 'Кора',
  'Fenrir': 'Фенрир'
};

// Polyfill for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    Telegram?: any;
    initTelegramAttempts?: number;
    themeManager?: {
      toggleTheme: () => string;
      setTheme: (theme: string) => void;
      getTheme: () => string;
      getEffectiveTheme: () => string;
      init: () => void;
    };
  }
}

// Telegram WebApp - инициализация с проверкой готовности
let tg: any = null;
if (typeof window !== 'undefined') {
  if (window.Telegram?.WebApp) {
    tg = window.Telegram.WebApp;
    // Инициализируем WebApp если он доступен
    try {
      tg.ready();
      tg.expand();
    } catch (e) {
      console.warn('⚠️ Не удалось инициализировать Telegram WebApp:', e);
    }
  } else {
    // Проверяем, может быть WebApp еще загружается
    console.warn('⚠️ Telegram WebApp не найден, возможно скрипт еще загружается');
  }
}

// Кэш для проверенного API URL
let cachedApiUrl: string | null = null;
let apiUrlCheckPromise: Promise<string> | null = null;

// Проверка доступности сервера
async function checkServerAvailable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Получение API URL сервера с проверкой доступности
async function getApiUrl(): Promise<string> {
  // Если уже проверен - возвращаем кэшированный URL
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  
  // Если проверка уже идет - ждем её
  if (apiUrlCheckPromise) {
    return await apiUrlCheckPromise;
  }
  
  // Начинаем проверку
  apiUrlCheckPromise = (async () => {
    const productionUrl = (window as any).API_URL || 'https://tg-ai-f9rj.onrender.com';
    const localUrl = 'http://localhost:5000';
    
    // Проверяем, находимся ли мы на localhost
    const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
    
    // Маскируем URL в логах
    const maskUrl = (url: string) => url ? `***${url.slice(-15)}` : 'не установлен';
    console.log('🌐 Определение окружения:', {
      hostname: window.location.hostname,
      isDevelopment,
      apiUrlFromWindow: maskUrl((window as any).API_URL || ''),
      productionUrl: maskUrl(productionUrl)
    });
    
    if (isDevelopment) {
      // Пробуем сначала локальный сервер
      console.log('🔍 Проверка доступности локального сервера...');
      const localAvailable = await checkServerAvailable(localUrl);
      
      if (localAvailable) {
        console.log('✅ Локальный сервер доступен, используем его');
        cachedApiUrl = localUrl;
        return localUrl;
      } else {
        console.log('⚠️ Локальный сервер недоступен, переключаемся на продакшн');
        cachedApiUrl = productionUrl;
        return productionUrl;
      }
    } else {
      // В продакшне сразу используем production URL (без проверки localhost, т.к. CSP блокирует)
      const maskedProdUrl = `***${productionUrl.slice(-15)}`;
      console.log('🚀 Продакшен окружение, используем API URL:', maskedProdUrl);
      cachedApiUrl = productionUrl;
      return productionUrl;
    }
  })();
  
  return await apiUrlCheckPromise;
}

// Получение API ключа из переменных окружения (fallback)
function getApiKeyFromEnv(): string | null {
  try {
    // Логирование замаскировано
    // console.log('🔍 Поиск API ключа в env переменных...');
    // console.log('🔍 window.ENV:', typeof window !== 'undefined' ? (window as any).ENV : 'недоступен');
    
    // Способ 1: Пробуем получить из window.ENV (встроенный через HTML скрипт)
    if (typeof window !== 'undefined' && (window as any).ENV?.GEMINI_API_KEY) {
      const envKey = (window as any).ENV.GEMINI_API_KEY;
      const maskedKey = `***${envKey.slice(-4)}`;
      console.log(`✅ API ключ получен из window.ENV: ${maskedKey}`);
      return envKey;
    }
    
    // Способ 2: Пробуем получить из import.meta.env (для Vite во время сборки)
    try {
      const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (viteKey && viteKey.trim() !== '') {
        const maskedKey = `***${viteKey.slice(-4)}`;
        console.log(`✅ API ключ получен из import.meta.env: ${maskedKey}`);
        return viteKey;
      } else {
        console.log('⚠️ import.meta.env.VITE_GEMINI_API_KEY пуст или не определен');
      }
    } catch (e) {
      console.log('⚠️ import.meta.env не доступен:', e);
    }
    
    // Способ 3: Пробуем получить из глобальной переменной (для Netlify через функции)
    if (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) {
      const globalKey = (window as any).GEMINI_API_KEY;
      const maskedKey = `***${globalKey.slice(-4)}`;
      console.log(`✅ API ключ получен из глобальной переменной: ${maskedKey}`);
      return globalKey;
    }
    
    // Способ 4: Fallback - явный ключ для тестирования (временный)
    const fallbackKey = 'AIzaSyBscpJYM-ZPFmvihUrbnaupQhEOjAAlyjo';
    const maskedFallback = `***${fallbackKey.slice(-4)}`;
    console.log(`⚠️ Использую fallback API ключ (явно указанный в коде): ${maskedFallback}`);
    return fallbackKey;
    
  } catch (e) {
    console.error('❌ Ошибка получения API ключа из env:', e);
    // В случае ошибки тоже возвращаем fallback ключ
    const fallbackKey = 'AIzaSyBscpJYM-ZPFmvihUrbnaupQhEOjAAlyjo';
    const maskedFallback = `***${fallbackKey.slice(-4)}`;
    console.log(`⚠️ Использую fallback API ключ из catch блока: ${maskedFallback}`);
    return fallbackKey;
  }
}

// Получение API ключа пользователя
async function getUserApiKey(): Promise<string | null> {
  try {
    const apiUrl = await getApiUrl();
    
    // Получаем Telegram WebApp (проверяем глобально, может быть загрузился позже)
    let webApp = tg;
    if (!webApp && typeof window !== 'undefined' && window.Telegram?.WebApp) {
      webApp = window.Telegram.WebApp;
      console.log('✅ Telegram WebApp найден через window.Telegram');
    }
    
    // Получаем telegram_id из Telegram WebApp
    let telegramId: number | null = null;
    
    // Детальное логирование для диагностики
    console.log('🔍 Поиск Telegram ID...', {
      hasTgVariable: !!tg,
      hasWindowTelegram: !!(typeof window !== 'undefined' && window.Telegram),
      hasWebApp: !!webApp,
      hasInitDataUnsafe: !!webApp?.initDataUnsafe,
      hasUser: !!webApp?.initDataUnsafe?.user,
      hasUserId: !!webApp?.initDataUnsafe?.user?.id,
      hasInitData: !!webApp?.initData,
      version: webApp?.version,
      platform: webApp?.platform,
      initDataLength: webApp?.initData?.length || 0
    });
    
    // Способ 1: initDataUnsafe (основной способ для Telegram WebApp)
    if (webApp?.initDataUnsafe?.user?.id) {
      telegramId = webApp.initDataUnsafe.user.id;
      const maskedId = `***${String(telegramId).slice(-4)}`;
      console.log(`✅ Telegram ID найден через initDataUnsafe: ${maskedId}`);
    }
    // Способ 2: Парсинг initData
    else if (webApp?.initData) {
      try {
        const urlParams = new URLSearchParams(webApp.initData);
        const userStr = urlParams.get('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          telegramId = user.id || null;
          if (telegramId) {
            const maskedId = `***${String(telegramId).slice(-4)}`;
            console.log(`✅ Telegram ID найден через парсинг initData: ${maskedId}`);
          } else {
            console.warn('⚠️ user.id отсутствует в распарсенном initData');
          }
        } else {
          console.warn('⚠️ Параметр "user" не найден в initData');
        }
      } catch (e) {
        console.warn('⚠️ Не удалось распарсить initData:', e);
        // Пробуем альтернативный способ парсинга
        try {
          const initDataObj = JSON.parse(decodeURIComponent(webApp.initData));
          if (initDataObj.user?.id) {
            telegramId = initDataObj.user.id;
            const maskedId = `***${String(telegramId).slice(-4)}`;
            console.log(`✅ Telegram ID найден через альтернативный парсинг: ${maskedId}`);
          }
        } catch (e2) {
          console.warn('⚠️ Альтернативный парсинг initData тоже не удался:', e2);
        }
      }
    }
    // Способ 3: Проверка URL параметров (для отладки или альтернативных запусков)
    else {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get('tg_user_id') || urlParams.get('user_id');
      if (urlUserId) {
        const parsedId = parseInt(urlUserId, 10);
        if (!isNaN(parsedId)) {
          telegramId = parsedId;
          const maskedId = `***${String(telegramId).slice(-4)}`;
          console.log(`✅ Telegram ID найден через URL параметр: ${maskedId}`);
        }
      }
    }
    
    // Только для локальной разработки используем заглушку
    const isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
    if (!telegramId && isDevelopment) {
      console.warn('⚠️ Telegram ID не найден, используем заглушку для локальной разработки');
      telegramId = 12345;
    }
    
    if (!telegramId) {
      const errorMsg = '❌ Telegram ID не найден. Убедитесь, что приложение открыто через Telegram.';
      console.error(errorMsg, {
        location: window.location.href,
        hasTelegram: !!(typeof window !== 'undefined' && window.Telegram),
        hasWebApp: !!webApp,
        webAppData: webApp ? {
          version: webApp.version,
          platform: webApp.platform,
          initDataExists: !!webApp.initData,
          initDataLength: webApp.initData?.length || 0,
          initDataUnsafeExists: !!webApp.initDataUnsafe,
          hasUser: !!webApp.initDataUnsafe?.user
        } : null
      });
      
      // Попробуем подождать немного и попробовать снова (на случай если WebApp еще загружается)
      if (typeof window !== 'undefined' && !window.Telegram?.WebApp) {
        console.log('⏳ Telegram WebApp не найден, ожидание 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (window.Telegram?.WebApp) {
          console.log('✅ Telegram WebApp загружен, повторная попытка...');
          return getUserApiKey(); // Рекурсивный вызов (только один раз)
        }
      }
      
      // Если не удалось получить telegram_id, пробуем взять ключ из env переменных (fallback)
      // Логирование замаскировано
      // console.log('⚠️ Telegram ID не найден, пробуем получить API ключ из env переменных...');
      const envApiKey = getApiKeyFromEnv();
      if (envApiKey) {
        const maskedKey = `***${envApiKey.slice(-4)}`;
        console.log(`✅ API ключ получен из env (fallback): ${maskedKey}`);
        return envApiKey;
      }
      
      console.error('❌ Не удалось получить API ключ ни с сервера, ни из env переменных');
      return null;
    }
    
    // Получаем initData для валидации на сервере (безопасность)
    const initData = webApp?.initData || null;
    const hasInitData = !!initData;
    console.log('🔐 initData для валидации:', hasInitData ? `✅ присутствует (${initData.length} символов)` : '❌ отсутствует');
    
    // Маскируем telegram_id и URL в логах
    const maskedTelegramId = telegramId ? `***${String(telegramId).slice(-4)}` : 'неизвестен';
    const maskUrl = (url: string) => url ? `***${url.slice(-15)}` : 'не установлен';
    const fullApiUrl = `${apiUrl}/api/gemini/api-key`;
    console.log('📤 Запрос API ключа для пользователя:', maskedTelegramId);
    console.log('🔗 URL запроса:', maskUrl(fullApiUrl));
    
    // Формируем тело запроса с initData для валидации
    const requestBody: { telegram_id: number; initData?: string } = { 
      telegram_id: telegramId 
    };
    if (initData) {
      requestBody.initData = initData;
      console.log('🔐 Добавляем initData для валидации на сервере');
    } else {
      console.warn('⚠️ initData отсутствует - запрос может быть отклонен сервером');
    }
    
    console.log('📤 Отправка запроса на получение API ключа...');
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📥 Ответ сервера получен:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('❌ Ошибка получения API ключа с сервера:', response.status, response.statusText);
        
        // Пробуем распарсить как JSON
        try {
          const errorData = JSON.parse(errorText);
          // Маскируем чувствительные данные в ошибках
          const maskedError = { ...errorData };
          if (maskedError.received_data?.telegram_id) {
            maskedError.received_data.telegram_id = `***${String(maskedError.received_data.telegram_id).slice(-4)}`;
          }
          if (maskedError.api_key) {
            maskedError.api_key = `***${String(maskedError.api_key).slice(-4)}`;
          }
          console.error('❌ Детали ошибки сервера:', maskedError);
        } catch (parseError) {
          // Маскируем API ключи в тексте ошибки
          const maskedErrorText = errorText.replace(/("api_key"\s*:\s*")([^"]+)(")/gi, (_match, prefix, key, suffix) => {
            return `${prefix}***${key.slice(-4)}${suffix}`;
          });
          console.error('❌ Текст ошибки сервера (не JSON, маскировано):', maskedErrorText.substring(0, 200));
        }
      } catch (readError) {
        console.error('❌ Не удалось прочитать ответ сервера:', readError);
      }
      
      // Fallback: пробуем получить ключ из env переменных
      console.log('⚠️ Пробуем получить API ключ из env переменных (fallback)...');
      const envApiKey = getApiKeyFromEnv();
      if (envApiKey) {
        const maskedKey = `***${envApiKey.slice(-4)}`;
        console.log(`✅ API ключ получен из env (fallback): ${maskedKey}`);
        return envApiKey;
      }
      
      return null;
    }
    
    let data: any;
    try {
      const responseText = await response.text();
      // Маскируем API ключи в логах перед выводом
      const maskedResponseText = responseText.replace(/("api_key"\s*:\s*")([^"]+)(")/gi, (_match, prefix, key, suffix) => {
        return `${prefix}***${key.slice(-4)}${suffix}`;
      });
      console.log('📥 Текст ответа сервера (первые 100 символов, маскировано):', maskedResponseText.substring(0, 100));
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Не удалось распарсить ответ сервера как JSON:', parseError);
      return null;
    }
    
    console.log('📥 Распарсенные данные ответа:', {
      hasApiKey: !!data.api_key,
      hasSuccess: 'success' in data,
      success: data.success,
      keys: Object.keys(data)
    });
    
    if (!data.api_key) {
      console.error('❌ API ключ отсутствует в ответе сервера. Данные ответа:', {
        ...data,
        api_key: data.api_key ? '***' + data.api_key.slice(-4) : 'отсутствует'
      });
      return null;
    }
    
    // Маскируем API ключ в логах (показываем только последние 4 символа)
    const maskedApiKey = `***${data.api_key.slice(-4)}`;
    const keyNumber = data.success ? 'получен' : 'не получен';
    console.log(`✅ API ключ ${keyNumber} с сервера: ${maskedApiKey}`);
    
    return data.api_key;
  } catch (error) {
    console.error('❌ Ошибка запроса API ключа с сервера, пробуем env переменные...');
    
    // Fallback: пробуем получить ключ из env переменных
    const envApiKey = getApiKeyFromEnv();
    if (envApiKey) {
      const maskedKey = `***${envApiKey.slice(-4)}`;
      console.log(`✅ API ключ получен из env (fallback): ${maskedKey}`);
      return envApiKey;
    }
    
    console.error('❌ Не удалось получить API ключ ни с сервера, ни из env переменных');
    console.error('💡 Убедитесь, что:');
    console.error('   1. Приложение открыто через Telegram (для получения Telegram ID)');
    console.error('   2. Сервер доступен (для получения ключа с сервера)');
    console.error('   3. В Netlify настроена переменная VITE_GEMINI_API_KEY (для fallback)');
    return null;
  }
}

const App: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice>('Zephyr');
  const [showTranscript, setShowTranscript] = useState(false); // Для кнопки открыть чат

  // FIX: Using `any` for session promise as `LiveSession` is not an exported type.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateLastTranscriptEntry = (speaker: Speaker, text: string) => {
    if (!text) return;
    setTranscript((prev: TranscriptEntry[]) => {
      // Use a functional update to ensure we have the latest state and prevent mutations
      const newTranscript = [...prev];
      const lastEntry = newTranscript.length > 0 ? newTranscript[newTranscript.length - 1] : null;
      
      if (lastEntry && lastEntry.speaker === speaker) {
        // Append to the last entry
        lastEntry.text += text;
      } else {
        // Create a new entry
        newTranscript.push({ speaker, text });
      }
      return newTranscript;
    });
  };

  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');
    
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }

    outputSourcesRef.current.forEach((source: AudioBufferSourceNode) => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    outputSourcesRef.current.clear();

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    mediaStreamRef.current = null;

    if (outputGainNodeRef.current) {
      outputGainNodeRef.current.disconnect();
      outputGainNodeRef.current = null;
    }

    inputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current?.close().catch(console.error);
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;

    setIsConnecting(false);
    setIsConnected(false);
    setIsModelSpeaking(false);
    
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    nextStartTimeRef.current = 0;
  }, []);

  const handleStopConversation = useCallback(async () => {
    if (sessionPromiseRef.current) {
        try {
            const session = await sessionPromiseRef.current;
            session.close();
        } catch (error) {
            console.error('Error closing session:', error);
        }
        sessionPromiseRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  const handleStartConversation = useCallback(async () => {
    setIsConnecting(true);
    setTranscript([]);

    try {
      // Request microphone permission upfront.
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Получаем API ключ пользователя (уже с ротацией через get_available_key)
      const apiKey = await getUserApiKey();
      if (!apiKey) {
        throw new Error('API ключ не найден');
      }
      
      // ВАЖНО: Проблема блокировок в РФ/Беларуси
      // GoogleGenAI SDK использует WebSocket напрямую к Google API (generativelanguage.googleapis.com)
      // Это не работает в РФ/Беларуси без VPN, т.к. запросы идут напрямую от клиента
      // 
      // Решение: Нужен прокси на уровне сети или серверный WebSocket прокси
      // 
      // Вариант 1: Использовать прокси на уровне браузера (расширение/настройки)
      // Вариант 2: Создать WebSocket прокси на сервере Python (gemini_ws_proxy.py)
      // Вариант 3: Изменить SDK для использования прокси URL
      //
      // Пока используем оригинальный SDK - трафик идет напрямую от клиента
      // Для работы нужен VPN или прокси на уровне сети
      console.log('⚠️ ВНИМАНИЕ: Соединение идет напрямую к Google API от клиента');
      console.log('⚠️ Для работы в РФ/Беларуси без VPN нужен прокси на уровне сети');
      
      const ai = new GoogleGenAI({ apiKey });
      
      inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      outputGainNodeRef.current = outputAudioContextRef.current.createGain();
      outputGainNodeRef.current.connect(outputAudioContextRef.current.destination);

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: 'You are a helpful and friendly AI assistant. Keep your responses concise and conversational. Respond in Russian when the user speaks Russian.',
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsConnected(true);
            
            if (!mediaStreamRef.current || !inputAudioContextRef.current) {
                console.error("Media stream or input audio context not available in onopen");
                return;
            }

            mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent: AudioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map((f: number) => f * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription?.text) {
                updateLastTranscriptEntry(Speaker.USER, message.serverContent.inputTranscription.text);
            }
            if (message.serverContent?.outputTranscription?.text) {
                updateLastTranscriptEntry(Speaker.MODEL, message.serverContent.outputTranscription.text);
            }
            
            // Handle interruption with a fade-out for a smoother transition.
            if (message.serverContent?.interrupted) {
              console.log("AI interrupted, fading out current playback.");
              if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
              setIsModelSpeaking(false);
              if (outputAudioContextRef.current && outputGainNodeRef.current) {
                const now = outputAudioContextRef.current.currentTime;
                const fadeOutDuration = 0.1; // 100ms
                
                outputGainNodeRef.current.gain.cancelScheduledValues(now);
                outputGainNodeRef.current.gain.setValueAtTime(outputGainNodeRef.current.gain.value, now);
                outputGainNodeRef.current.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutDuration);

                const sourcesToStop = new Set(outputSourcesRef.current);
                outputSourcesRef.current.clear();
                
                setTimeout(() => {
                    sourcesToStop.forEach((source: AudioBufferSourceNode) => {
                        try { source.stop(); source.disconnect(); } catch (e) {}
                    });
                }, fadeOutDuration * 1000);
              }
              nextStartTimeRef.current = 0;
            }

            const modelTurnParts = message.serverContent?.modelTurn?.parts;
            if (modelTurnParts) {
              for (const part of modelTurnParts) {
                const audioData = part?.inlineData?.data;
                if (audioData && outputAudioContextRef.current && outputGainNodeRef.current) {
                  setIsModelSpeaking(true);
                  if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);

                  // When new audio arrives, ensure volume is reset to full.
                  const now = outputAudioContextRef.current.currentTime;
                  outputGainNodeRef.current.gain.cancelScheduledValues(now);
                  outputGainNodeRef.current.gain.setValueAtTime(1.0, now);

                  const audioBuffer = await decodeAudioData(
                    decode(audioData),
                    outputAudioContextRef.current,
                    24000,
                    1
                  );
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                  const source = outputAudioContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputGainNodeRef.current);
                  source.onended = () => {
                    outputSourcesRef.current.delete(source);
                    try { source.disconnect(); } catch (e) {}
                  }
                  source.start(nextStartTimeRef.current);
                  outputSourcesRef.current.add(source);

                  const scheduledEndTime = nextStartTimeRef.current + audioBuffer.duration;
                  nextStartTimeRef.current = scheduledEndTime;

                  const durationUntilEnd = (scheduledEndTime - outputAudioContextRef.current.currentTime) * 1000;
                  speakingTimeoutRef.current = setTimeout(() => {
                    setIsModelSpeaking(false);
                  }, Math.max(0, durationUntilEnd));

                  break; 
                }
              }
            }
          },
          onclose: () => {
            console.log('Session closed.');
            cleanup();
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            alert(`Произошла ошибка во время сессии: ${e.message || 'Неизвестная ошибка'}. Сессия будет закрыта.`);
            cleanup();
          },
        },
      });

      await sessionPromiseRef.current;

  } catch (error) {
    console.error('❌ Не удалось начать разговор', error);
    let errorMessage = 'Произошла неизвестная ошибка.';
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      console.error('❌ Детали ошибки:', {
        name: error.name,
        message: errorMsg,
        stack: error.stack?.substring(0, 200)
      });
      
      if (error.name === 'NotAllowedError' || errorMsg.includes('permission denied') || errorMsg.includes('разрешение')) {
        errorMessage = 'Разрешение на использование микрофона отклонено. Пожалуйста, разрешите доступ к микрофону в настройках браузера.';
      } else if (errorMsg.includes('api ключ') || errorMsg.includes('api key') || errorMsg.includes('api_key') || errorMsg.includes('ключ не найден')) {
        errorMessage = 'Не удалось получить API ключ. Убедитесь, что приложение открыто через Telegram и попробуйте позже.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('cors')) {
        errorMessage = 'Проблема с сетевым соединением. Проверьте подключение к интернету.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('timeout')) {
        errorMessage = 'Превышено время ожидания. Попробуйте еще раз.';
      } else {
        // Показываем только безопасные части сообщения
        if (errorMsg.length < 100 && !errorMsg.includes('http') && !errorMsg.includes('://')) {
          errorMessage = error.message;
        }
      }
    } else {
      console.error('❌ Неизвестный тип ошибки:', typeof error, error);
    }
    
    alert(`Ошибка: ${errorMessage}`);
    cleanup();
  }
  }, [cleanup, selectedVoice]);

  const handleToggleConversation = () => {
    if (isConnected || isConnecting) {
      handleStopConversation();
    } else {
      handleStartConversation();
    }
  };

  // Инициализация Telegram WebApp
  React.useEffect(() => {
    // Ждем загрузки Telegram WebApp если он еще не готов
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        try {
          webApp.ready();
          webApp.expand();
          // setHeaderColor и setBackgroundColor не поддерживаются в версии 6.0+
          // Используем только если доступны
          if (typeof webApp.setHeaderColor === 'function') {
            webApp.setHeaderColor('#81D4FA'); // Светлый цвет по умолчанию
          }
          if (typeof webApp.setBackgroundColor === 'function') {
            webApp.setBackgroundColor('#F5F5F0'); // Белый фон по умолчанию
          }
          console.log('✅ Telegram WebApp инициализирован');
        } catch (e) {
          console.warn('⚠️ Ошибка инициализации Telegram WebApp:', e);
        }
      } else {
        // Если WebApp еще не загружен, ждем немного и пробуем снова (макс 3 попытки)
        if (typeof window !== 'undefined' && (!window.initTelegramAttempts || window.initTelegramAttempts < 3)) {
          window.initTelegramAttempts = (window.initTelegramAttempts || 0) + 1;
          setTimeout(initTelegram, 200);
        } else {
          console.warn('⚠️ Telegram WebApp не загружен после нескольких попыток');
        }
      }
    };
    
    initTelegram();
  }, []);

  // Определяем состояние для анимации облака
  const cloudState = isConnecting ? 'connecting' : 
                     isConnected && isModelSpeaking ? 'speaking' : 
                     isConnected ? 'listening' : 'idle';

  return (
    <main className="live-app-container">
      <header className="live-header">
        <button 
          onClick={() => window.location.href = 'main.html'}
          className="back-button"
        >
          ← Назад
        </button>
        <h1 className="live-title">
          🗣️ Live общение
        </h1>
        <div className="header-controls">
          <VoiceSelector 
            value={selectedVoice} 
            onChange={setSelectedVoice}
            disabled={isConnected || isConnecting}
          />
          <StatusIndicator 
            isConnecting={isConnecting} 
            isConnected={isConnected} 
            isModelSpeaking={isModelSpeaking} 
          />
          {/* Кнопка переключения темы */}
          <button 
            className="theme-toggle-btn" 
            onClick={() => {
              if (window.themeManager) {
                window.themeManager.toggleTheme();
              }
            }}
            title="Переключить тему"
          >
            <span id="theme-icon">🌓</span>
          </button>
        </div>
      </header>

      {/* Центральное облако с анимацией - кнопка для начала/остановки */}
      <div className="center-cloud-wrapper">
        <button
          onClick={handleToggleConversation}
          disabled={isConnecting}
          className={`center-cloud cloud-${cloudState} ${isConnecting ? 'connecting' : ''}`}
        >
          <div className="cloud-content">
            ☁️
          </div>
          <div className="cloud-status-text">
            {cloudState === 'idle' && 'Нажмите для начала'}
            {cloudState === 'connecting' && 'Подключение...'}
            {cloudState === 'listening' && 'Слушаю...'}
            {cloudState === 'speaking' && 'Отвечаю...'}
          </div>
        </button>
      </div>

      {/* Кнопка показать/скрыть чат */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <button 
          className="toggle-chat-button"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          {showTranscript ? '📋 Скрыть чат' : '📋 Показать чат'}
        </button>
      </div>

      {/* Транскрипт (скрыт по умолчанию) */}
      {showTranscript && (
        <div className="transcript-wrapper">
          <TranscriptView transcript={transcript} isModelSpeaking={isModelSpeaking} />
        </div>
      )}
    </main>
  );
};

// Компонент выбора голоса
interface VoiceSelectorProps {
  value: Voice;
  onChange: (voice: Voice) => void;
  disabled?: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ value, onChange, disabled }) => (
  <div className="voice-selector">
    <label htmlFor="voice-select" className="voice-label">Голос:</label>
    <select
      id="voice-select"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as Voice)}
      disabled={disabled}
      className="voice-select"
    >
      {AVAILABLE_VOICES.map(voice => (
        <option key={voice} value={voice}>{VOICE_NAMES[voice]}</option>
      ))}
    </select>
  </div>
);

export default App;
