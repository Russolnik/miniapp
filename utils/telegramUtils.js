/**
 * Утилиты для работы с Telegram WebApp
 */

/**
 * Инициализация Telegram WebApp с ожиданием загрузки
 * @returns {Promise<Telegram.WebApp | null>}
 */
export function initTelegramWebApp() {
    return new Promise((resolve) => {
        // Проверяем, доступен ли уже Telegram.WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            resolve(tg);
            return;
        }
        
        // Ждем загрузки Telegram WebApp SDK
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд максимум
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
                clearInterval(checkInterval);
                resolve(tg);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('⚠️ Telegram WebApp не загружен после ожидания');
                resolve(null);
            }
        }, 100);
    });
}

/**
 * Получение Telegram ID из различных источников
 * @param {Telegram.WebApp} webApp - Экземпляр Telegram WebApp
 * @returns {{telegramId: number | null, telegramUser: object | null}}
 */
export function getTelegramIdFromWebApp(webApp) {
    let telegramId = null;
    let telegramUser = null;
    
    if (!webApp) {
        return { telegramId: null, telegramUser: null };
    }
    
    // Способ 1: initDataUnsafe.user (основной способ)
    if (webApp.initDataUnsafe?.user) {
        telegramUser = webApp.initDataUnsafe.user;
        telegramId = telegramUser.id || telegramUser.user_id || telegramUser.userId;
        
        // Преобразуем в число если строка
        if (telegramId && typeof telegramId === 'string') {
            const parsedId = parseInt(telegramId, 10);
            if (!isNaN(parsedId)) {
                telegramId = parsedId;
            }
        }
        
        if (telegramId && typeof telegramId === 'number') {
            console.log('✅ Telegram ID получен из initDataUnsafe.user:', `***${String(telegramId).slice(-4)}`);
            return { telegramId, telegramUser };
        }
    }
    
    // Способ 2: Парсинг initData
    if (!telegramId && webApp.initData) {
        try {
            const params = new URLSearchParams(webApp.initData);
            const userParam = params.get('user');
            
            if (userParam) {
                telegramUser = JSON.parse(decodeURIComponent(userParam));
                telegramId = telegramUser.id;
                
                if (telegramId) {
                    console.log('✅ Telegram ID получен из initData:', `***${String(telegramId).slice(-4)}`);
                    return { telegramId, telegramUser };
                }
            }
        } catch (e) {
            console.warn('⚠️ Ошибка парсинга initData:', e);
        }
    }
    
    // Способ 3: Альтернативный парсинг initData
    if (!telegramId && webApp.initData) {
        try {
            const userMatch = webApp.initData.match(/user=([^&]+)/);
            if (userMatch && userMatch[1]) {
                telegramUser = JSON.parse(decodeURIComponent(userMatch[1]));
                telegramId = telegramUser.id;
                
                if (telegramId) {
                    console.log('✅ Telegram ID получен из альтернативного парсинга:', `***${String(telegramId).slice(-4)}`);
                    return { telegramId, telegramUser };
                }
            }
        } catch (e) {
            console.warn('⚠️ Ошибка альтернативного парсинга:', e);
        }
    }
    
    return { telegramId: null, telegramUser: null };
}

/**
 * Получение Telegram ID из URL параметров
 * @returns {number | null}
 */
export function getTelegramIdFromUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTelegramId = urlParams.get('tg_id') || 
                             urlParams.get('telegram_id') || 
                             urlParams.get('user_id');
        
        if (urlTelegramId) {
            const parsedId = parseInt(urlTelegramId, 10);
            // Telegram ID обычно больше 100000000 (9 цифр)
            if (!isNaN(parsedId) && parsedId > 100000000 && parsedId < 999999999999999) {
                console.log('✅ Telegram ID получен из URL:', `***${String(parsedId).slice(-4)}`);
                return parsedId;
            }
        }
    } catch (e) {
        console.warn('⚠️ Ошибка получения ID из URL:', e);
    }
    
    return null;
}

