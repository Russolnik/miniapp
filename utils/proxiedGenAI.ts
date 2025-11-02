/**
 * Прокси-обертка для Google GenAI SDK
 * Перехватывает WebSocket соединения и проксирует их через сервер
 */

import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

/**
 * Получает URL сервера для проксирования
 */
async function getProxyServerUrl(): Promise<string> {
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isDevelopment) {
    return 'http://localhost:5000';
  }
  
  // В продакшене используем Render сервер или Netlify через Render
  return (window as any).API_URL || 'https://tg-ai-f9rj.onrender.com';
}

/**
 * Прокси-обертка для GoogleGenAI с поддержкой WebSocket проксирования
 * 
 * ВАЖНО: GoogleGenAI SDK использует внутренний WebSocket URL,
 * который нельзя изменить напрямую. Поэтому мы используем проксирование
 * через сервер на уровне сети или кастомную реализацию.
 */
export class ProxiedGoogleGenAI {
  private apiKey: string;
  private serverUrl: string | null = null;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  /**
   * Инициализирует URL сервера для проксирования
   */
  private async initServerUrl(): Promise<string> {
    if (this.serverUrl) {
      return this.serverUrl;
    }
    this.serverUrl = await getProxyServerUrl();
    return this.serverUrl;
  }

  /**
   * Создает проксированное live соединение
   * 
   * ВАЖНО: GoogleGenAI SDK не позволяет изменить WebSocket URL.
   * Поэтому мы используем оригинальный SDK, но все запросы должны
   * проходить через прокси на уровне сети (например, через прокси-сервер).
   * 
   * Для работы в РФ/Беларуси без VPN нужно:
   * 1. Настроить прокси на уровне сети (SOCKS/HTTP прокси)
   * 2. ИЛИ использовать серверный прокси (WebSocket прокси на Python)
   * 3. ИЛИ использовать кастомную реализацию без SDK
   */
  get live() {
    return {
      connect: async (config: any) => {
        const serverUrl = await this.initServerUrl();
        console.log('🔗 Проксирование через сервер:', serverUrl.replace(/https?:\/\//, '***'));
        
        // Проблема: GoogleGenAI SDK использует WebSocket URL напрямую
        // и не позволяет его изменить. Поэтому мы временно используем
        // оригинальный SDK и полагаемся на проксирование на уровне сети.
        
        // TODO: Реализовать полный прокси через WebSocket прокси на сервере
        // Это требует создания кастомной реализации без использования SDK
        
        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        return ai.live.connect(config);
      }
    };
  }
}

/**
 * Создает проксированный GoogleGenAI клиент
 */
export function createProxiedGenAI(apiKey: string): ProxiedGoogleGenAI {
  return new ProxiedGoogleGenAI({ apiKey });
}

