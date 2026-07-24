<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-container">
        <svg class="logo" viewBox="0 0 40 40" fill="none">
          <defs>
            <linearGradient id="loginShield" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stop-color="#7c3aed"/>
              <stop offset="50%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
          </defs>
          <path d="M20 4L8 10v8c0 7.5 5.2 14.5 12 16 6.8-1.5 12-8.5 12-16v-8L20 4z" fill="url(#loginShield)"/>
          <text x="20" y="26" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="900" letter-spacing="1">MM</text>
        </svg>
      </div>
      <h2>ModMaster</h2>
      <p class="subtitle">Advanced custom feed moderation</p>
      
      <form @submit.prevent="handleLogin" v-if="!showRegister && !showForgotPassword">
        <h3>Login</h3>
        <div class="form-group">
          <label>Bluesky Handle</label>
          <input 
            v-model="loginForm.handle" 
            type="text" 
            placeholder="yourname.bsky.social"
            required
          />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input 
            v-model="loginForm.bskyPassword" 
            type="password" 
            placeholder="Password"
            autocomplete="current-password"
            required
          />
          <small>(Basic OR Bluesky app password)</small>
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
        <p class="switch-form">
          <a @click="showForgotPassword = true; showRegister = false">Forgot password?</a>
        </p>
        <p class="switch-form">
          New user? <a @click="showRegister = true; showForgotPassword = false">Register here</a>
        </p>
        <button type="button" @click="handleDemoLogin" class="demo-btn" :disabled="loading">
          {{ loading ? 'Loading...' : 'Try Demo Mode' }}
        </button>
      </form>

      <form @submit.prevent="handlePasswordReset" v-if="showForgotPassword && !showRegister && !showPasswordChoice">
        <h3>Reset Password</h3>
        <p class="info-text">Verify your account ownership with a Bluesky app password. This password will NOT be saved automatically.</p>
        <div class="form-group">
          <label>Bluesky Handle</label>
          <input 
            v-model="resetForm.handle" 
            type="text" 
            placeholder="yourname.bsky.social"
            required
          />
        </div>
        <div class="form-group">
          <label>App Password (for verification only)</label>
          <input 
            v-model="resetForm.newBskyPassword" 
            type="password" 
            placeholder="xxxx-xxxx-xxxx-xxxx"
            required
          />
          <small>Used only to verify account ownership - not saved</small>
        </div>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Verifying...' : 'Verify Account' }}
        </button>
        <p class="switch-form">
          <a @click="showForgotPassword = false; showRegister = false">Back to login</a>
        </p>
      </form>

      <div v-if="showPasswordChoice" class="password-choice">
        <h3>Choose Password Type</h3>
        <p class="info-text">Your account has been verified. Choose how you want to save your password:</p>
        
        <button @click="saveAppPassword" class="choice-btn" :disabled="loading">
          <strong>Use Bluesky App Password</strong>
          <small>Save the app password you just entered (recommended for most users)</small>
        </button>
        
        <button @click="showBasicPasswordForm = true" class="choice-btn" :disabled="loading">
          <strong>Create Basic Password</strong>
          <small>Create a custom password for this app (for zero-trust users)</small>
        </button>

        <form v-if="showBasicPasswordForm" @submit.prevent="saveBasicPassword" class="basic-password-form">
          <div class="form-group">
            <label>Create Password</label>
            <input 
              v-model="resetForm.basicPassword" 
              type="password" 
              placeholder="Enter new password"
              required
            />
          </div>
          <button type="submit" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save Password' }}
          </button>
        </form>
        
        <p class="switch-form">
          <a @click="cancelPasswordChoice">Cancel</a>
        </p>
      </div>

      <form @submit.prevent="handleRegister" v-if="showRegister && !showForgotPassword">
        <h3>Register</h3>
        <div class="form-group">
          <label>Bluesky Handle</label>
          <input 
            v-model="registerForm.handle" 
            type="text" 
            placeholder="yourname.bsky.social"
            required
          />
        </div>
        <div class="form-group" v-if="!registerForm.zeroTrustMode">
          <label>Password</label>
          <input 
            v-model="registerForm.bskyPassword" 
            type="password" 
            placeholder="Your Bluesky app password"
            autocomplete="new-password"
            required
          />
          <small>This password will be saved (AES-256 encrypted) for login and feed operations (enable DM access for autoblock)</small>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
        <div class="form-group toggle-group">
          <label class="toggle-label">
            <span>Use Zero-Trust Authentication</span>
            <div class="toggle-switch">
              <input type="checkbox" v-model="registerForm.zeroTrustMode" />
              <span class="toggle-slider"></span>
            </div>
          </label>
          <small>Configure your own authentication proxy for maximum security<br>
            <a href="https://github.com/femavibes/modmaster-zero-trust-auth-proxy" target="_blank" class="github-link">Get Zero-Trust Proxy →</a>
          </small>
        </div>
        <div class="form-group" v-if="registerForm.zeroTrustMode">
          <label>Feed Moderator Password</label>
          <input 
            v-model="registerForm.appPassword" 
            type="password" 
            placeholder="Create a password for this app"
            autocomplete="new-password"
            required
          />
          <small>Create a password for logging into Feed Moderator (your Bluesky password won't be saved)</small>
        </div>
        <div class="form-group" v-if="registerForm.zeroTrustMode">
          <label>Proxy URL</label>
          <input 
            v-model="registerForm.proxyUrl" 
            type="url" 
            placeholder="http://your-server:3550"
            required
          />
        </div>
        <div class="form-group" v-if="registerForm.zeroTrustMode">
          <label>Proxy API Key</label>
          <input 
            v-model="registerForm.proxyApiKey" 
            type="password" 
            placeholder="API key from proxy logs"
            required
          />
        </div>
        <button type="submit" :disabled="loading || !validateForm()">
          {{ loading ? 'Registering...' : 'Register' }}
        </button>
        <p class="switch-form">
          Already registered? <a @click="showRegister = false; showForgotPassword = false">Login here</a>
        </p>
      </form>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Redirect if already logged in
onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
  }
})

const showRegister = ref(false)
const showForgotPassword = ref(false)
const loading = ref(false)
const error = ref('')

const loginForm = ref({
  handle: '',
  bskyPassword: ''
})

const resetForm = ref({
  handle: '',
  newBskyPassword: '',
  basicPassword: '',
  verifiedToken: ''
})

const showPasswordChoice = ref(false)
const showBasicPasswordForm = ref(false)

const registerForm = ref({
  handle: '',
  bskyPassword: '',
  appPassword: '',
  zeroTrustMode: false,
  proxyUrl: '',
  proxyApiKey: ''
})

const validateForm = () => {
  if (registerForm.value.zeroTrustMode) {
    return registerForm.value.handle && registerForm.value.appPassword && 
           registerForm.value.proxyUrl && registerForm.value.proxyApiKey
  }
  return registerForm.value.handle && registerForm.value.bskyPassword
}

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const success = await authStore.login(
      loginForm.value.handle,
      loginForm.value.bskyPassword
    )
    
    if (success) {
      router.push('/dashboard')
    } else {
      error.value = 'Login failed. Please check your handle and password.'
    }
  } catch (err: any) {
    if (err.response?.status === 409 && err.response?.data?.canUpdate) {
      const confirmed = confirm(
        'This is a valid Bluesky app password, but it\'s not your currently saved password.\n\n' +
        'Would you like to update your saved password to this new one?'
      )
      
      if (confirmed) {
        try {
          const response = await fetch('/api/auth/update-login-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              handle: loginForm.value.handle,
              newPassword: loginForm.value.bskyPassword
            })
          })
          
          if (response.ok) {
            alert('Password updated! Logging you in...')
            const success = await authStore.login(
              loginForm.value.handle,
              loginForm.value.bskyPassword
            )
            if (success) {
              router.push('/dashboard')
            }
          } else {
            error.value = 'Failed to update password'
          }
        } catch (updateErr) {
          error.value = 'Failed to update password'
        }
      }
    } else {
      error.value = 'Login failed. Please check your handle and password.'
    }
  }
  
  loading.value = false
}

const handleRegister = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const success = await authStore.register(
      registerForm.value.handle,
      registerForm.value.bskyPassword,
      registerForm.value.appPassword,
      registerForm.value.zeroTrustMode,
      registerForm.value.proxyUrl,
      registerForm.value.proxyApiKey
    )
    
    if (success) {
      router.push('/dashboard')
    } else {
      error.value = 'Registration failed. Please check your handle and try again.'
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Registration failed. Please check your handle and try again.'
  }
  
  loading.value = false
}

const handlePasswordReset = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/auth/verify-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: resetForm.value.handle,
        newBskyPassword: resetForm.value.newBskyPassword
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      error.value = ''
      resetForm.value.verifiedToken = data.token
      showPasswordChoice.value = true
    } else {
      error.value = data.error || 'Verification failed'
    }
  } catch (err) {
    error.value = 'Verification failed. Please try again.'
  }
  
  loading.value = false
}

const saveAppPassword = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/auth/complete-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetForm.value.verifiedToken,
        passwordType: 'app',
        password: resetForm.value.newBskyPassword
      })
    })
    
    if (response.ok) {
      alert('Password saved! You can now login with your app password.')
      cancelPasswordChoice()
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to save password'
    }
  } catch (err) {
    error.value = 'Failed to save password. Please try again.'
  }
  
  loading.value = false
}

const saveBasicPassword = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/auth/complete-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetForm.value.verifiedToken,
        passwordType: 'basic',
        password: resetForm.value.basicPassword
      })
    })
    
    if (response.ok) {
      alert('Password saved! You can now login with your new password.')
      cancelPasswordChoice()
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to save password'
    }
  } catch (err) {
    error.value = 'Failed to save password. Please try again.'
  }
  
  loading.value = false
}

const cancelPasswordChoice = () => {
  showPasswordChoice.value = false
  showBasicPasswordForm.value = false
  showForgotPassword.value = false
  showRegister.value = false
  resetForm.value = { handle: '', newBskyPassword: '', basicPassword: '', verifiedToken: '' }
}

const handleDemoLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const success = authStore.demoLogin()
    if (success) {
      router.push('/dashboard')
    }
  } catch (err) {
    error.value = 'Demo login failed'
  }
  
  loading.value = false
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.login-card {
  background: var(--bg-card, white);
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px var(--shadow, rgba(0, 0, 0, 0.1));
  width: 100%;
  max-width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  border: 1px solid var(--border-primary, transparent);
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.logo {
  width: 60px;
  height: 60px;
  padding: 3px;
  border-radius: 2px;
}

.logo text {
  fill: white;
}

:root:not(.dark) .logo {
  background: #10b981;
}

:root.dark .logo {
  background: #1e293b;
}

.login-card h2 {
  text-align: center;
  margin: 0 0 0.25rem 0;
  font-weight: 600;
  font-size: 1.75rem;
}

.subtitle {
  color: var(--text-secondary, #6b7280);
  margin: 0 0 2rem 0;
  font-size: 0.9rem;
  font-weight: 400;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary, inherit);
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 0.375rem;
  font-size: 1rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, inherit);
}

input:focus {
  outline: none;
  border-color: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

button {
  width: 100%;
  background: #1d4ed8;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  background: #1e40af;
}

button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.switch-form {
  text-align: center;
  margin-top: 1rem;
}

.switch-form a {
  color: #1d4ed8;
  cursor: pointer;
  text-decoration: underline;
}

.error {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-top: 1rem;
}

small {
  display: block;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.toggle-group {
  display: flex;
  flex-direction: column;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
}

.toggle-switch input[type="checkbox"] {
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
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #1d4ed8;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-switch input:focus + .toggle-slider {
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

.info-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1e40af;
}

.info-text {
  color: var(--text-secondary, #6b7280);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.password-choice {
  text-align: center;
}

.choice-btn {
  width: 100%;
  background: var(--bg-primary, white);
  color: #1d4ed8;
  border: 2px solid #1d4ed8;
  padding: 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.choice-btn:hover {
  background: #eff6ff;
}

.choice-btn strong {
  font-size: 1rem;
}

.choice-btn small {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.basic-password-form {
  margin-top: 1rem;
  text-align: left;
}

.demo-btn {
  background: #6b7280;
  margin-top: 0.5rem;
}

.demo-btn:hover {
  background: #4b5563;
}

.github-link {
  color: #1d4ed8;
  text-decoration: none;
  font-weight: 500;
}

.github-link:hover {
  text-decoration: underline;
}
</style>