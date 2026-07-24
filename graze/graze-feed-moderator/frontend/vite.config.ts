import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'axios'],
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: true,
    // Optimize assets
    assetsInlineLimit: 4096,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['vue', 'axios']
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: true
  }
})