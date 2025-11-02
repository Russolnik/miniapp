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

// Плагин для встраивания env переменных в HTML - ОТКЛЮЧЕН
// API ключ теперь берется из БД через сервер
function injectEnvToHtml() {
  return {
    name: 'inject-env-to-html',
    transformIndexHtml(html: string) {
      // Функция отключена - API ключ берется из БД через сервер
      // console.log('⚠️ Встраивание API ключа в HTML отключено - ключ берется из БД');
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
