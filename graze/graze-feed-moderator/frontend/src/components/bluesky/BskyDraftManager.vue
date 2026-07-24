<template>
  <div class="draft-manager">
    <div class="draft-header">
      <h3>Drafts ({{ drafts.length }})</h3>
      <div class="header-actions">
        <button v-if="drafts.length > 0" @click="clearAll" class="clear-all-btn">Clear All</button>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
    </div>
    
    <div v-if="drafts.length === 0" class="no-drafts">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 1 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <p>No drafts saved</p>
    </div>
    
    <div v-else class="draft-list">
      <div v-for="draft in drafts" :key="draft.id" class="draft-item">
        <div class="draft-content" @click="$emit('select', draft)">
          <div class="draft-text">{{ draft.isThread ? `Thread: ${draft.text || 'Empty thread'}` : (draft.text || 'Empty draft') }}</div>
          <div class="draft-meta">
            <span class="draft-time">{{ formatTime(draft.updatedAt) }}</span>
            <span v-if="draft.isThread" class="draft-thread">{{ draft.threadPosts?.length || 1 }} post(s)</span>
            <span v-if="draft.images.length > 0" class="draft-images">{{ draft.images.length }} image(s)</span>
            <span v-if="draft.replyTo" class="draft-reply">Reply to @{{ draft.replyTo.post.author.handle }}</span>
            <span v-if="draft.quotedPost" class="draft-quote">Quote @{{ draft.quotedPost.post.author.handle }}</span>
          </div>
        </div>
        <button @click="deleteDraft(draft.id)" class="delete-draft">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { draftService } from '../../services/draftService'

defineEmits<{
  select: [draft: any]
  close: []
}>()

const drafts = ref<any[]>([])
let unsubscribe: (() => void) | null = null

const loadDrafts = () => {
  drafts.value = draftService.getAllDrafts()
}

const deleteDraft = (id: string) => {
  draftService.deleteDraft(id)
  loadDrafts()
}

const clearAll = () => {
  if (confirm('Delete all drafts?')) {
    draftService.clearAllDrafts()
    loadDrafts()
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

onMounted(() => {
  loadDrafts()
  unsubscribe = draftService.onDraftsChanged(loadDrafts)
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.draft-manager {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
}

.draft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.draft-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.clear-all-btn {
  background: none;
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.clear-all-btn:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.no-drafts {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.no-drafts svg {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.no-drafts p {
  margin: 0;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.draft-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  transition: all 0.2s;
}

.draft-item:hover {
  background: var(--bg-secondary);
  border-color: #3b82f6;
}

.draft-content {
  flex: 1;
  cursor: pointer;
}

.draft-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.draft-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.draft-images,
.draft-reply,
.draft-quote,
.draft-thread {
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.delete-draft {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 1.125rem;
  transition: all 0.2s;
}

.delete-draft:hover {
  background: #dc2626;
  color: white;
}
</style>