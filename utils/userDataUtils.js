/**
 * Утилиты для получения данных пользователя
 */

import { getApiUrlWithLocalhostCheck, getApiUrl } from './apiUtils.js';

/**
 * Получение URL аватара пользователя
 * Если photo_url - это путь сервера, преобразуем в полный URL
 * @param {string | null} photoUrl - photo_url из ответа сервера
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<string | null>}
 */
export async function getAvatarUrl(photoUrl, telegramId) {
    if (!photoUrl && telegramId) {
        // Если photo_url нет, но есть telegram_id, пробуем получить через endpoint
        try {
            const apiUrl = await getApiUrl();
            return `${apiUrl}/api/avatar/${telegramId}`;
        } catch (e) {
            console.warn('⚠️ Ошибка получения URL аватара:', e);
            return null;
        }
    }
    
    if (!photoUrl) {
        return null;
    }
    
    // Если это путь сервера (/api/avatar/...), преобразуем в полный URL
    if (photoUrl.startsWith('/api/avatar/')) {
        try {
            const apiUrl = await getApiUrl();
            return `${apiUrl}${photoUrl}`;
        } catch (e) {
            console.warn('⚠️ Ошибка преобразования пути аватара:', e);
            return photoUrl;
        }
    }
    
    // Если это полный URL (Telegram CDN), возвращаем как есть (но лучше использовать серверный)
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
        // Можно также преобразовать в серверный URL если есть telegramId
        if (telegramId) {
            try {
                const apiUrl = await getApiUrl();
                return `${apiUrl}/api/avatar/${telegramId}`;
            } catch (e) {
                // Fallback на исходный URL
                return photoUrl;
            }
        }
        return photoUrl;
    }
    
    return photoUrl;
}

/**
 * Загрузка данных пользователя по telegram_id через GET запрос
 * @param {number} telegramId - Telegram ID пользователя
 * @returns {Promise<object | null>}
 */
export async function fetchUserDataByTelegramId(telegramId) {
    if (!telegramId) {
        return null;
    }
    
    try {
        const apiUrl = await getApiUrlWithLocalhostCheck();
        
        const statusResponse = await fetch(`${apiUrl}/api/user/status?telegram_id=${telegramId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.user) {
                console.log('✅ Данные пользователя получены через GET запрос:', `***${String(telegramId).slice(-4)}`);
                return statusData;
            }
        }
    } catch (e) {
        console.warn('⚠️ Ошибка получения данных через GET запрос:', e);
    }
    
    return null;
}

/**
 * Загрузка полных данных пользователя с подпиской
 * @param {number} telegramId - Telegram ID пользователя
 * @param {string | null} initData - initData для валидации (опционально)
 * @returns {Promise<object | null>}
 */
export async function fetchFullUserData(telegramId, initData = null) {
    if (!telegramId) {
        return null;
    }
    
    try {
        const apiUrl = await getApiUrlWithLocalhostCheck();
        
        const statusResponse = await fetch(`${apiUrl}/api/user/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                telegram_id: telegramId,
                initData: initData
            }),
        });
        
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('✅ Полные данные пользователя получены:', `***${String(telegramId).slice(-4)}`);
            return statusData;
        } else {
            const errorText = await statusResponse.text().catch(() => 'Unknown error');
            console.warn('⚠️ Ошибка ответа сервера:', statusResponse.status, errorText);
        }
    } catch (e) {
        console.error('❌ Ошибка загрузки полных данных:', e);
    }
    
    return null;
}

/**
 * Получение Telegram ID и данных пользователя через сервер с валидацией initData
 * @param {string} initData - initData от Telegram WebApp
 * @returns {Promise<{telegramId: number | null, telegramUser: object | null}>}
 */
export async function getTelegramIdFromServer(initData) {
    if (!initData || initData.length === 0) {
        return { telegramId: null, telegramUser: null };
    }
    
    try {
        const apiUrl = await getApiUrlWithLocalhostCheck();
        
        const statusResponse = await fetch(`${apiUrl}/api/user/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                initData: initData
            }),
        });
        
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.user && statusData.user.telegram_id) {
                const telegramId = statusData.user.telegram_id;
                const telegramUser = {
                    id: telegramId,
                    first_name: statusData.user.first_name || 'Пользователь',
                    username: statusData.user.username || null,
                    photo_url: statusData.user.photo_url || null
                };
                
                console.log('✅ Telegram ID получен через сервер:', `***${String(telegramId).slice(-4)}`);
                return { telegramId, telegramUser };
            }
        }
    } catch (e) {
        console.error('❌ Ошибка получения ID через сервер:', e);
    }
    
    return { telegramId: null, telegramUser: null };
}

