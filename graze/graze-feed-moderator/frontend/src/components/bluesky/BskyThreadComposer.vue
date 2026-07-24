<template>
  <div class="thread-composer">
    <div class="thread-header">
      <h3>Create Thread</h3>
      <button @click="$emit('cancel')" class="close-btn">×</button>
    </div>
    
    <div class="thread-posts">
      <div v-for="(post, index) in threadPosts" :key="index" class="thread-post">
        <div class="post-header">
          <img :src="userAvatar || '/icon-192.svg'" class="post-avatar">
          <span class="post-number">{{ index + 1 }}/{{ threadPosts.length }}</span>
          <button v-if="threadPosts.length > 1" @click="removePost(index)" class="remove-post">×</button>
        </div>
        
        <textarea 
          v-model="post.text"
          @input="updateCharCount(index)"
          :placeholder="index === 0 ? 'Start your thread...' : 'Continue thread...'"
          class="thread-textarea"
          :maxlength="300"
        ></textarea>
        
        <div v-if="post.images.length > 0" class="image-preview">
          <div v-for="(image, imgIndex) in post.images" :key="imgIndex" class="image-item">
            <img :src="image.preview" :alt="image.alt || 'Uploaded image'" class="preview-image">
            <button @click="removeImage(index, imgIndex)" class="remove-image">×</button>
            <input 
              v-model="image.alt" 
              placeholder="Alt text (optional)"
              class="alt-text-input"
              maxlength="100"
            >
          </div>
        </div>
        
        <div v-if="post.videos.length > 0" class="video-preview">
          <div v-for="(video, vidIndex) in post.videos" :key="vidIndex" class="video-item">
            <div class="video-container">
              <video :src="video.preview" class="preview-video" controls preload="metadata"></video>
              <div class="video-overlay">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" class="play-icon">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <button @click="removeVideo(index, vidIndex)" class="remove-video">×</button>
          </div>
        </div>
        
        <div class="post-actions">
          <input 
            :ref="`fileInput${index}`"
            type="file" 
            accept="image/*" 
            multiple 
            @change="handleImageUpload($event, index)"
            style="display: none"
          >
          <input 
            :ref="`videoInput${index}`"
            type="file" 
            accept="video/*" 
            @change="handleVideoUpload($event, index)"
            style="display: none"
          >
          <button @click="$refs[`fileInput${index}`][0].click()" class="action-btn" :disabled="(post.images.length + post.videos.length) >= 4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>
          <button @click="$refs[`videoInput${index}`][0].click()" class="action-btn" :disabled="(post.images.length + post.videos.length) >= 4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </button>
          <div class="char-count" :class="{ warning: post.charCount > 280, error: post.charCount > 300 }">
            {{ post.charCount }}/300
          </div>
        </div>
      </div>
    </div>
    
    <div class="thread-controls">
      <button @click="addPost" class="add-post-btn" :disabled="threadPosts.length >= 10">
        + Add another post
      </button>
      
      <div class="thread-buttons">
        <button @click="$emit('cancel')" class="cancel-btn">Cancel</button>
        <button @click="publishThread" :disabled="!canPublish" class="publish-btn">
          Publish Thread
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ThreadPost {
  text: string
  images: Array<{ file: File, preview: string, alt: string }>
  videos: Array<{ file: File, preview: string, thumbnail?: string }>
  charCount: number
}

interface Props {
  userAvatar?: string
}

const props = defineProps<Props>()

defineEmits<{
  publish: [posts: Array<{ text: string, images: Array<{ file: File, alt: string }>, videos: Array<{ file: File }> }>]
  cancel: []
}>()

const threadPosts = ref<ThreadPost[]>([
  { text: '', images: [], videos: [], charCount: 0 }
])

const canPublish = computed(() => {
  return threadPosts.value.some(post => post.text.trim().length > 0) &&
         threadPosts.value.every(post => post.charCount <= 300)
})

const updateCharCount = (index: number) => {
  threadPosts.value[index].charCount = threadPosts.value[index].text.length
}

const addPost = () => {
  if (threadPosts.value.length < 10) {
    threadPosts.value.push({ text: '', images: [], videos: [], charCount: 0 })
  }
}

const removePost = (index: number) => {
  if (threadPosts.value.length > 1) {
    threadPosts.value.splice(index, 1)
  }
}

const handleImageUpload = (event: Event, postIndex: number) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  Array.from(files).forEach(file => {
    if ((threadPosts.value[postIndex].images.length + threadPosts.value[postIndex].videos.length) >= 4) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      threadPosts.value[postIndex].images.push({
        file,
        preview: e.target?.result as string,
        alt: ''
      })
    }
    reader.readAsDataURL(file)
  })
}

const handleVideoUpload = (event: Event, postIndex: number) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  Array.from(files).forEach(file => {
    if ((threadPosts.value[postIndex].images.length + threadPosts.value[postIndex].videos.length) >= 4) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      // Create video element to generate thumbnail
      const video = document.createElement('video')
      video.src = e.target?.result as string
      video.currentTime = 1
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0)
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        
        threadPosts.value[postIndex].videos.push({
          file,
          preview: e.target?.result as string,
          thumbnail
        })
      }
    }
    reader.readAsDataURL(file)
  })
}

const removeVideo = (postIndex: number, videoIndex: number) => {
  threadPosts.value[postIndex].videos.splice(videoIndex, 1)
}

const removeImage = (postIndex: number, imageIndex: number) => {
  threadPosts.value[postIndex].images.splice(imageIndex, 1)
}

const publishThread = () => {
  if (!canPublish.value) return
  
  const posts = threadPosts.value
    .filter(post => post.text.trim().length > 0)
    .map(post => ({
      text: post.text,
      images: post.images.map(img => ({ file: img.file, alt: img.alt })),
      videos: post.videos.map(vid => ({ file: vid.file }))
    }))
  
  // @ts-ignore
  $emit('publish', posts)
}
</script>

<style scoped>
.thread-composer {
  background: var(--bg-card);
  border-radius: 8px;
  max-height: 80vh;
  overflow-y: auto;
}

.thread-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.thread-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thread-posts {
  padding: 1rem;
}

.thread-post {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  position: relative;
}

.thread-post:last-child {
  margin-bottom: 0;
}

.post-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.post-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  background: #f3f4f6;
}

.post-number {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.remove-post {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1.25rem;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thread-textarea {
  width: 100%;
  min-height: 80px;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 1rem;
  line-height: 1.5;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  margin-bottom: 0.75rem;
}

.thread-textarea::placeholder {
  color: var(--text-secondary);
}

.image-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.image-item {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.alt-text-input {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 0.25rem;
  font-size: 0.75rem;
}

.alt-text-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.video-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.video-item {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.video-container {
  position: relative;
  width: 100%;
  height: 120px;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  opacity: 0.8;
}

.play-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.remove-video {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  z-index: 10;
}

.post-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-btn {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #f0f9ff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.char-count.warning {
  color: #f59e0b;
}

.char-count.error {
  color: #dc2626;
}

.thread-controls {
  padding: 1rem;
  border-top: 1px solid var(--border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-post-btn {
  background: none;
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.add-post-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.add-post-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.thread-buttons {
  display: flex;
  gap: 0.5rem;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
}

.publish-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>