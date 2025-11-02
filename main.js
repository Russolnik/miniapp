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

// Загрузка данных пользователя с сервера (обновленная версия с initData)
async function loadUserDataFromServer() {
    // Получаем telegram_id и initData из Telegram WebApp
    let telegramId = null;
    let telegramUser = null;
    let initData = null;
    
    if (tg?.initDataUnsafe?.user) {
        // Используем данные из initDataUnsafe (основной способ)
        telegramUser = tg.initDataUnsafe.user;
        telegramId = telegramUser.id;
    } else if (tg?.initData) {
        // Если initDataUnsafe не доступен, пробуем парсить initData
        initData = tg.initData;
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
            username: null,
            photoUrl: null
        };
        updateUserUI(currentUser, null);
        return;
    }

    // Базовые данные из Telegram (используем как fallback)
    const telegramUsername = telegramUser.username;
    const telegramFirstName = telegramUser.first_name || 'Пользователь';
    const telegramPhotoUrl = telegramUser.photo_url || null;

    // Начальные данные из Telegram (будут обновлены данными с сервера)
    currentUser = {
        telegramId: telegramId,
        firstName: telegramFirstName,
        username: telegramUsername || null,
        photoUrl: telegramPhotoUrl
    };

    const apiUrl = await getApiUrl();
    
    try {
        // Загружаем данные пользователя и статус подписки с сервера через новый endpoint
        const initDataForServer = tg?.initData || initData;
        const statusResponse = await fetch(`${apiUrl}/api/user/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                telegram_id: telegramId,
                initData: initDataForServer
            }),
        });

        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // Обновляем данные пользователя
            if (statusData.user) {
                currentUser = {
                    telegramId: statusData.user.telegram_id,
                    firstName: statusData.user.first_name || telegramFirstName,
                    username: statusData.user.username || telegramUsername || null,
                    photoUrl: statusData.user.photo_url || telegramPhotoUrl || null
                };
                
                console.log('✅ Данные пользователя получены с сервера:', {
                    username: currentUser.username ? `@${currentUser.username}` : 'не указан',
                    firstName: currentUser.firstName,
                    hasPhoto: !!currentUser.photoUrl
                });
            }
            
            // Обновляем статус подписки
            if (statusData.subscription) {
                userSubscription = statusData.subscription;
            }
            
            // Обновляем статус пробного периода (для информации)
            if (statusData.trial) {
                console.log('🎁 Статус пробного периода:', statusData.trial);
            }
        } else {
            console.warn('⚠️ Ошибка получения статуса с сервера, используем данные Telegram');
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
    const userUsernameEl = document.getElementById('user-username');
    const userAvatarEl = document.getElementById('user-avatar');
    const subscriptionStatusEl = document.getElementById('subscription-status');

    if (userNameEl) {
        // Показываем first_name (имя, например "Михаил", "Авигея") - приоритетно
        const displayName = user?.firstName || user?.first_name || 'Пользователь';
        userNameEl.textContent = displayName;
    }

    if (userUsernameEl) {
        // Показываем username если есть (например @rusolnik)
        if (user?.username) {
            userUsernameEl.textContent = `@${user.username}`;
            userUsernameEl.style.display = 'block';
        } else {
            userUsernameEl.style.display = 'none';
        }
    }

    if (userAvatarEl) {
        // Если есть фото из Telegram, показываем его
        if (user?.photoUrl) {
            userAvatarEl.innerHTML = `<img src="${user.photoUrl}" alt="Аватар пользователя" class="user-avatar-img" onerror="this.parentElement.innerHTML='${user?.firstName?.[0]?.toUpperCase() || '👤'}'; this.parentElement.classList.remove('has-photo');" />`;
            userAvatarEl.classList.add('has-photo');
        } else {
            // Иначе показываем первую букву имени или эмодзи
            const initial = user?.firstName?.[0]?.toUpperCase() || user?.first_name?.[0]?.toUpperCase() || '👤';
            userAvatarEl.innerHTML = initial;
            userAvatarEl.classList.remove('has-photo');
        }
    }

    if (subscriptionStatusEl) {
        if (subscription && subscription.is_active) {
            const daysLeft = subscription.days_left || 0;
            const hoursLeft = subscription.hours_left || 0;
            
            // Форматируем текст статуса
            let statusText = '';
            if (daysLeft > 0) {
                statusText = `💎 Подписка активна (${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})`;
            } else if (hoursLeft > 0) {
                statusText = `💎 Подписка активна (${Math.floor(hoursLeft)} ч.)`;
            } else {
                statusText = '💎 Подписка активна';
            }
            
            subscriptionStatusEl.textContent = statusText;
            subscriptionStatusEl.className = 'subscription-status-text active';
        } else {
            subscriptionStatusEl.textContent = '❌ Подписка не активна';
            subscriptionStatusEl.className = 'subscription-status-text inactive';
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

// Переход на страницу генерации (временно отключено)
function openGenerationPage() {
    console.log('Режим генерации изображений временно недоступен - в разработке');
    // Показываем уведомление пользователю
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Режим генерации изображений временно недоступен. Мы работаем над этим функционалом.');
    } else {
        alert('Режим генерации изображений временно недоступен. Мы работаем над этим функционалом.');
    }
    return false;
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
