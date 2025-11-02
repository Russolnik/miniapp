import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';

// Плагин для копирования JS файлов в dist после сборки
function copyJsFiles() {
  return {
    name: 'copy-js-files',
    writeBundle() {
      const filesToCopy = ['main.js', 'generation.js', 'app.js', 'theme.js'];
      filesToCopy.forEach(file => {
        const src = path.resolve(__dirname, file);
        const dest = path.resolve(__dirname, 'dist', file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          console.log(`✅ Скопирован ${file} в dist/`);
        }
      });
    }
  };
}

// Плагин для встраивания env переменных в HTML
function injectEnvToHtml() {
  return {
    name: 'inject-env-to-html',
    transformIndexHtml(html: string) {
      // Получаем API ключ из env (берем первый из списка если есть MGEMINI_API_KEYS)
      // Fallback на явный ключ если env переменные не найдены
      const apiKey = process.env.VITE_GEMINI_API_KEY || 
                    (process.env.MGEMINI_API_KEYS ? process.env.MGEMINI_API_KEYS.split(',')[0].trim() : '') ||
                    'AIzaSyBscpJYM-ZPFmvihUrbnaupQhEOjAAlyjo'; // Явный fallback ключ
      
      if (apiKey) {
        const maskedKey = `***${apiKey.slice(-4)}`;
        console.log(`✅ Встраиваю API ключ в HTML: ${maskedKey}`);
        
        // Встраиваем скрипт с API ключом в HTML
        const envScript = `
    <script>
        // Встроенный API ключ из env переменных (для fallback)
        // Встроено во время сборки Vite
        (function() {
            if (typeof window !== 'undefined') {
                if (!window.ENV) {
                    window.ENV = {};
                }
                window.ENV.GEMINI_API_KEY = ${JSON.stringify(apiKey)};
                console.log('✅ API ключ встроен из env переменных во время сборки');
            }
        })();
    </script>`;
        
        // Вставляем скрипт перед закрывающим тегом </head>
        if (html.includes('</head>')) {
          return html.replace('</head>', `${envScript}\n</head>`);
        } 
        // Или перед первым <script> в <head>
        else if (html.includes('<head>')) {
          const headMatch = html.match(/<head[^>]*>/);
          if (headMatch) {
            return html.replace(headMatch[0], `${headMatch[0]}\n${envScript}`);
          }
        }
        // Или перед <body>
        else if (html.includes('<body>')) {
          return html.replace('<body>', `${envScript}\n<body>`);
        }
        // В конец если ничего не найдено
        else {
          return html + envScript;
        }
      } else {
        console.warn('⚠️ VITE_GEMINI_API_KEY или MGEMINI_API_KEYS не найдены. API ключ не будет встроен в HTML.');
        console.log('🔍 Доступные env переменные:', Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('VITE')));
      }
      return html;
    }
  };
}

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Для работы с Telegram Mini App
    strictPort: false,
  },
  plugins: [react(), copyJsFiles(), injectEnvToHtml()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  optimizeDeps: {
    include: ['@google/genai'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'main.html'),
        live: path.resolve(__dirname, 'live.html'),
        generation: path.resolve(__dirname, 'generation.html'),
        about: path.resolve(__dirname, 'about.html'),
        index: path.resolve(__dirname, 'index.html'),
        'generation-tsx': path.resolve(__dirname, 'generation.tsx'),
      },
      output: {
        // Сохраняем структуру файлов
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  // Определяем env переменные для Netlify
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || ''),
  }
});
