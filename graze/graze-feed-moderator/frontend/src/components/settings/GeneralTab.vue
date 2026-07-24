<template>
  <div class="general-tab">
    <!-- Appearance -->
    <div class="section">
      <h2>Appearance</h2>
      <div class="card">
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Dark Mode</div>
            <small>Switch between light and dark theme</small>
          </div>
          <button 
            @click="toggleDarkMode"
            :class="['toggle-switch', { active: themeStore.isDarkMode }]"
          >
            <div class="toggle-slider"></div>
          </button>
        </div>
        
        <div class="theme-row">
          <div>
            <div class="toggle-label">Theme</div>
            <small>Choose a theme to personalize your experience</small>
          </div>
          <select v-model="themeStore.selectedTheme" @change="updateTheme" class="theme-select">
            <option value="default">Default</option>
            <option value="pride">Pride</option>
            <option value="trans">Trans</option>
            <option value="blm">Black Lives Matter</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Content Filtering -->
    <div class="section">
      <h2>Content Filtering</h2>
      <p class="section-desc">Control what content you see in your timeline</p>
      
      <div class="card">
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Hide NSFW Content</div>
            <small>Hide posts marked as sexual or adult content</small>
          </div>
          <button 
            @click="contentFilterStore.setHideNSFW(!contentFilterStore.hideNSFW)"
            :class="['toggle-switch', { active: contentFilterStore.hideNSFW }]"
          >
            <div class="toggle-slider"></div>
          </button>
        </div>
        
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Hide Sensitive Content</div>
            <small>Hide posts with graphic or violent content</small>
          </div>
          <button 
            @click="contentFilterStore.setHideSensitive(!contentFilterStore.hideSensitive)"
            :class="['toggle-switch', { active: contentFilterStore.hideSensitive }]"
          >
            <div class="toggle-slider"></div>
          </button>
        </div>
        
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Hide Spam</div>
            <small>Hide posts marked as spam or low quality</small>
          </div>
          <button 
            @click="contentFilterStore.setHideSpam(!contentFilterStore.hideSpam)"
            :class="['toggle-switch', { active: contentFilterStore.hideSpam }]"
          >
            <div class="toggle-slider"></div>
          </button>
        </div>
        
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Show Content Warnings</div>
            <small>Show warnings for potentially sensitive content</small>
          </div>
          <button 
            @click="contentFilterStore.setShowContentWarnings(!contentFilterStore.showContentWarnings)"
            :class="['toggle-switch', { active: contentFilterStore.showContentWarnings }]"
          >
            <div class="toggle-slider"></div>
          </button>
        </div>
      </div>
    </div>

    <!-- Emergency Tools -->
    <div class="section">
      <h2>Emergency Tools</h2>
      <p class="section-desc">Advanced tools for fixing list issues</p>
      
      <div class="card emergency-card">
        <div class="emergency-header">
          <div>
            <h3>List Cleanup</h3>
            <p>Remove ALL instances of a user from a Bluesky list (fixes duplicate entries)</p>
          </div>
          <button @click="showEmergencyModal = true" class="btn-danger">
            Cleanup
          </button>
        </div>
      </div>
    </div>

    <!-- Emergency Modal -->
    <div v-if="showEmergencyModal" class="modal-overlay" @click="showEmergencyModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Emergency List Cleanup</h3>
          <button @click="showEmergencyModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div class="info-box">
            <p>Remove ALL instances of a user from a list (fixes duplicate entries)</p>
          </div>
          <form @submit.prevent="emergencyRemoval">
            <div class="form-group">
              <label>User Handle</label>
              <input v-model="emergencyForm.userHandle" type="text" placeholder="@username.bsky.social" required>
            </div>
            <div class="form-group">
              <label>List URI</label>
              <input v-model="emergencyForm.listUri" type="text" placeholder="at://did:plc:xxx/app.bsky.graph.list/xxx" required>
              <small>Copy from your block list configuration</small>
            </div>
            <div class="modal-actions">
              <button type="button" @click="showEmergencyModal = false" class="btn-secondary">Cancel</button>
              <button type="submit" :disabled="emergencyRemoving" class="btn-danger">
                {{ emergencyRemoving ? 'Removing...' : 'Emergency Remove' }}
              </button>
            </div>
          </form>
          <div v-if="emergencyResult" class="message" :class="emergencyResult.success ? 'success' : 'error'">
            {{ emergencyResult.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'
import { useContentFilterStore } from '../../stores/contentFilter'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const contentFilterStore = useContentFilterStore()
const showEmergencyModal = ref(false)
const emergencyForm = ref({ userHandle: '', listUri: '' })
const emergencyRemoving = ref(false)
const emergencyResult = ref(null)

const toggleDarkMode = () => {
  themeStore.toggleDarkMode()
}

const updateTheme = () => {
  themeStore.setTheme(themeStore.selectedTheme)
}

const emergencyRemoval = async () => {
  emergencyRemoving.value = true
  emergencyResult.value = null
  
  try {
    const response = await axios.post('/api/emergency/remove-from-list', {
      userHandle: emergencyForm.value.userHandle,
      listUri: emergencyForm.value.listUri
    })
    
    emergencyResult.value = { success: true, message: response.data.message }
    emergencyForm.value = { userHandle: '', listUri: '' }
    
  } catch (error) {
    console.error('Emergency removal failed:', error)
    emergencyResult.value = {
      success: false,
      message: 'Emergency removal failed: ' + (error.response?.data?.error || error.message)
    }
  } finally {
    emergencyRemoving.value = false
  }
}

onMounted(async () => {
  await themeStore.initializeTheme()
})
</script>

<style scoped>
.general-tab {
  width: 100%;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  margin: 0 0 0.5rem 0;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0 0 1rem 0;
}

.card {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px var(--shadow);
  border: 1px solid var(--border-primary);
}

.toggle-row, .theme-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.theme-row {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.toggle-label {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.toggle-switch.active {
  background: #3b82f6;
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-slider {
  transform: translateX(20px);
}

.theme-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  min-width: 140px;
}

.emergency-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.emergency-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.emergency-header h3 {
  margin: 0 0 0.5rem 0;
  color: #dc2626;
}

.emergency-header p {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px var(--shadow);
  border: 1px solid var(--border-primary);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-content {
  padding: 1.5rem;
}

.info-box {
  background: #e0f2fe;
  border: 1px solid #0891b2;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.info-box p {
  margin: 0;
  color: #0c4a6e;
  font-weight: 500;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.message.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
</style>
