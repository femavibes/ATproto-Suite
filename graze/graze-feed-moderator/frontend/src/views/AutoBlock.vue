<template>
  <div>
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button 
        @click="$router.push('/dashboard')" 
        class="tab-btn"
        title="Remove Posts"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        <span class="tab-label">Remove</span>
      </button>
      <button 
        @click="$router.push('/dashboard')" 
        class="tab-btn"
        title="Ban Users"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="m4.9 4.9 14.2 14.2"/>
        </svg>
        <span class="tab-label">Ban</span>
      </button>
      <button 
        @click="$router.push('/dashboard')" 
        class="tab-btn"
        title="Add Labels"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        <span class="tab-label">Labels</span>
      </button>
      <button 
        class="tab-btn active"
        title="Auto-Block"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span class="tab-label">Auto-Block</span>
      </button>
    </div>

    <!-- Sub Tab Navigation -->
    <div class="sub-tab-navigation">
      <button 
        @click="activeTab = 'accounts'" 
        :class="{ active: activeTab === 'accounts' }"
        class="tab-btn"
        title="Manage Accounts"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="tab-label">Accounts</span>
      </button>
      <button 
        @click="activeTab = 'lists'" 
        :class="{ active: activeTab === 'lists' }"
        class="tab-btn"
        title="Block Lists"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 6h13"/>
          <path d="M8 12h13"/>
          <path d="M8 18h13"/>
          <path d="M3 6h.01"/>
          <path d="M3 12h.01"/>
          <path d="M3 18h.01"/>
        </svg>
        <span class="tab-label">Lists</span>
      </button>
      <button 
        @click="activeTab = 'activity'" 
        :class="{ active: activeTab === 'activity' }"
        class="tab-btn"
        title="Recent Activity"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v5h5"/>
          <path d="M6 17a9 9 0 0 1 9-9 9 9 0 0 1 9 9"/>
          <path d="M12 12l4 4"/>
        </svg>
        <span class="tab-label">Activity</span>
      </button>
      <button 
        @click="activeTab = 'logs'" 
        :class="{ active: activeTab === 'logs' }"
        class="tab-btn"
        title="System Logs"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <span class="tab-label">Logs</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Accounts Tab -->
      <div v-if="activeTab === 'accounts'" class="card">
        <div class="card-header">
          <div class="card-title">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <h3>Auto-Block Accounts</h3>
          </div>
          <p class="card-description">Add your alt accounts to monitor for blocks</p>
        </div>
        <div class="card-content">
          <div class="explanation">
            <p><strong>What this does:</strong> Prevents users from blocking you and then posting harmful content in your feeds without you knowing. When someone blocks any of your accounts, they're automatically added to your block lists, ensuring they can't exploit this loophole.</p>
          </div>
          
          <div class="requirements">
            <button @click="showRequirements = !showRequirements" class="requirements-toggle">
              <svg :class="['expand-icon', { 'expanded': showRequirements }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
              Setup Requirements
            </button>
            <ul v-if="showRequirements">
              <li>All accounts must <strong>subscribe (free)</strong> to: <a href="https://bsky.app/profile/listifications.app" target="_blank">@listifications.app</a></li>
              <li>App passwords must have <strong>"Chat/DM support"</strong> enabled when creating them</li>
              <li>🔒 <strong>Privacy:</strong> We ONLY read DMs from @listifications.app - no other messages are accessed</li>
            </ul>
          </div>

          <div class="main-account">
            <h4>Main Account</h4>
            <div class="account-item main">
              <img v-if="mainAccount.avatar" :src="mainAccount.avatar" class="avatar" />
              <div class="account-info">
                <div class="display-name">{{ mainAccount.displayName || mainAccount.handle }}</div>
                <div class="handle">@{{ mainAccount.handle }}</div>
              </div>
              <div v-if="mainAccount.zeroTrust" class="zero-trust-badge account-badge">🔒 Zero Trust</div>
              <div v-if="mainAccountList" class="assigned-lists account-meta">
                List: 
                <span class="list-tag">
                  <a :href="getListUrl(mainAccountList.list_uri)" target="_blank" :title="mainAccountList.list_uri">{{ mainAccountList.list_name }}</a>
                </span>
              </div>
              <div class="account-toggles">
                <div class="account-status">
                  <label class="toggle">
                    <input type="checkbox" v-model="mainAccount.enabled" @change="toggleMainAccount" />
                    <span class="slider"></span>
                  </label>
                  <span class="status-text">{{ mainAccount.enabled ? 'Monitoring' : 'Disabled' }}</span>
                </div>
                <div class="account-status" title="Account-wide setting: Affects all features (autoblock, moderation, feeds)">
                  <label class="toggle">
                    <input type="checkbox" v-model="mainAccount.zeroTrust" @change="toggleMainZeroTrust" />
                    <span class="slider"></span>
                  </label>
                  <span class="status-text">Zero Trust</span>
                </div>
              </div>
              <div class="account-actions">
                <button @click="testMainAccount" :disabled="loading" class="btn-test">Test</button>
                <button @click="reResolveMainAccount" :disabled="loading" class="btn-resolve">Re-resolve</button>
                <button @click="editMainAccount" class="btn-edit">Edit</button>
                <button disabled class="btn-danger" title="Cannot remove main account">Remove</button>
              </div>
            </div>
          </div>

          <form @submit.prevent="addAccount" class="add-account-form">
            <div class="add-account">
              <input 
                v-model="newAccount.handle" 
                placeholder="Handle or DID (e.g., user.bsky.social)" 
                autocomplete="username"
                class="input"
                required
              />
              <input 
                v-if="!newAccount.useZeroTrust"
                v-model="newAccount.appPassword" 
                type="password" 
                placeholder="App Password" 
                autocomplete="current-password"
                class="input"
                required
              />
              <div class="zero-trust-toggle">
                <label class="toggle">
                  <input type="checkbox" v-model="newAccount.useZeroTrust" />
                  <span class="slider"></span>
                </label>
                <span class="toggle-label">Use Zero Trust</span>
              </div>
              <button type="submit" :disabled="loading" class="btn-primary">
                {{ loading ? 'Adding...' : 'Add Account' }}
              </button>
            </div>
            <div v-if="newAccount.useZeroTrust" class="zero-trust-notice">
              ℹ️ Configure your zero trust proxy with credentials for this account, or add an app password later for it to work.
            </div>
          </form>

          <div v-if="accounts.length > 0" class="accounts-list">
            <div v-for="account in accounts" :key="account.id" class="account-item">
              <img v-if="account.avatar_url" :src="account.avatar_url" class="avatar" />
              <div v-else class="avatar avatar-placeholder">{{ (account.display_name || account.handle).charAt(0).toUpperCase() }}</div>
              <div class="account-info">
                <div class="display-name">{{ account.display_name || account.handle }}</div>
                <div class="handle">@{{ account.handle }}</div>
              </div>
              <div v-if="account.use_zero_trust" class="zero-trust-badge account-badge">🔒 Zero Trust</div>
              <div v-if="account.assigned_lists && account.assigned_lists.length > 0" class="assigned-lists account-meta">
                Lists: 
                <span v-for="(list, idx) in account.assigned_lists" :key="list.id" class="list-tag">
                  <a :href="getListUrl(list.uri)" target="_blank" :title="list.uri">{{ list.name }}</a><span v-if="idx < account.assigned_lists.length - 1">, </span>
                </span>
              </div>
              <div class="account-toggles">
                <div class="account-status">
                  <label class="toggle">
                    <input type="checkbox" :checked="account.is_active" @change="toggleAccount(account.id, $event.target.checked)" />
                    <span class="slider"></span>
                  </label>
                  <span class="status-text" :class="account.is_active ? 'status-active' : 'status-inactive'">
                    {{ account.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
                <div class="account-status" title="Per-account setting: Only affects this monitored account">
                  <label class="toggle">
                    <input type="checkbox" :checked="account.use_zero_trust" @change="toggleZeroTrust(account, $event.target.checked)" />
                    <span class="slider"></span>
                  </label>
                  <span class="status-text">Zero Trust</span>
                </div>
              </div>
              <div class="account-actions">
                <button @click="testAccount(account.id)" :disabled="loading" class="btn-test">Test</button>
                <button @click="reResolveAccount(account.id)" :disabled="loading" class="btn-resolve">Re-resolve</button>
                <button @click="editAccount(account)" class="btn-edit">Edit</button>
                <button @click="removeAccount(account.id)" class="btn-danger">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Block Lists Tab -->
      <div v-if="activeTab === 'lists'" class="card">
        <div class="card-header">
          <div class="card-title">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 6h13"/>
              <path d="M8 12h13"/>
              <path d="M8 18h13"/>
              <path d="M3 6h.01"/>
              <path d="M3 12h.01"/>
              <path d="M3 18h.01"/>
            </svg>
            <h3>Block Lists Configuration</h3><!-- Updated -->
          </div>
          <p class="card-description">Configure which lists blocked users will be added to per account - UPDATED</p>
        </div>
        <div class="card-content">
          <div class="explanation">
            <p><strong>How it works:</strong> When someone blocks one of your accounts, they'll be automatically added to the lists you select for that account. Lists are managed in the Ban Users section.</p>
          </div>
          
          <!-- Main Account Configuration -->
          <div class="account-config">
            <h4>Main Account: @{{ mainAccount.handle }}</h4>
            <div class="list-selection">
              <div v-for="list in availableLists" :key="list.id" class="list-option">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    :checked="isListSelectedForAccount('main', list.id)"
                    @change="toggleListForAccount('main', list.id, $event.target.checked)"
                  />
                  <span class="checkmark"></span>
                  <span class="list-label">{{ list.name }}</span>
                  <span class="list-type-badge">{{ list.type }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Monitored Accounts Configuration -->
          <div v-for="account in accounts" :key="account.id" class="account-config">
            <h4>Monitored Account: @{{ account.handle }}</h4>
            <div class="list-selection">
              <div v-for="list in availableLists" :key="list.id" class="list-option">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    :checked="isListSelectedForAccount(account.handle, list.id)"
                    @change="toggleListForAccount(account.handle, list.id, $event.target.checked)"
                  />
                  <span class="checkmark"></span>
                  <span class="list-label">{{ list.name }}</span>
                  <span class="list-type-badge">{{ list.type }}</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="accounts.length === 0" class="no-accounts">
            <p>No monitored accounts configured. Add accounts in the Accounts tab to configure their list settings.</p>
          </div>
        </div>
      </div>

      <!-- Logs Tab -->
      <div v-if="activeTab === 'logs'" class="card">
        <div class="card-header">
          <div class="card-title">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            <h3>System Logs</h3>
          </div>
          <p class="card-description">View all autoblock activity and authentication events</p>
        </div>
        <div class="card-content">
          <div class="log-filters">
            <select v-model="logFilter" @change="loadSystemLogs" class="select">
              <option value="all">All Events</option>
              <option value="autoblock">Autoblock Events</option>
              <option value="auth">Authentication Events</option>
              <option value="errors">Errors Only</option>
            </select>
            <select v-model="logLimit" @change="loadSystemLogs" class="select">
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
              <option value="200">Last 200</option>
            </select>
            <button @click="clearOldFailures" :disabled="loading" class="btn-resolve">
              {{ loading ? 'Clearing...' : 'Clear Old Failures' }}
            </button>
          </div>
          
          <div v-if="systemLogs.length > 0" class="system-logs">
            <div v-for="log in systemLogs" :key="log.id" :class="['log-entry', `log-${log.type}`]">
              <div class="log-timestamp">{{ formatTime(log.created_at) }}</div>
              <div class="log-content">
                <div class="log-type-badge" :class="`badge-${log.type}`">{{ log.type.toUpperCase() }}</div>
                <div class="log-message">{{ log.message }}</div>
                <div v-if="log.details" class="log-details">{{ log.details }}</div>
              </div>
            </div>
          </div>
          <div v-else class="no-logs">No system logs found</div>
        </div>
      </div>

      <!-- Activity Tab -->
      <div v-if="activeTab === 'activity'" class="card">
        <div class="card-header">
          <div class="card-title">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v5h5"/>
              <path d="M6 17a9 9 0 0 1 9-9 9 9 0 0 1 9 9"/>
              <path d="M12 12l4 4"/>
            </svg>
            <h3>Recent Activity</h3>
          </div>
          <p class="card-description">Monitor recent auto-block actions</p>
        </div>
        <div class="card-content">
          <div v-if="recentBlocks.length > 0" class="activity-log">
            <div v-for="block in recentBlocks" :key="block.id" class="activity-item">
              <div class="activity-info">
                <div class="activity-main">
                  <span class="blocker-info">
                    <strong class="clickable-handle" @click="showBlockerLogs(block.blocker_handle)">@{{ block.blocker_handle }}</strong>
                    <a :href="`https://bsky.app/profile/${block.blocker_handle}`" target="_blank" class="bsky-link" title="Open on Bluesky">
                      <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15,3 21,3 21,9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  </span>
                  blocked 
                  <strong class="clickable-handle" @click="showBlockedLogs(block.blocked_account_handle)">@{{ block.blocked_account_handle || 'Unknown' }}</strong>
                  <span class="action-badge" :class="`action-${block.action}`">{{ block.action }}</span>
                </div>
                <div v-if="block.all_lists && block.all_lists.length > 0" class="activity-lists">
                  Added to: 
                  <span v-for="(list, index) in block.all_lists" :key="index" class="list-link">
                    <a :href="getListUrl(list.uri)" target="_blank" :title="list.uri">
                      {{ list.name }}
                    </a>
                    <span v-if="index < block.all_lists.length - 1">, </span>
                  </span>
                </div>
              </div>
              <div class="activity-time">{{ formatTime(block.created_at) }}</div>
            </div>
          </div>
          <div v-else class="no-activity">No recent blocks detected</div>
        </div>
      </div>
    </div>

    <!-- Logs Modal -->
    <div v-if="showLogsModal" class="modal-overlay" @click="showLogsModal = false">
      <div class="modal logs-modal" @click.stop>
        <h3>{{ logsModalTitle }}</h3>
        <div class="logs-content">
          <div v-if="detailedLogs.length > 0" class="detailed-logs">
            <div v-for="log in detailedLogs" :key="log.id" class="log-item">
              <div class="log-info">
                <div class="log-main">
                  <strong>@{{ log.blocker_handle }}</strong> blocked 
                  <strong>@{{ log.blocked_account_handle }}</strong>
                  <span class="action-badge" :class="`action-${log.action}`">{{ log.action }}</span>
                </div>
                <div class="log-details">
                  <span class="list-name">List: {{ log.list_name }}</span>
                  <span class="log-time">{{ formatTime(log.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-logs">No logs found</div>
        </div>
        <div class="modal-actions">
          <button type="button" @click="showLogsModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Edit Account Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <div class="modal" @click.stop>
        <h3>Edit {{ editingAccount?.handle === mainAccount.handle ? 'Main ' : '' }}Account: @{{ editingAccount?.handle }}</h3>
        <div class="account-details">
          <p><strong>DID:</strong> {{ editingAccount?.did }}</p>
          <p><strong>Handle:</strong> @{{ editingAccount?.handle }}</p>
          <p><strong>Display Name:</strong> {{ editingAccount?.display_name || 'None' }}</p>
          <p><strong>Status:</strong> {{ editingAccount?.is_active ? 'Active' : 'Inactive' }}</p>
        </div>
        <form @submit.prevent="editingAccount?.handle === mainAccount.handle ? saveMainAccountEdit() : saveAccountEdit()">
          <div class="form-group">
            <label>New App Password</label>
            <input v-model="editForm.appPassword" type="password" autocomplete="new-password" required>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showEditModal = false">Cancel</button>
            <button type="submit" :disabled="loading">{{ loading ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const loading = ref(false)
const accounts = ref([])
const blockLists = ref([])
const recentBlocks = ref([])
const activeTab = ref('accounts')
const availableLists = ref([])
const accountListConfig = ref({})
const mainAccount = ref({
  handle: authStore.user?.handle || '',
  displayName: authStore.user?.display_name || '',
  avatar: authStore.user?.avatar || '',
  enabled: true,
  zeroTrust: authStore.user?.zero_trust_mode || false
})

const newAccount = ref({
  handle: '',
  appPassword: '',
  useZeroTrust: false
})



const showEditModal = ref(false)
const editingAccount = ref(null)
const editForm = ref({
  appPassword: ''
})

const showLogsModal = ref(false)
const logsModalTitle = ref('')
const detailedLogs = ref([])
const systemLogs = ref([])
const logFilter = ref('all')
const logLimit = ref('50')
const showRequirements = ref(false)

const isPaidUser = computed(() => 
  authStore.user?.subscription_tier === 'paid' || 
  authStore.user?.subscription_tier === 'premium'
)

const addAccount = async () => {
  if (!newAccount.value.handle) return
  if (!newAccount.value.useZeroTrust && !newAccount.value.appPassword) return
  
  loading.value = true
  try {
    const response = await fetch('/api/autoblock/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(newAccount.value)
    })
    
    const result = await response.json()
    if (response.ok) {
      newAccount.value = { handle: '', appPassword: '', useZeroTrust: false }
      await loadAccounts()
    } else {
      alert(`Error: ${result.error || 'Failed to add account'}`)
    }
  } catch (error) {
    console.error('Failed to add account:', error)
    alert('Network error: Failed to add account')
  }
  loading.value = false
}

const testAccount = async (id: number) => {
  loading.value = true
  try {
    const response = await fetch(`/api/autoblock/accounts/${id}/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    const result = await response.json()
    if (response.ok) {
      const dmInfo = result.dmStatus ? `\n\nDM Status: ${result.dmStatus}` : ''
      const recentBlockInfo = `\n\nMost Recent Block: ${result.recentBlock}`
      alert(`✅ Test successful: ${result.message}${dmInfo}${recentBlockInfo}`)
    } else {
      if (result.action === 'update_password') {
        const shouldUpdate = confirm(`❌ ${result.error}\n\nWould you like to update the password now?`)
        if (shouldUpdate) {
          editAccount(accounts.value.find(a => a.id === id))
        }
      } else {
        alert(`❌ Test failed: ${result.error}`)
      }
    }
  } catch (error) {
    console.error('Failed to test account:', error)
    alert('❌ Test failed: Network error')
  }
  loading.value = false
}

const reResolveAccount = async (id: number) => {
  loading.value = true
  try {
    const response = await fetch(`/api/autoblock/accounts/${id}/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    const result = await response.json()
    if (response.ok) {
      alert(`✅ Re-resolved: ${result.message}`)
      await loadAccounts()
    } else {
      alert(`❌ Re-resolve failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to re-resolve account:', error)
    alert('❌ Re-resolve failed: Network error')
  }
  loading.value = false
}

const editAccount = (account: any) => {
  editingAccount.value = account
  editForm.value.appPassword = ''
  showEditModal.value = true
}

const saveAccountEdit = async () => {
  if (!editForm.value.appPassword) return
  
  loading.value = true
  try {
    const response = await fetch(`/api/autoblock/accounts/${editingAccount.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ appPassword: editForm.value.appPassword })
    })
    
    const result = await response.json()
    if (response.ok) {
      alert('✅ Account updated successfully')
      showEditModal.value = false
      // Mark account as active since password update was successful
      await loadAccounts()
    } else {
      alert(`❌ Update failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to update account:', error)
    alert('❌ Update failed: Network error')
  }
  loading.value = false
}

const removeAccount = async (id: number) => {
  try {
    const response = await fetch(`/api/autoblock/accounts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      await loadAccounts()
    }
  } catch (error) {
    console.error('Failed to remove account:', error)
  }
}

const loadAvailableLists = async () => {
  try {
    const response = await fetch('/api/autoblock/config', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      availableLists.value = data.lists
      accountListConfig.value = data.config
    }
  } catch (error) {
    console.error('Failed to load available lists:', error)
  }
}

const isListSelectedForAccount = (accountHandle: string, listId: string) => {
  const config = accountListConfig.value[accountHandle]
  if (!config) return false
  return config.some(item => 
    (item.listType === 'global' && listId === 'global') ||
    (item.listType === 'feed' && item.feedId === listId)
  )
}

const toggleListForAccount = async (accountHandle: string, listId: string, isSelected: boolean) => {
  try {
    const listType = listId === 'global' ? 'global' : 'feed'
    const feedId = listType === 'feed' ? listId : null
    const accountType = accountHandle === mainAccount.value.handle ? 'main' : 'monitored'
    
    if (isSelected) {
      // Add configuration
      const response = await fetch('/api/autoblock/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          accountHandle,
          accountType,
          listType,
          feedId
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add configuration')
      }
    } else {
      // Remove configuration
      const response = await fetch('/api/autoblock/config', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          accountHandle,
          listType,
          feedId
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to remove configuration')
      }
    }
    
    // Reload configuration
    await loadAvailableLists()
  } catch (error) {
    console.error('Failed to toggle list for account:', error)
    alert('Failed to update configuration')
  }
}

const loadAccounts = async () => {
  try {
    const response = await fetch('/api/autoblock/accounts', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    accounts.value = await response.json()
  } catch (error) {
    console.error('Failed to load accounts:', error)
  }
}

const mainAccountList = computed(() => {
  return blockLists.value.find(list => list.is_main_account)
})

const loadLists = async () => {
  try {
    const response = await fetch('/api/autoblock/lists', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    blockLists.value = await response.json()
  } catch (error) {
    console.error('Failed to load lists:', error)
  }
}

const loadRecentBlocks = async () => {
  try {
    const response = await fetch('/api/autoblock/activity', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    recentBlocks.value = await response.json()
  } catch (error) {
    console.error('Failed to load recent blocks:', error)
  }
}

const getAccountHandle = (accountId: number) => {
  const account = accounts.value.find(a => a.id === accountId)
  return account?.handle || 'Unknown'
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString()
}

const toggleMainAccount = async () => {
  try {
    await fetch('/api/autoblock/main-account', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ enabled: mainAccount.value.enabled })
    })
  } catch (error) {
    console.error('Failed to toggle main account:', error)
  }
}

const loadMainAccountStatus = async () => {
  try {
    const response = await fetch('/api/autoblock/main-account', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    const data = await response.json()
    mainAccount.value.enabled = data.enabled
    mainAccount.value.zeroTrust = data.zeroTrust || false
  } catch (error) {
    console.error('Failed to load main account status:', error)
  }
}

const toggleMainZeroTrust = async () => {
  if (mainAccount.value.zeroTrust) {
    const confirmed = confirm(
      `⚠️ Enable Zero Trust for main account?\n\n` +
      `Your zero trust proxy must be configured to provide authentication for your main account.\n\n` +
      `Continue?`
    )
    if (!confirmed) {
      mainAccount.value.zeroTrust = false
      return
    }
  }
  
  try {
    const response = await fetch('/api/autoblock/main-account/zero-trust', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ useZeroTrust: mainAccount.value.zeroTrust })
    })
    
    if (response.ok) {
      if (mainAccount.value.zeroTrust) {
        alert(`✅ Zero trust enabled for main account\n\nMake sure your zero trust proxy is configured with credentials for this account.`)
      } else {
        alert(`✅ Zero trust disabled for main account`)
      }
    } else {
      const result = await response.json()
      alert(`❌ Failed to toggle zero trust: ${result.error}`)
      await loadMainAccountStatus() // Revert UI
    }
  } catch (error) {
    console.error('Failed to toggle zero trust:', error)
    alert('❌ Failed to toggle zero trust: Network error')
    await loadMainAccountStatus() // Revert UI
  }
}

const testMainAccount = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/autoblock/main-account/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    const result = await response.json()
    if (response.ok) {
      const dmInfo = result.dmStatus ? `\n\nDM Status: ${result.dmStatus}` : ''
      const recentBlockInfo = `\n\nMost Recent Block: ${result.recentBlock}`
      alert(`✅ Test successful: ${result.message}${dmInfo}${recentBlockInfo}`)
    } else {
      if (result.action === 'update_password') {
        const shouldUpdate = confirm(`❌ ${result.error}\n\nWould you like to update the password now?`)
        if (shouldUpdate) {
          editMainAccount()
        }
      } else {
        alert(`❌ Test failed: ${result.error}`)
      }
    }
  } catch (error) {
    console.error('Failed to test main account:', error)
    alert('❌ Test failed: Network error')
  }
  loading.value = false
}

const reResolveMainAccount = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/autoblock/main-account/resolve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    const result = await response.json()
    if (response.ok) {
      alert(`✅ Re-resolved: ${result.message}`)
      // Update main account info
      mainAccount.value.handle = authStore.user?.handle || ''
      mainAccount.value.displayName = authStore.user?.display_name || ''
      mainAccount.value.avatar = authStore.user?.avatar || ''
    } else {
      alert(`❌ Re-resolve failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to re-resolve main account:', error)
    alert('❌ Re-resolve failed: Network error')
  }
  loading.value = false
}

const editMainAccount = () => {
  editingAccount.value = {
    handle: mainAccount.value.handle,
    did: authStore.user?.did,
    display_name: mainAccount.value.displayName,
    is_active: true
  }
  editForm.value.appPassword = ''
  showEditModal.value = true
}

const toggleAccount = async (id: number, isActive: boolean) => {
  try {
    const response = await fetch(`/api/autoblock/accounts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ isActive })
    })
    
    if (response.ok) {
      await loadAccounts()
    } else {
      const result = await response.json()
      alert(`❌ Failed to update status: ${result.error}`)
      await loadAccounts() // Revert UI
    }
  } catch (error) {
    console.error('Failed to toggle account:', error)
    await loadAccounts() // Revert UI
  }
}

const toggleZeroTrust = async (account: any, useZeroTrust: boolean) => {
  if (useZeroTrust) {
    const confirmed = confirm(
      `⚠️ Enable Zero Trust for @${account.handle}?\n\n` +
      `Your zero trust proxy must be configured to provide authentication for ${account.did}.\n\n` +
      `Continue?`
    )
    if (!confirmed) {
      await loadAccounts() // Revert UI
      return
    }
  }
  
  try {
    const response = await fetch(`/api/autoblock/accounts/${account.id}/zero-trust`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ useZeroTrust })
    })
    
    if (response.ok) {
      await loadAccounts()
      if (useZeroTrust) {
        alert(`✅ Zero trust enabled for @${account.handle}\n\nMake sure your zero trust proxy is configured with credentials for this account.`)
      } else {
        alert(`✅ Zero trust disabled for @${account.handle}`)
      }
    } else {
      const result = await response.json()
      alert(`❌ Failed to toggle zero trust: ${result.error}`)
      await loadAccounts() // Revert UI
    }
  } catch (error) {
    console.error('Failed to toggle zero trust:', error)
    alert('❌ Failed to toggle zero trust: Network error')
    await loadAccounts() // Revert UI
  }
}

const saveMainAccountEdit = async () => {
  if (!editForm.value.appPassword) return
  
  loading.value = true
  try {
    const response = await fetch('/api/autoblock/main-account/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ appPassword: editForm.value.appPassword })
    })
    
    const result = await response.json()
    if (response.ok) {
      alert('✅ Main account password updated successfully')
      showEditModal.value = false
    } else {
      alert(`❌ Update failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to update main account:', error)
    alert('❌ Update failed: Network error')
  }
  loading.value = false
}

const showBlockerLogs = async (blockerHandle: string) => {
  try {
    const response = await fetch(`/api/autoblock/logs/blocker/${encodeURIComponent(blockerHandle)}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      detailedLogs.value = await response.json()
      logsModalTitle.value = `Blocks by @${blockerHandle}`
      showLogsModal.value = true
    }
  } catch (error) {
    console.error('Failed to load blocker logs:', error)
  }
}

const showBlockedLogs = async (blockedHandle: string) => {
  try {
    const response = await fetch(`/api/autoblock/logs/blocked/${encodeURIComponent(blockedHandle)}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      detailedLogs.value = await response.json()
      logsModalTitle.value = `Who blocked @${blockedHandle}`
      showLogsModal.value = true
    }
  } catch (error) {
    console.error('Failed to load blocked logs:', error)
  }
}

const loadSystemLogs = async () => {
  try {
    const params = new URLSearchParams({
      filter: logFilter.value,
      limit: logLimit.value
    })
    
    const response = await fetch(`/api/autoblock/system-logs?${params}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      systemLogs.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to load system logs:', error)
  }
}

const getListUrl = (listUri: string) => {
  // Convert AT-URI to web URL
  const match = listUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.graph\.list\/(.+)$/)
  if (match) {
    const [, did, rkey] = match
    return `https://bsky.app/profile/${did}/lists/${rkey}`
  }
  return listUri
}

const clearOldFailures = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/autoblock/clear-old-failures', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    const result = await response.json()
    if (response.ok) {
      alert(`✅ ${result.message}`)
      await loadSystemLogs()
    } else {
      alert(`❌ Failed to clear old failures: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to clear old failures:', error)
    alert('❌ Failed to clear old failures: Network error')
  }
  loading.value = false
}

onMounted(() => {
  loadAccounts()
  loadLists()
  loadAvailableLists()
  loadRecentBlocks()
  loadMainAccountStatus()
  loadSystemLogs()
})
</script>

<style scoped>
.explanation {
  background: var(--bg-tertiary, #f0f9ff);
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.explanation p {
  margin: 0;
  color: var(--text-primary, #0c4a6e);
  font-size: 0.875rem;
  line-height: 1.5;
}

.requirements {
  background: var(--bg-tertiary, #f8fafc);
  border: 1px solid var(--border-primary, #cbd5e1);
  border-radius: 6px;
  padding: 0;
  margin-bottom: 0.5rem;
}

.requirements-toggle {
  width: 100%;
  padding: 1rem;
  background: transparent;
  border: none;
  color: var(--text-primary, #475569);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.requirements-toggle:hover {
  background: var(--bg-secondary, rgba(0,0,0,0.02));
}

.requirements-toggle .expand-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.requirements-toggle .expand-icon.expanded {
  transform: rotate(180deg);
}

.requirements ul {
  margin: 0;
  padding: 0 1rem 1rem 2.5rem;
  color: var(--text-primary, #475569);
}

.requirements li {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.requirements a {
  color: #1d4ed8;
  text-decoration: none;
}

.requirements a:hover {
  text-decoration: underline;
}

.tab-navigation {
  display: flex;
  gap: 0;
  margin: -1rem 0 0 0;
  background: var(--bg-primary, white);
  padding: 0;
  border-top: 1px solid var(--border-primary, #e5e7eb);
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.tab-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-right: 1px solid var(--border-primary, #e5e7eb);
}

.tab-btn:last-child {
  border-right: none;
}

.tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.sub-tab-navigation {
  display: flex;
  gap: 0;
  margin: 0;
  background: var(--bg-primary, white);
  padding: 0;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.sub-tab-navigation .tab-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-right: 1px solid var(--border-primary, #e5e7eb);
}

.sub-tab-navigation .tab-btn:last-child {
  border-right: none;
}

.sub-tab-navigation .tab-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.sub-tab-navigation .tab-btn.active {
  background: #3b82f6;
  color: white;
}

.sub-tab-navigation .tab-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.tab-content {
  padding-top: 1.5rem;
}

.card {
  background: var(--bg-card, white);
  border-radius: 2px;
  box-shadow: 0 1px 3px var(--shadow, rgba(0,0,0,0.1));
  margin-bottom: 1.5rem;
  overflow: hidden;
  border: 1px solid var(--border-primary, transparent);
}

.card-header {
  padding: 1.5rem 2rem 1rem 2rem;
  border-bottom: 1px solid var(--border-primary, #f1f5f9);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.25rem;
  font-weight: 600;
}

.icon {
  width: 24px;
  height: 24px;
  color: var(--text-secondary, #64748b);
}

.card-description {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.card-content {
  padding: 1.5rem 2rem;
}

.main-account {
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.main-account h4 {
  margin: 0 0 1rem 0;
  color: #1e293b;
  font-size: 1rem;
}

.account-item.main {
  background: var(--bg-tertiary, #f8fafc);
  border: 2px solid var(--border-primary, #e2e8f0);
}

.add-account, .add-list {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.input, .select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  flex: 1;
  min-width: 200px;
}

.btn-primary, .btn-danger {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-test {
  background: #10b981;
  color: white;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn-test:hover {
  background: #059669;
}

.btn-test:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-resolve {
  background: #f59e0b;
  color: white;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn-resolve:hover {
  background: #d97706;
}

.btn-resolve:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-edit {
  background: #6366f1;
  color: white;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn-edit:hover {
  background: #4f46e5;
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
  background: var(--bg-card, white);
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.account-details {
  background: var(--bg-tertiary, #f8fafc);
  padding: 1rem;
  border-radius: 6px;
  margin: 1rem 0;
}

.account-details p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
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
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.modal-actions button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
}

.modal-actions button[type="button"] {
  background: #f3f4f6;
  color: #374151;
}

.modal-actions button[type="submit"] {
  background: #3b82f6;
  color: white;
}

.accounts-list, .lists, .activity-log {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.account-item {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto auto auto auto;
  padding: 1rem;
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 6px;
  gap: 1rem;
  background: var(--bg-card, white);
}

.list-item, .activity-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 6px;
  gap: 1rem;
  background: var(--bg-card, white);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  grid-row: 1;
}

.avatar-placeholder {
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
}

.account-info {
  grid-row: 1;
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.list-info, .activity-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.activity-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.activity-lists {
  font-size: 0.8rem;
  color: #64748b;
  margin-left: 1rem;
}

.list-link a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.list-link a:hover {
  text-decoration: underline;
}

.display-name, .list-name {
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.handle, .list-uri, .list-type {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.zero-trust-badge {
  display: inline-block;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: #10b981;
  color: white;
  border-radius: 4px;
  font-weight: 500;
}

.account-badge {
  grid-column: 1 / -1;
  margin-top: 0;
}

.assigned-lists {
  font-size: 0.8rem;
  color: #64748b;
}

.account-meta {
  grid-column: 1 / -1;
}

.list-tag a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.list-tag a:hover {
  text-decoration: underline;
}

.zero-trust-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.zero-trust-notice {
  background: #eff6ff;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #1e40af;
  width: 100%;
}

.account-toggles {
  grid-column: 1 / -1;
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.account-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.account-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.status-active {
  color: #059669;
  font-weight: 500;
}

.status-inactive {
  color: #dc2626;
  font-weight: 500;
}

.activity-time {
  font-size: 0.875rem;
  color: #64748b;
}

.no-activity {
  text-align: center;
  color: #64748b;
  padding: 2rem;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.status-text {
  font-size: 0.875rem;
  font-weight: 500;
}

.clickable-handle {
  cursor: pointer;
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
}

.clickable-handle:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.blocker-info {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.bsky-link {
  color: #64748b;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s;
}

.bsky-link:hover {
  color: #3b82f6;
}

.external-icon {
  width: 14px;
  height: 14px;
}

.action-badge {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-weight: 500;
  margin-left: 0.75rem;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.action-added {
  background: #10b981;
  color: white;
  border-color: #059669;
}

.action-failed {
  background: #ef4444;
  color: white;
  border-color: #dc2626;
}

.action-already_blocked {
  background: #f59e0b;
  color: white;
  border-color: #d97706;
}

.logs-modal {
  max-width: 800px;
  max-height: 80vh;
}

.logs-content {
  max-height: 60vh;
  overflow-y: auto;
  margin: 1rem 0;
}

.detailed-logs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-item {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.log-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-main {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.log-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #64748b;
}

.list-name {
  font-weight: 500;
}

.log-time {
  font-style: italic;
}

.no-logs {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-style: italic;
}

.log-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.system-logs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  border-left: 4px solid;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

.log-entry.log-autoblock {
  background: #f0f9ff;
  border-left-color: #0ea5e9;
}

.log-entry.log-auth {
  background: #fef3c7;
  border-left-color: #f59e0b;
}

.log-entry.log-error {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.log-entry.log-info {
  background: #f8fafc;
  border-left-color: #64748b;
}

.log-timestamp {
  color: #64748b;
  font-size: 0.75rem;
  white-space: nowrap;
  min-width: 140px;
}

.log-content {
  flex: 1;
}

.log-type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.badge-autoblock {
  background: #0ea5e9;
  color: white;
}

.badge-auth {
  background: #f59e0b;
  color: white;
}

.badge-error {
  background: #ef4444;
  color: white;
}

.badge-info {
  background: #64748b;
  color: white;
}

.log-message {
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.log-details {
  color: #64748b;
  font-size: 0.8rem;
}

.account-config {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.account-config:last-child {
  border-bottom: none;
}

.account-config h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1rem;
  font-weight: 600;
}

.list-selection {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list-option {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 6px;
  background: var(--bg-card, white);
  transition: all 0.2s;
  width: 100%;
}

.checkbox-label:hover {
  background: var(--bg-tertiary, #f8fafc);
  border-color: #3b82f6;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #d1d5db;
  border-radius: 3px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background: #3b82f6;
  border-color: #3b82f6;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  position: absolute;
  top: -2px;
  left: 2px;
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.list-label {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

.list-type-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.list-type-badge {
  background: #e5e7eb;
  color: #374151;
}

.no-accounts {
  text-align: center;
  color: var(--text-secondary, #64748b);
  padding: 2rem;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e5e7eb);
}

.no-accounts p {
  margin: 0;
  font-style: italic;
}

@media (max-width: 768px) {
  .add-account, .add-list {
    flex-direction: column;
  }
  
  .account-item, .list-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .checkbox-label {
    padding: 1rem;
  }
}
</style>