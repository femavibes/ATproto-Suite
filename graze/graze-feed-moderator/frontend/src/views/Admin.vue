<template>
  <div>
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button 
        @click="activeTab = 'users'" 
        :class="{ active: activeTab === 'users' }"
        class="tab-btn"
        title="Manage Users"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </button>
      <button 
        @click="activeTab = 'activity'" 
        :class="{ active: activeTab === 'activity' }"
        class="tab-btn"
        title="View Activity"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v5h5"/>
          <path d="M6 17a9 9 0 0 1 9-9 9 9 0 0 1 9 9"/>
          <path d="M12 12l4 4"/>
        </svg>
      </button>
      <button 
        @click="activeTab = 'defaults'" 
        :class="{ active: activeTab === 'defaults' }"
        class="tab-btn"
        title="Threshold Defaults"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1l3 6 6 .75-4.5 4.25L18 19l-6-3.25L6 19l1.5-6.75L3 7.75 9 7z"/>
        </svg>
      </button>
      <button 
        @click="activeTab = 'stats'" 
        :class="{ active: activeTab === 'stats' }"
        class="tab-btn"
        title="Statistics"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/>
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
        </svg>
      </button>
      <button 
        @click="activeTab = 'rate-limits'" 
        :class="{ active: activeTab === 'rate-limits' }"
        class="tab-btn"
        title="Rate Limiting"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="users-tab">
        <!-- Search and Filters -->
        <div class="users-controls">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search by handle or DID..."
            class="search-input"
          />
          <select v-model="tierFilter" class="tier-filter">
            <option value="all">All Users</option>
            <option value="app-users">App Users (not none)</option>
            <option value="none">None</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        
        <!-- Desktop Table -->
        <div class="users-table desktop-only">
          <table>
            <thead>
              <tr>
                <th>Handle</th>
                <th>DID</th>
                <th>Subscription</th>
                <th>Feeds</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>
                  <div class="user-info">
                    <span class="handle">{{ user.handle }}</span>
                    <span v-if="user.is_admin" class="admin-badge">ADMIN</span>
                  </div>
                </td>
                <td class="did">{{ user.did.substring(0, 20) }}...</td>
                <td>
                  <select 
                    :value="user.subscription_tier" 
                    @change="updateSubscription(user.id, $event.target.value)"
                    class="tier-select"
                  >
                    <option value="none">None</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td class="feed-count">{{ user.feed_count }}</td>
                <td class="date">{{ formatDate(user.created_at) }}</td>
                <td>
                  <button 
                    @click="viewUserDetails(user)" 
                    class="action-btn view-btn"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Mobile Cards -->
        <div class="users-cards mobile-only">
          <div v-for="user in filteredUsers" :key="user.id" class="user-card">
            <div class="user-card-header">
              <div class="user-info">
                <span class="handle">{{ user.handle }}</span>
                <span v-if="user.is_admin" class="admin-badge">ADMIN</span>
              </div>
              <button 
                @click="viewUserDetails(user)" 
                class="action-btn view-btn"
              >
                View
              </button>
            </div>
            <div class="user-card-body">
              <div class="user-field">
                <label>Subscription:</label>
                <select 
                  :value="user.subscription_tier" 
                  @change="updateSubscription(user.id, $event.target.value)"
                  class="tier-select"
                >
                  <option value="none">None</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div class="user-field">
                <label>Feeds:</label>
                <span class="feed-count">{{ user.feed_count }}</span>
              </div>
              <div class="user-field">
                <label>Joined:</label>
                <span class="date">{{ formatDate(user.created_at) }}</span>
              </div>
              <div class="user-field">
                <label>DID:</label>
                <span class="did">{{ user.did }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Tab -->
      <div v-if="activeTab === 'activity'" class="activity-tab">
        <!-- Desktop Table -->
        <div class="activity-log desktop-only">
          <div class="log-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Moderator</th>
                  <th>Feed</th>
                  <th>Reason</th>
                  <th>Post</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="activity in activities" :key="activity.id">
                  <td class="time">{{ formatTime(activity.created_at) }}</td>
                  <td>
                    <span class="action-badge" :class="getActionClass(activity.action)">
                      {{ formatAction(activity.action) }}
                    </span>
                  </td>
                  <td class="moderator">
                    {{ activity.moderator_handle || 'System' }}
                  </td>
                  <td class="feed">{{ activity.feed_name || 'N/A' }}</td>
                  <td class="reason">{{ activity.reason || 'N/A' }}</td>
                  <td class="post-uri">
                    <span v-if="activity.post_uri" class="uri-short">
                      {{ activity.post_uri.split('/').pop() }}
                    </span>
                    <span v-else>N/A</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Mobile Cards -->
        <div class="activity-cards mobile-only">
          <div v-for="activity in activities" :key="activity.id" class="activity-card">
            <div class="activity-card-header">
              <span class="action-badge" :class="getActionClass(activity.action)">
                {{ formatAction(activity.action) }}
              </span>
              <span class="time">{{ formatTime(activity.created_at) }}</span>
            </div>
            <div class="activity-card-body">
              <div class="activity-field">
                <label>Moderator:</label>
                <span class="moderator">{{ activity.moderator_handle || 'System' }}</span>
              </div>
              <div class="activity-field">
                <label>Feed:</label>
                <span class="feed">{{ activity.feed_name || 'N/A' }}</span>
              </div>
              <div class="activity-field" v-if="activity.reason">
                <label>Reason:</label>
                <span class="reason">{{ activity.reason }}</span>
              </div>
              <div class="activity-field" v-if="activity.post_uri">
                <label>Post:</label>
                <span class="post-uri">{{ activity.post_uri.split('/').pop() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Defaults Tab -->
      <div v-if="activeTab === 'defaults'" class="defaults-tab">
        <div class="defaults-header">
          <h2>Admin Threshold Defaults</h2>
          <p>Set system-wide default thresholds for new users and feeds. Users with sync enabled will automatically receive these values.</p>
        </div>
        
        <div class="defaults-controls">
          <div class="control-group">
            <label>Threshold Type:</label>
            <select v-model="selectedThresholdType" class="threshold-type-select">
              <option value="global">Global User Defaults</option>
              <option value="feed">Feed Defaults</option>
            </select>
          </div>
          <div class="control-actions">
            <button @click="loadDefaults" class="action-btn refresh-btn">Refresh</button>
            <button @click="saveDefaults" :disabled="saving" class="action-btn save-btn">
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
            <button @click="syncAllUsers" :disabled="syncing" class="action-btn sync-btn">
              {{ syncing ? 'Syncing...' : 'Sync All Users' }}
            </button>
          </div>
        </div>
        
        <div v-if="defaults.length" class="defaults-grid">
          <div v-for="category in categories" :key="category" class="category-section">
            <h3>{{ formatCategoryName(category) }}</h3>
            <div class="threshold-row main-category">
              <div class="threshold-label">{{ formatCategoryName(category) }} ({{ category }})</div>
              <div class="threshold-inputs">
                <div class="input-group">
                  <label>Post Removal:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000" 
                    :value="getThresholdValue(category, null, 'post')"
                    @input="setThresholdValue(category, null, 'post', $event.target.value)"
                    class="threshold-input"
                  />
                </div>
                <div class="input-group">
                  <label>User Ban:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000" 
                    :value="getThresholdValue(category, null, 'ban')"
                    @input="setThresholdValue(category, null, 'ban', $event.target.value)"
                    class="threshold-input"
                  />
                </div>
              </div>
            </div>
            
            <div v-for="subcategory in getSubcategories(category)" :key="subcategory" class="threshold-row subcategory">
              <div class="threshold-label subcategory-label">{{ formatSubcategoryName(subcategory) }} ({{ category }}-{{ subcategory }})</div>
              <div class="threshold-inputs">
                <div class="input-group">
                  <label>Post:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000" 
                    :value="getThresholdValue(category, subcategory, 'post')"
                    @input="setThresholdValue(category, subcategory, 'post', $event.target.value)"
                    :disabled="subcategory === 'other'"
                    class="threshold-input"
                  />
                </div>
                <div class="input-group">
                  <label>Ban:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="1000" 
                    :value="getThresholdValue(category, subcategory, 'ban')"
                    @input="setThresholdValue(category, subcategory, 'ban', $event.target.value)"
                    :disabled="subcategory === 'other'"
                    class="threshold-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="syncResult" class="sync-result">
          <div class="result-header">
            <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>Sync Complete</span>
          </div>
          <p>{{ syncResult.message }}</p>
        </div>
      </div>

      <!-- Stats Tab -->
      <div v-if="activeTab === 'stats'" class="stats-tab">
        <div class="admin-stats" v-if="adminStats">
          <div class="stat-card">
            <h3>{{ adminStats.total_users }}</h3>
            <p>Total Users</p>
          </div>
          <div class="stat-card">
            <h3>{{ adminStats.paid_users }}</h3>
            <p>Paid Users</p>
          </div>
          <div class="stat-card">
            <h3>{{ adminStats.total_feeds }}</h3>
            <p>Total Feeds</p>
          </div>
          <div class="stat-card">
            <h3>{{ adminStats.reports_24h }}</h3>
            <p>Reports (24h)</p>
          </div>
        </div>
        
        <div class="activity-stats">
          <div class="stat-card">
            <h3>{{ totalActions }}</h3>
            <p>Total Actions</p>
          </div>
          <div class="stat-card">
            <h3>{{ uniquePosts }}</h3>
            <p>Posts Moderated</p>
          </div>
          <div class="stat-card">
            <h3>{{ activeFeeds }}</h3>
            <p>Active Feeds</p>
          </div>
        </div>
        
        <!-- Communal Moderation Tools -->
        <div class="admin-tools">
          <h3>Communal Moderation Tools</h3>
          <div class="tool-cards">
            <div class="tool-card">
              <div class="tool-header">
                <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
                <h4>General Backfill</h4>
              </div>
              <p>Process up to 50 unprocessed posts with reports against current communal moderation thresholds. Useful for applying new threshold settings to existing reports.</p>
              <button 
                @click="runGeneralBackfill" 
                :disabled="backfillRunning"
                class="tool-btn"
              >
                {{ backfillRunning ? 'Processing...' : 'Run General Backfill' }}
              </button>
            </div>
            
            <div class="tool-card">
              <div class="tool-header">
                <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h4>User-Specific Backfill</h4>
              </div>
              <p>Reprocess recent removals from a specific user's feeds. Useful for retrying failed Graze API calls or testing communal moderation for a particular user.</p>
              <div class="user-backfill-form">
                <select v-model="selectedUserId" class="user-select">
                  <option value="">Select a user...</option>
                  <option v-for="user in users" :key="user.id" :value="user.id">
                    {{ user.handle }} ({{ user.feed_count }} feeds)
                  </option>
                </select>
                <button 
                  @click="runUserBackfill" 
                  :disabled="backfillRunning || !selectedUserId"
                  class="tool-btn"
                >
                  {{ backfillRunning ? 'Processing...' : 'Run User Backfill' }}
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="backfillResult" class="backfill-result">
            <div class="result-header">
              <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
              <span>Backfill Complete</span>
            </div>
            <p>{{ backfillResult.message }}</p>
            <div class="result-stats">
              <span>Processed: {{ backfillResult.processed }}/{{ backfillResult.total }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Rate Limits Tab -->
      <div v-if="activeTab === 'rate-limits'" class="rate-limits-tab">
        <div class="rate-limits-header">
          <h2>Rate Limiting Monitor</h2>
          <p>Monitor rate limiting activity and blocked IPs in real-time</p>
          <button @click="loadRateLimits" class="refresh-btn">Refresh</button>
        </div>
        
        <div v-if="rateLimits" class="rate-limits-stats">
          <div class="stat-card">
            <h3>{{ rateLimits.activeIPs }}</h3>
            <p>Active IPs</p>
          </div>
          <div class="stat-card">
            <h3>{{ rateLimits.totalRequests }}</h3>
            <p>Total Requests</p>
          </div>
          <div class="stat-card warning" v-if="rateLimits.warningIPs > 0">
            <h3>{{ rateLimits.warningIPs }}</h3>
            <p>Warning IPs (80%+)</p>
          </div>
          <div class="stat-card danger" v-if="rateLimits.exceededIPs > 0">
            <h3>{{ rateLimits.exceededIPs }}</h3>
            <p>Exceeded Limits</p>
          </div>
          <div class="stat-card" v-if="rateLimits.totalHitIPs > 0">
            <h3>{{ rateLimits.totalHitIPs }}</h3>
            <p>IPs Blocked (429s)</p>
          </div>
        </div>
        
        <div v-if="rateLimits && rateLimits.currentUsage.length > 0" class="rate-limits-table">
          <h3>Current Rate Limit Usage</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Requests</th>
                  <th>Limit</th>
                  <th>Usage</th>
                  <th>Window</th>
                  <th>Last Request</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="usage in rateLimits.currentUsage" :key="usage.key" :class="`status-${usage.status}`">
                  <td class="ip-address">{{ usage.ip }}</td>
                  <td class="user-info">
                    <span v-if="usage.userHandle" class="user-handle">@{{ usage.userHandle }}</span>
                    <span v-else class="anonymous">Anonymous</span>
                  </td>
                  <td>
                    <span class="limit-type" :class="`type-${usage.type}`">
                      {{ usage.type.toUpperCase() }}
                    </span>
                  </td>
                  <td class="request-count">{{ usage.count }}</td>
                  <td class="limit-value">{{ usage.limit }}</td>
                  <td class="usage-percentage">
                    <div class="progress-bar">
                      <div class="progress-fill" :class="`fill-${usage.status}`" :style="{ width: Math.min(usage.percentage, 100) + '%' }"></div>
                      <span class="progress-text">{{ usage.percentage }}%</span>
                    </div>
                  </td>
                  <td class="window-time">{{ formatWindow(usage.window) }}</td>
                  <td class="timestamp">{{ usage.lastRequest ? formatTimestamp(usage.lastRequest) : 'N/A' }}</td>
                  <td class="status-cell">
                    <span class="status-badge" :class="`status-${usage.status}`">
                      {{ usage.status.toUpperCase() }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div v-if="rateLimits && rateLimits.recentHits.length > 0" class="rate-limits-table">
          <h3>Recent Rate Limit Violations (429 Responses)</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Violations</th>
                  <th>First Hit</th>
                  <th>Last Hit</th>
                  <th>Minutes Ago</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hit in rateLimits.recentHits" :key="hit.key">
                  <td class="ip-address">{{ hit.ip }}</td>
                  <td class="user-info">
                    <span v-if="hit.userHandle" class="user-handle">@{{ hit.userHandle }}</span>
                    <span v-else class="anonymous">Anonymous</span>
                  </td>
                  <td>
                    <span class="limit-type" :class="`type-${hit.type}`">
                      {{ hit.type.toUpperCase() }}
                    </span>
                  </td>
                  <td class="hit-count">{{ hit.count }}</td>
                  <td class="timestamp">{{ formatTimestamp(hit.firstHit) }}</td>
                  <td class="timestamp">{{ formatTimestamp(hit.lastHit) }}</td>
                  <td class="minutes-ago" :class="{ 'recent': hit.minutesAgo < 5 }">
                    {{ hit.minutesAgo }}m
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div v-else-if="rateLimits && rateLimits.currentUsage.length === 0" class="no-rate-limits">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <h3>No Active Requests</h3>
            <p>No API requests are currently being tracked. Your API is idle or all request windows have expired.</p>
          </div>
        </div>
        
        <div class="rate-limits-info">
          <h3>Rate Limiting Configuration</h3>
          <div class="config-cards">
            <div class="config-card">
              <h4>General API Limits</h4>
              <p><strong>100 requests</strong> per minute per IP</p>
              <p>Applies to all API endpoints</p>
            </div>
            <div class="config-card">
              <h4>Authentication Limits</h4>
              <p><strong>10 requests</strong> per 15 minutes per IP</p>
              <p>Applies to login and auth endpoints</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User Details Modal -->
    <div v-if="selectedUser" class="modal-overlay" @click="selectedUser = null">
      <div class="modal" @click.stop>
        <h3>User Details</h3>
        <div class="user-details">
          <div class="detail-row">
            <strong>Handle:</strong> {{ selectedUser.handle }}
          </div>
          <div class="detail-row">
            <strong>DID:</strong> {{ selectedUser.did }}
          </div>
          <div class="detail-row">
            <strong>Subscription:</strong> 
            <span :class="`tier-${selectedUser.subscription_tier}`">
              {{ selectedUser.subscription_tier }}
            </span>
          </div>
          <div class="detail-row">
            <strong>Feeds:</strong> {{ selectedUser.feed_count }}
          </div>
          <div class="detail-row">
            <strong>Joined:</strong> {{ formatDate(selectedUser.created_at) }}
          </div>
        </div>
        <div class="modal-actions">
          <button @click="selectedUser = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const adminStats = ref(null)
const users = ref([])
const activities = ref([])
const selectedUser = ref(null)
const activeTab = ref('users')
const backfillRunning = ref(false)
const backfillResult = ref(null)
const selectedUserId = ref('')
const searchQuery = ref('')
const tierFilter = ref('all')
const defaults = ref([])
const selectedThresholdType = ref('global')
const saving = ref(false)
const syncing = ref(false)
const syncResult = ref(null)
const rateLimits = ref(null)

const filteredUsers = computed(() => {
  let filtered = users.value
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => 
      user.handle.toLowerCase().includes(query) ||
      user.did.toLowerCase().includes(query)
    )
  }
  
  if (tierFilter.value !== 'all') {
    if (tierFilter.value === 'app-users') {
      filtered = filtered.filter(user => user.subscription_tier !== 'none')
    } else {
      filtered = filtered.filter(user => user.subscription_tier === tierFilter.value)
    }
  }
  
  console.log('Filtered users:', filtered.length, 'Filter:', tierFilter.value)
  return filtered
})

const totalActions = computed(() => activities.value.length)
const uniquePosts = computed(() => {
  const posts = new Set(activities.value.map(a => a.post_uri).filter(Boolean))
  return posts.size
})
const activeFeeds = computed(() => {
  const feeds = new Set(activities.value.map(a => a.feed_id).filter(Boolean))
  return feeds.size
})

const categories = computed(() => {
  const cats = new Set(defaults.value.filter(d => d.threshold_type === selectedThresholdType.value).map(d => d.category))
  const categoryOrder = ['misleading', 'harassment', 'violence', 'sexual', 'child-safety', 'self-harm', 'rule', 'other']
  return Array.from(cats).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a)
    const indexB = categoryOrder.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
})

onMounted(async () => {
  await loadAdminStats()
  await loadUsers()
  await loadActivity()
  await loadDefaults()
  await loadRateLimits()
})

const loadAdminStats = async () => {
  try {
    const response = await axios.get('/api/admin/stats')
    adminStats.value = response.data
  } catch (error) {
    console.error('Failed to load admin stats:', error)
  }
}

const loadUsers = async () => {
  try {
    const response = await axios.get('/api/admin/users')
    users.value = response.data
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

const loadActivity = async () => {
  try {
    const response = await axios.get('/api/admin/activity')
    activities.value = response.data
  } catch (error) {
    console.error('Failed to load activity:', error)
  }
}

const updateSubscription = async (userId: number, tier: string) => {
  try {
    await axios.put(`/api/admin/users/${userId}/subscription`, {
      subscription_tier: tier
    })
    await loadUsers()
  } catch (error) {
    console.error('Failed to update subscription:', error)
    alert('Failed to update subscription')
  }
}

const viewUserDetails = (user: any) => {
  selectedUser.value = user
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatAction = (action: string) => {
  return action.replace('_', ' ').toUpperCase()
}

const getActionClass = (action: string) => {
  if (action.includes('remove')) return 'action-remove'
  if (action.includes('label')) return 'action-label'
  return 'action-other'
}

const runGeneralBackfill = async () => {
  backfillRunning.value = true
  backfillResult.value = null
  
  try {
    const response = await axios.post('/api/admin/communal-backfill')
    backfillResult.value = response.data
  } catch (error) {
    console.error('Backfill failed:', error)
    alert('Backfill failed. Check console for details.')
  } finally {
    backfillRunning.value = false
  }
}

const runUserBackfill = async () => {
  if (!selectedUserId.value) return
  
  backfillRunning.value = true
  backfillResult.value = null
  
  try {
    const response = await axios.post('/api/admin/communal-backfill', {
      userId: parseInt(selectedUserId.value)
    })
    backfillResult.value = response.data
  } catch (error) {
    console.error('User backfill failed:', error)
    alert('User backfill failed. Check console for details.')
  } finally {
    backfillRunning.value = false
  }
}

const loadDefaults = async () => {
  try {
    const response = await axios.get('/api/admin/defaults')
    defaults.value = response.data
  } catch (error) {
    console.error('Failed to load defaults:', error)
  }
}

const saveDefaults = async () => {
  saving.value = true
  try {
    const response = await axios.put('/api/admin/defaults', {
      defaults: defaults.value
    })
    alert('Defaults saved successfully!')
    if (response.data.synced_users) {
      syncResult.value = {
        message: `Auto-synced ${response.data.synced_users.post_thresholds} users (post) and ${response.data.synced_users.ban_thresholds} users (ban)`
      }
    }
  } catch (error) {
    console.error('Failed to save defaults:', error)
    alert('Failed to save defaults')
  } finally {
    saving.value = false
  }
}

const syncAllUsers = async () => {
  syncing.value = true
  syncResult.value = null
  try {
    const response = await axios.post('/api/admin/sync-users')
    syncResult.value = response.data
  } catch (error) {
    console.error('Failed to sync users:', error)
    alert('Failed to sync users')
  } finally {
    syncing.value = false
  }
}

const getThresholdValue = (category, subcategory, type) => {
  const item = defaults.value.find(d => 
    d.threshold_type === selectedThresholdType.value &&
    d.category === category &&
    d.subcategory === subcategory
  )
  return item ? (type === 'post' ? item.post_threshold : item.user_ban_threshold) : 3
}

const setThresholdValue = (category, subcategory, type, value) => {
  const item = defaults.value.find(d => 
    d.threshold_type === selectedThresholdType.value &&
    d.category === category &&
    d.subcategory === subcategory
  )
  if (item) {
    const numValue = parseInt(value)
    if (type === 'post') {
      item.post_threshold = numValue
    } else {
      item.user_ban_threshold = numValue
    }
  }
}

const getSubcategories = (category) => {
  const subcats = defaults.value
    .filter(d => d.threshold_type === selectedThresholdType.value && d.category === category && d.subcategory)
    .map(d => d.subcategory)
  
  const subcategoryOrder = {
    misleading: ['spam', 'scam', 'bot', 'impersonation', 'elections', 'other'],
    harassment: ['troll', 'targeted', 'hate-speech', 'doxxing', 'other'],
    violence: ['animal', 'threats', 'graphic-content', 'glorification', 'trafficking', 'other'],
    sexual: ['unlabeled', 'abuse-content', 'ncii', 'deepfake', 'animal', 'other'],
    'child-safety': ['privacy', 'harassment'],
    'self-harm': ['content', 'ed', 'stunts', 'substances', 'other'],
    rule: ['site-security', 'prohibited-sales', 'ban-evasion', 'other']
  }
  
  const order = subcategoryOrder[category] || []
  return Array.from(new Set(subcats)).sort((a, b) => {
    const indexA = order.indexOf(a)
    const indexB = order.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
}

const formatCategoryName = (category) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatSubcategoryName = (subcategory) => {
  return subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const loadRateLimits = async () => {
  try {
    const response = await axios.get('/api/admin/rate-limits')
    rateLimits.value = response.data
  } catch (error) {
    console.error('Failed to load rate limits:', error)
  }
}

const formatWindow = (windowMs) => {
  const minutes = Math.floor(windowMs / 60000)
  return minutes === 1 ? '1 min' : `${minutes} min`
}

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.tab-navigation {
  display: flex;
  gap: 0;
  margin: -1rem 0 0 0;
  background: var(--bg-primary);
  padding: 0;
  border-top: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
}

.tab-btn {
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
}

.tab-btn:last-child {
  border-right: none;
}

.tab-icon {
  width: 20px;
  height: 20px;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab-content {
  padding-top: 1.5rem;
}

.admin-stats, .activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 2px;
  box-shadow: 0 2px 4px var(--shadow);
  text-align: center;
  border-left: 4px solid #1d4ed8;
}

.stat-card h3 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1d4ed8;
  margin: 0 0 0.25rem 0;
}

.stat-card p {
  color: var(--text-secondary);
  font-weight: 500;
  margin: 0;
  font-size: 0.875rem;
}

.desktop-only {
  display: block !important;
}

.mobile-only {
  display: none !important;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
  
  .mobile-only {
    display: block !important;
  }
}

.users-table, .activity-log {
  background: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 2px 4px var(--shadow);
}

.log-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: var(--bg-primary);
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid var(--border-primary);
  font-size: 0.875rem;
  color: var(--text-primary);
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-secondary);
  font-size: 0.875rem;
  color: var(--text-primary);
}

.users-cards, .activity-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-card, .activity-card {
  background: var(--bg-secondary);
  border-radius: 2px;
  padding: 1rem;
  box-shadow: 0 2px 4px var(--shadow);
  border: 1px solid var(--border-primary);
}

.user-card-header, .activity-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-secondary);
}

.user-card-body, .activity-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-field, .activity-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-field label, .activity-field label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.user-field .did {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
  word-break: break-all;
}

.user-field .tier-select {
  margin-left: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-badge {
  background: #fbbf24;
  color: #92400e;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.did {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.tier-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 0.25rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.feed-count {
  text-align: center;
  font-weight: 600;
}

.date, .time {
  color: var(--text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
}

.action-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  white-space: nowrap;
}

.view-btn {
  background: #1d4ed8;
  color: white;
}

.action-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.action-remove {
  background: #fef2f2;
  color: #dc2626;
}

.action-label {
  background: #eff6ff;
  color: #1d4ed8;
}

.action-other {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.moderator {
  font-weight: 500;
}

.feed {
  color: #059669;
}

.reason {
  color: var(--text-secondary);
  font-style: italic;
}

.post-uri {
  font-family: monospace;
  color: var(--text-secondary);
}

.uri-short {
  background: var(--bg-tertiary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
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
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
  color: var(--text-primary);
}

.user-details {
  margin: 1rem 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-secondary);
}

.tier-free {
  color: var(--text-secondary);
}

.tier-paid {
  color: #059669;
  font-weight: 600;
}

.tier-premium {
  color: #d97706;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.modal-actions button {
  background: var(--text-secondary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
}

.admin-tools {
  margin-top: 2rem;
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 2px;
  box-shadow: 0 2px 4px var(--shadow);
}

.admin-tools h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.25rem;
}

.tool-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.tool-card {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
  background: var(--bg-primary);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tool-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.tool-header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.tool-card p {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0 0 1rem 0;
}

.tool-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
}

.tool-btn:hover:not(:disabled) {
  background: #2563eb;
}

.tool-btn:disabled {
  background: var(--text-secondary);
  cursor: not-allowed;
}

.user-backfill-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.backfill-result {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.result-icon {
  width: 20px;
  height: 20px;
  color: #059669;
}

.result-header span {
  font-weight: 600;
  color: #059669;
}

.backfill-result p {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.result-stats {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.users-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.tier-filter {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  min-width: 120px;
}

@media (max-width: 768px) {
  .users-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input, .tier-filter {
    width: 100%;
  }
}

.defaults-header {
  margin-bottom: 1.5rem;
}

.defaults-header h2 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.defaults-header p {
  color: var(--text-secondary);
  margin: 0;
}

.defaults-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 600;
  color: var(--text-primary);
}

.threshold-type-select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.control-actions {
  display: flex;
  gap: 0.5rem;
}

.refresh-btn {
  background: var(--text-secondary);
  color: white;
}

.save-btn {
  background: #059669;
  color: white;
}

.sync-btn {
  background: #3b82f6;
  color: white;
}

.defaults-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.category-section {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-primary);
}

.category-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  border-bottom: 1px solid var(--border-secondary);
  padding-bottom: 0.5rem;
}

.threshold-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-secondary);
}

.threshold-row:last-child {
  border-bottom: none;
}

.main-category {
  background: var(--bg-tertiary);
  margin: -1rem -1rem 0.5rem -1rem;
  padding: 1rem;
  border-radius: 6px 6px 0 0;
}

.subcategory {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid var(--border-primary);
}

.threshold-label {
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.subcategory-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.threshold-inputs {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-group label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  min-width: 60px;
}

.threshold-input {
  width: 80px;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: center;
}

.sync-result {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .defaults-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .control-actions {
    justify-content: center;
  }
  
  .threshold-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .threshold-inputs {
    justify-content: space-between;
  }
}

/* Rate Limits Tab Styles */
.rate-limits-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.rate-limits-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.rate-limits-header p {
  margin: 0.25rem 0 0 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.refresh-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #2563eb;
}

.rate-limits-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.rate-limits-table {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-primary);
  margin-bottom: 1.5rem;
}

.rate-limits-table h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.table-container {
  overflow-x: auto;
}

.ip-address {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.limit-type {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.type-general {
  background: #dbeafe;
  color: #1e40af;
}

.type-auth {
  background: #fef3c7;
  color: #92400e;
}

.hit-count {
  font-weight: 600;
  color: #dc2626;
  text-align: center;
}

.limit-value {
  text-align: center;
  color: var(--text-secondary);
}

.window-time {
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.timestamp {
  font-size: 0.875rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.minutes-ago {
  text-align: center;
  font-weight: 500;
  color: var(--text-secondary);
}

.minutes-ago.recent {
  color: #dc2626;
  font-weight: 600;
}

.no-rate-limits {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 2rem;
  border: 1px solid var(--border-primary);
  margin-bottom: 1.5rem;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: #10b981;
  margin: 0 auto 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.rate-limits-info {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-primary);
}

.rate-limits-info h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.config-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.config-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-secondary);
  border-radius: 6px;
  padding: 1rem;
}

.config-card h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.config-card p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.config-card p strong {
  color: var(--text-primary);
}

.stat-card.warning {
  border-left-color: #f59e0b;
}

.stat-card.warning h3 {
  color: #f59e0b;
}

.stat-card.danger {
  border-left-color: #ef4444;
}

.stat-card.danger h3 {
  color: #ef4444;
}

.request-count {
  font-weight: 600;
  text-align: center;
}

.usage-percentage {
  min-width: 120px;
}

.progress-bar {
  position: relative;
  width: 100px;
  height: 20px;
  background: #f3f4f6;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #d1d5db;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.fill-normal {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.fill-warning {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}

.fill-exceeded {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-shadow: 0 0 2px rgba(255,255,255,0.8);
}

.status-cell {
  text-align: center;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-normal {
  background: #dcfce7;
  color: #166534;
}

.status-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-exceeded {
  background: #fecaca;
  color: #991b1b;
}

tr.status-normal {
  background: rgba(16, 185, 129, 0.05);
}

tr.status-warning {
  background: rgba(245, 158, 11, 0.05);
}

tr.status-exceeded {
  background: rgba(239, 68, 68, 0.05);
}

.user-info {
  text-align: center;
}

.user-handle {
  font-weight: 600;
  color: #3b82f6;
  font-size: 0.875rem;
}

.anonymous {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .rate-limits-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
    text-align: center;
  }
  
  .rate-limits-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .config-cards {
    grid-template-columns: 1fr;
  }
}
</style>