// Система управления темами (дневная/ночная)
(function() {
    'use strict';
    
    // Сохраняем текущую тему в localStorage
    const THEME_KEY = 'ai-theme-preference';
    const THEME_AUTO = 'auto';
    const THEME_DAY = 'day';
    const THEME_NIGHT = 'night';
    
    // По умолчанию авто режим
    let currentTheme = localStorage.getItem(THEME_KEY) || THEME_AUTO;
    
    // Определение времени суток (утро: 6-12, день: 12-18, вечер: 18-22, ночь: 22-6)
    function getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'morning'; // Утро
        if (hour >= 12 && hour < 18) return 'day'; // День
        if (hour >= 18 && hour < 22) return 'evening'; // Вечер
        return 'night'; // Ночь
    }
    
    // Автоматическое определение темы по времени
    function getEffectiveTheme() {
        if (currentTheme === THEME_AUTO) {
            const timeOfDay = getTimeOfDay();
            // Ночь и вечер -> ночная тема, утро и день -> дневная
            return (timeOfDay === 'night' || timeOfDay === 'evening') ? THEME_NIGHT : THEME_DAY;
        }
        return currentTheme;
    }
    
    // Применение темы
    function applyTheme(theme) {
        const root = document.documentElement;
        const effectiveTheme = theme === THEME_AUTO ? getEffectiveTheme() : theme;
        
        root.setAttribute('data-theme', effectiveTheme);
        root.classList.remove('theme-day', 'theme-night');
        root.classList.add(`theme-${effectiveTheme}`);
        
        // Сохраняем в localStorage
        localStorage.setItem(THEME_KEY, theme);
        currentTheme = theme;
        
        // Обновляем иконку
        updateThemeIcon();
        
        console.log(`🌓 Тема применена: ${effectiveTheme} (выбор: ${theme})`);
    }
    
    // Обновление иконки кнопки темы
    function updateThemeIcon() {
        const icons = document.querySelectorAll('#theme-icon');
        icons.forEach(icon => {
            if (currentTheme === THEME_AUTO) {
                icon.textContent = '🌓'; // Солнце и луна - авто
            } else if (currentTheme === THEME_DAY) {
                icon.textContent = '☀️'; // Солнце - день
            } else {
                icon.textContent = '🌙'; // Луна - ночь
            }
        });
    }
    
    // Инициализация при загрузке
    function initTheme() {
        applyTheme(currentTheme);
        updateThemeIcon();
        
        // Создаем элементы ночной темы (звезды, луна, кометы)
        if (getEffectiveTheme() === THEME_NIGHT) {
            createNightElements();
        }
    }
    
    // Создание элементов ночной темы
    function createNightElements() {
        // Удаляем старые элементы если есть
        const existingStars = document.querySelectorAll('.night-star, .night-moon, .night-comet');
        existingStars.forEach(el => el.remove());
        
        // Создаем звезды
        const starsContainer = document.createElement('div');
        starsContainer.className = 'night-stars-container';
        
        for (let i = 0; i < 150; i++) {
            const star = document.createElement('div');
            star.className = 'night-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.animationDuration = (Math.random() * 2 + 1) + 's';
            
            // Разные размеры звезд
            const size = Math.random() * 2 + 1;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            
            starsContainer.appendChild(star);
        }
        
        document.body.appendChild(starsContainer);
        
        // Создаем луну
        const moon = document.createElement('div');
        moon.className = 'night-moon';
        moon.innerHTML = '🌙';
        document.body.appendChild(moon);
        
        // Создаем кометы (периодически - раз в 1-5 минут)
        function scheduleNextComet() {
            const delay = Math.random() * 240000 + 60000; // От 1 до 5 минут (60000-300000 мс)
            setTimeout(() => {
                if (getEffectiveTheme() === THEME_NIGHT) {
                    createComet();
                }
                scheduleNextComet(); // Планируем следующую комету
            }, delay);
        }
        scheduleNextComet(); // Запускаем планирование
    }
    
    // Создание кометы
    function createComet() {
        const comet = document.createElement('div');
        comet.className = 'night-comet';
        
        const startX = Math.random() * 100;
        const startY = -10;
        const endX = startX + (Math.random() * 40 - 20);
        const endY = 110;
        
        comet.style.left = startX + '%';
        comet.style.top = startY + '%';
        
        document.body.appendChild(comet);
        
        // Анимация полета
        setTimeout(() => {
            comet.style.left = endX + '%';
            comet.style.top = endY + '%';
        }, 10);
        
        // Удаление после анимации
        setTimeout(() => {
            if (comet.parentNode) {
                comet.remove();
            }
        }, 3000);
    }
    
    // Переключение темы
    function toggleTheme() {
        if (currentTheme === THEME_AUTO) {
            currentTheme = THEME_DAY;
        } else if (currentTheme === THEME_DAY) {
            currentTheme = THEME_NIGHT;
        } else {
            currentTheme = THEME_AUTO;
        }
        applyTheme(currentTheme);
        
        // Пересоздаем элементы ночной темы если нужно
        if (getEffectiveTheme() === THEME_NIGHT) {
            createNightElements();
        } else {
            const nightElements = document.querySelectorAll('.night-star, .night-moon, .night-comet, .night-stars-container');
            nightElements.forEach(el => el.remove());
        }
        
        return currentTheme;
    }
    
    // API для внешнего использования
    window.themeManager = {
        setTheme: applyTheme,
        toggleTheme: toggleTheme,
        getTheme: () => currentTheme,
        getEffectiveTheme: getEffectiveTheme,
        init: initTheme
    };
    
    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
    
    // Обновление темы при изменении времени (каждую минуту)
    setInterval(() => {
        if (currentTheme === THEME_AUTO) {
            const oldEffective = document.documentElement.getAttribute('data-theme');
            const newEffective = getEffectiveTheme();
            if (oldEffective !== newEffective) {
                applyTheme(THEME_AUTO);
                if (newEffective === THEME_NIGHT) {
                    createNightElements();
                } else {
                    const nightElements = document.querySelectorAll('.night-star, .night-moon, .night-comet, .night-stars-container');
                    nightElements.forEach(el => el.remove());
                }
            }
        }
    }, 60000); // Проверяем каждую минуту
    
})();

