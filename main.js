// Инициализация Telegram WebApp
let tg = null;
let currentUser = null;
let userSubscription = null;

// Функция для инициализации Telegram WebApp с ожиданием загрузки
function initTelegramWebApp() {
    return new Promise((resolve) => {
        // Проверяем, доступен ли уже Telegram.WebApp
        if (window.Telegram?.WebApp) {
            tg = window.Telegram.WebApp;
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
                tg = window.Telegram.WebApp;
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

// Загрузка данных пользователя с сервера (переработанная версия)
async function loadUserDataFromServer() {
    // ШАГ 1: Инициализируем Telegram WebApp и ждем его загрузки
    const webApp = await initTelegramWebApp();
    
    if (!webApp) {
        console.error('❌ Telegram WebApp не доступен');
        currentUser = {
            telegramId: null,
            firstName: 'Пользователь',
            username: null,
            photoUrl: null
        };
        updateUserUI(currentUser, null);
        return;
    }
    
    let telegramId = null;
    let telegramUser = null;
    
    // Способ 1: Получаем данные из initDataUnsafe (рекомендуемый способ)
    // Добавляем детальное логирование для диагностики
    if (webApp.initDataUnsafe) {
        console.log('🔍 Проверка initDataUnsafe:', {
            hasInitDataUnsafe: true,
            hasUser: !!webApp.initDataUnsafe.user,
            userKeys: webApp.initDataUnsafe.user ? Object.keys(webApp.initDataUnsafe.user) : [],
            userId: webApp.initDataUnsafe.user?.id,
            userType: typeof webApp.initDataUnsafe.user?.id,
            userValue: webApp.initDataUnsafe.user?.id
        });
    }
    
    // Пробуем получить user.id напрямую
    if (webApp.initDataUnsafe?.user) {
        telegramUser = webApp.initDataUnsafe.user;
        
        // Детальное логирование структуры user
        console.log('🔍 Детальная структура initDataUnsafe.user:', {
            keys: Object.keys(telegramUser),
            values: Object.entries(telegramUser).reduce((acc, [key, val]) => {
                // Маскируем длинные значения
                if (typeof val === 'string' && val.length > 20) {
                    acc[key] = `${val.substring(0, 20)}...`;
                } else {
                    acc[key] = val;
                }
                return acc;
            }, {})
        });
        
        // Проверяем разные варианты получения ID (стандартное поле Telegram - id)
        telegramId = telegramUser.id;
        
        // Если id отсутствует, пробуем альтернативные варианты
        if (!telegramId && telegramUser.user_id) {
            telegramId = telegramUser.user_id;
            console.log('⚠️ Используем альтернативное поле user_id');
        }
        if (!telegramId && telegramUser.userId) {
            telegramId = telegramUser.userId;
            console.log('⚠️ Используем альтернативное поле userId');
        }
        
        // Если ID в виде строки, пробуем преобразовать в число
        if (telegramId && typeof telegramId === 'string') {
            const parsedId = parseInt(telegramId, 10);
            if (!isNaN(parsedId)) {
                telegramId = parsedId;
            }
        }
        
        // Проверяем что id есть и это валидное число
        if (telegramId && (typeof telegramId === 'number' || (typeof telegramId === 'string' && /^\d+$/.test(String(telegramId))))) {
            telegramId = parseInt(telegramId, 10);
            console.log('✅ Telegram ID получен из initDataUnsafe.user.id:', `***${String(telegramId).slice(-4)}`);
        } else {
            console.warn('⚠️ initDataUnsafe.user.id не является валидным ID');
            console.warn('🔍 Полная структура user (для отладки):', JSON.stringify(telegramUser, null, 2));
            
            // Последняя попытка - ищем любое числовое значение, похожее на ID
            for (const key in telegramUser) {
                const value = telegramUser[key];
                if (value && (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(String(value))))) {
                    const potentialId = parseInt(value, 10);
                    // Telegram ID обычно больше 100000000 (9 цифр)
                    if (!isNaN(potentialId) && potentialId > 100000000 && potentialId < 999999999999999) {
                        telegramId = potentialId;
                        console.log(`✅ Telegram ID найден в поле ${key}:`, `***${String(telegramId).slice(-4)}`);
                        break;
                    }
                }
            }
        }
    } else {
        console.warn('⚠️ initDataUnsafe.user недоступен');
        console.warn('🔍 initDataUnsafe структура:', {
            hasInitDataUnsafe: !!webApp.initDataUnsafe,
            keys: webApp.initDataUnsafe ? Object.keys(webApp.initDataUnsafe) : []
        });
    }
    
    // Способ 2: Если initDataUnsafe не сработал, парсим initData напрямую
    if (!telegramId && webApp.initData) {
        try {
            console.log('🔍 Пробуем парсить initData напрямую...');
            
            // Парсим initData (формат: user=...&auth_date=...&hash=...)
            const params = new URLSearchParams(webApp.initData);
            const userParam = params.get('user');
            
            if (userParam) {
                // Декодируем и парсим JSON
                const userJson = decodeURIComponent(userParam);
                telegramUser = JSON.parse(userJson);
                telegramId = telegramUser.id;
                console.log('✅ Telegram ID получен из initData парсинга:', `***${String(telegramId).slice(-4)}`);
            } else {
                console.warn('⚠️ Параметр "user" не найден в initData');
            }
        } catch (e) {
            console.error('❌ Ошибка парсинга initData:', e);
        }
    }
    
    // Способ 3: Альтернативный парсинг initData (если стандартный не сработал)
    if (!telegramId && webApp.initData) {
        try {
            // Пробуем найти user= в строке напрямую
            const userMatch = webApp.initData.match(/user=([^&]+)/);
            if (userMatch && userMatch[1]) {
                const userJson = decodeURIComponent(userMatch[1]);
                telegramUser = JSON.parse(userJson);
                telegramId = telegramUser.id;
                console.log('✅ Telegram ID получен из альтернативного парсинга:', `***${String(telegramId).slice(-4)}`);
            }
        } catch (e) {
            console.error('❌ Ошибка альтернативного парсинга:', e);
        }
    }
    
    // Способ 4: Пробуем получить telegram_id из URL параметров
    if (!telegramId) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlTelegramId = urlParams.get('tg_id') || urlParams.get('telegram_id') || urlParams.get('user_id');
            if (urlTelegramId) {
                const parsedId = parseInt(urlTelegramId, 10);
                if (!isNaN(parsedId) && parsedId > 100000000) {
                    telegramId = parsedId;
                    console.log('✅ Telegram ID получен из URL параметров:', `***${String(telegramId).slice(-4)}`);
                }
            }
        } catch (e) {
            console.warn('⚠️ Ошибка получения ID из URL:', e);
        }
    }
    
    // Способ 5: Если initData есть, пробуем получить через сервер с валидацией initData
    if (!telegramId && webApp.initData && webApp.initData.length > 0) {
        console.log('🔍 Пробуем получить telegram_id через сервер с валидацией initData...', {
            hasInitData: !!webApp.initData,
            initDataLength: webApp.initData?.length || 0
        });
        try {
            const apiUrl = await getApiUrl();
            
            const statusResponse = await fetch(`${apiUrl}/api/user/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    initData: webApp.initData
                }),
            });
            
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.user && statusData.user.telegram_id) {
                    telegramId = statusData.user.telegram_id;
                    telegramUser = {
                        id: telegramId,
                        first_name: statusData.user.first_name || 'Пользователь',
                        username: statusData.user.username || null,
                        photo_url: statusData.user.photo_url || null
                    };
                    console.log('✅ Telegram ID получен через сервер:', `***${String(telegramId).slice(-4)}`);
                } else if (statusData.error) {
                    console.warn('⚠️ Сервер вернул ошибку:', statusData.error);
                }
            } else {
                const errorText = await statusResponse.text().catch(() => 'Unknown error');
                console.warn('⚠️ Ошибка ответа сервера:', statusResponse.status, errorText);
            }
        } catch (e) {
            console.error('❌ Ошибка получения ID через сервер:', e);
        }
    }
    
    // Если не удалось получить данные, показываем заглушку с инструкцией
    if (!telegramId || !telegramUser) {
        console.error('❌ Не удалось получить Telegram ID. Доступные данные:', {
            hasWebApp: !!webApp,
            hasInitDataUnsafe: !!webApp?.initDataUnsafe,
            hasInitData: !!webApp?.initData,
            initDataLength: webApp?.initData?.length || 0,
            initDataUnsafeKeys: webApp?.initDataUnsafe ? Object.keys(webApp.initDataUnsafe) : [],
            webAppVersion: webApp?.version,
            webAppPlatform: webApp?.platform
        });
        
        // Показываем сообщение пользователю
        const userInfoCard = document.getElementById('user-info-card');
        if (userInfoCard) {
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                userNameEl.textContent = '⚠️ Данные не получены';
            }
            const subscriptionStatusEl = document.getElementById('subscription-status');
            if (subscriptionStatusEl) {
                subscriptionStatusEl.innerHTML = '⚠️ Miniapp должен быть открыт через Telegram бота.<br>Используйте кнопку "📱 Открыть приложение" в боте.';
                subscriptionStatusEl.className = 'subscription-status-text inactive';
            }
        }
        
        currentUser = {
            telegramId: null,
            firstName: 'Пользователь',
            username: null,
            photoUrl: null
        };
        updateUserUI(currentUser, null);
        return;
    }
    
    // Сразу показываем данные из Telegram для быстрого отображения
    currentUser = {
        telegramId: telegramId,
        firstName: telegramUser.first_name || 'Пользователь',
        username: telegramUser.username || null,
        photoUrl: telegramUser.photo_url || null
    };
    updateUserUI(currentUser, null);
    console.log('✅ Данные пользователя из Telegram:', {
        id: `***${String(telegramId).slice(-4)}`,
        firstName: currentUser.firstName,
        username: currentUser.username ? `@${currentUser.username}` : 'не указан'
    });

    // ШАГ 2: Загружаем данные пользователя и статус подписки с сервера по telegram_id
    // Отправляем только telegram_id, остальное сервер получит из БД
    const apiUrl = await getApiUrl();
    
    try {
        // Получаем initData для валидации на сервере (только для безопасности)
        const initDataForServer = webApp.initData || null;
        
        console.log('📡 Запрос к серверу для получения данных пользователя по telegram_id...', {
            telegramId: `***${String(telegramId).slice(-4)}`
        });
        
        const statusResponse = await fetch(`${apiUrl}/api/user/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                telegram_id: telegramId,
                initData: initDataForServer  // Для валидации, если нужно
            }),
        });

        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // Проверяем, найден ли пользователь в БД
            if (statusData.user_not_found) {
                console.warn('⚠️ Пользователь не найден в БД. Нужно сначала активировать бота через /start');
                // Показываем сообщение пользователю
                const userInfoCard = document.getElementById('user-info-card');
                if (userInfoCard) {
                    const userNameEl = document.getElementById('user-name');
                    if (userNameEl) {
                        userNameEl.textContent = '❌ Активируйте бота через /start';
                    }
                    const subscriptionStatusEl = document.getElementById('subscription-status');
                    if (subscriptionStatusEl) {
                        subscriptionStatusEl.textContent = 'Сначала активируйте бота в Telegram';
                        subscriptionStatusEl.className = 'subscription-status-text inactive';
                    }
                }
                return; // Прерываем загрузку, не обновляем UI дальше
            }
            
            // Формируем объект пользователя из ответа сервера
            if (statusData.user) {
                // Приоритет отдаем данным с сервера (из БД)
                currentUser = {
                    telegramId: statusData.user.telegram_id || telegramId,
                    firstName: statusData.user.first_name || currentUser?.firstName || telegramUser?.first_name || 'Пользователь',
                    username: statusData.user.username || currentUser?.username || telegramUser?.username || null,
                    photoUrl: statusData.user.photo_url || currentUser?.photoUrl || telegramUser?.photo_url || null
                };
                
                console.log('✅ Данные пользователя получены с сервера (из БД):', {
                    username: currentUser.username ? `@${currentUser.username}` : 'не указан',
                    firstName: currentUser.firstName,
                    hasPhoto: !!currentUser.photoUrl
                });
            } else {
                // Fallback: используем данные из Telegram если данных нет на сервере
                console.warn('⚠️ Данные пользователя не найдены на сервере, используем данные из Telegram');
                currentUser = {
                    telegramId: telegramId,
                    firstName: currentUser?.firstName || telegramUser?.first_name || 'Пользователь',
                    username: currentUser?.username || telegramUser?.username || null,
                    photoUrl: currentUser?.photoUrl || telegramUser?.photo_url || null
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
                // Форматируем время детально (дни и часы)
                const totalHours = hoursLeft || 0;
                const days = Math.floor(totalHours / 24);
                const hours = Math.floor(totalHours % 24);
                
                const trialHoursAdded = subscription.trial_hours_added || 0;
                
                if (days > 0 && hours > 0) {
                    statusText = `💎 Подписка активна (${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} и ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'})`;
                } else if (days > 0) {
                    statusText = `💎 Подписка активна (${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'})`;
                } else if (hours > 0) {
                    statusText = `💎 Подписка активна (${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'})`;
                } else {
                    statusText = '💎 Подписка активна';
                }
                
                // Добавляем информацию о пробном периоде, если он был включен
                if (trialHoursAdded > 0) {
                    const trialDays = Math.floor(trialHoursAdded / 24);
                    const trialHours = Math.floor(trialHoursAdded % 24);
                    if (trialDays > 0 && trialHours > 0) {
                        statusText += `\n🎁 +${trialDays} ${trialDays === 1 ? 'день' : trialDays < 5 ? 'дня' : 'дней'} ${trialHours} ${trialHours === 1 ? 'час' : trialHours < 5 ? 'часа' : 'часов'} из пробного периода`;
                    } else if (trialDays > 0) {
                        statusText += `\n🎁 +${trialDays} ${trialDays === 1 ? 'день' : trialDays < 5 ? 'дня' : 'дней'} из пробного периода`;
                    } else if (trialHours > 0) {
                        statusText += `\n🎁 +${trialHours} ${trialHours === 1 ? 'час' : trialHours < 5 ? 'часа' : 'часов'} из пробного периода`;
                    }
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
