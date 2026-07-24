import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useThemeStore = defineStore('theme', () => {
  const isDarkMode = ref(false)
  const selectedTheme = ref('default')

  const initializeTheme = async () => {
    try {
      // Load preferences from database first, fallback to localStorage
      const response = await axios.get('/api/user/preferences')
      const prefs = response.data
      
      isDarkMode.value = prefs.dark_mode ?? (localStorage.getItem('darkMode') === 'true')
      selectedTheme.value = prefs.theme ?? localStorage.getItem('theme') ?? 'default'
    } catch (error) {
      // Fallback to localStorage
      isDarkMode.value = localStorage.getItem('darkMode') === 'true'
      selectedTheme.value = localStorage.getItem('theme') ?? 'default'
    }
    
    applyTheme()
  }

  const applyTheme = () => {
    // Apply dark mode
    document.documentElement.classList.toggle('dark', isDarkMode.value)
    
    // Remove existing theme classes
    document.documentElement.classList.remove('theme-pride', 'theme-trans', 'theme-blm')
    
    // Add new theme class if not default
    if (selectedTheme.value !== 'default') {
      document.documentElement.classList.add(`theme-${selectedTheme.value}`)
    }
  }

  const toggleDarkMode = async () => {
    isDarkMode.value = !isDarkMode.value
    localStorage.setItem('darkMode', isDarkMode.value.toString())
    applyTheme()
    
    // Save to database
    try {
      await axios.put('/api/user/preferences', {
        dark_mode: isDarkMode.value
      })
    } catch (error) {
      console.error('Failed to save dark mode preference:', error)
    }
  }

  const setTheme = async (theme: string) => {
    selectedTheme.value = theme
    localStorage.setItem('theme', theme)
    applyTheme()
    
    // Save to database
    try {
      await axios.put('/api/user/preferences', {
        theme: theme
      })
    } catch (error) {
      console.error('Failed to save theme preference:', error)
    }
  }

  return {
    isDarkMode,
    selectedTheme,
    initializeTheme,
    toggleDarkMode,
    setTheme
  }
})