<template>
  <div class="modmaster-settings">
    <h2>ModMaster Configuration</h2>
    <p class="description">
      Configure how reports to the ModMaster labeler affect your feeds.
    </p>

    <!-- Custom Labeler Section -->
    <section class="section">
      <h3>Custom Labeler (Optional)</h3>
      <p class="help-text">
        Add your own Ozone labeler to enable label commands and personal moderation.
      </p>

      <div v-if="!customLabeler.configured" class="form-group">
        <label>Labeler DID</label>
        <input 
          v-model="customLabeler.did" 
          type="text" 
          placeholder="did:plc:your-labeler-did"
        />

        <label>Ozone URL</label>
        <input 
          v-model="customLabeler.ozoneUrl" 
          type="text" 
          placeholder="https://your-ozone.example.com"
        />

        <label>App Password</label>
        <input 
          v-model="customLabeler.password" 
          type="password" 
          placeholder="Your labeler app password"
        />

        <button @click="saveCustomLabeler" :disabled="saving" class="btn-primary">
          {{ saving ? 'Saving...' : 'Configure Custom Labeler' }}
        </button>
      </div>

      <div v-else class="configured">
        <p><strong>DID:</strong> {{ customLabeler.did }}</p>
        <p><strong>Ozone URL:</strong> {{ customLabeler.ozoneUrl }}</p>
        <button @click="removeCustomLabeler" :disabled="saving" class="btn-danger">
          {{ saving ? 'Removing...' : 'Remove Custom Labeler' }}
        </button>
      </div>
    </section>

    <!-- Report Type Actions -->
    <section class="section">
      <h3>Report Type Actions</h3>
      <p class="help-text">
        Choose what happens when you report posts/accounts with each report type.
      </p>

      <div class="report-types">
        <div v-for="type in reportTypes" :key="type.id" class="report-type-row">
          <label>{{ type.label }}</label>
          <select v-model="reportTypeSettings[type.id]" @change="saveReportTypeSetting(type.id)">
            <option value="remove_all">Remove from all feeds</option>
            <option value="ban_all">Ban from all feeds</option>
            <option value="log_only">Log only (no action)</option>
            <option value="command_only">Commands only</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Non-User Report Weights -->
    <section class="section">
      <h3>Non-User Report Weights</h3>
      <p class="help-text">
        How much should reports from non-app users count toward communal thresholds?
      </p>

      <div class="weight-controls">
        <div class="weight-group">
          <label>Post Removal Weight: {{ nonUserWeights.postWeight.toFixed(2) }}</label>
          <input 
            type="range" 
            v-model.number="nonUserWeights.postWeight" 
            min="0" 
            max="1" 
            step="0.05"
            @change="saveNonUserWeights"
          />
          <span class="weight-hint">0 = ignored, 1 = full weight</span>
        </div>

        <div class="weight-group">
          <label>User Ban Weight: {{ nonUserWeights.banWeight.toFixed(2) }}</label>
          <input 
            type="range" 
            v-model.number="nonUserWeights.banWeight" 
            min="0" 
            max="1" 
            step="0.05"
            @change="saveNonUserWeights"
          />
          <span class="weight-hint">0 = ignored, 1 = full weight</span>
        </div>
      </div>
    </section>

    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const customLabeler = ref({
  configured: false,
  did: '',
  ozoneUrl: '',
  password: ''
})

const reportTypes = [
  { id: 'misleading-spam', label: 'Spam' },
  { id: 'misleading-scam', label: 'Scam' },
  { id: 'misleading-other', label: 'Misleading (Other)' },
  { id: 'harassment-troll', label: 'Trolling' },
  { id: 'harassment-targeted', label: 'Targeted Harassment' },
  { id: 'harassment-other', label: 'Harassment (Other)' },
  { id: 'violence-threats', label: 'Violent Threats' },
  { id: 'violence-other', label: 'Violence (Other)' },
  { id: 'sexual-other', label: 'Sexual Content' },
  { id: 'other', label: 'Other' }
]

const reportTypeSettings = ref<Record<string, string>>({})
const nonUserWeights = ref({
  postWeight: 0.5,
  banWeight: 0.5
})

onMounted(async () => {
  await loadCustomLabeler()
  await loadReportTypeSettings()
  await loadNonUserWeights()
})

async function loadCustomLabeler() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/custom-labeler/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    const data = await response.json()
    
    if (data.configured) {
      customLabeler.value = {
        configured: true,
        did: data.labelerDid,
        ozoneUrl: data.ozoneUrl,
        password: ''
      }
    }
  } catch (error) {
    console.error('Failed to load custom labeler:', error)
  }
}

async function saveCustomLabeler() {
  saving.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/custom-labeler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        userId: authStore.user?.id,
        labelerDid: customLabeler.value.did,
        ozoneUrl: customLabeler.value.ozoneUrl,
        password: customLabeler.value.password
      })
    })

    if (response.ok) {
      showMessage('Custom labeler configured successfully', 'success')
      await loadCustomLabeler()
    } else {
      showMessage('Failed to configure custom labeler', 'error')
    }
  } catch (error) {
    showMessage('Error configuring custom labeler', 'error')
  } finally {
    saving.value = false
  }
}

async function removeCustomLabeler() {
  saving.value = true
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/custom-labeler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        userId: authStore.user?.id,
        labelerDid: null
      })
    })

    if (response.ok) {
      customLabeler.value = { configured: false, did: '', ozoneUrl: '', password: '' }
      showMessage('Custom labeler removed', 'success')
    } else {
      showMessage('Failed to remove custom labeler', 'error')
    }
  } catch (error) {
    showMessage('Error removing custom labeler', 'error')
  } finally {
    saving.value = false
  }
}

async function loadReportTypeSettings() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/report-type-settings/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    const data = await response.json()
    
    // Set defaults
    reportTypes.forEach(type => {
      reportTypeSettings.value[type.id] = data.settings[type.id] || 'remove_all'
    })
  } catch (error) {
    console.error('Failed to load report type settings:', error)
  }
}

async function saveReportTypeSetting(reportType: string) {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/report-type-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        userId: authStore.user?.id,
        reportType,
        action: reportTypeSettings.value[reportType]
      })
    })

    if (response.ok) {
      showMessage('Report type setting saved', 'success')
    }
  } catch (error) {
    showMessage('Error saving report type setting', 'error')
  }
}

async function loadNonUserWeights() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/non-user-weights/${authStore.user?.id}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    const data = await response.json()
    nonUserWeights.value = data
  } catch (error) {
    console.error('Failed to load non-user weights:', error)
  }
}

async function saveNonUserWeights() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/modmaster/non-user-weights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        userId: authStore.user?.id,
        postWeight: nonUserWeights.value.postWeight,
        banWeight: nonUserWeights.value.banWeight
      })
    })

    if (response.ok) {
      showMessage('Non-user weights saved', 'success')
    }
  } catch (error) {
    showMessage('Error saving non-user weights', 'error')
  }
}

function showMessage(text: string, type: 'success' | 'error') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}
</script>

<style scoped>
.modmaster-settings {
  max-width: 800px;
}

h2 {
  margin-bottom: 0.5rem;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.section {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.help-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  margin-top: 0.5rem;
}

.form-group input {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.configured {
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.configured p {
  margin: 0.5rem 0;
}

.report-types {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.report-type-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.report-type-row label {
  font-weight: 500;
  flex: 1;
}

.report-type-row select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 200px;
}

.weight-controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.weight-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.weight-group label {
  font-weight: 500;
}

.weight-group input[type="range"] {
  width: 100%;
}

.weight-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.btn-primary, .btn-danger {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-top: 1rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.message.success {
  background: #10b981;
  color: white;
}

.message.error {
  background: #ef4444;
  color: white;
}
</style>
