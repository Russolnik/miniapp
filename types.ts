// Типы для генерации изображений
export type Model = 'imagen-4.0-generate-001' | 'gemini-2.5-flash-image';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface UserMessage {
  role: 'user';
  prompt: string;
  referenceImages?: { name: string; type: string }[];
}

export interface ModelMessage {
  role: 'model';
  imageUrl: string;
  mimeType: string;
}

export type HistoryItem = UserMessage | ModelMessage;

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Типы для Live общения
export enum Speaker {
  USER = 'user',
  MODEL = 'model',
}

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
}
