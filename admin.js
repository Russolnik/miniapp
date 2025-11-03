// Админ-панель JavaScript
const ADMIN_PASSWORD = '240123';
let currentEditingUser = null;
let originalUserData = null;

// Получение API URL (сначала localhost, потом production)
async function getApiUrl() {
    const productionUrl = window.API_URL || 'https://tg-ai-f9rj.onrender.com';
    const localUrl = 'http://localhost:5000';
    
    // Пропускаем проверку localhost если мы на HTTPS сайте (CORS ограничение браузера)
    if (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')) {
        return productionUrl;
    }
    
    try {
        const response = await fetch(`${localUrl}/health`, { 
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        if (response.ok) {
            return localUrl;
        }
    } catch (e) {
        // localhost недоступен
    }
    
    return productionUrl;
}

// Проверка пароля
async function checkPassword() {
    const passwordInput = document.getElementById('password');
    const password = passwordInput.value;
    const errorMessage = document.getElementById('error-message');
    
    if (!password) {
        errorMessage.textContent = 'Пожалуйста, введите пароль';
        errorMessage.style.display = 'block';
        return;
    }
    
    if (password === ADMIN_PASSWORD) {
        showAdminPanel();
    } else {
        errorMessage.textContent = 'Неверный пароль. Попробуйте снова.';
        errorMessage.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Проверка пароля при нажатии Enter
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    }
    
    const searchInput = document.getElementById('admin-search-user');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminSearchUser();
            }
        });
    }
});

function showAdminPanel() {
    document.getElementById('password-form').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    loadStats();
}

function logout() {
    document.getElementById('password-form').style.display = 'flex';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('password').value = '';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('admin-user-info').style.display = 'none';
    document.getElementById('admin-users-list').style.display = 'none';
}

// Загрузка статистики
async function loadStats() {
    const apiUrl = await getApiUrl();
    
    document.getElementById('total-users').textContent = '...';
    document.getElementById('active-keys').textContent = '...';
    document.getElementById('trial-active').textContent = '...';
    document.getElementById('subscribed').textContent = '...';
    
    try {
        const response = await fetch(`${apiUrl}/api/admin/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: ADMIN_PASSWORD })
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('total-users').textContent = stats.total_users || 0;
            document.getElementById('active-keys').textContent = stats.active_keys || 0;
            document.getElementById('trial-active').textContent = stats.trial_active || 0;
            document.getElementById('subscribed').textContent = stats.subscribed || 0;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Поиск пользователя
async function adminSearchUser() {
    const searchTerm = document.getElementById('admin-search-user').value.trim();
    if (!searchTerm) {
        showNotification('Введите ID или username для поиска', 'error');
        return;
    }
    
    await adminShowUserInfo(searchTerm);
}

// Отображение информации о пользователе
async function adminShowUserInfo(searchTerm) {
    const apiUrl = await getApiUrl();
    const infoDiv = document.getElementById('admin-user-info');
    const titleDiv = document.getElementById('admin-user-info-title');
    const contentDiv = document.getElementById('admin-user-info-content');
    
    infoDiv.style.display = 'block';
    contentDiv.innerHTML = '<p>Загрузка...</p>';
    
    try {
        const response = await fetch(`${apiUrl}/api/admin/users/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                search_term: searchTerm.toString()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (!data.found || !data.user) {
                contentDiv.innerHTML = '<p style="color: red;">Пользователь не найден</p>';
                return;
            }
            
            const user = data.user;
            currentEditingUser = user;
            originalUserData = JSON.parse(JSON.stringify(user)); // Deep copy
            
            renderUserInfo(user, contentDiv);
            titleDiv.textContent = `Пользователь: ${user.first_name || user.telegram_id}`;
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            contentDiv.innerHTML = `<p style="color: red;">Ошибка: ${error.error || 'Неизвестная ошибка'}</p>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

// Рендеринг информации о пользователе
function renderUserInfo(user, container) {
    let html = '<div class="admin-user-info-view">';
    
    // Основная информация
    html += '<div class="admin-field-group"><label class="admin-field-label">Telegram ID:</label>';
    html += `<div class="admin-field-value" id="edit-user-id">${user.telegram_id}</div></div>`;
    
    html += '<div class="admin-field-group"><label class="admin-field-label">Username:</label>';
    html += `<div class="admin-field-value" id="edit-username">${user.username || '—'}</div></div>`;
    
    html += '<div class="admin-field-group"><label class="admin-field-label">Имя:</label>';
    html += `<div class="admin-field-value" id="edit-first-name">${user.first_name || '—'}</div></div>`;
    
    // Пробный период
    const trial = user.trial_status || {};
    html += '<div class="admin-field-group"><label class="admin-field-label">Пробный период:</label>';
    html += '<div class="admin-field-value">';
    if (trial.is_active) {
        html += `✅ Активен (осталось: ${trial.hours_remaining ? trial.hours_remaining.toFixed(1) : 0} ч.)`;
        if (trial.trial_start) {
            html += `<br><small>Начало: ${formatDate(trial.trial_start)}</small>`;
        }
    } else if (trial.trial_used) {
        html += `❌ Использован`;
        if (trial.trial_start) {
            html += `<br><small>Начало: ${formatDate(trial.trial_start)}</small>`;
        }
    } else {
        html += `🆕 Доступен`;
    }
    html += '</div></div>';
    
    // Кнопки управления пробным периодом
    html += '<div class="admin-actions">';
    if (!trial.is_active && !trial.trial_used) {
        html += `<button class="btn btn-primary" onclick="adminActivateTrial(${user.telegram_id})">Активировать пробный период</button>`;
    }
    if (trial.is_active || trial.trial_used) {
        html += `<button class="btn" onclick="adminDeactivateTrial(${user.telegram_id})" style="background: #ef5350; color: white;">Удалить пробный период</button>`;
    }
    html += '</div>';
    
    // Подписка
    const subscription = user.active_subscription;
    if (subscription) {
        const totalHours = subscription.hours_left || 0;
        const days = Math.floor(totalHours / 24);
        const hours = Math.floor(totalHours % 24);
        let timeLeftText = '';
        if (days > 0 && hours > 0) {
            timeLeftText = `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} и ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
        } else if (days > 0) {
            timeLeftText = `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
        } else if (hours > 0) {
            timeLeftText = `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
        }
        
        html += '<div class="admin-field-group" style="margin-top: 20px;"><label class="admin-field-label">💎 Активная подписка:</label>';
        html += '<div class="admin-field-value">';
        html += `Тип: ${subscription.type}<br>`;
        html += `Осталось: ${timeLeftText || '0'}<br>`;
        html += `Действует до: ${formatDate(subscription.end_date)}<br>`;
        
        // Логирование дат покупки и активации
        if (subscription.created_at) {
            html += `📅 Покупка: ${formatDate(subscription.created_at)}<br>`;
        }
        if (subscription.start_date) {
            html += `🚀 Активация: ${formatDate(subscription.start_date)}<br>`;
        }
        if (subscription.updated_at) {
            html += `🔄 Обновлено: ${formatDate(subscription.updated_at)}<br>`;
        }
        
        html += `Оплата: ${subscription.is_stars_payment ? 'Stars ⭐' : 'Ручная'}`;
        
        if (subscription.usage_percent !== undefined && subscription.usage_percent !== null) {
            html += `<br><strong>Использование периода:</strong> ${subscription.usage_percent.toFixed(2)}%`;
            html += `<br>Возможный возврат: ${subscription.refund_percent || 0}% от суммы`;
        }
        
        html += '</div></div>';
        
        // Кнопки управления подпиской
        html += '<div class="admin-actions">';
        html += '<div class="admin-btn-group">';
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('1_month', ${user.telegram_id})">+1 месяц</button>`;
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('3_months', ${user.telegram_id})">+3 месяца</button>`;
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('6_months', ${user.telegram_id})">+6 месяцев</button>`;
        html += '</div>';
        
        if (subscription.is_active) {
            html += `<button class="btn" onclick="adminPauseSubscription(${user.telegram_id})" style="background: #ffa726;">Пауза</button>`;
            html += `<button class="btn" onclick="adminStopSubscription(${user.telegram_id})" style="background: #ef5350; color: white;">Остановить</button>`;
        } else {
            html += `<button class="btn" onclick="adminResumeSubscription(${user.telegram_id})" style="background: #66bb6a; color: white;">Возобновить</button>`;
        }
        html += '</div>';
    } else {
        html += '<div class="admin-field-group"><label class="admin-field-label">Подписка:</label>';
        html += '<div class="admin-field-value">❌ Не активна</div></div>';
        
        html += '<div class="admin-actions">';
        html += '<div class="admin-btn-group">';
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('1_month', ${user.telegram_id})">Добавить 1 месяц</button>`;
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('3_months', ${user.telegram_id})">Добавить 3 месяца</button>`;
        html += `<button class="btn btn-primary" onclick="adminCreateSubscription('6_months', ${user.telegram_id})">Добавить 6 месяцев</button>`;
        html += '</div></div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Уведомления
function showNotification(message, type) {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Функции управления пробным периодом
async function adminActivateTrial(telegramId) {
    if (!confirm(`Активировать пробный период для пользователя ${telegramId}?`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/trial/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId
            })
        });
        
        if (response.ok) {
            showNotification('✅ Пробный период активирован', 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

async function adminDeactivateTrial(telegramId) {
    if (!confirm(`Удалить пробный период для пользователя ${telegramId}?`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/trial/deactivate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId
            })
        });
        
        if (response.ok) {
            showNotification('✅ Пробный период удален', 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

// Функции управления подписками
async function adminCreateSubscription(subscriptionType, telegramId) {
    const typeNames = {
        '1_month': '1 месяц',
        '3_months': '3 месяца',
        '6_months': '6 месяцев'
    };
    
    if (!confirm(`Добавить подписку ${typeNames[subscriptionType]} пользователю ${telegramId}?`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/subscription/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId,
                subscription_type: subscriptionType
            })
        });
        
        if (response.ok) {
            showNotification(`✅ Подписка успешно добавлена`, 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

async function adminPauseSubscription(telegramId) {
    if (!confirm(`Поставить подписку пользователя ${telegramId} на паузу?`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/subscription/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId
            })
        });
        
        if (response.ok) {
            showNotification('✅ Подписка поставлена на паузу', 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

async function adminResumeSubscription(telegramId) {
    if (!confirm(`Возобновить подписку пользователя ${telegramId}?`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/subscription/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId
            })
        });
        
        if (response.ok) {
            showNotification('✅ Подписка возобновлена', 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

async function adminStopSubscription(telegramId) {
    if (!confirm(`⚠️ ВНИМАНИЕ! Остановить подписку пользователя ${telegramId}?\n\nЭто действие нельзя отменить!`)) return;
    
    const apiUrl = await getApiUrl();
    try {
        const response = await fetch(`${apiUrl}/api/admin/subscription/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                telegram_id: telegramId
            })
        });
        
        if (response.ok) {
            showNotification('✅ Подписка остановлена', 'success');
            setTimeout(() => adminShowUserInfo(telegramId), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            showNotification(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

// Загрузка списка всех пользователей
async function adminLoadUsersList() {
    const apiUrl = await getApiUrl();
    const listDiv = document.getElementById('admin-users-list');
    listDiv.style.display = 'block';
    listDiv.innerHTML = '<p>Загрузка...</p>';
    
    try {
        const response = await fetch(`${apiUrl}/api/admin/users/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                limit: 1000,
                offset: 0
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users || [];
            
            if (users.length === 0) {
                listDiv.innerHTML = '<p>Пользователи не найдены</p>';
                return;
            }
            
            let html = '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
            html += '<thead><tr style="background: rgba(79, 195, 247, 0.2);"><th style="padding: 8px; text-align: left; border: 1px solid rgba(79, 195, 247, 0.3);">ID</th><th style="padding: 8px; text-align: left; border: 1px solid rgba(79, 195, 247, 0.3);">Username</th><th style="padding: 8px; text-align: left; border: 1px solid rgba(79, 195, 247, 0.3);">Имя</th><th style="padding: 8px; text-align: left; border: 1px solid rgba(79, 195, 247, 0.3);">Действие</th></tr></thead><tbody>';
            
            users.forEach(user => {
                html += `<tr>
                    <td style="padding: 8px; border: 1px solid rgba(79, 195, 247, 0.3);">${user.telegram_id}</td>
                    <td style="padding: 8px; border: 1px solid rgba(79, 195, 247, 0.3);">${user.username || '—'}</td>
                    <td style="padding: 8px; border: 1px solid rgba(79, 195, 247, 0.3);">${user.first_name || '—'}</td>
                    <td style="padding: 8px; border: 1px solid rgba(79, 195, 247, 0.3);">
                        <button class="btn btn-primary" onclick="adminShowUserInfo('${user.telegram_id}')" style="padding: 5px 10px; font-size: 12px;">Подробнее</button>
                    </td>
                </tr>`;
            });
            
            html += '</tbody></table></div>';
            listDiv.innerHTML = html;
        } else {
            listDiv.innerHTML = '<p style="color: red;">Ошибка загрузки списка пользователей</p>';
        }
    } catch (error) {
        listDiv.innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

// Делаем функции глобальными
window.checkPassword = checkPassword;
window.adminSearchUser = adminSearchUser;
window.adminShowUserInfo = adminShowUserInfo;
window.adminLoadUsersList = adminLoadUsersList;
window.adminActivateTrial = adminActivateTrial;
window.adminDeactivateTrial = adminDeactivateTrial;
window.adminCreateSubscription = adminCreateSubscription;
window.adminPauseSubscription = adminPauseSubscription;
window.adminResumeSubscription = adminResumeSubscription;
window.adminStopSubscription = adminStopSubscription;

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
}

