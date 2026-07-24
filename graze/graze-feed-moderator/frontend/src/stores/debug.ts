import { ref } from 'vue'

const showDebugMode = ref(false)

export const useDebugStore = () => {
  const setDebugMode = (enabled: boolean) => {
    showDebugMode.value = Boolean(enabled)
    localStorage.setItem('debug-mode', String(enabled))
  }

  const loadDebugMode = () => {
    const saved = localStorage.getItem('debug-mode')
    showDebugMode.value = saved === 'true'
  }

  return {
    showDebugMode,
    setDebugMode,
    loadDebugMode
  }
}