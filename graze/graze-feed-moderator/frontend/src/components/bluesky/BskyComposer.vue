<template>
  <div class="composer" :class="{ expanded: isExpanded, compact: props.compact, modal: props.modal }">
    <div class="composer-header" v-if="replyTo">
      <span class="reply-indicator">Replying to @{{ replyTo.post.author.handle }}</span>
      <button @click="$emit('cancel')" class="cancel-btn">×</button>
    </div>
    
    <div class="composer-body">
      <img 
        :src="userAvatar || '/icon-192.svg'" 
        @error="$event.target.src = '/icon-192.svg'"
        class="composer-avatar"
      >
      <div class="composer-content">
        <div class="textarea-container">
          <textarea 
            ref="textareaRef"
            v-model="postText" 
            @focus="isExpanded = true"
            @input="handleTextInput"
            @keydown="handleKeydown"
            @selectionchange="updateSelection"
            placeholder="What's happening?"
            class="composer-textarea"
            :maxlength="300"
          ></textarea>
          <div v-if="showSuggestions" class="suggestions-dropdown">
            <div 
              v-for="(suggestion, index) in filteredSuggestions" 
              :key="index"
              @click="selectSuggestion(suggestion)"
              class="suggestion-item"
              :class="{ active: selectedSuggestionIndex === index }"
            >
              <span class="suggestion-type">{{ suggestion.type === 'mention' ? '@' : '#' }}</span>
              {{ suggestion.text }}
            </div>
          </div>
        </div>
        
        <div v-if="images.length > 0" class="image-preview">
          <div v-for="(image, index) in images" :key="index" class="image-item">
            <img :src="image.preview" :alt="image.alt || 'Uploaded image'" class="preview-image">
            <button @click="removeImage(index)" class="remove-image">×</button>
            <input 
              v-model="image.alt" 
              placeholder="Alt text (optional)"
              class="alt-text-input"
              maxlength="100"
            >
          </div>
        </div>
        
        <div v-if="videos.length > 0" class="video-preview">
          <div v-for="(video, index) in videos" :key="index" class="video-item">
            <div class="video-container">
              <video :src="video.preview" class="preview-video" controls preload="metadata"></video>
              <div class="video-overlay">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white" class="play-icon">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <button @click="removeVideo(index)" class="remove-video">×</button>
          </div>
        </div>
        
        <div v-if="selectedGif" class="gif-preview">
          <div class="gif-item">
            <img :src="selectedGif.images.original.url" :alt="selectedGif.title" class="preview-gif">
            <button @click="removeGif" class="remove-gif">×</button>
          </div>
        </div>
        
        <div v-if="quotedPost" class="quoted-post-preview">
          <div class="quote-header">
            <img :src="quotedPost.post.author.avatar || '/icon-192.svg'" class="quote-avatar">
            <span class="quote-author">{{ quotedPost.post.author.displayName || quotedPost.post.author.handle }}</span>
            <span class="quote-handle">@{{ quotedPost.post.author.handle }}</span>
            <button @click="quotedPost = null" class="remove-quote">×</button>
          </div>
          <p class="quote-text">{{ quotedPost.post.record.text }}</p>
        </div>
        
        <div v-if="isExpanded" class="composer-actions">
          <div class="formatting-toolbar">
            <button @click="formatText('bold')" class="format-btn" :class="{ active: isFormatActive('bold') }" title="Bold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
              </svg>
            </button>
            <button @click="formatText('italic')" class="format-btn" :class="{ active: isFormatActive('italic') }" title="Italic">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
              </svg>
            </button>
            <div class="toolbar-separator"></div>
            <input 
              ref="fileInput"
              type="file" 
              accept="image/*" 
              multiple 
              @change="handleImageUpload"
              style="display: none"
            >
            <input 
              ref="videoInput"
              type="file" 
              accept="video/*" 
              @change="handleVideoUpload"
              style="display: none"
            >
            <button @click="$refs.fileInput.click()" class="action-btn" :disabled="(images.length + videos.length + (selectedGif ? 1 : 0)) >= 4" title="Add image">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </button>
            <button @click="$refs.videoInput.click()" class="action-btn" :disabled="(images.length + videos.length + (selectedGif ? 1 : 0)) >= 4" title="Add video">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </button>
            <button @click="showGifPicker = !showGifPicker" class="action-btn" :disabled="(images.length + videos.length + (selectedGif ? 1 : 0)) >= 4" title="Add GIF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V9z"/>
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
              </svg>
            </button>
            <button @click="showDrafts = !showDrafts" class="action-btn" title="Drafts">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
              </svg>
            </button>
            <button @click="showThreadModal = true" class="action-btn" title="Create Thread">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
          
          <div class="composer-footer">
            <div class="footer-left">
              <div class="char-count" :class="{ warning: charCount > 280, error: charCount > 300 }">
                {{ charCount }}/300
              </div>
              <div v-if="autoSaveIndicator" class="auto-save-indicator">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zM12 19c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm1-5h-2v-4h2v4z"/>
                </svg>
                Saving...
              </div>
            </div>
            <div class="post-buttons">
              <button @click="$emit('cancel')" class="cancel-post-btn" v-if="replyTo">Cancel</button>
              <button @click="submitPost" :disabled="!canPost" class="post-btn">
                {{ replyTo ? 'Reply' : 'Post' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- GIF Picker -->
        <div class="gif-picker-container">
          <BskyGifPicker 
            :show="showGifPicker"
            @select="selectGif"
            @close="showGifPicker = false"
          />
        </div>
        
        <!-- Drafts Modal -->
        <div v-if="showDrafts" class="modal-overlay" @click="showDrafts = false">
          <div class="drafts-container" @click.stop>
            <BskyDraftManager @select="loadDraft" @close="showDrafts = false" />
          </div>
        </div>
        
        <!-- Thread Modal -->
        <BskyThreadComposerModal 
          :show="showThreadModal"
          :user-avatar="userAvatar"
          @publish="handleThreadPublish"
          @close="showThreadModal = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { draftService } from '../../services/draftService'
import BskyGifPicker from './BskyGifPicker.vue'
import BskyDraftManager from './BskyDraftManager.vue'
import BskyThreadComposerModal from './BskyThreadComposerModal.vue'

interface Props {
  replyTo?: any
  quotedPost?: any
  userAvatar?: string
  compact?: boolean
  modal?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  post: [data: { text: string, images: any[], videos: any[], gif?: any, replyTo?: any, quotedPost?: any }]
  thread: [posts: Array<{ text: string, images: Array<{ file: File, alt: string }>, videos: Array<{ file: File }> }>]
  cancel: []
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const fileInput = ref<HTMLInputElement>()
const videoInput = ref<HTMLInputElement>()
const postText = ref('')
const images = ref<Array<{ file: File, preview: string, alt: string }>>([])
const videos = ref<Array<{ file: File, preview: string, thumbnail?: string }>>([])
const selectedGif = ref<any>(null)
const showGifPicker = ref(false)
const isExpanded = ref(false)
const charCount = ref(0)
const quotedPost = ref(props.quotedPost)
const currentDraftId = ref<string | null>(null)
const autoSaveIndicator = ref(false)

// Rich text formatting
const selectionStart = ref(0)
const selectionEnd = ref(0)
const showSuggestions = ref(false)
const suggestionQuery = ref('')
const suggestionType = ref<'mention' | 'hashtag'>('mention')
const selectedSuggestionIndex = ref(0)
const showDrafts = ref(false)
const showThreadModal = ref(false)

// Mock suggestions - in real app, fetch from API
const mockMentions = ['alice.bsky.social', 'bob.bsky.social', 'charlie.bsky.social']
const mockHashtags = ['bluesky', 'social', 'tech', 'coding', 'web3']

const canPost = computed(() => {
  return postText.value.trim().length > 0 && charCount.value <= 300 && (images.value.length + videos.value.length + (selectedGif.value ? 1 : 0)) <= 4
})

const updateCharCount = () => {
  charCount.value = postText.value.length
}

const updateSelection = () => {
  if (textareaRef.value) {
    selectionStart.value = textareaRef.value.selectionStart || 0
    selectionEnd.value = textareaRef.value.selectionEnd || 0
  }
}

const handleTextInput = (event: Event) => {
  updateCharCount()
  updateSelection()
  checkForSuggestions()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (showSuggestions.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, filteredSuggestions.value.length - 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      selectSuggestion(filteredSuggestions.value[selectedSuggestionIndex.value])
    } else if (event.key === 'Escape') {
      showSuggestions.value = false
    }
  }
  
  // Format shortcuts
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 'b') {
      event.preventDefault()
      formatText('bold')
    } else if (event.key === 'i') {
      event.preventDefault()
      formatText('italic')
    }
  }
}

const checkForSuggestions = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const cursorPos = textarea.selectionStart || 0
  const text = postText.value
  const beforeCursor = text.substring(0, cursorPos)
  
  // Check for @ mentions
  const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9._-]*)$/)
  if (mentionMatch) {
    suggestionQuery.value = mentionMatch[1]
    suggestionType.value = 'mention'
    showSuggestions.value = true
    selectedSuggestionIndex.value = 0
    return
  }
  
  // Check for # hashtags
  const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/)
  if (hashtagMatch) {
    suggestionQuery.value = hashtagMatch[1]
    suggestionType.value = 'hashtag'
    showSuggestions.value = true
    selectedSuggestionIndex.value = 0
    return
  }
  
  showSuggestions.value = false
}

const filteredSuggestions = computed(() => {
  const query = suggestionQuery.value.toLowerCase()
  const items = suggestionType.value === 'mention' ? mockMentions : mockHashtags
  
  return items
    .filter(item => item.toLowerCase().includes(query))
    .slice(0, 5)
    .map(item => ({ type: suggestionType.value, text: item }))
})

const selectSuggestion = (suggestion: { type: 'mention' | 'hashtag', text: string }) => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const cursorPos = textarea.selectionStart || 0
  const text = postText.value
  const beforeCursor = text.substring(0, cursorPos)
  const afterCursor = text.substring(cursorPos)
  
  const prefix = suggestion.type === 'mention' ? '@' : '#'
  const regex = suggestion.type === 'mention' ? /@[a-zA-Z0-9._-]*$/ : /#[a-zA-Z0-9_]*$/
  
  const newBeforeCursor = beforeCursor.replace(regex, prefix + suggestion.text + ' ')
  postText.value = newBeforeCursor + afterCursor
  
  showSuggestions.value = false
  
  nextTick(() => {
    const newCursorPos = newBeforeCursor.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)
    textarea.focus()
  })
}

const formatText = (format: 'bold' | 'italic') => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart || 0
  const end = textarea.selectionEnd || 0
  const selectedText = postText.value.substring(start, end)
  
  let wrapper = ''
  if (format === 'bold') wrapper = '**'
  if (format === 'italic') wrapper = '*'
  
  if (selectedText) {
    // Wrap selected text
    const beforeSelection = postText.value.substring(0, start)
    const afterSelection = postText.value.substring(end)
    postText.value = beforeSelection + wrapper + selectedText + wrapper + afterSelection
    
    nextTick(() => {
      textarea.setSelectionRange(start + wrapper.length, end + wrapper.length)
      textarea.focus()
    })
  } else {
    // Insert wrapper at cursor
    const beforeCursor = postText.value.substring(0, start)
    const afterCursor = postText.value.substring(start)
    postText.value = beforeCursor + wrapper + wrapper + afterCursor
    
    nextTick(() => {
      textarea.setSelectionRange(start + wrapper.length, start + wrapper.length)
      textarea.focus()
    })
  }
}

const isFormatActive = (format: 'bold' | 'italic') => {
  const textarea = textareaRef.value
  if (!textarea) return false
  
  const start = textarea.selectionStart || 0
  const end = textarea.selectionEnd || 0
  const text = postText.value
  
  if (start === end) return false
  
  const selectedText = text.substring(start, end)
  const wrapper = format === 'bold' ? '**' : '*'
  
  return selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper)
}

// Auto-save draft when content changes
watch([postText, images, videos, selectedGif], () => {
  if (postText.value.trim().length > 0 || images.value.length > 0 || videos.value.length > 0 || selectedGif.value) {
    autoSaveIndicator.value = true
    const key = draftService.autoSave(
      postText.value,
      [...images.value, ...videos.value],
      props.replyTo,
      quotedPost.value,
      selectedGif.value
    )
    currentDraftId.value = key
    setTimeout(() => {
      autoSaveIndicator.value = false
    }, 3000)
  }
}, { deep: true })

const handleImageUpload = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  Array.from(files).forEach(file => {
    if ((images.value.length + videos.value.length + (selectedGif.value ? 1 : 0)) >= 4) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      images.value.push({
        file,
        preview: e.target?.result as string,
        alt: ''
      })
    }
    reader.readAsDataURL(file)
  })
}

const handleVideoUpload = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  Array.from(files).forEach(file => {
    if ((images.value.length + videos.value.length + (selectedGif.value ? 1 : 0)) >= 4) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      // Create video element to generate thumbnail
      const video = document.createElement('video')
      video.src = e.target?.result as string
      video.currentTime = 1 // Seek to 1 second for thumbnail
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0)
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        
        videos.value.push({
          file,
          preview: e.target?.result as string,
          thumbnail
        })
      }
    }
    reader.readAsDataURL(file)
  })
}

const removeImage = (index: number) => {
  images.value.splice(index, 1)
}

const removeVideo = (index: number) => {
  videos.value.splice(index, 1)
}

const selectGif = (gif: any) => {
  selectedGif.value = gif
  showGifPicker.value = false
}

const removeGif = () => {
  selectedGif.value = null
}



const submitPost = () => {
  if (!canPost.value) return
  
  const postData = {
    text: postText.value,
    images: images.value.map(img => ({ file: img.file, alt: img.alt })),
    videos: videos.value.map(vid => ({ file: vid.file })),
    gif: selectedGif.value,
    replyTo: props.replyTo,
    quotedPost: quotedPost.value
  }
  
  // Delete draft after successful post
  if (currentDraftId.value) {
    draftService.deleteDraft(currentDraftId.value)
  }
  
  // Reset form
  postText.value = ''
  images.value = []
  videos.value = []
  selectedGif.value = null
  charCount.value = 0
  isExpanded.value = false
  quotedPost.value = null
  currentDraftId.value = null
  
  // Emit the post data
  // @ts-ignore
  $emit('post', postData)
}

const handleThreadPublish = (posts: Array<{ text: string, images: Array<{ file: File, alt: string }>, videos: Array<{ file: File }> }>) => {
  showThreadModal.value = false
  // @ts-ignore
  $emit('thread', posts)
}

const loadDraft = (draft: any) => {
  postText.value = draft.text
  images.value = draft.images?.filter((item: any) => item.file.type.startsWith('image/')) || []
  videos.value = draft.images?.filter((item: any) => item.file.type.startsWith('video/')) || []
  selectedGif.value = draft.gif || null
  quotedPost.value = draft.quotedPost
  currentDraftId.value = draft.id
  updateCharCount()
  isExpanded.value = true
  showDrafts.value = false
}

defineExpose({ loadDraft })
</script>

<style scoped>
.composer {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  margin-bottom: 1rem;
  transition: all 0.2s;
}

.composer.modal {
  border: none;
  border-radius: 0;
  margin-bottom: 0;
}

.composer.compact {
  margin-bottom: 0;
  border-radius: 4px;
}

.composer.compact .composer-body {
  padding: 0.75rem;
}

.composer.compact .composer-avatar {
  width: 32px;
  height: 32px;
}

.composer.expanded {
  border-color: #3b82f6;
}

.composer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-primary);
  background: #f8fafc;
}

.reply-indicator {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.cancel-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.composer-body {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
}

.composer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background: #f3f4f6;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.composer-avatar[src]:not([src=""]):not([src="/icon-192.svg"]) {
  opacity: 1;
}

.composer-content {
  flex: 1;
  position: relative;
}

.textarea-container {
  position: relative;
}

.composer-textarea {
  width: 100%;
  min-height: 60px;
  border: none;
  outline: none;
  resize: none;
  font-size: 1.125rem;
  line-height: 1.5;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
}

.composer-textarea::placeholder {
  color: var(--text-secondary);
}

.image-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.image-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alt-text-input {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 0.5rem;
  font-size: 0.75rem;
}

.alt-text-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.video-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.video-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.video-container {
  position: relative;
  width: 100%;
  height: 200px;
  background: #000;
  border-radius: 8px;
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
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.gif-preview {
  margin-top: 0.75rem;
}

.gif-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  display: inline-block;
}

.preview-gif {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
}

.remove-gif {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.gif-picker-container {
  position: relative;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.drafts-container {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  width: 90%;
  max-width: 500px;
  overflow: hidden;
}

.quoted-post-preview {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-primary);
}

.quote-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.quote-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.quote-author {
  font-weight: 600;
  font-size: 0.875rem;
}

.quote-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.remove-quote {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.quote-text {
  margin: 0;
  font-size: 0.875rem;
}

.composer-actions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-primary);
}

.formatting-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-primary);
}

.format-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.format-btn:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.format-btn.active {
  background: #3b82f6;
  color: white;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 0.25rem;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-primary);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--bg-primary);
}

.suggestion-type {
  color: #3b82f6;
  font-weight: 600;
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-btn {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  padding: 0.5rem;
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

.composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auto-save-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.8;
}

.auto-save-indicator svg {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.char-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.char-count.warning {
  color: #f59e0b;
}

.char-count.error {
  color: #dc2626;
}

.post-buttons {
  display: flex;
  gap: 0.5rem;
}

.cancel-post-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
}

.post-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.post-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>