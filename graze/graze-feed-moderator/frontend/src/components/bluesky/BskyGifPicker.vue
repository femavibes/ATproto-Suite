<template>
  <div class="gif-picker" v-if="show">
    <div class="gif-picker-header">
      <input 
        v-model="searchQuery" 
        @input="searchGifs"
        placeholder="Search GIFs..."
        class="gif-search"
        ref="searchInput"
      >
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="gif-grid" v-if="gifs.length > 0">
      <div 
        v-for="gif in gifs" 
        :key="gif.id"
        @click="selectGif(gif)"
        class="gif-item"
      >
        <img :src="gif.images.fixed_height_small.url" :alt="gif.title" class="gif-preview">
      </div>
    </div>
    
    <div v-else-if="loading" class="gif-loading">
      <div class="spinner"></div>
      <span>Searching GIFs...</span>
    </div>
    
    <div v-else class="gif-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <p>Search for GIFs to add to your post</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

interface GifImage {
  url: string
  width: string
  height: string
}

interface Gif {
  id: string
  title: string
  images: {
    fixed_height_small: GifImage
    original: GifImage
  }
}

interface Props {
  show: boolean
}

const props = defineProps<Props>()

defineEmits<{
  select: [gif: Gif]
  close: []
}>()

const searchQuery = ref('')
const gifs = ref<Gif[]>([])
const loading = ref(false)
const searchInput = ref<HTMLInputElement>()

// Giphy API key - in production, this should be in environment variables
const GIPHY_API_KEY = 'your_giphy_api_key_here'

const searchGifs = async () => {
  if (!searchQuery.value.trim()) {
    gifs.value = []
    return
  }
  
  loading.value = true
  
  try {
    // For demo purposes, using mock data since we don't have a real API key
    // In production, replace with actual Giphy API call
    const mockGifs: Gif[] = [
      {
        id: '1',
        title: 'Happy Dance',
        images: {
          fixed_height_small: { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif', width: '200', height: '200' },
          original: { url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', width: '480', height: '480' }
        }
      },
      {
        id: '2', 
        title: 'Thumbs Up',
        images: {
          fixed_height_small: { url: 'https://media.giphy.com/media/111ebonMs90YLu/200.gif', width: '200', height: '200' },
          original: { url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', width: '480', height: '480' }
        }
      }
    ]
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    gifs.value = mockGifs
  } catch (error) {
    console.error('Failed to search GIFs:', error)
    gifs.value = []
  } finally {
    loading.value = false
  }
}

const selectGif = (gif: Gif) => {
  // @ts-ignore
  $emit('select', gif)
}

watch(() => props.show, (show) => {
  if (show) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  } else {
    searchQuery.value = ''
    gifs.value = []
  }
})
</script>

<style scoped>
.gif-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 300px;
  overflow: hidden;
}

.gif-picker-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-primary);
}

.gif-search {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gif-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
  padding: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.gif-item {
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  transition: transform 0.2s;
}

.gif-item:hover {
  transform: scale(1.05);
}

.gif-preview {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.gif-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-primary);
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.gif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: var(--text-secondary);
  text-align: center;
}

.gif-empty svg {
  opacity: 0.5;
}

.gif-empty p {
  margin: 0;
  font-size: 0.875rem;
}
</style>