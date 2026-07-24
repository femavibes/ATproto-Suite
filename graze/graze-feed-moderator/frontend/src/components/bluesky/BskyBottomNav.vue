<template>
  <div class="bottom-nav">
    <!-- Main Navigation Icons -->
    <button 
      @click="$emit('navigate', 'home')"
      :class="['nav-item', { active: activeTab === 'home' }]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    </button>

    <button 
      @click="$emit('navigate', 'search')"
      :class="['nav-item', { active: activeTab === 'search' }]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
    </button>

    <button 
      @click="$emit('navigate', 'notifications')"
      :class="['nav-item', { active: activeTab === 'notifications' }]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
    </button>

    <button 
      @click="$emit('navigate', 'profile')"
      :class="['nav-item', { active: activeTab === 'profile' }]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    </button>

    <button 
      @click="toggleMenu"
      :class="['nav-item', 'menu-button', { active: showMenu }]"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
    </button>

    <!-- Hamburger Menu Popup -->
    <div v-if="showMenu" class="menu-popup" @click.stop>
      <div class="menu-item" @click="navigateAndClose('bookmarks')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
        <span>Bookmarks</span>
      </div>
      <div class="menu-item debug-toggle-item" @click.stop>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 3H7v2H5v2h2v2h2V7h2V5H9V3zm0 8H7v2H5v2h2v2h2v-2h2v-2H9v-2zm8-8h-2v2h-2v2h2v2h2V7h2V5h-2V3zm0 8h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2z"/>
        </svg>
        <span>Record View</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="debugStore.showDebugMode.value">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Backdrop -->
    <div v-if="showMenu" class="menu-backdrop" @click="showMenu = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useDebugStore } from '../../stores/debug'

const debugStore = useDebugStore()

interface Props {
  activeTab: string
}

defineProps<Props>()

const emit = defineEmits<{
  navigate: [tab: string]
}>()

const showMenu = ref(false)

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const navigateAndClose = (tab: string) => {
  showMenu.value = false
  emit('navigate', tab)
}

onMounted(() => {
  debugStore.loadDebugMode()
})

// Watch for changes and save to localStorage
watch(() => debugStore.showDebugMode.value, (newValue) => {
  debugStore.setDebugMode(newValue)
})
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border-top: 1px solid var(--border-primary);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0.75rem 0;
  z-index: 100;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
}

.nav-item {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  min-width: 48px;
}

.nav-item:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.nav-item.active {
  color: #3b82f6;
  background: #f0f9ff;
}

.menu-button.active {
  background: var(--bg-primary);
}

.menu-popup {
  position: absolute;
  bottom: 100%;
  right: 1rem;
  margin-bottom: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  overflow: hidden;
  z-index: 101;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-primary);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: var(--bg-primary);
}

.menu-item svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.menu-item span {
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
}

.debug-toggle-item {
  justify-content: space-between;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 22px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(18px);
}

.menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
}

@media (max-width: 768px) {
  .bottom-nav {
    padding: 0.5rem 0;
  }
  
  .nav-item {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>