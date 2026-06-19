import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 시 /api 요청을 백엔드(기본 3000)로 프록시 → CORS·하드코딩 URL 불필요.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
