<template>
  <div v-if="preview" class="link-preview" @click="openLink">
    <img v-if="preview.image" :src="preview.image" :alt="preview.title" class="preview-image">
    <div class="preview-content">
      <h4 v-if="preview.title" class="preview-title">{{ preview.title }}</h4>
      <p v-if="preview.description" class="preview-description">{{ truncateText(preview.description, 120) }}</p>
      <div class="preview-url">
        <span class="preview-domain">{{ getDomain(preview.url) }}</span>
      </div>
    </div>
  </div>
  <div v-else-if="loading" class="link-preview loading">
    <div class="preview-skeleton">
      <div class="skeleton-image"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-description"></div>
        <div class="skeleton-url"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { linkPreviewService } from '../../services/linkPreview'

interface Props {
  url: string
}

const props = defineProps<Props>()

const preview = ref(null)
const loading = ref(true)

const loadPreview = async () => {
  try {
    const result = await linkPreviewService.getPreview(props.url)
    preview.value = result
  } catch (error) {
    console.error('Failed to load link preview:', error)
    preview.value = null
  } finally {
    loading.value = false
  }
}

const openLink = () => {
  window.open(props.url, '_blank', 'noopener,noreferrer')
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const truncateText = (text: string, length: number) => {
  return text.length > length ? text.substring(0, length) + '...' : text
}

onMounted(() => {
  loadPreview()
})
</script>

<style scoped>
.link-preview {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-card);
}

.link-preview:hover {
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: 160px;
  object-fit: cover;
  background: var(--bg-secondary);
}

.preview-content {
  padding: 0.75rem;
}

.preview-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.preview-description {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.preview-url {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-domain {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: lowercase;
}

.link-preview.loading {
  cursor: default;
}

.link-preview.loading:hover {
  border-color: var(--border-primary);
  transform: none;
  box-shadow: none;
}

.preview-skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton-image {
  width: 100%;
  height: 160px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-primary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  padding: 0.75rem;
}

.skeleton-title {
  height: 16px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-primary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  width: 80%;
}

.skeleton-description {
  height: 12px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-primary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  width: 100%;
}

.skeleton-url {
  height: 12px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-primary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 768px) {
  .preview-image {
    height: 120px;
  }
  
  .preview-content {
    padding: 0.5rem;
  }
  
  .preview-title {
    font-size: 0.8125rem;
  }
  
  .preview-description {
    font-size: 0.6875rem;
  }
}
</style>