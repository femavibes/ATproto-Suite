<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content thread-modal" @click.stop>
        <BskyThreadComposer 
          :user-avatar="userAvatar"
          @publish="handlePublish"
          @cancel="$emit('close')"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import BskyThreadComposer from './BskyThreadComposer.vue'

interface Props {
  show: boolean
  userAvatar?: string
}

defineProps<Props>()

defineEmits<{
  publish: [posts: Array<{ text: string, images: Array<{ file: File, alt: string }> }>]
  close: []
}>()

const handleOverlayClick = () => {
  // @ts-ignore
  $emit('close')
}

const handlePublish = (posts: Array<{ text: string, images: Array<{ file: File, alt: string }> }>) => {
  // @ts-ignore
  $emit('publish', posts)
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
  padding: 1rem;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 8px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.thread-modal {
  max-width: 700px;
}
</style>