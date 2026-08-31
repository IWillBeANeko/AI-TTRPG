import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

const GITHUB_PAGES_BASE = '/AI-TTRPG/';

export default defineConfig({
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
});
