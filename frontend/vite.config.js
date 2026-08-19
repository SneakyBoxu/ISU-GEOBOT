import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Audit W6/W2: the browser never talks to Groq or Supabase's service role.
    // Everything goes through the Express API.
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Audit F-12 / W4: the guard dashboard is split out of the public
          // bundle. Its code and query shapes are not shipped to anonymous
          // visitors, who have no business holding a map of the most sensitive
          // table in the system.
          leaflet: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
