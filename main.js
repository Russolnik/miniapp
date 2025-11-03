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

// Загрузка данных пользователя с сервера (упрощенная версия)
async function loadUserDataFromServer() {
    // ШАГ 1: Получаем telegram_id из Telegram WebApp (самый простой способ)
    let telegramId = null;
    
    // Пробуем получить ID из initDataUnsafe (самый надежный способ)
    const webApp = window.Telegram?.WebApp || tg;
    if (webApp?.initDataUnsafe?.user?.id) {
        telegramId = webApp.initDataUnsafe.user.id;
        console.log('✅ Telegram ID получен из initDataUnsafe:', `***${String(telegramId).slice(-4)}`);
    } else if (webApp?.initData) {
        // Пробуем парсить initData напрямую
        try {
            const urlParams = new URLSearchParams(webApp.initData);
            const userStr = urlParams.get('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                if (userObj.id) {
                    telegramId = userObj.id;
                    console.log('✅ Telegram ID получен из initData:', `***${String(telegramId).slice(-4)}`);
                }
            }
        } catch (e) {
            console.warn('⚠️ Не удалось распарсить initData:', e);
        }
    }
    
    // Если не удалось получить ID, показываем заглушку
    if (!telegramId) {
        console.error('❌ Telegram ID не найден в WebApp. Показываем заглушку.');
        currentUser = {
            telegramId: null,
            firstName: 'Пользователь',
            username: null,
            photoUrl: null
        };
        updateUserUI(currentUser, null);
        return;
    }

    // ШАГ 2: Загружаем данные пользователя и статус подписки с сервера по telegram_id
    const apiUrl = await getApiUrl();
    
    try {
        // Получаем initData для валидации на сервере
        const initDataForServer = webApp?.initData || null;
        
        console.log('📡 Запрос к серверу для получения данных пользователя...', {
            telegramId: `***${String(telegramId).slice(-4)}`,
            hasInitData: !!initDataForServer
        });
        
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
            
            // Формируем объект пользователя из ответа сервера
            if (statusData.user) {
                currentUser = {
                    telegramId: statusData.user.telegram_id || telegramId,
                    firstName: statusData.user.first_name || 'Пользователь',
                    username: statusData.user.username || null,
                    photoUrl: statusData.user.photo_url || null
                };
                
                console.log('✅ Данные пользователя получены с сервера:', {
                    username: currentUser.username ? `@${currentUser.username}` : 'не указан',
                    firstName: currentUser.firstName,
                    hasPhoto: !!currentUser.photoUrl
                });
            } else {
                // Fallback: используем telegramId если данных пользователя нет в ответе
                currentUser = {
                    telegramId: telegramId,
                    firstName: 'Пользователь',
                    username: null,
                    photoUrl: null
                };
            }
            
            // Обновляем статус подписки
            if (statusData.subscription) {
                userSubscription = statusData.subscription;
                console.log('✅ Статус подписки получен:', {
                    is_active: userSubscription.is_active,
                    is_trial: userSubscription.is_trial,
                    days_left: userSubscription.days_left,
                    hours_left: userSubscription.hours_left
                });
            } else {
                console.warn('⚠️ Подписка не найдена в ответе сервера');
                userSubscription = null;
            }
            
        } else {
            const errorText = await statusResponse.text().catch(() => 'Неизвестная ошибка');
            console.warn('⚠️ Ошибка получения статуса с сервера:', statusResponse.status, errorText);
            
            // Используем базовые данные только с telegramId
            currentUser = {
                telegramId: telegramId,
                firstName: 'Пользователь',
                username: null,
                photoUrl: null
            };
            userSubscription = null;
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки данных с сервера:', error);
        // Fallback: используем telegramId
        currentUser = {
            telegramId: telegramId,
            firstName: 'Пользователь',
            username: null,
            photoUrl: null
        };
        userSubscription = null;
    }

    // Обновляем UI с полученными данными
    if (currentUser && currentUser.telegramId) {
        updateUserUI(currentUser, userSubscription);
        updateModeCardsAccess(userSubscription);
    } else {
        console.error('❌ Не удалось загрузить данные пользователя');
        // Показываем заглушку
        updateUserUI({
            telegramId: null,
            firstName: 'Пользователь',
            username: null,
            photoUrl: null
        }, null);
    }
}

// Обновление доступности карточек режимов в зависимости от подписки
function updateModeCardsAccess(subscription) {
    // Проверяем подписку или пробный период (оба считаются активной подпиской)
    const hasActiveSubscription = subscription && (subscription.is_active || subscription.is_trial);
    
    // Карточка Live
    const liveCard = document.querySelector('.mode-card:not(.generation-card-disabled)');
    if (liveCard && liveCard.textContent.includes('Live общение')) {
        if (!hasActiveSubscription) {
            liveCard.classList.add('disabled');
            liveCard.style.opacity = '0.6';
            liveCard.style.cursor = 'not-allowed';
            liveCard.setAttribute('onclick', 'checkSubscriptionAndOpen("live")');
        } else {
            liveCard.classList.remove('disabled');
            liveCard.style.opacity = '1';
            liveCard.style.cursor = 'pointer';
            liveCard.setAttribute('onclick', 'openLivePage()');
        }
    }
    
    // Карточка Generation - всегда недоступна, в разработке
    const generationCard = document.getElementById('generation-card');
    if (generationCard) {
        // Всегда показываем как недоступную
        generationCard.classList.add('generation-card-disabled');
        generationCard.style.opacity = '0.6';
        generationCard.style.cursor = 'not-allowed';
        generationCard.setAttribute('onclick', 'showGenerationDisabled()');
    }
}

// Функция проверки подписки перед открытием страницы
function checkSubscriptionAndOpen(page) {
    // Проверяем подписку или пробный период
    const hasActiveSub = userSubscription && userSubscription.is_active;
    const isTrial = userSubscription && userSubscription.is_trial;
    
    if (!hasActiveSub && !isTrial) {
        const message = '🚫 **Доступ ограничен**\n\n' +
            'Для использования этого раздела требуется активная подписка.\n\n' +
            'Используйте команду /subscription в боте для оформления подписки.';
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    // Если подписка активна, открываем страницу
    if (page === 'live') {
        openLivePage();
    } else if (page === 'generation') {
        openGenerationPage();
    }
}

// Делаем функцию глобальной
window.checkSubscriptionAndOpen = checkSubscriptionAndOpen;

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
        // Проверяем подписку или пробный период
        const hasActiveSub = subscription && subscription.is_active;
        const isTrial = subscription && subscription.is_trial;
        
        if (hasActiveSub || isTrial) {
            const daysLeft = subscription.days_left || 0;
            const hoursLeft = subscription.hours_left || 0;
            
            // Форматируем текст статуса
            let statusText = '';
            if (isTrial) {
                if (daysLeft > 0) {
                    statusText = `🎁 Пробный период (${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})`;
                } else if (hoursLeft > 0) {
                    statusText = `🎁 Пробный период (${Math.floor(hoursLeft)} ч.)`;
                } else {
                    statusText = '🎁 Пробный период';
                }
            } else {
                if (daysLeft > 0) {
                    statusText = `💎 Подписка активна (${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})`;
                } else if (hoursLeft > 0) {
                    statusText = `💎 Подписка активна (${Math.floor(hoursLeft)} ч.)`;
                } else {
                    statusText = '💎 Подписка активна';
                }
            }
            
            subscriptionStatusEl.textContent = statusText;
            subscriptionStatusEl.className = 'subscription-status-text active';
        } else {
            subscriptionStatusEl.textContent = '❌ Подписка не активна';
            subscriptionStatusEl.className = 'subscription-status-text inactive';
        }
    }
}

// Переход на страницу Live - с проверкой подписки
function openLivePage() {
    // Проверяем подписку или пробный период перед доступом
    const hasActiveSub = userSubscription && userSubscription.is_active;
    const isTrial = userSubscription && userSubscription.is_trial;
    
    if (!hasActiveSub && !isTrial) {
        const message = '🚫 **Доступ ограничен**\n\n' +
            'Для использования Live общения требуется активная подписка.\n\n' +
            'Используйте команду /subscription в боте для оформления подписки.';
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    // Добавляем класс для плавного перехода
    document.body.style.transition = 'opacity 0.2s ease-out';
    document.body.style.opacity = '0.95';
    
    // Небольшая задержка для плавности, затем переход
    setTimeout(() => {
        window.location.href = 'live.html';
    }, 50);
}

// Переход на страницу генерации - с проверкой подписки
function openGenerationPage() {
    // Generation пока в разработке для всех
    const message = '🚫 **Доступ ограничен**\n\n' +
        'Генерация изображений временно недоступна.\n\n' +
        'Мы работаем над этим функционалом.';
    
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(message);
    } else {
        alert(message);
    }
    return false;
    
    // Проверяем подписку или пробный период перед доступом
    const hasActiveSub = userSubscription && userSubscription.is_active;
    const isTrial = userSubscription && userSubscription.is_trial;
    
    if (!hasActiveSub && !isTrial) {
        const message = '🚫 **Доступ ограничен**\n\n' +
            'Для использования генерации изображений требуется активная подписка.\n\n' +
            'Используйте команду /subscription в боте для оформления подписки.';
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
        return false;
    }
    
    // Добавляем класс для плавного перехода
    document.body.style.transition = 'opacity 0.2s ease-out';
    document.body.style.opacity = '0.95';
    
    // Переход на страницу генерации
    setTimeout(() => {
        window.location.href = 'generation.html';
    }, 50);
}

// Показать страницу "О проекте"
function showAboutPage() {
    console.log('Переход на страницу "О проекте"');
    window.location.href = 'about.html';
}

// Открыть страницу покупки подписки (через бота)
function openSubscriptionPage() {
    if (window.Telegram?.WebApp) {
        // Открываем бота с командой /subscription
        window.Telegram.WebApp.openTelegramLink('https://t.me/YOUR_BOT_USERNAME?start=subscription');
    } else {
        // Fallback: показываем сообщение
        alert('Откройте бота и используйте команду /subscription для оформления подписки');
    }
}

// Делаем функцию глобальной
window.openSubscriptionPage = openSubscriptionPage;

// Функция для показа сообщения о недоступности Generation
function showGenerationDisabled() {
    const message = '🚫 **Генерация изображений в разработке**\n\nЭта функция временно недоступна и находится в стадии разработки.\n\nСледите за обновлениями!';
    
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(message);
    } else {
        alert(message);
    }
}

// Делаем функции глобальными для доступа из HTML
window.openLivePage = openLivePage;
window.openGenerationPage = openGenerationPage;
window.showAboutPage = showAboutPage;
window.showGenerationDisabled = showGenerationDisabled;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Ждем немного, чтобы Telegram WebApp успел загрузиться
    let attempts = 0;
    const maxAttempts = 10;
    
    const waitForTelegramWebApp = () => {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                attempts++;
                if (window.Telegram?.WebApp || attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    };
    
    await waitForTelegramWebApp();
    
    // Обновляем глобальную переменную tg
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
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
