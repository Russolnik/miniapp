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
    
    // Сначала пробуем localhost
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
    }
    
    // Если localhost недоступен, используем продакшн
    console.log('🌐 Локальный сервер недоступен, используем продакшн:', productionUrl.replace(/https?:\/\/([^.]+).*/, '***$1'));
    return productionUrl;
}

