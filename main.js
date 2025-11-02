// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
let currentUser = null;
let userSubscription = null;

// Кэш для проверенного API URL (чтобы не проверять каждый раз)
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
        currentUser = {
            telegramId: null,
            firstName: 'Пользователь',
            username: null
        };
        updateUserUI(currentUser, null);
        return;
    }

    // Базовые данные из Telegram (используем как fallback)
    const telegramUsername = telegramUser.username;
    const telegramFirstName = telegramUser.first_name || 'Пользователь';

    // Начальные данные из Telegram (будут перезаписаны данными с сервера)
    currentUser = {
        telegramId: telegramId,
        firstName: telegramFirstName,
        username: telegramUsername || null,
        photoUrl: null // Будет получено с сервера
    };

    const apiUrl = await getApiUrl();
    
    try {
        // Загружаем данные пользователя с сервера (сервер получает их из Telegram при /start)
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
                // Используем данные с сервера (они получены при активации бота)
                currentUser = {
                    telegramId: userData.user.telegram_id,
                    firstName: userData.user.first_name || telegramFirstName,
                    username: userData.user.username || telegramUsername || null,
                    photoUrl: userData.user.photo_url || null
                };
                console.log('✅ Данные пользователя получены с сервера:', {
                    username: currentUser.username ? `@${currentUser.username}` : 'не указан',
                    firstName: currentUser.firstName,
                    hasPhoto: !!currentUser.photoUrl
                });
            } else {
                console.warn('⚠️ Пользователь не найден на сервере, используем данные Telegram');
            }
        } else {
            console.warn('⚠️ Ошибка получения данных с сервера, используем данные Telegram');
        }

        // Загружаем статус подписки с сервера
        const subResponse = await fetch(`${apiUrl}/api/user/subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                telegram_id: telegramId,
                username: username
            }),
        });

        if (subResponse.ok) {
            const subData = await subResponse.json();
            userSubscription = subData.has_subscription ? subData.subscription : null;
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки данных с сервера:', error);
        // Продолжаем с базовыми данными из Telegram
    }

    updateUserUI(currentUser, userSubscription);
}

// Обновление UI пользователя
function updateUserUI(user, subscription) {
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const subscriptionStatusEl = document.getElementById('subscription-status');

    if (userNameEl) {
        // Показываем только first_name (имя, например "Михаил", "Авигея")
        const displayName = user?.firstName || user?.first_name || 'Пользователь';
        userNameEl.textContent = displayName;
    }

    if (userAvatarEl) {
        // Если есть фото из Telegram, показываем его
        if (user?.photoUrl) {
            userAvatarEl.innerHTML = `<img src="${user.photoUrl}" alt="Аватар пользователя" class="user-avatar-img" />`;
            userAvatarEl.classList.add('has-photo');
        } else {
            // Иначе показываем первую букву имени или эмодзи
            const initial = user?.firstName?.[0]?.toUpperCase() || '👤';
            userAvatarEl.innerHTML = initial;
            userAvatarEl.classList.remove('has-photo');
        }
    }

    if (subscriptionStatusEl) {
        if (subscription && subscription.is_active) {
            const daysLeft = subscription.days_left || 0;
            subscriptionStatusEl.textContent = `💎 Подписка активна (${daysLeft} дн.)`;
            subscriptionStatusEl.className = 'subscription-status-text active';
        } else {
            subscriptionStatusEl.textContent = '✅ Все функции доступны';
            subscriptionStatusEl.className = 'subscription-status-text active';
        }
    }
}

// Переход на страницу Live - с плавной анимацией
function openLivePage() {
    // Добавляем класс для плавного перехода
    document.body.style.transition = 'opacity 0.2s ease-out';
    document.body.style.opacity = '0.95';
    
    // Небольшая задержка для плавности, затем переход
    setTimeout(() => {
        window.location.href = 'live.html';
    }, 50);
}

// Переход на страницу генерации
function openGenerationPage() {
    console.log('Переход на страницу генерации');
    window.location.href = 'generation.html';
}

// Показать страницу "О проекте"
function showAboutPage() {
    console.log('Переход на страницу "О проекте"');
    window.location.href = 'about.html';
}

// Делаем функции глобальными для доступа из HTML
window.openLivePage = openLivePage;
window.openGenerationPage = openGenerationPage;
window.showAboutPage = showAboutPage;

// Инициализация при загрузке
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

    // Загружаем данные пользователя с сервера
    await loadUserDataFromServer();
});
