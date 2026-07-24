<template>
  <div class="credentials-tab">
    <!-- Password Management -->
    <div class="section">
      <h2>Password</h2>
      <p class="section-desc">{{ zeroTrustSettings.enabled ? 'Password for logging into Feed Moderator (zero-trust handles Bluesky authentication)' : 'Bluesky app password required for feed operations and login' }}</p>
      
      <div class="card">
        <div v-if="zeroTrustSettings.enabled && passwordType === 'app'" class="warning-box">
          <strong>⚠️ Recommendation:</strong> You're using zero-trust mode with a Bluesky app password. Change to a regular password since zero-trust handles Bluesky authentication.
        </div>
        <div v-if="!zeroTrustSettings.enabled && passwordType === 'basic'" class="warning-box">
          <strong>⚠️ Recommendation:</strong> You should use a Bluesky app password for feed operations. Create one in your Bluesky settings (required for DM support in autoblock).
        </div>
        <div class="form-group">
          <label>{{ zeroTrustSettings.enabled ? 'Feed Moderator Password' : 'Bluesky App Password' }}</label>
          <input 
            v-model="credentialsForm.password" 
            type="password" 
            :placeholder="zeroTrustSettings.enabled ? 'Enter your Feed Moderator password' : 'Enter your Bluesky app password'"
          >
          <small v-if="zeroTrustSettings.enabled">
            Currently using: {{ passwordType === 'app' ? 'Bluesky app password (consider changing to basic password)' : 'Basic password' }}. Encrypted with AES-256.
          </small>
          <small v-else>
            Currently using: {{ passwordType === 'app' ? 'Bluesky app password' : 'Basic password (consider changing to Bluesky app password)' }}. Encrypted with AES-256.
          </small>
        </div>
        
        <button 
          @click="updateCredentials" 
          :disabled="!credentialsForm.password || updatingCredentials"
          class="btn-primary"
        >
          {{ updatingCredentials ? 'Updating...' : 'Update Password' }}
        </button>
        
        <div v-if="credentialsMessage" class="message" :class="credentialsMessageType">
          {{ credentialsMessage }}
        </div>
      </div>
    </div>

    <!-- Zero-Trust Mode -->
    <div class="section">
      <h2>Zero-Trust Authentication</h2>
      <p class="section-desc">Deploy your own authentication proxy - your Bluesky credentials never leave your infrastructure</p>
      
      <div class="card">
        <div v-if="zeroTrustSettings.enabled" class="status-indicator" :class="zeroTrustSettings.status">
          <span class="status-dot"></span>
          <span class="status-text">{{ getStatusText(zeroTrustSettings.status) }}</span>
          <button @click="disableZeroTrust" class="btn-disable" :disabled="disablingProxy">
            {{ disablingProxy ? 'Disabling...' : 'Disable Zero-Trust' }}
          </button>
        </div>
        
        <template v-if="zeroTrustSettings.enabled">
          <div class="form-group">
            <label>Proxy URL</label>
            <input 
              v-model="zeroTrustForm.proxyUrl" 
              type="url" 
              placeholder="http://your-server:3550"
            >
          </div>
          
          <div class="form-group">
            <label>API Key</label>
            <input 
              v-model="zeroTrustForm.apiKey" 
              type="password" 
              placeholder="API key from proxy logs"
            >
          </div>
          
          <button 
            @click="configureZeroTrust" 
            :disabled="!zeroTrustForm.proxyUrl || !zeroTrustForm.apiKey || configuringProxy"
            class="btn-primary"
          >
            {{ configuringProxy ? 'Testing Connection...' : 'Update Zero-Trust Proxy' }}
          </button>
        </template>
        
        <div v-if="!zeroTrustSettings.enabled && zeroTrustSettings.proxyUrl" class="info-box">
          <p><strong>Zero-Trust Disabled:</strong> Your saved proxy configuration is preserved. Click "Enable Zero-Trust" to re-activate.</p>
        </div>
        
        <div v-if="!zeroTrustSettings.enabled && !zeroTrustSettings.proxyUrl" class="info-box">
          <p><strong>Maximum Security:</strong> Your Bluesky credentials stay on your server. Feed-moderator only receives temporary session tokens.</p>
          <p><strong>Complete Control:</strong> Stop your proxy container = instant access revocation. Full audit trail of all operations.</p>
        </div>
        
        <div v-if="!zeroTrustSettings.enabled && !zeroTrustSettings.proxyUrl" class="setup-instructions">
          <h4>Quick Setup:</h4>
          <ol>
            <li>Run: <code>docker run -d -p 3550:3550 -e BLUESKY_HANDLE=you.bsky.social -e BLUESKY_PASSWORD=your-app-password feedmoderator/auth-proxy</code></li>
            <li>Get API key from logs: <code>docker logs [container-id]</code></li>
            <li>Enter proxy URL and API key below</li>
          </ol>
        </div>
        
        <button 
          v-if="!zeroTrustSettings.enabled && zeroTrustSettings.proxyUrl"
          @click="enableZeroTrust" 
          :disabled="enablingProxy"
          class="btn-primary"
        >
          {{ enablingProxy ? 'Enabling...' : 'Enable Zero-Trust' }}
        </button>
        
        <template v-if="!zeroTrustSettings.enabled && !zeroTrustSettings.proxyUrl">
          <div class="form-group">
            <label>Proxy URL</label>
            <input 
              v-model="zeroTrustForm.proxyUrl" 
              type="url" 
              placeholder="http://your-server:3550"
            >
          </div>
          
          <div class="form-group">
            <label>API Key</label>
            <input 
              v-model="zeroTrustForm.apiKey" 
              type="password" 
              placeholder="API key from proxy logs"
            >
          </div>
          
          <button 
            @click="configureZeroTrust" 
            :disabled="!zeroTrustForm.proxyUrl || !zeroTrustForm.apiKey || configuringProxy"
            class="btn-primary"
          >
            {{ configuringProxy ? 'Testing Connection...' : 'Configure Zero-Trust Proxy' }}
          </button>
        </template>
        
        <div v-if="zeroTrustMessage" class="message" :class="zeroTrustMessageType">
          {{ zeroTrustMessage }}
        </div>
      </div>
    </div>

    <!-- Logout -->
    <div class="section">
      <h2>Account</h2>
      <p class="section-desc">Manage your session</p>
      
      <div class="card">
        <button @click="logout" class="btn-logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const zeroTrustSettings = ref({ enabled: false, proxyUrl: null, status: 'inactive' })
const zeroTrustForm = ref({ proxyUrl: '', apiKey: '' })
const configuringProxy = ref(false)
const disablingProxy = ref(false)
const enablingProxy = ref(false)
const zeroTrustMessage = ref('')
const zeroTrustMessageType = ref('')
const passwordType = ref<'basic' | 'app' | null>(null)

const credentialsForm = ref({ password: '' })
const updatingCredentials = ref(false)
const credentialsMessage = ref('')
const credentialsMessageType = ref('')

const loadZeroTrustSettings = async () => {
  try {
    const response = await axios.get('/api/user/zero-trust-settings')
    zeroTrustSettings.value = response.data
    passwordType.value = response.data.passwordType || null
    if (response.data.proxyUrl) {
      zeroTrustForm.value.proxyUrl = response.data.proxyUrl
    }
  } catch (error) {
    console.error('Failed to load zero-trust settings:', error)
  }
}

const configureZeroTrust = async () => {
  configuringProxy.value = true
  zeroTrustMessage.value = ''
  
  try {
    await axios.post('/api/user/configure-zero-trust', {
      proxyUrl: zeroTrustForm.value.proxyUrl,
      apiKey: zeroTrustForm.value.apiKey
    })
    
    zeroTrustMessage.value = 'Proxy configured successfully!'
    zeroTrustMessageType.value = 'success'
    await loadZeroTrustSettings()
    
  } catch (error) {
    console.error('Failed to configure proxy:', error)
    zeroTrustMessage.value = error.response?.data?.error || 'Configuration failed'
    zeroTrustMessageType.value = 'error'
  } finally {
    configuringProxy.value = false
    setTimeout(() => zeroTrustMessage.value = '', 5000)
  }
}

const disableZeroTrust = async () => {
  disablingProxy.value = true
  zeroTrustMessage.value = ''
  
  try {
    await axios.post('/api/user/disable-zero-trust')
    
    zeroTrustMessage.value = 'Zero-trust mode disabled'
    zeroTrustMessageType.value = 'success'
    await loadZeroTrustSettings()
    
  } catch (error) {
    console.error('Failed to disable zero-trust:', error)
    zeroTrustMessage.value = error.response?.data?.error || 'Failed to disable'
    zeroTrustMessageType.value = 'error'
  } finally {
    disablingProxy.value = false
    setTimeout(() => zeroTrustMessage.value = '', 5000)
  }
}

const enableZeroTrust = async () => {
  enablingProxy.value = true
  zeroTrustMessage.value = ''
  
  try {
    await axios.post('/api/user/enable-zero-trust')
    
    zeroTrustMessage.value = 'Zero-trust mode enabled'
    zeroTrustMessageType.value = 'success'
    await loadZeroTrustSettings()
    
  } catch (error) {
    console.error('Failed to enable zero-trust:', error)
    zeroTrustMessage.value = error.response?.data?.error || 'Failed to enable'
    zeroTrustMessageType.value = 'error'
  } finally {
    enablingProxy.value = false
    setTimeout(() => zeroTrustMessage.value = '', 5000)
  }
}

const updateCredentials = async () => {
  updatingCredentials.value = true
  credentialsMessage.value = ''
  
  try {
    await axios.post('/api/auth/update-password', {
      bskyPassword: credentialsForm.value.password
    })
    
    credentialsMessage.value = 'Password updated successfully!'
    credentialsMessageType.value = 'success'
    credentialsForm.value.password = ''
    await loadZeroTrustSettings()
    
  } catch (error) {
    console.error('Failed to update credentials:', error)
    if (error.response?.status === 401) {
      authStore.logout()
      window.location.href = '/login'
      return
    }
    credentialsMessage.value = 'Failed to update password. Please try again.'
    credentialsMessageType.value = 'error'
  } finally {
    updatingCredentials.value = false
    setTimeout(() => credentialsMessage.value = '', 3000)
  }
}

const getStatusText = (status: string): string => {
  const texts = {
    inactive: 'Not Configured',
    pending: 'Setup Required',
    active: 'Active',
    offline: 'Proxy Offline'
  }
  return texts[status as keyof typeof texts] || status
}

const logout = () => {
  authStore.logout()
  window.location.href = '/login'
}

onMounted(() => {
  loadZeroTrustSettings()
})
</script>

<style scoped>
.credentials-tab {
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

.input-group {
  display: flex;
  gap: 0.5rem;
}

.input-group input {
  flex: 1;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-primary {
  background: #1d4ed8;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  background: #1e40af;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6366f1;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.btn-secondary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-secondary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
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

.success-text {
  color: #059669 !important;
  font-weight: 500;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.status-indicator.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-indicator.active {
  background: #dcfce7;
  color: #166534;
}

.status-indicator.offline {
  background: #fef2f2;
  color: #dc2626;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.setup-instructions {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.setup-instructions h4 {
  margin: 0 0 0.5rem 0;
  color: #1e40af;
}

.setup-instructions ol {
  margin: 0;
  padding-left: 1.5rem;
  color: #1e40af;
}

.setup-instructions li {
  margin-bottom: 0.25rem;
}

.setup-instructions code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  display: inline-block;
  margin: 0.25rem 0;
}

.info-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.info-box p {
  margin: 0 0 0.5rem 0;
  color: #1e40af;
}

.info-box p:last-child {
  margin-bottom: 0;
}

.info-box strong {
  color: #1e40af;
}

.warning-box {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  color: #92400e;
}

.warning-box strong {
  color: #92400e;
}

.btn-disable {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  margin-left: auto;
}

.btn-disable:hover:not(:disabled) {
  background: #dc2626;
}

.btn-disable:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.btn-logout {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: #dc2626;
}

.btn-logout svg {
  width: 18px;
  height: 18px;
}
</style>
