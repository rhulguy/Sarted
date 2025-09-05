import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000' // For local dev against a local Vercel server
    }
  }
  // No `define` block for environment variables is included.
  // This is crucial for keeping API keys secure on the server-side.
});
