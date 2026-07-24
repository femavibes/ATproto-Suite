<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="composer-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button @click="$emit('close')" class="close-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <BskyComposer 
          :reply-to="replyTo"
          :quoted-post="quotedPost"
          :user-avatar="userAvatar"
          @post="handlePost"
          @cancel="$emit('close')"
          modal
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BskyComposer from './BskyComposer.vue'

interface Props {
  show: boolean
  replyTo?: any
  quotedPost?: any
  userAvatar?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  post: [data: any]
}>()

const title = computed(() => {
  if (props.replyTo) return 'Reply'
  if (props.quotedPost) return 'Quote Post'
  return 'New Post'
})

const handlePost = (data: any) => {
  emit('post', data)
  emit('close')
}
</script>

<style scoped>
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
  backdrop-filter: blur(4px);
}

.composer-modal {
  background: var(--bg-card);
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-primary);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  max-height: calc(80vh - 80px);
}

@media (max-width: 768px) {
  .composer-modal {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-body {
    max-height: calc(90vh - 80px);
  }
}
</style>