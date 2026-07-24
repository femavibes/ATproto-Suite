<template>
  <div class="bookmarks-container">
    <div class="bookmarks-header">
      <h2>Bookmarks</h2>
      <button @click="clearAllBookmarks" v-if="bookmarks.length > 0" class="clear-btn">Clear All</button>
    </div>
    
    <div v-if="bookmarks.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      <h3>No bookmarks yet</h3>
      <p>Save posts you want to read later by clicking the bookmark icon</p>
    </div>
    
    <div v-else class="bookmarks-list">
      <BskyPost 
        v-for="bookmark in bookmarks" 
        :key="bookmark.uri"
        :post="bookmark.post"
        :user-profile="userProfile"
        @repost="$emit('repost', $event)"
        @quote="$emit('quote', $event)"
        @like="$emit('like', $event)"
        @moderate="$emit('moderate', $event)"
        @view-profile="$emit('viewProfile', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BskyPost from './BskyPost.vue'

interface Props {
  userProfile?: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  repost: [post: any]
  quote: [post: any]
  like: [post: any]
  moderate: [post: any, action: string, target?: string]
  viewProfile: [handle: string]
}>()

const bookmarks = ref([])

const loadBookmarks = () => {
  const saved = JSON.parse(localStorage.getItem('bsky-bookmarks') || '[]')
  bookmarks.value = saved
}

const clearAllBookmarks = () => {
  if (confirm('Clear all bookmarks? This cannot be undone.')) {
    localStorage.removeItem('bsky-bookmarks')
    bookmarks.value = []
  }
}

onMounted(() => {
  loadBookmarks()
  
  // Listen for bookmark changes from other components
  window.addEventListener('storage', (e) => {
    if (e.key === 'bsky-bookmarks') {
      loadBookmarks()
    }
  })
})
</script>

<style scoped>
.bookmarks-container {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.bookmarks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.bookmarks-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: #b91c1c;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.empty-state svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  line-height: 1.5;
}

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .bookmarks-container {
    padding: 0.5rem;
  }
}
</style>