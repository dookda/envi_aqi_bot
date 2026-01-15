import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Set base path for deployment under /ebot/ prefix
  base: '/ebot/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true, // Enable polling for Docker volumes (especially on Windows/Mac)
    },
    proxy: {
      '/ebot/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ebot/, ''),
      },
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
      '/ebot/health': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ebot/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
