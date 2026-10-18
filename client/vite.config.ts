import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import prerender from 'vite-plugin-prerender';

export default defineConfig({
  plugins: [react(), prerender({
    staticDir: path.join(__dirname, 'dist'),
    routes: ['/landingpage'],
  }),],
  resolve: {
    // @/ maps to src/ — used in every import across the codebase
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // ← change to your backend port
        changeOrigin: true,
      },
    },
  },
})