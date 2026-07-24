<template>
  <div>
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button 
        @click="activeTab = 'remove'" 
        :class="{ active: activeTab === 'remove' }"
        class="tab-btn"
        title="Posts"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
        <span class="tab-label">Posts</span>
      </button>
      <button 
        @click="activeTab = 'ban'" 
        :class="{ active: activeTab === 'ban' }"
        class="tab-btn"
        title="Users"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="tab-label">Users</span>
      </button>
      <button 
        @click="activeTab = 'ozone'" 
        :class="{ active: activeTab === 'ozone' }"
        class="tab-btn"
        title="Ozone Configuration"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path d="M9 9h.01"/>
          <path d="M15 9h.01"/>
          <path d="M9 15h.01"/>
          <path d="M15 15h.01"/>
          <path d="M7 12l2 2 4-4"/>
        </svg>
        <span class="tab-label">Ozone</span>
      </button>
      <button 
        @click="activeTab = 'autoblock'" 
        :class="{ active: activeTab === 'autoblock' }"
        class="tab-btn"
        title="Auto-Block"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <span class="tab-label">Auto-Block</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content" v-if="tabsLoaded">
      <!-- Posts Tab -->
      <RemoveTab 
        v-if="activeTab === 'remove'"
        :feeds="feeds"
        :report-types="reportTypes"
        :user-activity="userActivity"
        :trending-removals="trendingRemovals"
        :global-settings="globalThresholds"
        :backfill-limits="backfillLimits"
        @show-info="showInfo"
        @show-post-history="showPostHistory"
        @show-restore-confirm="showRestoreConfirm"
        @show-protection-info="showProtectionInfo"
        @show-reverse-info="showReverseInfo"
        @show-post-reports="showPostReports"
        @post-removed="loadUserActivity(); loadTrendingRemovals()"
        @trending-updated="loadTrendingRemovals"
      />

      <!-- Ban Users Tab -->
      <BanTab 
        v-if="activeTab === 'ban'"
        :feeds="feeds"
        :report-types="reportTypes"
        :banned-users="bannedUsers"
        :trending-banned-users="trendingBannedUsers"
        :available-lists="availableLists"
        :selected-list-filter="selectedListFilter"
        :user-tier="authStore.user?.subscription_tier || 'free'"
        :global-settings="globalThresholds"
        @show-info="showInfo"
        @user-banned="loadBannedUsers(); loadTrendingBannedUsers(); loadFeeds()"
        @user-unbanned="loadBannedUsers()"
        @trending-updated="loadTrendingBannedUsers"
        @edit-global-ban-list="editGlobalBanList"
        @edit-feed-ban-list="editFeedBanList"
        @show-attempted-posts="showAttemptedPosts"
        @show-user-history="showUserHistory"
        @show-unban-confirm="showUnbanConfirm"
        @sync-all-lists="syncAllLists"
        @sync-specific-list="syncSpecificList"
        @ban-trending-user="banTrendingUser"
        @hide-trending-banned-user="hideTrendingBannedUser"
        @trending-params-changed="loadTrendingBannedUsers"
        @update:selectedListFilter="selectedListFilter = $event"
      />

      <!-- Ozone Tab -->
      <div v-show="activeTab === 'ozone'" class="ozone-wrapper">
        <OzoneTab />
      </div>

      <!-- Auto-Block Tab -->
      <div v-show="activeTab === 'autoblock'" class="autoblock-wrapper">
        <AutoBlockTab />
      </div>
    </div>

    <!-- Edit Global Ban List Modal -->
    <div v-if="showGlobalEditModal" class="modal-overlay" @click="showGlobalEditModal = false">
      <div class="modal" @click.stop>
        <h3>Edit Global Ban List</h3>
        <div class="form-group">
          <label>Ban List URI</label>
          <input v-model="editGlobalBanListUri" type="text" placeholder="at://did:plc:xxx/app.bsky.graph.list/xxx">
          <small>Add this to your feed logic: <code>NOT author in {{ editGlobalBanListUri || 'YOUR_LIST_URI' }}</code></small>
        </div>
        <div class="modal-actions">
          <button type="button" @click="showGlobalEditModal = false">Cancel</button>
          <button type="button" @click="saveGlobalBanListFromModal">Save</button>
        </div>
      </div>
    </div>

    <!-- Edit Per-Feed Ban List Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <div class="modal" @click.stop>
        <h3>Edit Per-Feed Ban List</h3>
        <p>{{ editingFeed?.feed_name }}</p>
        <div class="form-group">
          <label>Ban List URI</label>
          <input v-model="editFeedBanListUri" type="text" placeholder="at://did:plc:xxx/app.bsky.graph.list/xxx">
          <small>Add this to your feed logic: <code>NOT author in {{ editFeedBanListUri || 'YOUR_LIST_URI' }}</code></small>
        </div>
        <div class="modal-actions">
          <button type="button" @click="showEditModal = false">Cancel</button>
          <button type="button" @click="saveFeedBanList">Save</button>
        </div>
      </div>
    </div>

    <!-- Restore Confirmation Modal -->
    <div v-if="showRestoreModal" class="modal-overlay" @click="showRestoreModal = false">
      <div class="restore-modal" @click.stop>
        <div class="restore-header">
          <h3>Restore Post</h3>
          <button @click="showRestoreModal = false" class="close-btn">×</button>
        </div>
        <div class="restore-content">
          <div class="restore-description">
            <p>This will restore the post to <strong>{{ restoreActivity?.feed_name || getFeedName(restoreActivity?.feed_id) || 'All feeds' }}</strong> and mark it as protected 
              <svg class="protection-icon-modal" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10.1V11.1C15.4,11.4 16,12 16,12.8V16.2C16,17.1 15.1,18 14.2,18H9.8C8.9,18 8,17.1 8,16.2V12.8C8,12 8.6,11.4 9.2,11.1V10.1C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10.1V11.1H13.5V10.1C13.5,8.7 12.8,8.2 12,8.2Z"/>
              </svg>
            </p>
            <p>The post will be visible in the feed again and <strong>protected from automated removal</strong> - it will not be removed by communal moderation or other automated processes.</p>
          </div>
          <div class="restore-actions">
            <button @click="showRestoreModal = false" class="cancel-btn">Cancel</button>
            <button @click="confirmRestore" class="restore-confirm-btn">
              <svg class="restore-icon-small" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              Restore Post
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reports Modal -->
    <div v-if="showReportsModal" class="modal-overlay" @click="showReportsModal = false">
      <div class="reports-modal" @click.stop>
        <div class="reports-header">
          <h3>Reports: {{ reportsPostUri.split('/').pop() }}</h3>
          <button @click="showReportsModal = false" class="close-btn">×</button>
        </div>
        <div class="reports-content">
          <div v-if="reportsData.length === 0" class="empty-reports">
            <p>No reports found for this post.</p>
          </div>
          <div v-else class="reports-list">
            <div v-for="report in reportsData" :key="report.id" class="report-entry">
              <div class="report-header">
                <span class="report-badge" :class="'source-' + report.source">
                  {{ report.source.charAt(0).toUpperCase() + report.source.slice(1) }}: {{ report.report_type }}
                </span>
                <div class="report-time">{{ formatTime(report.reported_at) }}</div>
              </div>
              <div class="report-details">
                <div class="reporter-info">Reporter: {{ report.reporter_did }}</div>
                <div v-if="report.post_uri" class="report-context">Context: {{ report.post_uri }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Post History Modal -->
    <div v-if="showHistoryModal" class="modal-overlay" @click="showHistoryModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Post History: {{ historyPostUri.split('/').pop() }}</h3>
          <button @click="showHistoryModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div class="history-tabs">
            <button 
              @click="postHistoryTab = 'history'"
              :class="['history-tab-btn', { active: postHistoryTab === 'history' }]"
            >
              Removal History
            </button>
            <button 
              @click="postHistoryTab = 'reports'"
              :class="['history-tab-btn', { active: postHistoryTab === 'reports' }]"
            >
              Reports
            </button>
          </div>
          
          <div v-if="postHistoryTab === 'reports'">
            <div v-if="postReportsData.length === 0" class="empty-state">
              <p>No reports found for this post.</p>
            </div>
            <div v-else class="reports-list">
              <div v-for="report in postReportsData" :key="report.id" class="report-entry">
                <div class="report-header">
                  <span class="report-badge" :class="'source-' + report.source">
                    {{ report.source.charAt(0).toUpperCase() + report.source.slice(1) }}: {{ report.report_type }}
                  </span>
                  <div class="report-time">{{ formatTime(report.reported_at) }}</div>
                </div>
                <div class="report-details">
                  <div class="reporter-info">Reporter: {{ report.reporter_display || report.reporter_did }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="historyData.length === 0" class="empty-state">
            <p>No removal history found for this post.</p>
          </div>
          <div v-else class="user-history-list">
            <div class="history-controls">
              <button @click="toggleHistoryView" class="toggle-view-btn">
                {{ showAllFeeds ? 'Show This Feed Only' : 'Show All Feeds' }}
              </button>
            </div>
            <div v-for="entry in historyData" :key="entry.id" class="activity-item">
              <div class="activity-details">
                <div class="activity-header">
                  <div class="activity-header-line">
                    <div class="activity-center">
                      <span class="activity-action">{{ formatActivityAction(entry.action) }}</span>
                    </div>
                    <span class="activity-time">{{ formatTime(entry.created_at) }}</span>
                  </div>
                </div>
                <div class="activity-info">
                  <div v-if="entry.feed_name" class="feed-name">{{ entry.feed_name }}</div>
                  <div v-if="entry.reason" class="history-reason">{{ entry.reason }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Attempted Posts Modal -->
    <div v-if="showAttemptedPostsModal" class="modal-overlay" @click="showAttemptedPostsModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Attempted Post Removals</h3>
          <button @click="showAttemptedPostsModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div v-if="attemptedPostsData.length === 0" class="empty-state">
            <p>No posts were attempted to be removed.</p>
          </div>
          <div v-else class="attempted-posts-list">
            <div v-for="post in attemptedPostsData" :key="post.postUri" class="attempted-post-item">
              <div class="post-info">
                <a :href="convertUriToUrl(post.postUri)" target="_blank" class="post-link">
                  {{ post.postUri.split('/').pop() }}
                </a>
                <span :class="post.success ? 'success' : 'error'">
                  {{ post.success ? '✓ Removed' : '✗ ' + (post.error || 'Failed') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User History Modal -->
    <div v-if="showUserHistoryModal" class="modal-overlay" @click="showUserHistoryModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>User History: @{{ userHistoryHandle }}</h3>
          <button @click="showUserHistoryModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <div class="history-tabs">
            <button 
              @click="userHistoryTab = 'posts'"
              :class="['history-tab-btn', { active: userHistoryTab === 'posts' }]"
            >
              Post Removals
            </button>
            <button 
              @click="userHistoryTab = 'bans'"
              :class="['history-tab-btn', { active: userHistoryTab === 'bans' }]"
            >
              Ban/Unban History
            </button>
            <button 
              @click="userHistoryTab = 'reports'"
              :class="['history-tab-btn', { active: userHistoryTab === 'reports' }]"
            >
              User Reports
            </button>
          </div>
          
          <div v-if="userHistoryTab === 'reports'">
            <div v-if="userReportsData.length === 0" class="empty-state">
              <p>No reports found for this user.</p>
            </div>
            <div v-else class="reports-list">
              <div v-for="report in userReportsData" :key="report.id" class="report-entry">
                <div class="report-header">
                  <span class="report-badge" :class="'source-' + report.source">
                    {{ report.source.charAt(0).toUpperCase() + report.source.slice(1) }}: {{ report.report_type }}
                  </span>
                  <div class="report-time">{{ formatTime(report.reported_at) }}</div>
                </div>
                <div class="report-details">
                  <div class="reporter-info">Reporter: {{ report.reporter_display || report.reporter_did }}</div>
                  <div v-if="report.post_uri" class="report-context">
                    Context: <a :href="convertUriToUrl(report.post_uri)" target="_blank" class="post-link">{{ report.post_uri.split('/').pop() }}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="filteredUserHistory.length === 0" class="empty-state">
            <p>No {{ userHistoryTab === 'posts' ? 'post removal' : 'ban/unban' }} history found for this user.</p>
          </div>
          <div v-else class="user-history-list">
            <div v-for="entry in filteredUserHistory" :key="entry.id" class="activity-item">
              <div class="activity-details">
                <div class="activity-header">
                  <div class="activity-header-line">
                    <div class="activity-center">
                      <span class="activity-action">{{ formatActivityAction(entry.action) }}</span>
                    </div>
                    <span class="activity-time">{{ formatTime(entry.created_at) }}</span>
                  </div>
                </div>
                <div class="activity-info">
                  <div v-if="entry.feed_name" class="feed-name">{{ entry.feed_name }}</div>
                  <div v-if="entry.post_uri" class="history-post">
                    <a :href="convertUriToUrl(entry.post_uri)" target="_blank" class="post-link">
                      {{ entry.post_uri.split('/').pop() }}
                    </a>
                  </div>
                  <div v-if="entry.reason" class="history-reason">{{ entry.reason }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unban Confirmation Modal -->
    <div v-if="showUnbanModal" class="modal-overlay" @click="showUnbanModal = false">
      <div class="restore-modal" @click.stop>
        <div class="restore-header">
          <h3>Unban User</h3>
          <button @click="showUnbanModal = false" class="close-btn">×</button>
        </div>
        <div class="restore-content">
          <div class="restore-description">
            <p>This will unban <strong>@{{ unbanUser?.banned_handle }}</strong> from <strong>{{ unbanUser?.feed_name || (unbanUser?.list_type === 'global' ? 'Global Ban List' : unbanUser?.list_type) }}</strong></p>
            <p v-if="getBanMethodPlain(unbanUser)" class="ban-method-info">Ban method: <strong>{{ getBanMethodPlain(unbanUser) }}</strong></p>
            <p>The user will be removed from the ban list and will no longer be automatically filtered from your feeds.</p>
          </div>
          <div class="restore-actions">
            <button @click="showUnbanModal = false" class="cancel-btn">Cancel</button>
            <button @click="confirmUnban" class="restore-confirm-btn">
              <svg class="restore-icon-small" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              Unban User
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Modal -->
    <div v-if="showInfoModal" class="modal-overlay" @click="showInfoModal = false">
      <div class="info-modal" @click.stop>
        <div class="info-header">
          <h3>{{ infoTitle }}</h3>
          <button @click="showInfoModal = false" class="close-btn">×</button>
        </div>
        <div class="info-content">
          <p>{{ infoMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted, defineAsyncComponent } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import { debounce, requestDeduplicator } from '../utils/debounce'
// Lazy load heavy components for better performance
const OzoneTab = defineAsyncComponent(() => import('../components/tabs/Ozone.vue'))
const RemoveTab = defineAsyncComponent(() => import('../components/tabs/RemoveTab.vue'))
const BanTab = defineAsyncComponent(() => import('../components/tabs/BanTab.vue'))
const AutoBlockTab = defineAsyncComponent(() => import('../components/tabs/AutoBlock.vue'))

const authStore = useAuthStore()

const feeds = ref([])
const reportTypes = ref({})

const credentialsForm = ref({
  password: ''
})
const updatingCredentials = ref(false)
const credentialsMessage = ref('')
const credentialsMessageType = ref('')

const bannedUsers = ref([])
const selectedListFilter = ref('all')
const availableLists = ref([])
const globalBanListUri = ref('')
const showEditModal = ref(false)
const showGlobalEditModal = ref(false)
const editingFeed = ref(null)
const editFeedBanListUri = ref('')
const editGlobalBanListUri = ref('')
const activeTab = ref('remove')
const tabsLoaded = ref(false)
const backfillsRemaining = ref(0)
const backfillLimits = ref(null)
const showInfoModal = ref(false)
const infoTitle = ref('')
const infoMessage = ref('')
const showAttemptedPostsModal = ref(false)
const attemptedPostsData = ref([])
const showUserHistoryModal = ref(false)
const userHistoryData = ref([])
const userHistoryHandle = ref('')
const userHistoryTab = ref('posts')
const userReportsData = ref([])
const showUnbanModal = ref(false)
const unbanUser = ref(null)
const showHistoryModal = ref(false)
const historyData = ref([])
const historyPostUri = ref('')
const historyFeedId = ref('')
const showAllFeeds = ref(false)
const postHistoryTab = ref('history')
const postReportsData = ref([])

const showRestoreModal = ref(false)
const restoreActivity = ref(null)



const userActivity = ref([])
const trendingRemovals = ref([])


const trendingBannedUsers = ref([])

const globalThresholds = ref({})



onMounted(async () => {
  await loadReportTypes()
  await loadFeeds()
  await loadGlobalBanList()
  await loadBackfillLimits()
  await loadBannedUsers()
  await loadUserActivity()
  await loadTrendingRemovals()
  await loadTrendingBannedUsers()
  await loadGlobalThresholds()
  
  // Listen for global settings updates from other components
  window.addEventListener('globalSettingsUpdated', loadGlobalThresholds)
  
  // Expose tab switching method globally
  window.setDashboardTab = (tab) => {
    // Small delay to ensure smooth transition
    setTimeout(() => {
      activeTab.value = tab
    }, 10)
  }
  
  // Check for tab parameter in URL
  const urlParams = new URLSearchParams(window.location.search)
  const tabParam = urlParams.get('tab')
  if (tabParam && ['remove', 'ban', 'ozone', 'autoblock'].includes(tabParam)) {
    activeTab.value = tabParam
  }
  
  // Mark tabs as loaded after initial setup
  tabsLoaded.value = true
})

// Watch for feeds changes to update dropdown
watch(feeds, () => {
  updateAvailableLists()
}, { deep: true })

// Watch for filter changes to reload data
watch(selectedListFilter, async (newValue, oldValue) => {
  // Only reload if the value actually changed
  if (newValue !== oldValue) {
    await loadBannedUsers()
  }
})

const updateAvailableLists = () => {
  const listTypes = [...new Set(bannedUsers.value.map(u => u.list_type))]
  console.log('List types found:', listTypes)
  console.log('Feeds available:', feeds.value.map(f => ({ id: f.feed_id, name: f.feed_name })))
  
  availableLists.value = [
    { value: 'all', label: 'All Banned' },
    { value: 'history', label: 'Unbanned Users' },
    { value: 'global', label: 'Global Ban List' },
    // Always include all feeds, not just those with banned users
    ...feeds.value.map(feed => ({
      value: feed.feed_id,
      label: `${feed.feed_name} Ban List`
    }))
  ]
  
  console.log('Available lists:', availableLists.value)
}

const loadReportTypes = async () => {
  try {
    const response = await axios.get('/api/report-types/hierarchical')
    reportTypes.value = response.data.reportTypes
  } catch (error) {
    console.error('Failed to load report types:', error)
    // Fallback to legacy types if API fails
    reportTypes.value = {
      other: {
        name: 'Other',
        subcategories: {
          'other': 'Other/Commands'
        }
      }
    }
  }
}

const loadGlobalThresholds = async () => {
  try {
    const response = await axios.get('/api/user/global-settings')
    globalThresholds.value = response.data || {}
  } catch (error) {
    console.error('Failed to load global thresholds:', error)
  }
}

const loadFeeds = async () => {
  try {
    const response = await axios.get('/api/feeds')
    feeds.value = response.data
  } catch (error) {
    console.error('Failed to load feeds:', error)
  }
}















const convertUrlToUri = (url: string): string => {
  // Backend now handles URL conversion, so just pass through
  return url
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
    
  } catch (error) {
    console.error('Failed to update credentials:', error)
    credentialsMessage.value = 'Failed to update password. Please try again.'
    credentialsMessageType.value = 'error'
  } finally {
    updatingCredentials.value = false
    
    // Clear message after 3 seconds
    setTimeout(() => {
      credentialsMessage.value = ''
    }, 3000)
  }
}

const getFeedName = (feedId: string): string => {
  const feed = feeds.value.find(f => f.feed_id === feedId)
  return feed ? feed.feed_name : feedId
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const loadGlobalBanList = async () => {
  try {
    const response = await axios.get('/api/user/global-ban-list')
    globalBanListUri.value = response.data.globalBanList || ''
  } catch (error) {
    console.error('Failed to load global ban list:', error)
  }
}

const saveGlobalBanList = async () => {
  try {
    await axios.post('/api/user/global-ban-list', {
      globalBanList: globalBanListUri.value
    })
  } catch (error) {
    console.error('Failed to save global ban list:', error)
  }
}

const editGlobalBanList = () => {
  editGlobalBanListUri.value = globalBanListUri.value
  showGlobalEditModal.value = true
}

const saveGlobalBanListFromModal = async () => {
  globalBanListUri.value = editGlobalBanListUri.value
  await saveGlobalBanList()
  showGlobalEditModal.value = false
}

const editFeedBanList = (feed: any) => {
  editingFeed.value = feed
  editFeedBanListUri.value = feed.feed_ban_list || ''
  showEditModal.value = true
}

const saveFeedBanList = async () => {
  try {
    await axios.put(`/api/feeds/${editingFeed.value.feed_id}`, {
      ...editingFeed.value,
      feed_ban_list: editFeedBanListUri.value
    })
    editingFeed.value.feed_ban_list = editFeedBanListUri.value
    showEditModal.value = false
    await loadFeeds()
  } catch (error) {
    console.error('Failed to save feed ban list:', error)
  }
}

const loadBackfillLimits = async () => {
  try {
    const response = await axios.get('/api/user/backfill-limits')
    backfillsRemaining.value = response.data.remaining
    backfillLimits.value = response.data.limits
  } catch (error) {
    console.error('Failed to load backfill limits:', error)
    // Set default remaining count if API fails
    backfillsRemaining.value = 20
    backfillLimits.value = {
      '25': { remaining: 20, max: 20 },
      '50': { remaining: 10, max: 10 },
      '100': { remaining: 5, max: 5 }
    }
  }
}



const loadBannedUsers = async () => {
  try {
    const includeHistory = selectedListFilter.value === 'history'
    const response = await axios.get('/api/moderation/banned-users', {
      params: { includeHistory }
    })
    console.log('Banned users response:', response.data)
    console.log('Current feeds:', feeds.value)
    bannedUsers.value = response.data
    
    // Always update available lists, even when empty
    updateAvailableLists()
  } catch (error) {
    console.error('Failed to load banned users:', error)
    // Still update available lists on error to ensure dropdown works
    updateAvailableLists()
  }
}

const loadUserActivity = async () => {
  try {
    const response = await axios.get('/api/moderation/user-activity')
    userActivity.value = response.data
  } catch (error) {
    console.error('Failed to load user activity:', error)
  }
}

const loadTrendingRemovals = debounce(async (params) => {
  try {
    const queryParams = {
      timeframe: '1d',
      showHidden: false,
      showRemoved: false
    }
    
    if (params && typeof params === 'object') {
      Object.assign(queryParams, params)
    }
    
    const key = `trending-removals-${JSON.stringify(queryParams)}`
    const response = await requestDeduplicator.dedupe(key, () => 
      axios.get('/api/moderation/trending-removals', { params: queryParams })
    )
    trendingRemovals.value = response.data
  } catch (error) {
    console.error('Failed to load trending removals:', error)
  }
}, 300)



const convertUriToUrl = (uri: string): string => {
  const match = uri.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)/)
  if (match) {
    const [, did, postId] = match
    return `https://bsky.app/profile/${did}/post/${postId}`
  }
  return uri
}

const loadTrendingBannedUsers = debounce(async (params) => {
  try {
    const queryParams = {
      timeframe: '1d',
      showHidden: false,
      showRemoved: false
    }
    
    if (params && typeof params === 'object') {
      Object.assign(queryParams, params)
    }
    
    const key = `trending-banned-users-${JSON.stringify(queryParams)}`
    const response = await requestDeduplicator.dedupe(key, () => 
      axios.get('/api/moderation/trending-banned-users', { params: queryParams })
    )
    trendingBannedUsers.value = response.data
  } catch (error) {
    console.error('Failed to load trending banned users:', error)
  }
}, 300)

const hideTrendingBannedUser = async (bannedHandle: string) => {
  try {
    await axios.post('/api/moderation/hide-trending-banned-user', { bannedHandle })
    await loadTrendingBannedUsers()
  } catch (error) {
    console.error('Failed to hide trending banned user:', error)
  }
}



const banTrendingUser = async (userHandle: string) => {
  try {
    const response = await axios.post('/api/moderation/ban-user', {
      userHandle,
      useGlobal: false,
      selectedFeeds: [],
      reason: 'Trending ban'
    })
    
    if (response.data.success) {
      await loadTrendingBannedUsers()
      await loadBannedUsers()
    }
  } catch (error) {
    console.error('Failed to ban trending user:', error)
  }
}

const showUnbanConfirm = (user) => {
  unbanUser.value = user
  showUnbanModal.value = true
}

const confirmUnban = async () => {
  if (!unbanUser.value) return
  
  try {
    const response = await axios.post('/api/moderation/unban-user', {
      userHandle: unbanUser.value.banned_handle,
      listType: unbanUser.value.list_type,
      listIdentifier: unbanUser.value.list_identifier
    })
    
    if (response.data.success) {
      await loadBannedUsers()
      showUnbanModal.value = false
      unbanUser.value = null
    } else {
      alert('Failed to unban user: ' + response.data.error)
    }
    
  } catch (error) {
    console.error('Failed to unban user:', error)
    alert('Failed to unban user')
  }
}

const syncAllLists = async () => {
  try {
    const response = await axios.post('/api/moderation/sync-ban-lists')
    if (response.data.added > 0 || response.data.removed > 0) {
      alert(`Sync completed: ${response.data.added} added, ${response.data.removed} removed`)
      await loadBannedUsers()
    } else {
      alert('All lists are already in sync')
    }
  } catch (error) {
    if (error.response?.status === 429) {
      alert('Sync cooldown active. Try again in 24 hours.')
    } else {
      console.error('Failed to sync ban lists:', error)
      alert('Sync failed')
    }
  }
}

const syncSpecificList = async (listType: string) => {
  try {
    const response = await axios.post('/api/moderation/sync-ban-lists', { listType })
    if (response.data.added > 0 || response.data.removed > 0) {
      alert(`Sync completed: ${response.data.added} added, ${response.data.removed} removed`)
      await loadBannedUsers()
    } else {
      alert('List is already in sync')
    }
  } catch (error) {
    if (error.response?.status === 429) {
      alert('Sync cooldown active. Try again in 24 hours.')
    } else {
      console.error('Failed to sync list:', error)
      alert('Sync failed')
    }
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatActivityAction = (action: string): string => {
  if (action === 'manual_removal') return 'Manual Post Removal'
  if (action === 'backfill_removal') return 'Backfill Post Removal'
  if (action === 'ban_removal') return 'Post Removed During Ban'
  if (action === 'communal_removal') return 'Communal Post Removal'
  if (action === 'remove_post') return 'Post Removal'
  if (action === 'auto_ban') return 'User Banned (Auto)'
  if (action === 'manual_ban') return 'User Banned (Manual)'
  if (action === 'unban') return 'User Unbanned'
  if (action === 'reverse_removal') return 'Post Restoration'
  return action.replace('_', ' ').toUpperCase()
}

const getBanMethodPlain = (ban: any): string => {
  if (!ban) return 'Manual Ban'
  
  if (ban.reason) {
    if (ban.reason.includes('auto-block') || ban.reason.includes('Auto Block')) return 'Auto Block'
    if (ban.reason.includes('communal') || ban.reason.includes('Communal')) return 'Communal Moderation'
  }
  
  if (ban.ban_type) {
    if (ban.ban_type === 'auto') return 'Auto Block'
    if (ban.ban_type === 'communal') return 'Communal Moderation'
  }
  
  return 'Manual Ban'
}



const getGlobalThreshold = (type: string, globalThresholds: any = {}): number => {
  const fallbacks = {
    misleading: 10,
    harassment: 5,
    violence: 3,
    sexual: 5,
    'child-safety': 2,
    'self-harm': 3,
    rule: 5
  }
  return globalThresholds[`global_threshold_${type.replace('-', '_')}`] || fallbacks[type as keyof typeof fallbacks] || 10
}

const calculateFeedThresholdDisplay = (item: any, type: string, feed: any): string => {
  // Handle new format with report_types array
  if (item.report_types && Array.isArray(item.report_types)) {
    const reportTypes = item.report_types || []
    const crossTypeThreshold = feed[`threshold_${type}`] || feed[`global_threshold_${type}`] || getGlobalThreshold(type)
    
    // Get percentages from feed or global settings
    const sameCategoryPercentage = feed.same_category_cross_percentage || feed.global_same_category_cross_percentage || 50
    const globalCrossTypePercentage = feed.cross_type_percentage || feed.global_cross_type_percentage || 20
    
    // Calculate same-type threshold (no cross-type contributions)
    const sameTypeThreshold = Math.floor(crossTypeThreshold * (100 - globalCrossTypePercentage) / 100)
    
    // Count reports matching the main category and same-category subcategories
    const mainCategoryReports = reportTypes.filter(rt => {
      if (rt === type) return true
      const mainCategory = type
      return rt.startsWith(mainCategory + '-')
    }).length
    
    // Count other category reports
    const otherCategoryReports = reportTypes.filter(rt => {
      if (rt === type) return false
      const mainCategory = type
      if (rt.startsWith(mainCategory + '-')) return false
      return true
    }).length
    
    // Apply same-category cross-type
    const sameCategoryContribution = Math.floor(mainCategoryReports * (sameCategoryPercentage / 100))
    
    // Apply global cross-type
    const globalCrossTypeContribution = Math.floor(otherCategoryReports * (globalCrossTypePercentage / 100))
    
    const totalEffective = mainCategoryReports + sameCategoryContribution + globalCrossTypeContribution
    
    // Build display showing both thresholds
    let display = ''
    
    // Cross-type threshold display
    if (sameCategoryContribution > 0 || globalCrossTypeContribution > 0) {
      display = `${mainCategoryReports}`
      if (sameCategoryContribution > 0) display += `+${sameCategoryContribution}`
      if (globalCrossTypeContribution > 0) display += `+${globalCrossTypeContribution}`
      display += `=${totalEffective}/${crossTypeThreshold}`
    } else {
      display = `${mainCategoryReports}/${crossTypeThreshold}`
    }
    
    // Add same-type threshold (calculated from percentages)
    display += ` | Same-type: ${mainCategoryReports}/${sameTypeThreshold}`
    
    return display
  }
  
  // Legacy format fallback
  const reportCount = item[`${type}_reports`] || 0
  const crossTypeThreshold = feed[`threshold_${type}`] || feed[`global_threshold_${type}`] || getGlobalThreshold(type)
  const globalCrossTypePercentage = feed.cross_type_percentage || feed.global_cross_type_percentage || 20
  const sameTypeThreshold = Math.floor(crossTypeThreshold * (100 - globalCrossTypePercentage) / 100)
  
  const otherTypes = ['spam', 'harassment', 'illegal', 'sexual'].filter(t => t !== type)
  const otherReportsTotal = otherTypes.reduce((sum, t) => sum + (item[`${t}_reports`] || 0), 0)
  
  const maxOtherReports = Math.floor(crossTypeThreshold * (globalCrossTypePercentage / 100))
  const allowedOtherReports = Math.min(otherReportsTotal, maxOtherReports)
  
  const totalEffective = reportCount + allowedOtherReports
  
  let display = ''
  if (allowedOtherReports > 0) {
    display = `${reportCount}+${allowedOtherReports}=${totalEffective}/${crossTypeThreshold}`
  } else {
    display = `${reportCount}/${crossTypeThreshold}`
  }
  
  // Add same-type threshold (calculated from percentages)
  display += ` | Same-type: ${reportCount}/${sameTypeThreshold}`
  
  return display
}





const getCategoryDisplayName = (category: string): string => {
  const names = {
    misleading: 'Misleading',
    harassment: 'Harassment',
    violence: 'Violence',
    sexual: 'Sexual',
    'child-safety': 'Child Safety',
    'self-harm': 'Self Harm',
    rule: 'Rule Breaking'
  }
  return names[category as keyof typeof names] || category
}



const getSubcategoriesForCategory = (category: string) => {
  const subcategories = {
    misleading: [
      { key: 'misleading-spam', name: 'Spam' },
      { key: 'misleading-scam', name: 'Scam' },
      { key: 'misleading-bot', name: 'Fake account or bot' },
      { key: 'misleading-impersonation', name: 'Impersonation' },
      { key: 'misleading-elections', name: 'False information about elections' },
      { key: 'misleading-other', name: 'Other misleading content' }
    ],
    harassment: [
      { key: 'harassment-troll', name: 'Trolling' },
      { key: 'harassment-targeted', name: 'Targeted harassment' },
      { key: 'harassment-hate-speech', name: 'Hate speech' },
      { key: 'harassment-doxxing', name: 'Doxxing' },
      { key: 'harassment-other', name: 'Other harassing or hateful content' }
    ],
    violence: [
      { key: 'violence-animal', name: 'Animal welfare' },
      { key: 'violence-threats', name: 'Threats or incitement' },
      { key: 'violence-graphic-content', name: 'Graphic violent content' },
      { key: 'violence-glorification', name: 'Glorification of violence' },
      { key: 'violence-trafficking', name: 'Human trafficking' },
      { key: 'violence-other', name: 'Other violent content' }
    ],
    sexual: [
      { key: 'sexual-unlabeled', name: 'Unlabeled adult content' },
      { key: 'sexual-abuse-content', name: 'Adult sexual abuse content' },
      { key: 'sexual-ncii', name: 'Non-consensual intimate imagery' },
      { key: 'sexual-deepfake', name: 'Deepfake adult content' },
      { key: 'sexual-animal', name: 'Animal sexual abuse' },
      { key: 'sexual-other', name: 'Other sexual violence content' }
    ],
    'child-safety': [
      { key: 'child-safety-privacy', name: 'Privacy violation of a minor' },
      { key: 'child-safety-harassment', name: 'Minor harassment or bullying' }
    ],
    'self-harm': [
      { key: 'self-harm-content', name: 'Content promoting or depicting self-harm' },
      { key: 'self-harm-ed', name: 'Eating disorders' },
      { key: 'self-harm-stunts', name: 'Dangerous challenges or activities' },
      { key: 'self-harm-substances', name: 'Dangerous substances or drug abuse' },
      { key: 'self-harm-other', name: 'Other dangerous content' }
    ],
    rule: [
      { key: 'rule-site-security', name: 'Hacking or system attacks' },
      { key: 'rule-prohibited-sales', name: 'Promoting or selling prohibited items or services' },
      { key: 'rule-ban-evasion', name: 'Banned user returning' },
      { key: 'rule-other', name: 'Other network rule-breaking' }
    ]
  }
  return subcategories[category as keyof typeof subcategories] || []
}

const calculateSubcategoryDisplay = (item: any, subType: string): string => {
  // For subcategories, we need to count from report_types array
  if (item.report_types && Array.isArray(item.report_types)) {
    const count = item.report_types.filter(rt => rt === subType).length
    return `${count}`
  }
  return '0'
}







const showInfo = (topic: string) => {
  const info = {
    bannedUsers: {
      title: 'Banned Users',
      message: 'Banned users are stored locally and synced to Bluesky moderation lists. Manual sync has 1-hour cooldown to prevent abuse. Automatic sync runs every 24 hours to keep lists synchronized.'
    },
    banUsers: {
      title: 'Ban Users',
      message: 'Banning adds users to both local database and Bluesky moderation lists simultaneously. We also send removal requests for their 10 most recent posts to ensure fast cleanup, without checking if those posts are actually on your feeds first.'
    },
    removePosts: {
      title: 'Remove Posts',
      message: 'Remove individual posts by pasting Bluesky post URLs. Posts are removed from your selected feeds only and do not affect other users\' feeds.'
    },
    bulkRemoval: {
      title: 'Bulk User Removal',
      message: 'Remove the last X posts by a user from your selected feeds. This feature is useful when an account mass spams your feeds and you need fast, extensive post removal.<br><br>When a user is banned, all their posts will eventually disappear from your feeds, but due to list caching this isn\'t always immediate. That\'s why we automatically remove their last 5-10 posts when they\'re banned (regardless of whether those specific posts are actually on your feeds - we just try to ensure none of their recent activity remains visible).<br><br>Bulk removal is more extensive but works the same way - neither feature checks if posts are actually on your feeds first, as the intention is FAST removal rather than targeted precision.'
    },
    backfill: {
      title: 'Backfill Removal',
      message: 'Remove the last X posts by a user from all your feeds. This feature is useful when an account mass spams your feeds and you need fast, extensive post removal.<br><br>When a user is banned, all their posts will eventually disappear from your feeds, but due to list caching this isn\'t always immediate. That\'s why we automatically remove their last 5-10 posts when they\'re banned (regardless of whether those specific posts are actually on your feeds - we just try to ensure none of their recent activity remains visible).<br><br>Backfill is more extensive but works the same way - neither feature checks if posts are actually on your feeds first, as the intention is FAST removal rather than targeted precision.'
    }
  }
  
  const selected = info[topic]
  if (selected) {
    infoTitle.value = selected.title
    infoMessage.value = selected.message
    showInfoModal.value = true
  }
}

const showPostInfo = (type: string) => {
  const info = {
    misinformation: {
      title: 'Misinformation Post Removal',
      message: 'Misinformation reports are used for off-topic post removal only. These posts are not considered "bad" content, so they do not participate in communal moderation thresholds.'
    },
    other: {
      title: 'Other Reports Post Removal',
      message: 'Other reports are used for special commands and feed owner controls. They do not participate in communal moderation as they serve administrative functions.'
    }
  }
  
  const selected = info[type]
  if (selected) {
    infoTitle.value = selected.title
    infoMessage.value = selected.message
    showInfoModal.value = true
  }
}

const showUserBanInfo = (type: string) => {
  const info = {
    misinformation: {
      title: 'Misinformation User Bans',
      message: 'Misinformation reports are used for off-topic post removal only. These are not considered "bad" posts that warrant user bans, so they do not participate in communal moderation user banning.'
    },
    other: {
      title: 'Other Reports User Bans', 
      message: 'Other reports are used for special commands and feed owner controls. They do not participate in communal moderation user banning as they serve administrative functions.'
    }
  }
  
  const selected = info[type]
  if (selected) {
    infoTitle.value = selected.title
    infoMessage.value = selected.message
    showInfoModal.value = true
  }
}

const reverseToFeed = async (postUri: string, feedId: string, feedName: string) => {
  if (!confirm(`Re-add this post to ${feedName}?`)) return
  
  try {
    const response = await axios.post('/api/moderation/reverse-removal', {
      postUri,
      feedIds: [feedId]
    })
    
    if (response.data.success) {
      const result = response.data.results[0]
      if (result.success) {
        alert(`Post successfully re-added to ${feedName}! It is now protected from automated removal.`)
        await loadUserActivity() // Refresh activity log to show new reverse_removal entry
      } else {
        alert(`Failed to re-add to ${feedName}: ${result.error}`)
      }
    }
  } catch (error) {
    console.error('Failed to reverse removal:', error)
    alert('Failed to reverse removal. The post may have been deleted or there was an error.')
  }
}

const canShowReverseButtons = (activity: any) => {
  return activity.action !== 'reverse_removal' && activity.feed_id
}

const getAvailableFeeds = (activity: any) => {
  if (activity.action === 'manual_removal') {
    // For manual removals, only show the specific feed it was removed from
    const feed = feeds.value.find(f => f.feed_id === activity.feed_id)
    return feed ? [feed] : []
  } else {
    // For communal/backfill removals, show all user's feeds
    return feeds.value
  }
}



const isPostProtectedInFeed = (activity: any, feedId: string) => {
  // Check if this feed is in the protected_feeds array
  if (!activity.protected_feeds) return false
  return activity.protected_feeds.some(pf => pf.feed_id === feedId)
}

const hasAnyRestoredFeeds = (activity: any) => {
  // Check if any feeds have been restored for this post
  return activity.protected_feeds && activity.protected_feeds.length > 0
}

const showPostHistory = async (postUri: string, feedId: string) => {
  try {
    historyPostUri.value = postUri
    historyFeedId.value = feedId
    showAllFeeds.value = false
    postHistoryTab.value = 'history'
    
    // Load history
    const params = new URLSearchParams()
    if (!showAllFeeds.value && feedId) {
      params.append('feedId', feedId)
    }
    
    const historyResponse = await axios.get(`/api/moderation/post-history/${encodeURIComponent(postUri)}?${params}`)
    historyData.value = historyResponse.data
    
    // Load reports
    const reportsResponse = await axios.get(`/api/moderation/post-reports/${encodeURIComponent(postUri)}`)
    postReportsData.value = reportsResponse.data
    
    showHistoryModal.value = true
  } catch (error) {
    console.error('Failed to load post history:', error)
    alert('Failed to load post history')
  }
}

const showPostReports = async (postUri: string) => {
  try {
    // Use the same tabbed modal but switch to reports tab
    await showPostHistory(postUri, '')
    postHistoryTab.value = 'reports'
  } catch (error) {
    console.error('Failed to load post reports:', error)
    alert('Failed to load post reports')
  }
}

const showRestoreConfirm = (activity: any) => {
  restoreActivity.value = activity
  showRestoreModal.value = true
}

const confirmRestore = async () => {
  if (!restoreActivity.value) return
  
  const activity = restoreActivity.value
  const feedName = activity.feed_name || getFeedName(activity.feed_id) || 'All feeds'
  
  await reverseToFeed(activity.post_uri, activity.feed_id, feedName)
  showRestoreModal.value = false
  restoreActivity.value = null
}

const toggleHistoryView = async () => {
  showAllFeeds.value = !showAllFeeds.value
  await showPostHistory(historyPostUri.value, showAllFeeds.value ? '' : historyFeedId.value)
}



const showThresholdInfo = () => {
  infoTitle.value = 'Communal Moderation Thresholds'
  infoMessage.value = 'Posts are automatically removed when they reach the threshold for each report type. The format shows: direct reports + cross-type reports = total/cross-type-threshold | Same-type: direct-reports/same-type-threshold. Cross-type thresholds allow other report types to contribute a percentage, while same-type thresholds only count reports from the same main category. Both thresholds can trigger removal independently.'
  showInfoModal.value = true
}

const showProtectionInfo = () => {
  infoTitle.value = '🛡️ Protected Post'
  infoMessage.value = 'This post has been restored and is now protected from automated removal in this feed. It will not be removed by communal moderation or other automated processes.'
  showInfoModal.value = true
}

const showReverseInfo = () => {
  infoTitle.value = 'Reverse Removal'
  infoMessage.value = 'Only manual removals can be reversed. Communal removals affected all feeds and cannot be safely reversed. Backfill removals processed multiple posts and cannot be individually reversed.'
  showInfoModal.value = true
}

const showAttemptedPosts = (posts) => {
  attemptedPostsData.value = posts
  showAttemptedPostsModal.value = true
}

const filteredUserHistory = computed(() => {
  if (userHistoryTab.value === 'posts') {
    return userHistoryData.value.filter(entry => 
      ['manual_removal', 'backfill_removal', 'ban_removal', 'communal_removal', 'reverse_removal'].includes(entry.action)
    )
  } else if (userHistoryTab.value === 'bans') {
    return userHistoryData.value.filter(entry => 
      ['manual_ban', 'auto_ban', 'unban'].includes(entry.action)
    )
  } else {
    return []
  }
})

const showUserHistory = async (userHandle) => {
  try {
    userHistoryHandle.value = userHandle
    userHistoryTab.value = 'posts'
    const response = await axios.get(`/api/moderation/user-history/${encodeURIComponent(userHandle)}`)
    userHistoryData.value = response.data
    
    // Load user reports
    try {
      const reportsResponse = await axios.get(`/api/moderation/user-reports/${encodeURIComponent(userHandle)}`)
      userReportsData.value = reportsResponse.data
    } catch (reportsError) {
      console.error('Failed to load user reports:', reportsError)
      userReportsData.value = []
    }
    
    showUserHistoryModal.value = true
  } catch (error) {
    console.error('Failed to load user history:', error)
    alert('Failed to load user history')
  }
}

// Cleanup event listener on unmount
onUnmounted(() => {
  window.removeEventListener('globalSettingsUpdated', loadGlobalThresholds)
  delete window.setDashboardTab
})
</script>

<style scoped>




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

.tab-content {
  padding-top: 1.5rem;
}

.autoblock-wrapper {
  margin-top: -1.5rem;
}

.ozone-wrapper {
  margin-top: -1.5rem;
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
  padding: 0.75rem 0.75rem 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

@media (min-width: 640px) {
  .card-header {
    padding: 1rem 1rem 0.75rem 1rem;
  }
}

@media (min-width: 768px) {
  .card-header {
    padding: 1.5rem 2rem 1rem 2rem;
  }
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  color: #64748b;
}

.icon-sm {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.backfill-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.backfill-title h4 {
  margin: 0;
  color: #374151;
}

.card-description {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

.card-content {
  padding: 0.75rem;
}

@media (min-width: 640px) {
  .card-content {
    padding: 1rem;
  }
}

@media (min-width: 768px) {
  .card-content {
    padding: 1.5rem 2rem;
  }
}





.feeds-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  background: white;
  padding: 0.75rem;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .feeds-header {
    padding: 1rem;
    flex-wrap: nowrap;
  }
}

@media (min-width: 768px) {
  .feeds-header {
    margin-bottom: 1.5rem;
    padding: 1.5rem 2rem;
  }
}

.feeds-header h2 {
  margin: 0;
  color: var(--text-primary, #1e293b);
}

.btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  white-space: nowrap;
  min-height: 44px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.feeds-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .feeds-grid {
    gap: 1rem;
  }
}

@media (min-width: 768px) {
  .feeds-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

.feed-card {
  background: white;
  padding: 1rem;
  border-radius: 2px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  border: 1px solid #f1f5f9;
  transition: transform 0.2s, box-shadow 0.2s;
}

@media (min-width: 640px) {
  .feed-card {
    padding: 1.5rem;
  }
}

.feed-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.feed-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.feed-content {
  margin-top: 1rem;
}

.feed-header h3 {
  margin: 0;
  color: #1e293b;
}

.feed-id {
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-family: monospace;
}

.communal-settings h4 {
  margin-bottom: 0.5rem;
  color: #374151;
}

.communal-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.875rem;
  font-style: italic;
}

.checkbox-label {
  display: block;
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 0.5rem;
}

.threshold-setting {
  margin-bottom: 0.75rem;
}

.threshold-setting.disabled-setting {
  opacity: 0.6;
}

.checkbox-label.disabled {
  cursor: not-allowed;
}

.checkbox-label.disabled input[type="checkbox"] {
  cursor: not-allowed;
}

.checkbox-label small {
  color: #6b7280;
  font-style: italic;
  font-weight: normal;
}

.threshold-setting .checkbox-label {
  width: 100%;
  justify-content: space-between;
}

.threshold-input {
  width: 60px;
  padding: 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 2px;
  text-align: center;
  background: white;
  margin-left: auto;
}

.category-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.category-title {
  margin: 0 0 0.75rem 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.category-threshold {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #d1d5db;
}

.main-threshold-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #3b82f6;
  font-weight: 700;
}

.main-threshold-label:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.main-threshold-label .threshold-input {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  font-weight: 600;
}



.user-ban-settings {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.user-ban-settings h4 {
  margin-bottom: 0.5rem;
  color: #374151;
}

.info-btn-small {
  background: #374151;
  color: white;
  border: none;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  transition: all 0.2s;
}

.info-btn-small svg {
  width: 12px;
  height: 12px;
}

.info-btn-small:hover {
  background: #4b5563;
}

.cross-type-setting {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.percentage-slider {
  width: 100%;
  margin: 0.5rem 0;
}

.percentage {
  font-weight: 600;
  color: #1d4ed8;
}

.delete-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  margin-top: 1rem;
  font-weight: 500;
  transition: all 0.2s;
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
  background: white;
  padding: 1rem;
  border-radius: 12px;
  width: 95%;
  max-width: 400px;
  margin: 0.5rem;
  max-height: 90vh;
  overflow-y: auto;
}

@media (min-width: 640px) {
  .modal {
    padding: 1.5rem;
    margin: 1rem;
  }
}

@media (min-width: 768px) {
  .modal {
    padding: 2rem;
    width: 90%;
    margin: 0;
  }
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.removal-section {
  margin-bottom: 2rem;
}

.removal-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.ban-card {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.ban-btn, .remove-btn, .backfill-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  font-size: 0.875rem;
  min-height: 44px;
}

.ban-btn {
  background: #ef4444;
  color: white;
}

.ban-btn:hover:not(:disabled) {
  background: #dc2626;
}

.remove-btn {
  background: #6b7280;
  color: white;
}

.remove-btn:hover:not(:disabled) {
  background: #4b5563;
}

.backfill-btn {
  background: #f59e0b;
  color: white;
}

.backfill-btn:hover:not(:disabled) {
  background: #d97706;
}



.ban-btn:hover:not(:disabled) {
  background: #991b1b;
}

.ban-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.list-selection {
  margin-bottom: 1.5rem;
}

.list-selection h4 {
  margin: 0 0 0.75rem 0;
  color: #374151;
  font-size: 1rem;
}

.ban-action, .remove-action {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.upgrade-notice {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 8px;
  text-align: center;
  color: #374151;
  border: 1px solid #e2e8f0;
}

.ban-lists-section {
  margin-bottom: 2rem;
}

.section-card {
  background: white;
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  border: 1px solid #f1f5f9;
}

.ban-lists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.ban-list-card {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.list-header h4 {
  margin: 0;
  color: #1e293b;
}

.list-type {
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.list-uri {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.list-uri code {
  flex: 1;
  background: white;
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  border: 1px solid #d1d5db;
  word-break: break-all;
}

.copy-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.copy-btn:hover {
  background: #2563eb;
}

.usage-instructions {
  color: #64748b;
  font-style: italic;
}

.usage-instructions code {
  background: #f1f5f9;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
}

.ban-list-settings {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.ban-list-settings h4 {
  margin-bottom: 0.5rem;
  color: #374151;
}

.ban-list-config {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ban-list-config label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.global-ban-list-config {
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255,255,255,0.1);
  border-radius: 0.5rem;
}

.global-ban-list-config label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.per-feed-ban-list {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.ban-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ban-list-header h4 {
  margin: 0;
  color: #374151;
}

.edit-btn {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.edit-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.current-list {
  background: #f8fafc;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #e2e8f0;
}

.current-list code {
  font-size: 0.75rem;
  word-break: break-all;
}

.no-list {
  color: #6b7280;
  font-style: italic;
}

.backfill-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.section-header {
  margin-bottom: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.section-title h4 {
  margin: 0;
  color: #374151;
}

.section-desc {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.global-list-chip {
  background: #374151;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  width: 100%;
  font-weight: 500;
}

.global-list-chip:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.global-list-chip input[type="checkbox"] {
  display: none;
}

.global-list-chip:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.chip-text {
  flex: 1;
}

.edit-text {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  margin-left: 0.5rem;
}

.edit-text:hover {
  background: #4b5563;
}

.backfill-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .backfill-form {
    gap: 0.75rem;
  }
}

@media (min-width: 768px) {
  .backfill-form {
    flex-direction: row;
    gap: 0.5rem;
  }
}

.post-count-select {
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  min-height: 44px;
  font-size: 0.875rem;
}

@media (min-width: 640px) {
  .post-count-select {
    padding: 0.75rem;
  }
}

.backfill-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.backfill-btn:hover:not(:disabled) {
  background: #dc2626;
}

.backfill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.backfill-remaining-box {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: #374151;
}

.remaining-count {
  font-weight: 700;
  font-size: 1.1em;
  color: #1f2937;
}

.ban-details, .backfill-details {
  margin-top: 0.25rem;
  color: #6b7280;
}

.bluesky-list-status {
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

.bluesky-list-status .success {
  color: #10b981;
  font-weight: 500;
}

.bluesky-list-status .error {
  color: #ef4444;
  font-weight: 500;
}

.bluesky-list-status .warning {
  color: #f59e0b;
  font-weight: 500;
}

.list-link {
  color: #3b82f6;
  text-decoration: underline;
  font-weight: 600;
}

.list-link:hover {
  color: #2563eb;
}

.attempted-posts-btn {
  background: none;
  border: none;
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}

.attempted-posts-btn:hover {
  color: #2563eb;
}

.user-handle-btn {
  background: none;
  border: none;
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 600;
  font-size: inherit;
  padding: 0;
  text-align: left;
}

.user-handle-btn:hover {
  color: #2563eb;
}

.attempted-posts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attempted-post-item {
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 4px solid #e5e7eb;
}

.post-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.history-tab-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}

.history-tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.history-tab-btn:hover:not(.active) {
  color: var(--text-primary, #334155);
  background: var(--bg-tertiary, #f8fafc);
}

.user-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-entry {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.history-post {
  margin-top: 0.25rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 0 1.5rem;
}

.modal-content {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.ban-info {
  background: rgba(255,255,255,0.1);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.ban-info p {
  margin: 0 0 0.5rem 0;
  color: white;
  font-weight: 500;
}

.ban-info small {
  color: rgba(255,255,255,0.8);
  font-style: italic;
}

.removal-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .form-row {
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
}

@media (min-width: 768px) {
  .form-row {
    flex-direction: row;
    gap: 1rem;
  }
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
  font-weight: 500;
  font-size: 0.875rem;
}

.input, .post-url-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 0;
  box-sizing: border-box;
  min-height: 44px;
}

@media (min-width: 640px) {
  .input, .post-url-input {
    padding: 0.75rem 1rem;
  }
}

.input:focus, .post-url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.feed-selection {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  background: #374151;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.checkbox-label:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkbox-label:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.feed-chips {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.feed-chip {
  background: #374151;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-weight: 500;
}

.feed-chip:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.feed-chip input[type="checkbox"] {
  display: none;
}

.feed-chip:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}



.post-url-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-family: monospace;
}

.post-url-input::placeholder {
  color: #9ca3af;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.remove-btn:hover:not(:disabled) {
  background: #dc2626;
}

.remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.result-item {
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border-left: 4px solid #e5e7eb;
}

.result-item.success {
  border-left-color: #10b981;
}

.result-item.error {
  border-left-color: #ef4444;
}

.result-item:last-child {
  margin-bottom: 0;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.section-desc {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.credentials-form {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.password-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.update-credentials-btn {
  background: #1d4ed8;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  margin-top: 1rem;
}

.update-credentials-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.credentials-message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
}

.credentials-message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.credentials-message.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.removal-form {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.post-url-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-family: monospace;
}

.feed-checkboxes {
  margin-top: 0.5rem;
}

.individual-feeds {
  margin-left: 1rem;
  margin-top: 0.5rem;
}

.remove-post-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  margin-top: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.remove-post-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.removal-results {
  margin-top: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.result-item {
  margin-bottom: 0.5rem;
}

.removal-results .success {
  color: #059669;
  font-weight: 600;
}

.removal-results .error {
  color: #dc2626;
  font-weight: 600;
}

.results .success {
  color: #10b981;
  font-weight: 600;
}

.results .error {
  color: #ef4444;
  font-weight: 600;
}

.results .warning {
  color: #f59e0b;
  font-weight: 600;
}

.banned-users-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.banned-user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary, #ffffff);
  border-radius: 2px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ban-info {
  margin-top: 0.25rem;
}



.user-handle {
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.ban-date {
  color: #6b7280;
  font-size: 0.75rem;
}

.ban-reason {
  color: #ef4444;
  font-size: 0.75rem;
  font-style: italic;
}

.unban-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.unban-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.unban-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sync-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.sync-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.info-btn {
  background: #374151;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: all 0.2s;
}

.info-btn svg {
  width: 16px;
  height: 16px;
}

.info-btn:hover {
  background: #4b5563;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-modal {
  background: var(--bg-card, white);
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid var(--border-primary, transparent);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.info-header h3 {
  margin: 0;
  color: var(--text-primary, #1f2937);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text-primary, #374151);
}

.info-content {
  padding: 1.5rem;
}

.info-content p {
  margin: 0;
  line-height: 1.6;
  color: #374151;
}

.emergency-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.emergency-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.emergency-btn svg {
  width: 18px;
  height: 18px;
}

.emergency-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.emergency-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-radius: 12px 12px 0 0;
}

.emergency-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.emergency-icon {
  width: 24px;
  height: 24px;
  color: #ef4444;
}

.emergency-title h3 {
  margin: 0;
  color: #dc2626;
  font-weight: 600;
}

.emergency-content {
  padding: 1.5rem;
}

.emergency-description {
  background: #e0f2fe;
  border: 1px solid #0891b2;
  border-radius: 2px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.emergency-description p {
  margin: 0;
  color: #0c4a6e;
  font-weight: 500;
}

.emergency-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.emergency-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 2px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.emergency-input:focus {
  outline: none;
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.emergency-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.cancel-btn {
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.emergency-submit-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.emergency-submit-btn:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.emergency-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.emergency-result {
  margin-top: 1.5rem;
}

.result-message {
  padding: 1rem;
  border-radius: 8px;
  font-weight: 500;
}

.result-message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.result-message.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.list-filter {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sync-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sync-btn-small {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.filter-row label {
  font-weight: 500;
  color: var(--text-primary, #374151);
  white-space: nowrap;
}

.list-dropdown {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.list-dropdown:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.list-dropdown:hover {
  border-color: #9ca3af;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.activity-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-header {
  margin-bottom: 0.5rem;
}

.activity-header-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.post-id-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.post-id-btn {
  font-family: monospace;
  font-size: 0.75rem;
  color: #3b82f6;
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.post-id-btn:hover {
  background: #e5e7eb;
  text-decoration: underline;
}

.bluesky-icon {
  width: 16px;
  height: 16px;
  color: #0085ff;
  transition: all 0.2s;
}

.bluesky-icon:hover {
  color: #0066cc;
  transform: scale(1.1);
}

.bluesky-icon svg {
  width: 100%;
  height: 100%;
}

.history-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.history-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toggle-view-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.toggle-view-btn:hover {
  background: #2563eb;
}

.history-content {
  padding: 1.5rem;
}

.empty-history {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-post {
  margin-top: 0.25rem;
}

.history-reason {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  margin-top: 0.25rem;
}

.activity-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.activity-action {
  font-weight: 600;
  color: white;
  background: #3b82f6;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
}

.restoration-indicator {
  font-size: 0.875rem;
  color: #ef4444;
  font-weight: bold;
}

.activity-time {
  color: #6b7280;
  font-size: 0.75rem;
}

.removed-from-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  margin-right: 0.5rem;
}

.separator {
  color: #6b7280;
  margin: 0 0.5rem;
  font-weight: 500;
}

.feed-action-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.feed-action-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.combined-feed-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  transition: all 0.2s;
  max-width: 200px;
}

.combined-feed-btn:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.combined-feed-btn.protected {
  background: #fbbf24;
  color: #92400e;
  cursor: default;
}

.combined-feed-btn.protected:hover {
  background: #fbbf24;
  transform: none;
  box-shadow: none;
}

.unban-feed-btn {
  background: #10b981 !important;
  color: white !important;
}

.unban-feed-btn:hover {
  background: #059669 !important;
}

.history-user {
  background: #3b82f6 !important;
  color: white !important;
}

.restore-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.protection-icon-inline {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.protection-icon-inline:hover {
  opacity: 0.8;
}

.protection-icon-modal {
  width: 16px;
  height: 16px;
  color: #fbbf24;
  vertical-align: middle;
  margin: 0 2px;
}

.feed-name-static {
  background: #6b7280;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
  max-width: 200px;
}

.restore-modal {
  background: white;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.restore-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 12px 12px 0 0;
}

.restore-content {
  padding: 1.5rem;
}

.restore-description {
  margin-bottom: 1.5rem;
}

.restore-description p {
  margin: 0 0 0.5rem 0;
  color: #374151;
  line-height: 1.5;
}

.ban-method-info {
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #6b7280;
  border-left: 3px solid #3b82f6;
}

.restore-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.restore-confirm-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.restore-confirm-btn:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.restore-icon-small {
  width: 16px;
  height: 16px;
}

.activity-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.post-uri {
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #3b82f6;
  text-decoration: none;
}

.post-uri:hover {
  text-decoration: underline;
}

.target-handle {
  background: #fef3c7;
  color: #92400e;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.feed-name {
  background: #dcfce7;
  color: #166534;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.trending-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.timeframe-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
}

.show-hidden-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.trending-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.trending-item {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.trending-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.trending-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.post-link {
  font-family: monospace;
  font-size: 0.875rem;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.post-link:hover {
  text-decoration: underline;
}

.trending-stats {
  display: flex;
  gap: 0.5rem;
}

.velocity {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
}

.removers {
  background: #10b981;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
}

.hide-trending-btn-inline {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.hide-trending-btn-inline:hover {
  background: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.trending-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-badge {
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.removed {
  background: #6b7280;
  color: white;
}

.status-badge.hidden {
  background: #f3f4f6;
  color: #6b7280;
}

.time-span {
  color: #6b7280;
  font-size: 0.75rem;
}

.trending-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.trending-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.remove-trending-btn {
  background: #ef4444;
  color: white;
}

.remove-trending-btn:hover {
  background: #dc2626;
}

.hide-trending-btn {
  background: #6b7280;
  color: white;
}

.hide-trending-btn:hover {
  background: #4b5563;
}

.threshold-proximity {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.threshold-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.threshold-category-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.threshold-category-btn:hover {
  background: #f3f4f6;
  border-radius: 2px;
  padding: 0.125rem 0.25rem;
}

.category-details {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.subcategory-thresholds {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.threshold-type {
  color: #6b7280;
  font-weight: 500;
}

.threshold-count {
  background: #f3f4f6;
  color: #374151;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-weight: 600;
}

.threshold-count-dual {
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: normal;
  max-width: 180px;
  text-align: center;
  padding: 0.25rem 0.375rem;
}

.subcategory-note {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.subcategory-note small {
  color: #6b7280;
  font-style: italic;
}

.threshold-count strong {
  font-size: 1.2em !important;
  font-weight: 700 !important;
  color: #6b7280 !important;
}

.threshold-item .threshold-count strong {
  font-size: 1.2em !important;
  font-weight: 700 !important;
  color: #6b7280 !important;
}

.global-thresholds .threshold-count strong {
  font-size: 1.2em !important;
  font-weight: 700 !important;
  color: #6b7280 !important;
}

.expanded-feed-threshold .threshold-count strong {
  font-size: 1.2em !important;
  font-weight: 700 !important;
  color: #6b7280 !important;
}

.report-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.25rem;
}

.reports-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.report-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-weight: 500;
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
  display: inline-block;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.report-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.report-badge.source-app {
  background: #3b82f6;
  color: white;
}

.report-badge.source-communal {
  background: #10b981;
  color: white;
}

.reports-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.reports-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.reports-content {
  padding: 1.5rem;
}

.empty-reports {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.report-entry {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #e5e7eb;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.report-time {
  font-size: 0.75rem;
  color: #6b7280;
}

.report-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reporter-info {
  font-size: 0.875rem;
  color: #374151;
  font-family: monospace;
}

.report-context {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

.report-type-select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  min-height: 44px;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.report-type-select optgroup {
  font-weight: 600;
  color: #374151;
  background: #f8fafc;
}

.report-type-select option {
  padding: 0.5rem;
  color: #6b7280;
}

.report-type-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.global-thresholds {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.threshold-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.threshold-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
}

.feed-threshold-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.feed-threshold-btn {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.feed-threshold-btn:hover {
  background: #e5e7eb;
}

.feed-threshold-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.expanded-feed-threshold {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.feed-threshold-details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.threshold-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.25rem;
}

.feed-threshold-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.feed-name-expanded {
  background: #6b7280;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-weight: 500;
  font-size: 0.875rem;
}

.threshold-info-btn {
  background: #374151;
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.threshold-info-btn svg {
  width: 12px;
  height: 12px;
}

.threshold-info-btn:hover {
  background: #4b5563;
}

.sub-tab-navigation {
  display: flex;
  gap: 0;
  margin: -1.5rem 0 1.5rem 0;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.sub-tab-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.sub-tab-btn:last-child {
  border-right: none;
}

.sub-tab-icon {
  width: 18px;
  height: 18px;
}

.sub-tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.sub-tab-btn.active {
  background: #3b82f6;
  color: white;
}

.sub-tab-btn:hover:not(.active) {
  background: #f1f5f9;
  color: #334155;
}

.activity-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.reverse-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.reverse-btn:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.info-btn-inline {
  background: #6b7280;
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.info-btn-inline:hover {
  background: #4b5563;
}

.protection-badge {
  background: #fbbf24;
  color: #92400e;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.reverse-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reverse-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.feed-action-btn {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.feed-action-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.feed-action-btn.protected {
  background: #fbbf24;
  color: #92400e;
  cursor: default;
}

.feed-action-btn.protected:hover {
  background: #fbbf24;
  transform: none;
  box-shadow: none;
}

.btn-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.btn-action {
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-feed-name {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
  word-break: break-word;
}

.protection-icon {
  width: 10px;
  height: 10px;
  cursor: pointer;
  flex-shrink: 0;
}

.protection-icon:hover {
  opacity: 0.8;
}

.post-preview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.post-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #374151) !important;
}

.author-handle {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280) !important;
}

.post-text {
  font-size: 0.875rem;
  color: var(--text-primary, #374151) !important;
  line-height: 1.5;
  white-space: pre-wrap;
}

.post-images {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.post-image {
  max-width: 100px;
  max-height: 100px;
  border-radius: 4px;
  cursor: pointer;
  object-fit: cover;
}

.post-videos {
  margin-top: 0.5rem;
}

.post-video {
  max-width: 200px;
  max-height: 150px;
  border-radius: 4px;
}

.post-embeds {
  margin-top: 0.5rem;
}

.post-embed {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #6b7280;
}

.embed-type {
  font-weight: 500;
}

.external-embed {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
}

.embed-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.embed-info {
  flex: 1;
  min-width: 0;
}

.embed-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
  margin-bottom: 0.25rem;
}

.embed-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  line-height: 1.4;
}

.embed-uri {
  font-size: 0.75rem;
  color: #3b82f6;
  text-decoration: none;
}
</style>