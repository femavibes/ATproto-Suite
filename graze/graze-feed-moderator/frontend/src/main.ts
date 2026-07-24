import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { useContentFilterStore } from './stores/contentFilter'
import './assets/dark-mode.css'

// Configure axios defaults - use relative URLs (proxied by nginx)
axios.defaults.baseURL = ''

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize stores
const authStore = useAuthStore()
const themeStore = useThemeStore()
const contentFilterStore = useContentFilterStore()

authStore.initializeAuth()
themeStore.initializeTheme()
contentFilterStore.initializeFilters()

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}

app.mount('#app')