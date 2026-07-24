<template>
  <div class="card">
    <div class="card-header">
      <div class="card-title">
        <div class="card-title-left">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
          <h3>Backfill Post Removal</h3>
        </div>
        <button @click="$emit('show-info', 'backfill')" class="info-btn">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
      </div>
      <p class="card-description">Remove the last X posts by a user from all your feeds. Useful for mass spam situations.</p>
      <div class="backfill-remaining-box">
        <div class="remaining-breakdown">
          <div class="remaining-item">25 posts: <span class="remaining-count">{{ backfillLimits?.['25']?.remaining || 20 }}</span>/20</div>
          <div class="remaining-item">50 posts: <span class="remaining-count">{{ backfillLimits?.['50']?.remaining || 10 }}</span>/10</div>
          <div class="remaining-item">100 posts: <span class="remaining-count">{{ backfillLimits?.['100']?.remaining || 5 }}</span>/5</div>
        </div>
      </div>
    </div>
    <div class="card-content">
      <div class="backfill-form">
        <input 
          v-model="form.userHandle" 
          type="text" 
          placeholder="@username.bsky.social"
          class="post-url-input"
        >
        <select v-model="form.postCount" class="post-count-select">
          <option value="25">25 posts (20/month)</option>
          <option value="50">50 posts (10/month)</option>
          <option value="100">100 posts (5/month)</option>
        </select>
        <button 
          @click="handleBackfill" 
          :disabled="!canBackfill || processing"
          class="backfill-btn"
        >
          {{ processing ? 'Removing...' : 'Remove Posts' }}
        </button>
      </div>
      <div v-if="results.length > 0" class="results">
        <div v-for="result in results" :key="result.userHandle" class="result-item">
          <span :class="result.success ? 'success' : 'error'">
            {{ result.success ? '✓ Backfill completed' : '✗ ' + result.error }}
          </span>
          <div v-if="result.success" class="backfill-details">
            <small>{{ result.postsProcessed }} posts processed, {{ result.removalsAttempted }} removal attempts</small>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'

interface BackfillResult {
  success: boolean
  userHandle?: string
  postsProcessed?: number
  removalsAttempted?: number
  error?: string
}

const props = defineProps<{
  backfillsRemaining: number
  backfillLimits?: any
  userTier: string
}>()

const emit = defineEmits<{
  'show-info': [topic: string]
  'backfill-completed': [remaining: number]
}>()

const form = ref({
  userHandle: '',
  postCount: 25
})

const processing = ref(false)
const results = ref<BackfillResult[]>([])

const canBackfill = computed(() => {
  return form.value.userHandle && props.backfillsRemaining > 0
})

const handleBackfill = async () => {
  processing.value = true
  results.value = []
  
  try {
    const userHandle = form.value.userHandle.replace('@', '')
    
    const response = await axios.post('/api/moderation/backfill-removal', {
      userHandle,
      postCount: parseInt(form.value.postCount.toString())
    })
    
    if (response.data.success) {
      results.value = [{ 
        success: true, 
        userHandle,
        postsProcessed: response.data.postsProcessed,
        removalsAttempted: response.data.removalsAttempted
      }]
      emit('backfill-completed', response.data.backfillsRemaining)
      form.value.userHandle = ''
    } else {
      results.value = [{ success: false, error: response.data.error }]
    }
    
  } catch (error) {
    console.error('Failed backfill removal:', error)
    results.value = [{ success: false, error: 'Backfill removal failed' }]
  } finally {
    processing.value = false
  }
}
</script>

<style scoped>
.card {
  background: white;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.card-header {
  padding: 0.75rem 0.75rem 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

@media (min-width: 640px) {
  .card-header {
    padding: 1rem 1rem 0.75rem 1rem;
  }
}

@media (min-width: 768px) {
  .card-header {
    padding: 1.5rem 2rem 1rem 2rem;
  }
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
}

.icon {
  width: 24px;
  height: 24px;
  color: #64748b;
}

.info-btn {
  background: #374151;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: all 0.2s;
}

.info-btn svg {
  width: 16px;
  height: 16px;
}

.info-btn:hover {
  background: #4b5563;
}

.card-description {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

.backfill-remaining-box {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  font-size: 0.875rem;
  color: #374151;
}

.remaining-breakdown {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.remaining-item {
  text-align: center;
  flex: 1;
}

.remaining-count {
  font-weight: 700;
  color: #1f2937;
}

.card-content {
  padding: 0.75rem;
}

@media (min-width: 640px) {
  .card-content {
    padding: 1rem;
  }
}

@media (min-width: 768px) {
  .card-content {
    padding: 1.5rem 2rem;
  }
}

.backfill-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .backfill-form {
    gap: 0.75rem;
  }
}

@media (min-width: 768px) {
  .backfill-form {
    flex-direction: row;
    gap: 0.5rem;
  }
}

.post-url-input {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-family: monospace;
  min-height: 44px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

@media (min-width: 640px) {
  .post-url-input {
    padding: 0.75rem;
  }
}

.post-url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.post-count-select {
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  min-height: 44px;
  font-size: 0.875rem;
}

@media (min-width: 640px) {
  .post-count-select {
    padding: 0.75rem;
  }
}

.backfill-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  min-height: 44px;
  font-size: 0.875rem;
}

.backfill-btn:hover:not(:disabled) {
  background: #dc2626;
}

.backfill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.result-item {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border-left: 4px solid #e5e7eb;
}

.result-item:last-child {
  margin-bottom: 0;
}

.success {
  color: #10b981;
  font-weight: 600;
}

.error {
  color: #ef4444;
  font-weight: 600;
}

.backfill-details {
  margin-top: 0.25rem;
  color: #6b7280;
}
</style>