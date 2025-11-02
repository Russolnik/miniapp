// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
let currentUser = null;
let currentChatId = null;
let uploadedImages = []; // Массив до 2 изображений
let chatMessages = []; // История сообщений в чате

// Кэш для проверенного API URL
let cachedApiUrl = null;
let apiUrlCheckPromise = null;

// Проверка доступности сервера
async function checkServerAvailable(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Таймаут 3 секунды
        
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
async function getApiUrl() {
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
        const productionUrl = window.API_URL || 'https://tg-ai-f9rj.onrender.com';
        const localUrl = 'http://localhost:5000';
        
        // Проверяем, находимся ли мы на localhost
        const isDevelopment = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1';
        
        // Маскируем URL в логах
        const maskUrl = (url) => url ? `***${url.slice(-15)}` : 'не установлен';
        console.log('🌐 Определение окружения:', {
            hostname: window.location.hostname,
            isDevelopment,
            apiUrlFromWindow: maskUrl(window.API_URL || ''),
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
            // В продакшне сначала проверяем локальный сервер (может быть доступен через туннель)
            console.log('🔍 Проверка доступности локального сервера (продакшен)...');
            try {
                const localAvailable = await checkServerAvailable(localUrl);
                if (localAvailable) {
                    console.log('✅ Локальный сервер доступен, используем его');
                    cachedApiUrl = localUrl;
                    return localUrl;
                }
            } catch (e) {
                // Игнорируем ошибки проверки локального сервера
            }
            
            // В продакшне используем production URL
            const maskedProdUrl = `***${productionUrl.slice(-15)}`;
            console.log('🚀 Продакшен окружение, используем API URL:', maskedProdUrl);
            cachedApiUrl = productionUrl;
            return productionUrl;
        }
    })();
    
    return await apiUrlCheckPromise;
}

// Загрузка данных пользователя с сервера
async function loadUserDataFromServer() {
    // Получаем telegram_id из Telegram WebApp
    let telegramId = null;
    let telegramUser = null;
    
    if (tg?.initDataUnsafe?.user) {
        // Используем данные из initDataUnsafe (основной способ)
        telegramUser = tg.initDataUnsafe.user;
        telegramId = telegramUser.id;
    } else if (tg?.initData) {
        // Если initDataUnsafe не доступен, пробуем парсить initData
        try {
            const urlParams = new URLSearchParams(tg.initData);
            const userStr = urlParams.get('user');
            if (userStr) {
                telegramUser = JSON.parse(userStr);
                telegramId = telegramUser.id || null;
            }
        } catch (e) {
            console.warn('Не удалось распарсить initData:', e);
        }
    }
    
    if (!telegramId || !telegramUser) {
        console.error('❌ Данные пользователя Telegram не найдены');
        return;
    }

    const username = telegramUser.username;
    // Получаем фото пользователя (публичный аватар)
    const photoUrl = telegramUser.photo_url || null;

    currentUser = {
        telegramId: telegramId,
        firstName: telegramUser.first_name || 'Пользователь',
        username: username || null,
        photoUrl: photoUrl || null
    };

    const apiUrl = await getApiUrl();
    
    try {
        // Загружаем данные пользователя с сервера
        const userResponse = await fetch(`${apiUrl}/api/user/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ telegram_id: telegramId }),
        });

        if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.user) {
                currentUser = {
                    ...currentUser,
                    ...userData.user
                };
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных с сервера:', error);
    }
}

// Обработка загрузки изображений
function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    const remainingSlots = 2 - uploadedImages.length;
    
    if (remainingSlots === 0) {
        alert('Можно прикрепить максимум 2 изображения');
        event.target.value = '';
        return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
        if (uploadedImages.length >= 2) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = {
                id: Date.now() + Math.random(),
                file: file,
                dataUrl: e.target.result,
                base64: e.target.result.split(',')[1]
            };
            
            uploadedImages.push(imageData);
            updateImagesPreview();
        };
        reader.readAsDataURL(file);
    });
    
    // Сбрасываем input для возможности загрузить те же файлы снова
    event.target.value = '';
}

// Обновить превью изображений
function updateImagesPreview() {
    const previewContainer = document.getElementById('images-preview');
    previewContainer.innerHTML = '';
    
    if (uploadedImages.length === 0) {
        previewContainer.style.display = 'none';
        return;
    }
    
    previewContainer.style.display = 'flex';
    
    uploadedImages.forEach((imageData, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview-item';
        previewDiv.innerHTML = `
            <img src="${imageData.dataUrl}" alt="Превью ${index + 1}">
            <button class="remove-preview-btn" onclick="removeImage(${index})">✕</button>
        `;
        previewContainer.appendChild(previewDiv);
    });
}

// Удалить изображение
function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImagesPreview();
}

// Генерация изображения
async function generateImage() {
    const promptInput = document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();

    if (!prompt && uploadedImages.length === 0) {
        alert('Введите описание изображения или загрузите изображение');
        return;
    }

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = true;
    generateBtn.textContent = '✨ Генерирую...';

    try {
        // Показываем запрос пользователя в чате
        const userPrompt = prompt || (uploadedImages.length > 0 ? 'Генерация на основе изображения' : '');
        addChatMessage('user', userPrompt, uploadedImages.length > 0 ? uploadedImages.map(img => img.dataUrl) : null);

        // Сохраняем запрос через сервер
        try {
            const apiUrl = await getApiUrl();
            await fetch(`${apiUrl}/api/chat/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    telegram_id: currentUser?.telegramId,
                    chat_type: 'generation',
                    role: 'user',
                    content: userPrompt,
                    context_type: 'generation_request'
                })
            });
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить запрос:', error);
        }

        // Показываем индикатор загрузки
        const loadingId = addChatMessage('model', 'Генерирую изображение...', null, true);

        try {
            // Подготавливаем данные для отправки
            const imagesBase64 = uploadedImages.map(img => img.base64);
            
            // Получаем API URL сервера
            const apiUrl = await getApiUrl();
            
            // Маскируем telegram_id в логах
            const maskedTelegramId = currentUser?.telegramId ? `***${String(currentUser.telegramId).slice(-4)}` : 'неизвестен';
            console.log('📤 Отправка запроса генерации для пользователя:', maskedTelegramId);
            
            // Отправляем запрос на сервер
            const response = await fetch(`${apiUrl}/api/gemini/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    telegram_id: currentUser?.telegramId,
                    prompt: userPrompt,
                    images: imagesBase64
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Удаляем индикатор загрузки
            removeChatMessage(loadingId);
            
            // Преобразуем base64 изображение в data URL
            let generatedImageUrl = null;
            if (data.image) {
                generatedImageUrl = `data:image/png;base64,${data.image}`;
            }
            
            const responseText = data.text || 'Изображение готово!';
            
            // Показываем результат в чате
            addChatMessage('model', responseText, generatedImageUrl);

            // Сохраняем ответ через сервер
            try {
                const apiUrl = await getApiUrl();
                const imagePart = generatedImageUrl ? `[IMAGE]${generatedImageUrl}[/IMAGE]` : '';
                const saveResponse = await fetch(`${apiUrl}/api/chat/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        telegram_id: currentUser?.telegramId,
                        chat_type: 'generation',
                        role: 'model',
                        content: `${imagePart}${responseText}`,
                        context_type: 'generation_response'
                    })
                });
                
                if (saveResponse.ok) {
                    const saveData = await saveResponse.json();
                    if (saveData.chat_id) {
                        currentChatId = saveData.chat_id;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось сохранить ответ:', error);
            }

            // Сбрасываем форму
            promptInput.value = '';
            uploadedImages = [];
            updateImagesPreview();
            
        } catch (error) {
            // Удаляем индикатор загрузки при ошибке
            removeChatMessage(loadingId);
            throw error; // Пробрасываем ошибку дальше
        }

    } catch (error) {
        console.error('❌ Ошибка генерации:', error);
        addChatMessage('error', 'Ошибка при генерации изображения. Попробуйте снова.', null);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ Сгенерировать';
    }
}

// Добавить сообщение в чат
function addChatMessage(role, text, images, isTemporary = false) {
    const container = document.getElementById('chat-container');
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `chat-message ${role} ${isTemporary ? 'temporary' : ''}`;
    
    let content = '';
    
    if (role === 'user') {
        content = `<div class="message-text">${text}</div>`;
        if (images && images.length > 0) {
            content += '<div class="message-images">';
            images.forEach(imgUrl => {
                content += `<img src="${imgUrl}" alt="Прикрепленное изображение" class="attached-image">`;
            });
            content += '</div>';
        }
    } else if (role === 'model') {
        content = `<div class="message-text">${text}</div>`;
        if (images) {
            const imgUrl = Array.isArray(images) ? images[0] : images;
            content += `
                <div class="generated-image-wrapper">
                    <img src="${imgUrl}" alt="Сгенерированное изображение" class="generated-image-small" onclick="openImageModal('${imgUrl}')">
                    <button class="image-download-btn" onclick="downloadImage('${imgUrl}')" title="Скачать">💾</button>
                </div>
            `;
        }
    } else if (role === 'error') {
        content = `<div class="message-text error">${text}</div>`;
    }
    
    messageDiv.innerHTML = content;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    if (!isTemporary) {
        chatMessages.push({ id: messageId, role, text, images });
    }
    
    return messageId;
}

// Удалить временное сообщение
function removeChatMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// Открыть модальное окно с изображением
function openImageModal(imageUrl) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = imageUrl;
    modal.style.display = 'flex';
    modal.dataset.imageUrl = imageUrl;
}

// Закрыть модальное окно
function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.style.display = 'none';
}

// Скачать изображение из модального окна
function downloadModalImage() {
    const modal = document.getElementById('image-modal');
    const imageUrl = modal.dataset.imageUrl;
    if (imageUrl) {
        downloadImage(imageUrl);
    }
}

// Скачать изображение
function downloadImage(imageUrl) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-${Date.now()}.png`;
    link.click();
}

// Вернуться назад
function goBack() {
    window.location.href = 'main.html';
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (tg) {
        tg.ready();
        tg.expand();
        // setHeaderColor и setBackgroundColor не поддерживаются в версии 6.0+
        try {
            if (typeof tg.setHeaderColor === 'function') {
                tg.setHeaderColor('#81D4FA');
            }
        } catch (e) {}
        try {
            if (typeof tg.setBackgroundColor === 'function') {
                tg.setBackgroundColor('#F5F5F0');
            }
        } catch (e) {}
    }

    await loadUserDataFromServer();
});
