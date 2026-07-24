<template>
  <div>
    <FeedsTab 
      :feeds="feeds"
      :report-types="reportTypes"
      :user-tier="authStore.user?.subscription_tier || 'free'"
      @show-add-feed="showAddFeed = true"
      @edit-ban-list="editFeedBanList"
      @show-user-ban-info="showUserBanInfo"
      @feed-updated="loadFeeds"
      @feed-deleted="loadFeeds"
    />

    <!-- Add Feed Modal -->
    <div v-if="showAddFeed" class="modal-overlay" @click="showAddFeed = false">
      <div class="modal" @click.stop>
        <h3>Add New Feed</h3>
        <form @submit.prevent="addFeed">
          <div class="form-group">
            <label>Feed Nickname</label>
            <input v-model="newFeed.name" type="text" required>
            <small>Your personal name for this feed - also used in commands (e.g. "remove urbanism+")</small>
          </div>
          <div class="form-group">
            <label>Graze Feed ID</label>
            <input v-model="newFeed.id" type="text" required>
            <small>Find this in your Graze feed URL</small>
          </div>
          <div class="form-group">
            <label>Bluesky Feed URL</label>
            <div class="slug-input-container">
              <input v-model="newFeed.url" type="text" placeholder="https://bsky.app/profile/did:plc:.../feed/slug" required>
              <button type="button" @click="fetchBlueskyName" :disabled="!newFeed.url || fetchingName" class="fetch-btn">
                <svg v-if="!fetchingName" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M21 21v-5h-5"/>
                </svg>
                <span v-if="fetchingName">...</span>
                <span v-if="!fetchingName" style="margin-left: 4px;">Fetch Name</span>
              </button>
            </div>
            <small>Full Bluesky feed URL for automatic name and slug extraction</small>
          </div>
          <div class="form-group" v-if="blueskyFeedName">
            <label>Bluesky Feed Name</label>
            <div class="bluesky-name-display">
              <span>{{ blueskyFeedName }}</span>
              <button type="button" @click="fetchBlueskyName" :disabled="fetchingName" class="refresh-btn">
                {{ fetchingName ? '...' : '🔄' }}
              </button>
            </div>
            <small>Automatically fetched from Bluesky</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddFeed = false">Cancel</button>
            <button type="submit">Add Feed</button>
          </div>
          <div class="tier-info">
            <div class="current-tier">
              <small>Current tier: <strong>{{ authStore.user?.subscription_tier || 'free' }}</strong> ({{ getTierLimit(authStore.user?.subscription_tier || 'free') }} feeds max)</small>
            </div>
            <div class="all-tiers">
              <div class="tier-row" :class="{ current: (authStore.user?.subscription_tier || 'free') === 'free' }">
                <span class="tier-name">Free:</span> <span class="tier-limit">3 feeds</span>
              </div>
              <div class="tier-row" :class="{ current: (authStore.user?.subscription_tier || 'free') === 'paid' }">
                <span class="tier-name">Paid:</span> <span class="tier-limit">30 feeds</span>
              </div>
              <div class="tier-row" :class="{ current: (authStore.user?.subscription_tier || 'free') === 'premium' }">
                <span class="tier-name">Premium:</span> <span class="tier-limit">100 feeds</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import FeedsTab from '../components/tabs/FeedsTab.vue'

const authStore = useAuthStore()
const feeds = ref([])
const reportTypes = ref({})
const showAddFeed = ref(false)
const newFeed = ref({ name: '', id: '', url: '' })
const blueskyFeedName = ref('')
const fetchingName = ref(false)

onMounted(async () => {
  // Refresh user data to ensure we have the latest subscription tier
  await refreshUserData()
  await loadReportTypes()
  await loadFeeds()
})

const refreshUserData = async () => {
  try {
    const response = await axios.get('/api/user/global-settings')
    if (response.data && authStore.user) {
      authStore.user.subscription_tier = response.data.subscription_tier
      localStorage.setItem('user', JSON.stringify(authStore.user))
      console.log('Refreshed user tier:', response.data.subscription_tier)
    }
  } catch (error) {
    console.error('Failed to refresh user data:', error)
  }
}

const loadReportTypes = async () => {
  try {
    const response = await axios.get('/api/report-types/hierarchical')
    reportTypes.value = response.data.reportTypes
  } catch (error) {
    console.error('Failed to load report types:', error)
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

const loadFeeds = async () => {
  try {
    const response = await axios.get('/api/feeds')
    feeds.value = response.data
  } catch (error) {
    console.error('Failed to load feeds:', error)
  }
}

const editFeedBanList = (feed: any) => {
  // Handle edit ban list
  console.log('Edit ban list for feed:', feed)
}

const showUserBanInfo = (type: string) => {
  // Handle show user ban info
  console.log('Show user ban info:', type)
}

const getTierLimit = (tier: string) => {
  const limits = { free: 3, paid: 30, premium: 100 }
  return limits[tier as keyof typeof limits] || 3
}

const addFeed = async () => {
  try {
    // Extract slug from URL
    let extractedSlug = null
    if (newFeed.value.url && newFeed.value.url.includes('/feed/')) {
      const slugMatch = newFeed.value.url.match(/\/feed\/([^/?]+)/)
      if (slugMatch) {
        extractedSlug = slugMatch[1]
      }
    }
    
    await axios.post('/api/feeds', {
      feedId: newFeed.value.id,
      feedName: newFeed.value.name,
      feedUrl: newFeed.value.url,
      feedSlug: extractedSlug
    })
    
    showAddFeed.value = false
    newFeed.value = { name: '', id: '', url: '' }
    blueskyFeedName.value = ''
    await loadFeeds()
    
    // Auto-fetch feed name if URL was provided
    if (newFeed.value.url) {
      // Find the newly created feed and fetch its name
      const feeds = await axios.get('/api/feeds')
      const newlyCreatedFeed = feeds.data.find((f: any) => f.feed_id === newFeed.value.id)
      if (newlyCreatedFeed) {
        try {
          await axios.post('/api/bluesky/fetch-feed-name', {
            feedSlug: newFeed.value.url,
            creatorDid: newFeed.value.url.includes('/profile/') ? 
              newFeed.value.url.match(/\/profile\/([^/]+)/)?.[1] : ''
          })
        } catch (error) {
          console.log('Auto-fetch failed, user can manually refresh')
        }
      }
    }
  } catch (error: any) {
    console.error('Failed to add feed:', error)
    if (error.response?.status === 409 || error.response?.data?.error?.includes('already exists')) {
      alert(`Feed ID "${newFeed.value.id}" is already added. Each feed can only be added once.`)
    } else if (error.response?.status === 403 && error.response?.data?.error?.includes('tier limited')) {
      alert(error.response.data.error)
    } else {
      alert('Failed to add feed. Check console for details.')
    }
  }
}

const fetchBlueskyName = async () => {
  if (!newFeed.value.url) return
  
  fetchingName.value = true
  try {
    // Extract DID from URL if it's a full URL
    let creatorDid = ''
    if (newFeed.value.url.includes('/profile/')) {
      const didMatch = newFeed.value.url.match(/\/profile\/([^/]+)/)
      if (didMatch) {
        creatorDid = didMatch[1]
      }
    }
    
    const response = await axios.post('/api/bluesky/fetch-feed-name', {
      feedSlug: newFeed.value.url,
      creatorDid
    })
    
    if (response.data.success) {
      blueskyFeedName.value = response.data.feedName
    }
  } catch (error: any) {
    console.error('Failed to fetch Bluesky feed name:', error)
    if (error.response?.status === 400) {
      alert('Please provide a valid feed slug or full Bluesky URL')
    } else if (error.response?.status === 404) {
      alert('Feed not found on Bluesky')
    } else {
      alert('Failed to fetch feed name from Bluesky')
    }
  } finally {
    fetchingName.value = false
  }
}
</script>

<style scoped>
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
  background: var(--bg-primary, white);
  padding: 2rem;
  border-radius: 2px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h3 {
  margin: 0 0 1.5rem 0;
  color: var(--text-primary, #1e293b);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #374151);
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 2px;
  font-size: 0.875rem;
  box-sizing: border-box;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1e293b);
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary, #6b7280);
  font-size: 0.75rem;
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
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-actions button[type="button"] {
  background: #f3f4f6;
  color: #374151;
}

.modal-actions button[type="button"]:hover {
  background: #e5e7eb;
}

.modal-actions button[type="submit"] {
  background: #3b82f6;
  color: white;
}

.modal-actions button[type="submit"]:hover {
  background: #2563eb;
}

.tier-info {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.current-tier {
  margin-bottom: 0.75rem;
}

.current-tier small {
  color: var(--text-secondary, #6b7280);
}

.current-tier strong {
  color: var(--text-primary, #1e293b);
  text-transform: capitalize;
}

.all-tiers {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.tier-row {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-secondary, #f9fafb);
}

.tier-row.current {
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 600;
}

.tier-name {
  font-weight: 500;
}

.tier-limit {
  color: inherit;
}

.slug-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.slug-input-container input {
  flex: 1;
}

.fetch-btn, .refresh-btn {
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 2px;
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-primary, #374151);
  cursor: pointer;
  font-size: 0.875rem;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  white-space: nowrap;
}

.fetch-btn:hover, .refresh-btn:hover {
  background: var(--bg-tertiary, #f3f4f6);
}

.fetch-btn:disabled, .refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bluesky-name-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 2px;
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-primary, #374151);
}

.bluesky-name-display span {
  flex: 1;
  font-weight: 500;
}
</style>
