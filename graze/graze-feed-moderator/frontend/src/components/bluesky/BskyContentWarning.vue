<template>
  <div class="content-warning" v-if="warning">
    <div class="warning-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span class="warning-text">{{ warning }}</span>
    </div>
    <button @click="$emit('show')" class="show-content-btn">
      Show Content
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  warning: string | null
}

defineProps<Props>()

defineEmits<{
  show: []
}>()
</script>

<style scoped>
.content-warning {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 1rem;
  margin: 0.75rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
}

.warning-text {
  font-weight: 500;
  font-size: 0.875rem;
}

.show-content-btn {
  background: #f59e0b;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.show-content-btn:hover {
  background: #d97706;
}

/* Dark mode */
.dark .content-warning {
  background: #451a03;
  border-color: #92400e;
}

.dark .warning-header {
  color: #fbbf24;
}

.dark .show-content-btn {
  background: #d97706;
}

.dark .show-content-btn:hover {
  background: #b45309;
}
</style>