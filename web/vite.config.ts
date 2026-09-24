import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev, a API roda em :3000 (server/); o Vite faz proxy para evitar CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
