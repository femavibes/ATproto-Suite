<template>
  <div class="api-keys-tab">
    <h3>API Keys</h3>
    <p class="description">
      API keys allow browser extensions and external tools to access your account.
      Keep your keys secure and never share them publicly.
    </p>

    <!-- Create new key -->
    <div class="create-key-section">
      <h4>Create New API Key</h4>
      <div class="form-group">
        <label for="keyName">Key Name</label>
        <input
          id="keyName"
          v-model="newKeyName"
          type="text"
          placeholder="e.g., Browser Extension"
          maxlength="100"
        />
      </div>
      <div class="form-group">
        <label for="expiresIn">Expires In (optional)</label>
        <select id="expiresIn" v-model="expiresInDays">
          <option :value="undefined">Never</option>
          <option :value="30">30 days</option>
          <option :value="90">90 days</option>
          <option :value="180">180 days</option>
          <option :value="365">1 year</option>
        </select>
      </div>
      <button @click="createApiKey" :disabled="!newKeyName.trim() || creating">
        {{ creating ? 'Creating...' : 'Create API Key' }}
      </button>
    </div>

    <!-- Show newly created key -->
    <div v-if="newlyCreatedKey" class="new-key-alert">
      <h4>⚠️ Save Your API Key</h4>
      <p>This is the only time you'll see this key. Copy it now!</p>
      <div class="key-display">
        <code>{{ newlyCreatedKey }}</code>
        <button @click="copyKey" class="copy-btn">
          {{ copied ? '✓ Copied' : 'Copy' }}
        </button>
      </div>
      <button @click="newlyCreatedKey = null" class="dismiss-btn">I've saved it</button>
    </div>

    <!-- Existing keys list -->
    <div class="keys-list">
      <h4>Your API Keys</h4>
      <div v-if="loading" class="loading">Loading keys...</div>
      <div v-else-if="keys.length === 0" class="no-keys">
        No API keys yet. Create one above to get started.
      </div>
      <div v-else class="keys-table">
        <div v-for="key in keys" :key="key.id" class="key-row">
          <div class="key-info">
            <div class="key-name">{{ key.name }}</div>
            <div class="key-meta">
              <span>Created: {{ formatDate(key.created_at) }}</span>
              <span v-if="key.last_used">Last used: {{ formatDate(key.last_used) }}</span>
              <span v-else>Never used</span>
              <span v-if="key.expires_at">Expires: {{ formatDate(key.expires_at) }}</span>
              <span v-if="!key.is_active" class="inactive">Revoked</span>
            </div>
          </div>
          <div class="key-actions">
            <button
              v-if="key.is_active"
              @click="regenerateKey(key.id, key.name)"
              class="regenerate-btn"
              :disabled="regenerating === key.id"
            >
              {{ regenerating === key.id ? 'Regenerating...' : 'Regenerate' }}
            </button>
            <button
              v-if="key.is_active"
              @click="revokeKey(key.id)"
              class="revoke-btn"
              :disabled="revoking === key.id"
            >
              {{ revoking === key.id ? 'Revoking...' : 'Revoke' }}
            </button>
            <button
              @click="deleteKey(key.id)"
              class="delete-btn"
              :disabled="deleting === key.id"
            >
              {{ deleting === key.id ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

const keys = ref<any[]>([]);
const loading = ref(false);
const creating = ref(false);
const regenerating = ref<number | null>(null);
const revoking = ref<number | null>(null);
const deleting = ref<number | null>(null);
const error = ref('');

const newKeyName = ref('');
const expiresInDays = ref<number | undefined>(undefined);
const newlyCreatedKey = ref<string | null>(null);
const copied = ref(false);

async function loadKeys() {
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/keys', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to load API keys' }));
      throw new Error(errorData.error || 'Failed to load API keys');
    }

    const data = await response.json();
    keys.value = data.keys;
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createApiKey() {
  creating.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newKeyName.value.trim(),
        expiresInDays: expiresInDays.value
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Failed to create API key' }));
      throw new Error(data.error || 'Failed to create API key');
    }

    const data = await response.json();
    newlyCreatedKey.value = data.key;
    newKeyName.value = '';
    expiresInDays.value = undefined;
    
    await loadKeys();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    creating.value = false;
  }
}

async function regenerateKey(keyId: number, keyName: string) {
  if (!confirm(`Regenerate API key "${keyName}"? The old key will stop working immediately.`)) {
    return;
  }

  regenerating.value = keyId;
  error.value = '';
  try {
    // Delete the old key
    await fetch(`/api/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    // Create a new key with the same name
    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: keyName
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to regenerate API key');
    }

    const data = await response.json();
    newlyCreatedKey.value = data.key;
    
    await loadKeys();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    regenerating.value = null;
  }
}

async function revokeKey(keyId: number) {
  if (!confirm('Are you sure you want to revoke this API key? It will stop working immediately.')) {
    return;
  }

  revoking.value = keyId;
  error.value = '';
  try {
    const response = await fetch(`/api/keys/${keyId}/revoke`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to revoke API key');
    }

    await loadKeys();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    revoking.value = null;
  }
}

async function deleteKey(keyId: number) {
  if (!confirm('Are you sure you want to permanently delete this API key?')) {
    return;
  }

  deleting.value = keyId;
  error.value = '';
  try {
    const response = await fetch(`/api/keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to delete API key');
    }

    await loadKeys();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    deleting.value = null;
  }
}

function copyKey() {
  if (newlyCreatedKey.value) {
    navigator.clipboard.writeText(newlyCreatedKey.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  loadKeys();
});
</script>

<style scoped>
.api-keys-tab {
  max-width: 800px;
}

.description {
  color: #666;
  margin-bottom: 2rem;
}

.create-key-section {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.new-key-alert {
  background: #fff3cd;
  border: 2px solid #ffc107;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.new-key-alert h4 {
  margin-top: 0;
  color: #856404;
}

.key-display {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin: 1rem 0;
}

.key-display code {
  flex: 1;
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  font-family: monospace;
  word-break: break-all;
}

.copy-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.dismiss-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.keys-list h4 {
  margin-bottom: 1rem;
}

.loading,
.no-keys {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.key-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.key-info {
  flex: 1;
}

.key-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.key-meta {
  font-size: 0.875rem;
  color: #666;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.key-meta .inactive {
  color: #dc3545;
  font-weight: 500;
}

.key-actions {
  display: flex;
  gap: 0.5rem;
}

.regenerate-btn,
.revoke-btn,
.delete-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.regenerate-btn {
  background: #17a2b8;
  color: white;
}

.revoke-btn {
  background: #ffc107;
  color: #000;
}

.delete-btn {
  background: #dc3545;
  color: white;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}
</style>