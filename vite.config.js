import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

const GITHUB_PAGES_BASE = '/AI-TTRPG/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = (env.VITE_RPG_API_BASE || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
  const isOllama = /11434|ollama/i.test(apiBase) || String(env.VITE_RPG_API_KEY || '').toLowerCase() === 'ollama';
  const proxyTarget = isOllama ? 'http://127.0.0.1:11434' : apiBase;

  return {
    plugins: [react()],
    base: process.env.NODE_ENV === 'production' ? GITHUB_PAGES_BASE : '/',
    build: {
      outDir: 'build',
    },
    server: {
      host: '::',
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/llm': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => {
            const rest = path.replace(/^\/llm/, '');
            if (isOllama) {
              if (rest.startsWith('/api/')) return rest;
              return `/v1${rest}`;
            }
            return rest;
          },
        },
      },
    },
    resolve: {
      alias: [
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
        {
          find: 'lib',
          replacement: resolve(__dirname, 'lib'),
        },
      ],
    },
  };
});
