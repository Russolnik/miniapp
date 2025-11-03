/**
 * Утилиты для получения данных пользователя
 */

import { getApiUrlWithLocalhostCheck } from './apiUtils.js';

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

