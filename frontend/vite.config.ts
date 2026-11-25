import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forward /api to the Go server during `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
