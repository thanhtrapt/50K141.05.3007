import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend và API cùng nằm trong một project: khi chạy `npm run dev`, Vite phục vụ
// giao diện ở cổng 5173 và chuyển tiếp `/api` sang server API cục bộ ở cổng 4000.
// Trên Vercel, `/api` do các Serverless Functions trong thư mục `api/` đảm nhiệm.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
