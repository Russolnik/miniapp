/**
 * Утилиты для работы с API
 */

let cachedApiUrl = null;
let apiUrlCheckPromise = null;

/**
 * Проверка доступности сервера
 * @param {string} url - URL сервера
 * @returns {Promise<boolean>}
 */
export async function checkServerAvailable(url) {
    try {
        // Не проверяем localhost если мы на продакшн домене (HTTPS)
        // Это вызывает CORS ошибку "unknown address space"
        if (window.location.protocol === 'https:' && url.startsWith('http://localhost')) {
            console.log('⚠️ Пропускаем проверку localhost на HTTPS сайте (CORS ограничение браузера)');
            return false;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Таймаут 2 секунды
        
        const response = await fetch(`${url}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        // CORS ошибка для localhost - это нормально на HTTPS сайте
        if (url.startsWith('http://localhost') && (error.name === 'TypeError' || error.message.includes('CORS'))) {
            console.log('⚠️ CORS ошибка для localhost (это нормально на HTTPS сайте)');
        }
        return false;
    }
}

/**
 * Получение API URL сервера с проверкой доступности (приоритет localhost)
 * @returns {Promise<string>}
 */
export async function getApiUrl() {
    // Если уже проверен - возвращаем кэшированный URL
    if (cachedApiUrl) {
        return cachedApiUrl;
    }
    
    // Если проверка уже идет - ждем её
    if (apiUrlCheckPromise) {
        return await apiUrlCheckPromise;
    }
    
    // Начинаем проверку - ВСЕГДА сначала пробуем localhost, потом production
    apiUrlCheckPromise = (async () => {
        const productionUrl = window.API_URL || 'https://tg-ai-f9rj.onrender.com';
        const localUrl = 'http://localhost:5000';
        
        // Маскируем URL в логах
        const maskUrl = (url) => url ? `***${url.slice(-15)}` : 'не установлен';
        console.log('🌐 Определение API сервера (сначала проверяем localhost)...');
        
        // ВСЕГДА сначала проверяем локальный сервер (для удобства разработки)
        // Но только если мы не на HTTPS сайте (CORS ограничение браузера)
        if (window.location.protocol === 'http:' || window.location.hostname === 'localhost') {
            console.log('🔍 Проверка доступности локального сервера (localhost:5000)...');
            try {
                const localAvailable = await checkServerAvailable(localUrl);
                if (localAvailable) {
                    console.log('✅ Локальный сервер доступен, используем его для разработки');
                    cachedApiUrl = localUrl;
                    return localUrl;
                } else {
                    console.log('⚠️ Локальный сервер недоступен');
                }
            } catch (e) {
                console.log('⚠️ Ошибка проверки локального сервера:', e.message);
            }
        } else {
            console.log('ℹ️ Пропуск проверки localhost (на HTTPS сайте это вызывает CORS ошибку)');
        }
        
        // Если локальный сервер недоступен, используем production
        const maskedProdUrl = maskUrl(productionUrl);
        console.log('🚀 Используем продакшн API URL:', maskedProdUrl);
        cachedApiUrl = productionUrl;
        return productionUrl;
    })();
    
    return await apiUrlCheckPromise;
}

/**
 * Получение API URL с проверкой localhost (без кэширования)
 * @returns {Promise<string>}
 */
export async function getApiUrlWithLocalhostCheck() {
    const productionUrl = window.API_URL || 'https://tg-ai-f9rj.onrender.com';
    const localUrl = 'http://localhost:5000';
    
    // Пропускаем проверку localhost если мы на HTTPS сайте (CORS ограничение браузера)
    if (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')) {
        console.log('ℹ️ Пропуск проверки localhost на HTTPS сайте (CORS ограничение браузера)');
        return productionUrl;
    }
    
    // Сначала пробуем localhost (только для HTTP или локальной разработки)
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
        );
        const localhostCheck = await Promise.race([
            fetch(`${localUrl}/health`, { method: 'GET' }),
            timeoutPromise
        ]);
        
        if (localhostCheck.ok) {
            console.log('🌐 Используем локальный сервер (localhost:5000)');
            return localUrl;
        }
    } catch (e) {
        // Игнорируем ошибки, переходим к продакшн
        if (e.name === 'TypeError' || e.message?.includes('CORS')) {
            console.log('⚠️ CORS ошибка для localhost (это нормально на HTTPS сайте)');
        }
    }
    
    // Если localhost недоступен, используем продакшн
    console.log('🌐 Локальный сервер недоступен, используем продакшн:', productionUrl.replace(/https?:\/\/([^.]+).*/, '***$1'));
    return productionUrl;
}

