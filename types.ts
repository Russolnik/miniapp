// Типы для генерации изображений (обновлены по образцу gemini-image-chat)
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  ERROR = 'error',
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface UserMessage {
  role: MessageRole.USER;
  prompt: string;
  referenceImages: string[]; // base64 data URLs
}

export interface ModelMessage {
  role: MessageRole.MODEL;
  generatedImages: string[]; // base64 data URLs
}

export interface ErrorMessage {
  role: MessageRole.ERROR;
  content: string;
}

export type ChatMessage = UserMessage | ModelMessage | ErrorMessage;

// Старые типы для совместимости
export type Model = 'imagen-4.0-generate-001' | 'gemini-2.5-flash-image';
export type HistoryItem = UserMessage | ModelMessage;

// Типы для Live общения
export enum Speaker {
  USER = 'user',
  MODEL = 'model',
}

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
}
