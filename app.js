// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    // setHeaderColor и setBackgroundColor не поддерживаются в версии 6.0+
    try {
        if (typeof tg.setHeaderColor === 'function') {
            tg.setHeaderColor('#81D4FA'); // Небесно-голубой цвет заголовка
        }
    } catch (e) {}
    try {
        if (typeof tg.setBackgroundColor === 'function') {
            tg.setBackgroundColor('#F5F5F0'); // Цвет фона
        }
    } catch (e) {}
}

// Функция для открытия профиля пользователя в Telegram
function openTelegramUser(event, username) {
    event.preventDefault();
    
    // Если мы в Mini App внутри Telegram
    if (tg) {
        // Используем https:// ссылку через openLink - это перекинет в Telegram
        const url = `https://t.me/${username}`;
        tg.openLink(url);
    } else {
        // Если открыто в браузере, используем обычную ссылку
        const url = `https://t.me/${username}`;
        window.open(url, '_blank');
    }
    
    return false;
}

// Вернуться назад
function goBack() {
    window.location.href = 'main.html';
}

// Простая страница "О проекте" - нет сложной логики
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Страница "О проекте" загружена');
    
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
    
    // Если есть данные пользователя из Telegram, можно их использовать
    if (tg?.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        console.log('Пользователь:', user.first_name || user.username);
    }
});
