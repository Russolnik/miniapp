// Импорты утилит
import { initTelegramWebApp, getTelegramIdFromWebApp, getTelegramIdFromUrl } from './utils/telegramUtils.js';
import { getApiUrl } from './utils/apiUtils.js';
import { fetchUserDataByTelegramId, fetchFullUserData, getTelegramIdFromServer, getAvatarUrl } from './utils/userDataUtils.js';

// Инициализация Telegram WebApp
let tg = null;
let currentUser = null;
let userSubscription = null;

// Функция для загрузки полных данных пользователя с подпиской
async function loadFullUserDataFromServer(telegramId, initData = null) {
    if (!telegramId) return;
    
    try {
        const statusData = await fetchFullUserData(telegramId, initData);
        
        if (!statusData) {
            console.warn('⚠️ Не удалось получить данные с сервера');
            return;
        }
        
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
            return; // Прерываем загрузку
        }
        
        // Обновляем данные пользователя
        if (statusData.user) {
            // Преобразуем photo_url в полный URL сервера
            const serverPhotoUrl = await getAvatarUrl(
                statusData.user.photo_url, 
                statusData.user.telegram_id || telegramId
            );
            
            currentUser = {
                telegramId: statusData.user.telegram_id || telegramId,
                firstName: statusData.user.first_name || currentUser?.firstName || 'Пользователь',
                username: statusData.user.username || currentUser?.username || null,
                photoUrl: serverPhotoUrl
            };
            
            console.log('✅ Данные пользователя получены с сервера:', {
                username: currentUser.username ? `@${currentUser.username}` : 'не указан',
                firstName: currentUser.firstName,
                hasPhoto: !!currentUser.photoUrl,
                photoUrl: currentUser.photoUrl ? `***${currentUser.photoUrl.slice(-20)}` : 'отсутствует'
            });
        } else {
            // Fallback: используем текущие данные если данных нет на сервере
            console.warn('⚠️ Данные пользователя не найдены на сервере, используем данные из Telegram');
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
        
        // Сохраняем данные в sessionStorage для передачи между страницами
        if (currentUser && currentUser.telegramId) {
            sessionStorage.setItem('telegramId', String(currentUser.telegramId));
            sessionStorage.setItem('userData', JSON.stringify({
                telegramId: currentUser.telegramId,
                firstName: currentUser.firstName,
                username: currentUser.username,
                photoUrl: currentUser.photoUrl
            }));
        }
        if (userSubscription) {
            sessionStorage.setItem('subscription', JSON.stringify(userSubscription));
        }
        
        // Обновляем UI
        updateUserUI(currentUser, userSubscription);
        updateModeCardsAccess(userSubscription);
        
        console.log('✅ Полные данные пользователя загружены:', {
            telegramId: `***${String(telegramId).slice(-4)}`,
            hasSubscription: !!userSubscription
        });
    } catch (e) {
        console.error('❌ Ошибка загрузки полных данных:', e);
        // Fallback: используем текущие данные
        updateUserUI(currentUser, null);
    }
}

// Загрузка данных пользователя с сервера (новая архитектура с утилитами)
async function loadUserDataFromServer() {
    let telegramId = null;
    let telegramUser = null;
    
    // Проверяем сохраненные данные из sessionStorage (при возврате назад)
    const savedUserData = sessionStorage.getItem('userData');
    const savedSubscription = sessionStorage.getItem('subscription');
    if (savedUserData) {
        try {
            const savedUser = JSON.parse(savedUserData);
            const savedSub = savedSubscription ? JSON.parse(savedSubscription) : null;
            
            // Восстанавливаем данные из сохраненных
            currentUser = savedUser;
            userSubscription = savedSub;
            
            console.log('✅ Восстановлены данные из sessionStorage:', {
                telegramId: `***${String(savedUser.telegramId).slice(-4)}`,
                hasSubscription: !!savedSub
            });
            
            // Обновляем UI сразу
            updateUserUI(currentUser, userSubscription);
            updateModeCardsAccess(userSubscription);
            
            // Загружаем свежие данные с сервера в фоне (для обновления статуса)
            if (savedUser.telegramId) {
                await loadFullUserDataFromServer(savedUser.telegramId);
            }
            return;
        } catch (e) {
            console.warn('⚠️ Ошибка восстановления данных из sessionStorage:', e);
        }
    }
    
    // ШАГ 0: Приоритет - URL параметры (бот передает tg_id)
    telegramId = getTelegramIdFromUrl();
    
    if (telegramId) {
        // Если получили ID из URL, сразу загружаем данные с сервера
        const statusData = await fetchUserDataByTelegramId(telegramId);
        
        if (statusData && statusData.user) {
            telegramUser = {
                id: telegramId,
                first_name: statusData.user.first_name || 'Пользователь',
                username: statusData.user.username || null,
                photo_url: statusData.user.photo_url || null
            };
            
            // Преобразуем photo_url в полный URL сервера
            const serverPhotoUrl = await getAvatarUrl(telegramUser.photo_url, telegramId);
            
            // Обновляем UI сразу
            currentUser = {
                telegramId: telegramId,
                firstName: telegramUser.first_name || 'Пользователь',
                username: telegramUser.username || null,
                photoUrl: serverPhotoUrl
            };
            updateUserUI(currentUser, null);
            
            // Загружаем полные данные с подпиской
            await loadFullUserDataFromServer(telegramId);
            return; // Выходим, данные уже получены
        }
    }
    
    // ШАГ 1: Инициализируем Telegram WebApp
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
    
    // ШАГ 2: Пробуем получить данные из WebApp (если еще не получили из URL)
    if (!telegramId) {
        const result = getTelegramIdFromWebApp(webApp);
        telegramId = result.telegramId;
        telegramUser = result.telegramUser;
    }
    
    // ШАГ 3: Если все еще не получили, пробуем через сервер с валидацией initData
    if (!telegramId && webApp.initData && webApp.initData.length > 0) {
        console.log('🔍 Пробуем получить telegram_id через сервер с валидацией initData...');
        const result = await getTelegramIdFromServer(webApp.initData);
        telegramId = result.telegramId;
        telegramUser = result.telegramUser;
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
    
    // Преобразуем photo_url в полный URL сервера
    const serverPhotoUrl = await getAvatarUrl(telegramUser.photo_url, telegramId);
    
    // Сразу показываем данные из Telegram для быстрого отображения
    currentUser = {
        telegramId: telegramId,
        firstName: telegramUser.first_name || 'Пользователь',
        username: telegramUser.username || null,
        photoUrl: serverPhotoUrl
    };
    updateUserUI(currentUser, null);
    console.log('✅ Данные пользователя из Telegram:', {
        id: `***${String(telegramId).slice(-4)}`,
        firstName: currentUser.firstName,
        username: currentUser.username ? `@${currentUser.username}` : 'не указан'
    });

    // ШАГ 4: Загружаем полные данные с сервера (подписка, данные из БД)
    await loadFullUserDataFromServer(telegramId, webApp.initData || null);
}

// Обновление доступности карточек режимов в зависимости от подписки
function updateModeCardsAccess(subscription) {
    // Проверяем подписку или пробный период (оба считаются активной подпиской)
    const hasActiveSubscription = subscription && (subscription.is_active || subscription.is_trial);
    
    console.log('🔓 Обновление доступности карточек:', {
        hasSubscription: !!subscription,
        is_active: subscription?.is_active,
        is_trial: subscription?.is_trial,
        hasActiveSubscription: hasActiveSubscription
    });
    
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
    // Trial считается активной подпиской и дает доступ
    const hasActiveSub = userSubscription && userSubscription.is_active;
    const isTrial = userSubscription && userSubscription.is_trial;
    const hasAccess = hasActiveSub || isTrial;
    
    console.log('🔍 Проверка доступа:', {
        page: page,
        hasSubscription: !!userSubscription,
        is_active: userSubscription?.is_active,
        is_trial: userSubscription?.is_trial,
        hasAccess: hasAccess
    });
    
    if (!hasAccess) {
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
        const photoUrl = user?.photoUrl || user?.photo_url;
        if (photoUrl) {
            console.log('🖼️ Загрузка аватара:', photoUrl);
            
            // Безопасная обработка ошибок загрузки изображения
            const initial = user?.firstName?.[0]?.toUpperCase() || user?.first_name?.[0]?.toUpperCase() || '👤';
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Аватар пользователя';
            img.className = 'user-avatar-img';
            img.onerror = function() {
                // Проверяем, была ли это реальная ошибка или просто файл отсутствует
                // Если это 404, это нормально - просто показываем инициал
                console.log('⚠️ Аватар не загружен, используем инициал:', initial);
                // Безопасная обработка ошибки
                const parent = this.parentElement;
                if (parent) {
                    parent.innerHTML = initial;
                    parent.classList.remove('has-photo');
                } else {
                    // Если parentElement недоступен, ищем элемент по ID
                    const avatarEl = document.getElementById('user-avatar');
                    if (avatarEl) {
                        avatarEl.innerHTML = initial;
                        avatarEl.classList.remove('has-photo');
                    }
                }
            };
            img.onload = function() {
                console.log('✅ Аватар успешно загружен');
            };
            
            userAvatarEl.innerHTML = '';
            userAvatarEl.appendChild(img);
            userAvatarEl.classList.add('has-photo');
        } else {
            // Иначе показываем первую букву имени или эмодзи
            const initial = user?.firstName?.[0]?.toUpperCase() || user?.first_name?.[0]?.toUpperCase() || '👤';
            userAvatarEl.innerHTML = initial;
            userAvatarEl.classList.remove('has-photo');
            console.log('⚠️ Аватар не найден, используем инициал:', initial);
        }
    }

    if (subscriptionStatusEl) {
        // Проверяем подписку или пробный период
        // Trial считается активной подпиской
        const hasActiveSub = subscription && subscription.is_active;
        const isTrial = subscription && subscription.is_trial;
        const hasAccess = hasActiveSub || isTrial;
        
        console.log('📊 Обновление статуса подписки в UI:', {
            hasSubscription: !!subscription,
            is_active: subscription?.is_active,
            is_trial: subscription?.is_trial,
            days_left: subscription?.days_left,
            hours_left: subscription?.hours_left
        });
        
        if (hasAccess) {
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
    // Trial считается активной подпиской и дает доступ
    const hasActiveSub = userSubscription && userSubscription.is_active;
    const isTrial = userSubscription && userSubscription.is_trial;
    const hasAccess = hasActiveSub || isTrial;
    
    console.log('🔍 Проверка доступа к Live:', {
        hasSubscription: !!userSubscription,
        is_active: userSubscription?.is_active,
        is_trial: userSubscription?.is_trial,
        hasAccess: hasAccess
    });
    
    if (!hasAccess) {
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
    
    // Сохраняем данные в sessionStorage перед переходом
    if (currentUser && currentUser.telegramId) {
        sessionStorage.setItem('telegramId', String(currentUser.telegramId));
        sessionStorage.setItem('userData', JSON.stringify({
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            photoUrl: currentUser.photoUrl
        }));
    }
    if (userSubscription) {
        sessionStorage.setItem('subscription', JSON.stringify(userSubscription));
    }
    
    // Добавляем класс для плавного перехода
    document.body.style.transition = 'opacity 0.2s ease-out';
    document.body.style.opacity = '0.95';
    
    // Передаем telegramId через URL
    const telegramId = currentUser?.telegramId || userSubscription?.telegram_id;
    const url = telegramId ? `live.html?tg_id=${telegramId}` : 'live.html';
    
    // Небольшая задержка для плавности, затем переход
    setTimeout(() => {
        window.location.href = url;
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
