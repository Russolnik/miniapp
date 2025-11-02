import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { HistoryItem, Model, AspectRatio, UserMessage, ModelMessage } from './types';
import { fileToBase64 } from './utils/fileUtils';
import Spinner from './components/shared/Spinner';
import ImageModal from './components/ImageModal';
import './App.css';

// Получение API ключа (аналогично App.tsx для Live)
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

const RobotIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3m0-10V6a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6m-6 3h6m0 3H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const PaperclipIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>;
const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const PaperPlaneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>;


const GenerationApp: React.FC = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [prompt, setPrompt] = useState<string>('');
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    const [model, setModel] = useState<Model>('imagen-4.0-generate-001');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
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
    }, [history, loading]);
    
    useEffect(() => {
        if (referenceImages.length > 0) {
            setModel('gemini-2.5-flash-image');
        }
    }, [referenceImages]);

    const downloadImage = (base64Image: string, fileName: string = 'generated-image.png') => {
        const link = document.createElement('a');
        link.href = base64Image;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Пожалуйста, введите промпт.');
            return;
        }
        if (!apiKey) {
            setError('API ключ не найден. Пожалуйста, обновите страницу.');
            return;
        }
        setLoading(true);
        setError('');

        const userMessage: UserMessage = {
            role: 'user',
            prompt,
            referenceImages: referenceImages.map(f => ({ name: f.name, type: f.type })),
        };
        setHistory(prev => [...prev, userMessage]);

        try {
            let imageUrl: string = '';
            let mimeType: string = 'image/png';

            // Используем прямое подключение к GoogleGenAI
            const ai = new GoogleGenAI({ apiKey });
            
            if (model === 'imagen-4.0-generate-001') {
                 if (referenceImages.length > 0) throw new Error("Imagen-4 не поддерживает референсные изображения. Пожалуйста, удалите их или переключитесь на Gemini Flash Image.");
                console.log('🔗 Использую прямое подключение к Imagen 4');
                const response = await ai.generateImages({
                    model,
                    prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/png',
                        aspectRatio,
                    },
                });
                imageUrl = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
            } else {
                // gemini-2.5-flash-image - прямое подключение
                console.log('🔗 Использую прямое подключение к Gemini Flash Image');
                const imageParts = await Promise.all(referenceImages.map(async (file) => ({
                    inlineData: { data: await fileToBase64(file), mimeType: file.type },
                })));

                const response = await ai.generateContent({
                    model,
                    contents: [{ parts: [{ text: prompt }, ...imageParts] }],
                    config: { responseModalities: [Modality.IMAGE] },
                });
                
                const part = response.candidates?.[0]?.content?.parts?.[0];
                if (part && 'inlineData' in part && part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    mimeType = part.inlineData.mimeType;
                } else {
                    throw new Error('Изображение не получено от API.');
                }
            }
            
            const modelMessage: ModelMessage = { role: 'model', imageUrl, mimeType };
            setHistory(prev => [...prev, modelMessage]);

        } catch (err: any) {
            console.error('Ошибка генерации:', err);
            let errorMessage = 'Не удалось сгенерировать изображение. Попробуйте снова.';
            
            // Извлекаем сообщение об ошибке из разных структур ответа
            const errorStr = JSON.stringify(err);
            const errorMsg = err.message || err.error?.message || err.toString() || '';
            
            // Обработка специфичных ошибок - только если используется Imagen
            if (model === 'imagen-4.0-generate-001') {
                if (errorMsg.includes('Imagen API is only accessible to billed users') || 
                    errorStr.includes('Imagen API is only accessible to billed users') ||
                    (err.error?.code === 400 && err.error?.message?.includes('Imagen API'))) {
                    errorMessage = 'Imagen 4 доступен только для платных пользователей Google Cloud. Пожалуйста, переключитесь на модель "Gemini Flash Image" (она бесплатна).';
                } else if (errorMsg.includes('429') || errorStr.includes('429') || err.error?.code === 429) {
                    errorMessage = 'Превышен лимит запросов для Imagen 4. Пожалуйста, подождите немного и попробуйте снова, или переключитесь на "Gemini Flash Image".';
                } else if (errorMsg) {
                    errorMessage = errorMsg;
                }
            } else {
                // Для Gemini Flash Image - только ошибки квоты
                if (errorMsg.includes('429') || errorStr.includes('429') || err.error?.code === 429) {
                    errorMessage = 'Превышен лимит запросов для Gemini Flash Image. Пожалуйста, подождите немного и попробуйте снова.';
                } else if (errorMsg) {
                    errorMessage = errorMsg;
                }
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
            setPrompt('');
            setReferenceImages([]);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const files = Array.from(event.target.files).slice(0, 3);
            setReferenceImages(files);
        }
    };

    const removeReferenceImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const goBack = () => {
        window.location.href = 'main.html';
    };

    if (apiKeyLoading) {
        return (
            <div className="generation-app-container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                    <Spinner size="lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="generation-app-container">
            {/* Заголовок с кнопкой назад */}
            <header className="generation-header">
                <button className="back-button" onClick={goBack}>← Назад</button>
                <h1 className="generation-title">🎨 Генерация изображений</h1>
                <div className="header-spacer"></div>
            </header>

            {/* Основной контент - полностью как в оригинале */}
            <div className="flex relative h-full" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div className="flex-1 flex flex-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {history.map((item, index) => (
                            item.role === 'user' ? (
                                <div key={index} className="flex justify-end" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <div className="bg-cyan-600 text-white rounded-lg p-3 max-w-lg" style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)', color: 'white', borderRadius: '12px', padding: '12px 16px', maxWidth: '85%' }}>
                                        <p>{item.prompt}</p>
                                        {item.referenceImages && item.referenceImages.length > 0 && (
                                            <div className="text-sm mt-2 text-cyan-200" style={{ fontSize: '12px', marginTop: '8px', opacity: 0.9 }}>
                                                Прикреплено: {item.referenceImages.map(f => f.name).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div key={index} className="flex justify-start" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <div className="bg-gray-700 rounded-lg p-3 max-w-lg" style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 16px', maxWidth: '85%', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
                                        <div className="relative group" style={{ position: 'relative' }}>
                                            <img src={item.imageUrl} alt="Generated image" className="rounded-md max-w-full h-auto" style={{ borderRadius: '8px', maxWidth: '100%', height: 'auto', display: 'block' }} />
                                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', opacity: 0, transition: 'opacity 0.2s', borderRadius: '8px' }}>
                                                <button onClick={() => setSelectedImage(item.imageUrl)} className="flex items-center bg-gray-800 text-white py-1 px-3 rounded-md hover:bg-gray-900" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.9)', color: '#333', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                                                    <ViewIcon /> Полный экран
                                                </button>
                                                <button onClick={() => downloadImage(item.imageUrl)} className="flex items-center bg-gray-800 text-white py-1 px-3 rounded-md hover:bg-gray-900" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.9)', color: '#333', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                                                    <DownloadIcon /> Скачать
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                        {loading && <div className="flex justify-start" style={{ display: 'flex', justifyContent: 'flex-start' }}><div className="bg-gray-700 rounded-lg p-3" style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 16px' }}><Spinner/></div></div>}
                        {error && <div className="flex justify-center" style={{ display: 'flex', justifyContent: 'center' }}><p className="text-red-400 bg-red-900/50 p-3 rounded-lg" style={{ color: '#c62828', background: '#ffebee', padding: '12px 16px', borderRadius: '8px' }}>{error}</p></div>}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-gray-700" style={{ padding: '20px', borderTop: '1px solid rgba(0, 0, 0, 0.1)', background: '#ffffff' }}>
                        {referenceImages.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2" style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {referenceImages.map((file, index) => (
                                    <div key={index} className="relative bg-gray-600 p-1 rounded-md" style={{ position: 'relative', background: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
                                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-16 w-16 object-cover rounded" style={{ height: '64px', width: '64px', objectFit: 'cover', borderRadius: '4px' }} />
                                        <button onClick={() => removeReferenceImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 text-xs flex items-center justify-center" style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#f44336', color: 'white', borderRadius: '50%', width: '24px', height: '24px', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2 relative" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', position: 'relative' }}>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" style={{ display: 'none' }} />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-gray-600" title="Прикрепить до 3 изображений" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(79, 195, 247, 0.1)', border: '1px solid rgba(79, 195, 247, 0.3)', color: '#4FC3F7', cursor: 'pointer', fontSize: '20px', flexShrink: 0 }}>
                                <PaperclipIcon />
                            </button>
                            
                            <div className="relative" style={{ position: 'relative' }}>
                               <button onClick={() => setShowModelSelector(!showModelSelector)} className="p-2 rounded-full hover:bg-gray-600" title="Выбрать модель" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(79, 195, 247, 0.1)', border: '1px solid rgba(79, 195, 247, 0.3)', color: '#4FC3F7', cursor: 'pointer', fontSize: '20px', flexShrink: 0 }}>
                                   <RobotIcon />
                               </button>
                               {showModelSelector && (
                                    <div className="absolute bottom-full mb-2 w-64 bg-gray-600 rounded-lg shadow-lg p-2 z-10" style={{ position: 'absolute', bottom: '100%', marginBottom: '8px', width: '250px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', padding: '16px', zIndex: 100 }}>
                                       <label className="block text-sm font-bold text-gray-300 mb-1" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#757575', marginBottom: '8px' }}>Модель</label>
                                        <select value={model} onChange={(e) => setModel(e.target.value as Model)} className="w-full bg-gray-700 border border-gray-500 rounded p-1" disabled={referenceImages.length > 0} style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(0, 0, 0, 0.1)', borderRadius: '8px', background: '#f9f9f9', color: '#333', fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}>
                                            <option value="imagen-4.0-generate-001">Imagen 4 (Высокое качество)</option>
                                            <option value="gemini-2.5-flash-image">Gemini Flash Image (Универсальная)</option>
                                        </select>
                                        {model === 'imagen-4.0-generate-001' && (
                                           <div className="mt-2" style={{ marginTop: '12px' }}>
                                               <label className="block text-sm font-bold text-gray-300 mb-1" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#757575', marginBottom: '8px' }}>Соотношение сторон</label>
                                               <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-gray-700 border border-gray-500 rounded p-1" style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(0, 0, 0, 0.1)', borderRadius: '8px', background: '#f9f9f9', color: '#333', fontSize: '14px', cursor: 'pointer' }}>
                                                   <option value="1:1">1:1 (Квадрат)</option>
                                                   <option value="16:9">16:9 (Альбомная)</option>
                                                   <option value="9:16">9:16 (Портретная)</option>
                                                   <option value="4:3">4:3</option>
                                                   <option value="3:4">3:4</option>
                                               </select>
                                           </div>
                                        )}
                                        {referenceImages.length > 0 && <p className="text-xs text-yellow-400 mt-2" style={{ fontSize: '11px', color: '#ff9800', marginTop: '8px', padding: '8px', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '6px' }}>Модель переключена на Gemini Flash Image для поддержки референсных изображений.</p>}
                                    </div>
                                )}
                            </div>
                            
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Введите промпт..."
                                onKeyPress={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                                className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                style={{ flex: 1, minWidth: 0, padding: '12px 16px', border: '1px solid rgba(0, 0, 0, 0.1)', borderRadius: '12px', fontSize: '14px', fontFamily: 'inherit', background: '#f9f9f9' }}
                            />
                            <button 
                                onClick={handleGenerate} 
                                disabled={loading} 
                                className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg disabled:opacity-50 flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)', border: 'none', color: 'white', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', flexShrink: 0, transition: 'all 0.2s', minWidth: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {loading ? 
                                    <Spinner size="sm" colorClass="#ffffff" /> : 
                                    <span>Генерировать</span>
                                }
                            </button>
                        </div>
                    </div>
                </div>

                <button onClick={() => setShowHistory(!showHistory)} className="absolute top-0 right-0 m-2 bg-gray-700 hover:bg-gray-600 p-2 rounded-lg text-sm" style={{ position: 'absolute', top: '80px', right: '20px', background: 'rgba(79, 195, 247, 0.1)', border: '1px solid rgba(79, 195, 247, 0.3)', color: '#4FC3F7', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>
                    История
                </button>
                <div className={`transition-all duration-300 ease-in-out bg-gray-900 border-l border-gray-700 overflow-y-auto ${showHistory ? 'w-1/3' : 'w-0'}`} style={{ transition: 'all 0.3s ease-in-out', background: '#f5f5f5', borderLeft: '1px solid rgba(0, 0, 0, 0.1)', overflowY: 'auto', width: showHistory ? '33%' : '0', overflow: 'hidden' }}>
                    <div className="p-4" style={{ padding: '16px' }}>
                        <h3 className="text-lg font-bold mb-2" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>История генераций (JSON)</h3>
                        <pre className="text-xs whitespace-pre-wrap break-all" style={{ fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(history, null, 2)}</pre>
                    </div>
                </div>
            </div>
            {selectedImage && <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} onDownload={() => downloadImage(selectedImage)} />}
        </div>
    );
};

export default GenerationApp;
