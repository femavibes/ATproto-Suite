<template>
  <div class="settings">
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="handleTabClick(tab.id)"
        :class="['tab', { active: activeTab === tab.id }]"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <CredentialsTab v-if="activeTab === 'credentials'" />
      <GlobalModerationSettingsTab v-if="activeTab === 'moderation'" />
      <GeneralTab v-if="activeTab === 'general'" />
      <ApiKeysTab v-if="activeTab === 'api-keys'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import CredentialsTab from '../components/settings/CredentialsTab.vue'
import GlobalModerationSettingsTab from '../components/settings/GlobalModerationSettingsTab.vue'
import GeneralTab from '../components/settings/GeneralTab.vue'
import ApiKeysTab from '../components/settings/ApiKeysTab.vue'

const authStore = useAuthStore()
const router = useRouter()
const activeTab = ref('credentials')

const tabs = computed(() => {
  const baseTabs = [
    { id: 'credentials', label: 'Credentials' },
    { id: 'moderation', label: 'Global Moderation' },
    { id: 'general', label: 'General' },
    { id: 'api-keys', label: 'API Keys' }
  ]
  
  if (authStore.isAdmin) {
    baseTabs.push({ id: 'admin', label: 'Admin' })
  }
  
  return baseTabs
})

const handleTabClick = (tabId: string) => {
  if (tabId === 'admin') {
    router.push('/admin')
  } else {
    activeTab.value = tabId
  }
}

const logout = () => {
  authStore.logout()
  window.location.href = '/login'
}
</script>

<style scoped>
.settings {
  padding: 0;
}

.tabs {
  display: flex;
  gap: 0;
  margin: -1rem 0 0 0;
  background: var(--bg-primary);
  padding: 0;
  border-top: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
}

.tab {
  flex: 1;
  padding: 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--border-primary);
  font-weight: 500;
}

.tab:last-child {
  border-right: none;
}

.tab.active {
  background: #3b82f6;
  color: white;
}

.tab:hover:not(.active) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab-content {
  min-height: 400px;
  padding-top: 1.5rem;
}
</style>
