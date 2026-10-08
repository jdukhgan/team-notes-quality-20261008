import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api is proxied to the Python server during development. The Integration
// Builder may change the target; override with NOTES_API_ORIGIN.
const apiOrigin = process.env.NOTES_API_ORIGIN ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: apiOrigin, changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
