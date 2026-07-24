import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['feed.fema.monster', 'feed-gen.atls.city', 'feedgen.atls.city'],
    proxy: {
      '/bsky-api': {
        target: 'https://public.api.bsky.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-api/, ''),
        secure: true,
      },
      '/debug': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/oauth': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      },
      '/.well-known': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      },
      '/xrpc': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
