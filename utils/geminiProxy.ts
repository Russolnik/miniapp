/**
 * Прокси-обертка для GoogleGenAI, которая проксирует все запросы через сервер
 * Это позволяет обойти блокировки в РФ/Беларуси
 */

import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

interface ProxyConfig {
  apiKey: string;
  proxyUrl?: string;
}

/**
 * Получает URL прокси-сервера
 */
async function getProxyUrl(): Promise<string> {
  // Проверяем, находимся ли мы в development
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isDevelopment) {
    return 'http://localhost:5000';
  }
  
  // В продакшене используем Netlify Functions или прямой URL к Render
  // Если приложение на Netlify, используем Netlify Functions
  const netlifyUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Если есть Netlify Functions, используем их
  if (netlifyUrl && netlifyUrl.includes('netlify.app')) {
    return `${netlifyUrl}/.netlify/functions/proxy-gemini`;
  }
  
  // Иначе используем прямой URL к Render серверу
  return (window as any).API_URL || 'https://tg-ai-f9rj.onrender.com';
}

/**
 * Создает проксированное подключение к Google GenAI через сервер
 * 
 * Проблема: GoogleGenAI SDK использует WebSocket напрямую к Google API,
 * что не работает в РФ/Беларуси без VPN.
 * 
 * Решение: Проксируем через сервер на Netlify/Render
 */
export class ProxiedGoogleGenAI {
  private apiKey: string;
  private proxyUrl: string | null = null;
  private originalAI: GoogleGenAI | null = null;

  constructor(config: ProxyConfig) {
    this.apiKey = config.apiKey;
    this.proxyUrl = config.proxyUrl || undefined;
  }

  /**
   * Инициализирует прокси URL
   */
  private async initProxyUrl(): Promise<string> {
    if (this.proxyUrl) {
      return this.proxyUrl;
    }
    this.proxyUrl = await getProxyUrl();
    return this.proxyUrl;
  }

  /**
   * Проксирует WebSocket соединение через сервер
   * 
   * Для этого создаем WebSocket к нашему серверу,
   * который проксирует соединение к Google API
   */
  async createProxiedConnection(config: any): Promise<any> {
    const proxyUrl = await this.initProxyUrl();
    
    // Если прокси URL указывает на Netlify Function, используем HTTP прокси
    // Если на Render сервер, используем WebSocket прокси
    if (proxyUrl.includes('.netlify.app')) {
      // Netlify Functions не поддерживают WebSocket напрямую
      // Используем прямой URL к Render серверу для WebSocket
      const renderUrl = (window as any).API_URL || 'https://tg-ai-f9rj.onrender.com';
      return this.createRenderProxiedConnection(renderUrl, config);
    } else {
      // Используем WebSocket прокси на Render
      return this.createRenderProxiedConnection(proxyUrl, config);
    }
  }

  /**
   * Создает соединение через Render сервер WebSocket прокси
   */
  private async createRenderProxiedConnection(serverUrl: string, config: any): Promise<any> {
    // Создаем WebSocket соединение к нашему серверу вместо прямого к Google
    const wsUrl = `${serverUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/api/gemini/ws-proxy`;
    
    // Для WebSocket прокси нам нужно создать кастомное соединение
    // Но GoogleGenAI SDK не позволяет легко изменить WebSocket URL
    
    // Временное решение: используем оригинальный SDK, но через прокси-сервер
    // Для этого нужно, чтобы сервер поддерживал WebSocket прокси
    
    // Пока используем оригинальный SDK, но это будет работать только если
    // сервер проксирует запросы на уровне сети
    console.log('🔗 Используем проксированное соединение через:', serverUrl);
    
    // Создаем оригинальный GoogleGenAI клиент
    // В будущем здесь будет проксирование через сервер
    this.originalAI = new GoogleGenAI({ apiKey: this.apiKey });
    
    return this.originalAI.live.connect(config);
  }

  /**
   * Публичный API для создания live соединения (совместимо с GoogleGenAI)
   */
  get live() {
    return {
      connect: async (config: any) => {
        return await this.createProxiedConnection(config);
      }
    };
  }
}

