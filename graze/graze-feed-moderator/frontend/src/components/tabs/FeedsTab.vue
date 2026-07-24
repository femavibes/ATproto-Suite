<template>
  <div class="feeds-container">
    <!-- Left Sidebar - Feed List -->
    <div class="feeds-sidebar">
      <div class="sidebar-header">
        <h2>My Feeds</h2>
        <button @click="checkFeedLimitAndAdd" class="btn-add">+</button>
      </div>
      
      <div class="sidebar-actions">
        <button @click="showGroupManager = true" class="btn-secondary-small">Groups</button>
        <button v-if="moderatedGroups.length > 0" @click="showModeratedGroups = !showModeratedGroups" class="btn-secondary-small">
          Moderated ({{ moderatedGroups.length }})
        </button>
      </div>

      <div v-if="showModeratedGroups && moderatedGroups.length > 0" class="moderated-groups-list">
        <h4>Groups I Moderate</h4>
        <div v-for="group in moderatedGroups" :key="group.id" class="moderated-group-item">
          <strong>{{ group.group_name }}</strong>
          <small>{{ group.permissions.join(', ') }}</small>
          <small class="group-owner">Owner: {{ group.owner_handle || 'Unknown' }}</small>
        </div>
      </div>
      
      <div v-if="feeds.length === 0" class="empty-feeds">
        <p>No feeds yet</p>
      </div>
      
      <div v-else class="feeds-list">
        <div 
          v-for="feed in feeds" 
          :key="feed.id" 
          class="feed-item"
          :class="{ active: selectedFeed?.id === feed.id }"
          @click="selectFeed(feed)"
        >
          <div class="feed-item-name">{{ feed.feed_name }}</div>
          <div class="feed-item-id">{{ feed.feed_id }}</div>
        </div>
      </div>
    </div>

    <!-- Right Panel - Feed Settings -->
    <div class="feed-settings-panel">
      <!-- Mobile Feed Selector -->
      <div class="mobile-feed-selector">
        <div class="mobile-select-row">
          <select v-if="feeds.length > 0" :value="selectedFeed?.id || ''" @change="selectFeedById(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Select a feed</option>
            <option v-for="feed in feeds" :key="feed.id" :value="feed.id">
              {{ feed.feed_name }}
            </option>
          </select>
          <button @click="checkFeedLimitAndAdd" class="btn-add-mobile">+</button>
        </div>
        <div class="mobile-actions">
          <button @click="showGroupManager = true" class="btn-secondary-small">Groups</button>
          <button v-if="moderatedGroups.length > 0" @click="showModeratedGroups = !showModeratedGroups" class="btn-secondary-small">
            Moderated ({{ moderatedGroups.length }})
          </button>
        </div>
      </div>

      <div v-if="!selectedFeed" class="no-selection">
        <p>Select a feed to view settings</p>
      </div>
      
      <div v-else class="feed-settings">
        <div class="settings-header">
          <div>
            <h3>{{ selectedFeed.feed_name }} <small>(nickname)</small></h3>
            <div class="feed-links">
              <span class="feed-link">
                Graze ID: 
                <a :href="`https://www.graze.social/app/feed/${selectedFeed.feed_id}/view`" target="_blank" class="external-link">
                  {{ selectedFeed.feed_id }}
                </a>
              </span>
              <span v-if="selectedFeed.feed_slug" class="feed-link">
                Bluesky Slug: 
                <a :href="selectedFeed.feed_url || `https://bsky.app/profile/unknown/feed/${selectedFeed.feed_slug}`" target="_blank" class="external-link">
                  {{ selectedFeed.feed_slug }}
                </a>
              </span>
            </div>
          </div>
          <button @click="deleteFeed(selectedFeed)" class="btn-delete">Delete</button>
        </div>

        <div class="settings-content">
          <!-- Feed Details -->
          <div class="settings-section">
            <h4>Feed Details</h4>
            <div class="form-group">
              <label>Bluesky Feed URL</label>
              <div class="url-input-container">
                <input 
                  v-model="selectedFeed.feed_url" 
                  type="text" 
                  placeholder="https://bsky.app/profile/did:plc:.../feed/slug"
                  @blur="updateFeedUrl(selectedFeed)"
                  class="url-input"
                >
              </div>
              <small>Full Bluesky feed URL for API calls and automatic slug extraction</small>
            </div>
            <div class="form-group" v-if="selectedFeed.feed_slug">
              <label>Bluesky Feed Slug (auto-extracted)</label>
              <div class="slug-display">
                <span>{{ selectedFeed.feed_slug }}</span>
              </div>
              <small>Automatically extracted from URL for browser extension matching</small>
            </div>
            <div class="form-group" v-if="selectedFeed.feed_url">
              <label>Bluesky Feed Name (from API)</label>
              <div class="bluesky-name-container">
                <div class="bluesky-name-display">
                  <span>{{ selectedFeed.bluesky_feed_name || 'Not fetched yet' }}</span>
                  <button type="button" @click="fetchBlueskyName(selectedFeed)" :disabled="fetchingName" class="refresh-btn">
                    <svg v-if="!fetchingName" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                      <path d="M21 21v-5h-5"/>
                    </svg>
                    <span v-if="fetchingName">...</span>
                    <span v-if="!fetchingName" style="margin-left: 4px;">{{ selectedFeed.bluesky_feed_name ? 'Refetch' : 'Fetch' }}</span>
                  </button>
                </div>
              </div>
              <small>Official feed name from Bluesky - refetch if you changed the name on Bluesky. Future: we'll auto-detect name changes and notify you.</small>
            </div>
          </div>


          <!-- Feed Groups -->
          <div class="settings-section">
            <h4>Groups</h4>
            <div class="tags-list">
              <span v-for="group in getFeedGroups(selectedFeed.feed_id)" :key="group.id" class="tag">
                {{ group.group_name }}
              </span>
              <span v-if="getFeedGroups(selectedFeed.feed_id).length === 0" class="empty-text">Not in any groups</span>
            </div>
          </div>

          <!-- Moderators -->
          <div class="settings-section" :key="moderatorUpdateKey">
            <div class="section-header">
              <h4>Moderators</h4>
              <button @click="showModeratorManager(selectedFeed.feed_id)" class="btn-edit">Manage</button>
            </div>
            <div class="tags-list">
              <span v-for="mod in getGroupModerators(selectedFeed.feed_id)" :key="mod.moderator_did" class="tag tag-moderator">
                {{ mod.moderator_handle }}
              </span>
              <span v-if="getGroupModerators(selectedFeed.feed_id).length === 0" class="empty-text">No moderators</span>
            </div>
          </div>

          <!-- Communal Settings -->
          <div class="settings-section">
            <h4>Communal Moderation</h4>
            <div class="toggle-item">
              <label class="toggle-switch">
                <input type="checkbox" v-model="selectedFeed.communal_enabled" @change="updateFeed(selectedFeed)">
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-content">
                <div class="toggle-title">Enable Communal Moderation</div>
                <div class="toggle-description">When enabled, uses per-feed thresholds with global settings as fallback. When disabled, completely excludes this feed from communal moderation.</div>
              </div>
            </div>
            <div class="toggle-item">
              <label class="toggle-switch">
                <input type="checkbox" v-model="selectedFeed.disable_global_for_feed" @change="updateFeed(selectedFeed)">
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-content">
                <div class="toggle-title">Block Global Moderation</div>
                <div class="toggle-description">When blocked, global thresholds will not apply to this feed, regardless of global settings being enabled.</div>
              </div>
            </div>
            
            <div class="toggle-item">
              <label class="toggle-switch">
                <input type="checkbox" v-model="selectedFeed.sync_feed_post_thresholds" @change="updateFeedSyncSettings(selectedFeed)">
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-content">
                <div class="toggle-title">Sync Feed Post Removal Thresholds</div>
                <div class="toggle-description">Automatically sync this feed's post removal thresholds with admin-recommended feed defaults. When enabled, your feed will use the same thresholds set by administrators and will update dynamically when admins change the defaults.</div>
              </div>
            </div>
            <div class="toggle-item">
              <label class="toggle-switch">
                <input type="checkbox" v-model="selectedFeed.sync_feed_ban_thresholds" @change="updateFeedSyncSettings(selectedFeed)">
                <span class="toggle-slider"></span>
              </label>
              <div class="toggle-content">
                <div class="toggle-title">Sync Feed User Ban Thresholds</div>
                <div class="toggle-description">Automatically sync this feed's user ban thresholds with admin-recommended feed defaults. When enabled, your feed will use the same ban thresholds set by administrators and will update dynamically when admins change the defaults.</div>
              </div>
            </div>
          </div>

          <!-- Tabs for Post Removal vs User Ban -->
          <div class="settings-tabs">
            <button 
              class="settings-tab" 
              :class="{ active: activeTab === 'post-removal' }"
              @click="activeTab = 'post-removal'"
            >
              Post Removal
            </button>
            <button 
              class="settings-tab" 
              :class="{ active: activeTab === 'user-ban' }"
              @click="activeTab = 'user-ban'"
            >
              User Ban
            </button>
          </div>

          <!-- Post Removal Tab -->
          <div v-if="activeTab === 'post-removal'" class="settings-section">
            <h4>Post Removal Thresholds</h4>
            <p class="section-description">Auto-remove posts after X Ozone reports</p>
            
            <div v-for="(category, categoryKey) in reportTypes" :key="categoryKey" v-if="categoryKey !== 'other'" class="category-block">
              <div class="category-threshold">
                <div class="category-header">
                  <strong>{{ category.name }}</strong>
                  <input 
                    type="number" 
                    :value="selectedFeed[`threshold_${categoryKey.replace('-', '_')}`] || 3" 
                    @input="updateMainThreshold(selectedFeed, categoryKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </div>
              </div>
              
              <div v-for="(subName, subKey) in category.subcategories" :key="subKey" class="subcategory-row" :class="{ 'disabled-setting': isExcludedFromCommunal(subKey) }">
                <label :class="{ disabled: isExcludedFromCommunal(subKey) }">
                  <input 
                    type="checkbox" 
                    :checked="selectedFeed[`opt_in_${subKey.replace('-', '_')}`] ?? true" 
                    @change="updateSubcategoryOptIn(selectedFeed, subKey, $event.target.checked)"
                    :disabled="isExcludedFromCommunal(subKey)"
                  >
                  <div class="label-with-reset">
                    <span>{{ subName }}</span>
                    <button 
                      v-if="selectedFeed[`threshold_${subKey.replace('-', '_')}`] !== null && selectedFeed[`threshold_${subKey.replace('-', '_')}`] !== undefined && !isExcludedFromCommunal(subKey)"
                      @click.stop="resetToInherit(selectedFeed, subKey, 'threshold')"
                      class="reset-btn"
                      title="Reset to inherit from main category"
                    >↺</button>
                  </div>
                  <span v-if="isExcludedFromCommunal(subKey)" class="excluded-note">
                    (Excluded from communal moderation)
                  </span>
                  <input 
                    v-if="(selectedFeed[`opt_in_${subKey.replace('-', '_')}`] ?? true) && !isExcludedFromCommunal(subKey)" 
                    type="number" 
                    :value="selectedFeed[`threshold_${subKey.replace('-', '_')}`] || selectedFeed[`threshold_${categoryKey.replace('-', '_')}`] || 3"
                    @input="updateSubcategoryThreshold(selectedFeed, subKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </label>
              </div>
            </div>

            <div class="percentage-control">
              <label>Same-category: {{ selectedFeed.same_category_cross_percentage }}%</label>
              <input type="range" v-model.number="selectedFeed.same_category_cross_percentage" @change="updateFeed(selectedFeed)" min="0" max="50">
            </div>
            
            <div class="percentage-control">
              <label>Cross-type: {{ selectedFeed.cross_type_percentage }}%</label>
              <input type="range" v-model.number="selectedFeed.cross_type_percentage" @change="updateFeed(selectedFeed)" min="0" max="40">
            </div>
          </div>

          <!-- User Ban Tab -->
          <div v-if="activeTab === 'user-ban'" class="settings-section">
            <h4>User Ban Thresholds</h4>
            <p class="section-description">Auto-ban users after X reports</p>
            
            <div v-for="(category, categoryKey) in reportTypes" :key="'ub_' + categoryKey" v-if="categoryKey !== 'other'" class="category-block">
              <div class="category-threshold">
                <div class="category-header">
                  <strong>{{ category.name }}</strong>
                  <input 
                    type="number" 
                    :value="selectedFeed[`user_ban_threshold_${categoryKey.replace('-', '_')}`] || getUserBanDefaultThreshold(categoryKey)" 
                    @input="updateUserBanMainThreshold(selectedFeed, categoryKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </div>
              </div>
              
              <div v-for="(subName, subKey) in category.subcategories" :key="'ub_' + subKey" class="subcategory-row" :class="{ 'disabled-setting': isExcludedFromCommunal(subKey) }">
                <label :class="{ disabled: isExcludedFromCommunal(subKey) }">
                  <input 
                    type="checkbox" 
                    :checked="selectedFeed[`user_ban_opt_in_${subKey.replace('-', '_')}`] ?? true" 
                    @change="updateUserBanSubcategoryOptIn(selectedFeed, subKey, $event.target.checked)"
                    :disabled="isExcludedFromCommunal(subKey)"
                  >
                  <div class="label-with-reset">
                    <span>{{ subName }}</span>
                    <button 
                      v-if="selectedFeed[`user_ban_threshold_${subKey.replace('-', '_')}`] !== null && selectedFeed[`user_ban_threshold_${subKey.replace('-', '_')}`] !== undefined && !isExcludedFromCommunal(subKey)"
                      @click.stop="resetToInherit(selectedFeed, subKey, 'user_ban_threshold')"
                      class="reset-btn"
                      title="Reset to inherit from main category"
                    >↺</button>
                  </div>
                  <span v-if="isExcludedFromCommunal(subKey)" class="excluded-note">
                    (Excluded from communal moderation)
                  </span>
                  <input 
                    v-if="(selectedFeed[`user_ban_opt_in_${subKey.replace('-', '_')}`] ?? true) && !isExcludedFromCommunal(subKey)" 
                    type="number" 
                    :value="selectedFeed[`user_ban_threshold_${subKey.replace('-', '_')}`] || selectedFeed[`user_ban_threshold_${categoryKey.replace('-', '_')}`] || getUserBanDefaultThreshold(categoryKey)"
                    @input="updateUserBanSubcategoryThreshold(selectedFeed, subKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </label>
              </div>
            </div>

            <div class="percentage-control">
              <label>User ban same-category: {{ selectedFeed.user_ban_same_category_cross_percentage }}%</label>
              <input type="range" v-model.number="selectedFeed.user_ban_same_category_cross_percentage" @change="updateFeed(selectedFeed)" min="0" max="50">
            </div>
            
            <div class="percentage-control">
              <label>User ban cross-type: {{ selectedFeed.user_ban_cross_type_percentage }}%</label>
              <input type="range" v-model.number="selectedFeed.user_ban_cross_type_percentage" @change="updateFeed(selectedFeed)" min="0" max="40">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <div v-if="showGroupManager" class="modal-overlay" @click="showGroupManager = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Feed Groups</h3>
          <button @click="showGroupManager = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="create-group-section">
            <h4>Create New Group</h4>
            <div class="input-group">
              <input v-model="newGroupName" placeholder="Group name" class="input-field">
              <button @click="createGroup" class="btn-primary" :disabled="!newGroupName.trim()">Create</button>
            </div>
          </div>
          
          <div v-if="feedGroups.length > 0" class="groups-list">
            <h4>Existing Groups</h4>
            <div v-for="group in feedGroups" :key="group.id" class="group-item">
              <div class="group-item-header">
                <h4>{{ group.group_name }}</h4>
                <button @click="deleteGroup(group.id)" class="btn-delete-small">Delete</button>
              </div>
              
              <div class="feed-toggles">
                <div v-for="feed in feeds" :key="feed.feed_id" class="toggle-item-compact">
                  <label class="toggle-switch">
                    <input 
                      type="checkbox" 
                      :checked="isInGroup(feed.feed_id, group.id)"
                      @change="toggleFeedInGroup(feed.feed_id, group.id, $event.target.checked)"
                    >
                    <span class="toggle-slider"></span>
                  </label>
                  <div class="toggle-content">
                    <div class="toggle-title">{{ feed.feed_name }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModeratorModal" class="modal-overlay" @click="showModeratorModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Group Moderators</h3>
          <button @click="showModeratorModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <input v-model="newModeratorHandle" placeholder="Bluesky handle" class="input-field">
            <button @click="addModerator" class="btn-primary" :disabled="!newModeratorHandle.trim()">Add</button>
          </div>
          
          <div v-if="currentGroupModerators.length > 0" class="moderators-list">
            <div v-for="moderator in currentGroupModerators" :key="moderator.moderator_did" class="moderator-item">
              <div>
                <strong>{{ moderator.moderator_handle }}</strong>
                <small>{{ moderator.permissions.join(', ') }}</small>
              </div>
              <button @click="removeModerator(moderator.moderator_did)" class="btn-delete-small">Remove</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upgrade Modal -->
    <div v-if="showUpgradeModal" class="modal-overlay" @click="showUpgradeModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Feed Limit Reached</h3>
          <button @click="showUpgradeModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="upgrade-info">
            <p>You've reached your feed limit for the <strong>{{ userTier }}</strong> tier.</p>
            
            <div class="tier-limits">
              <div class="tier-item" :class="{ current: userTier === 'free' }">
                <h4>Free</h4>
                <div class="limit">3 feeds</div>
              </div>
              <div class="tier-item" :class="{ current: userTier === 'paid' }">
                <h4>Paid</h4>
                <div class="limit">30 feeds</div>
              </div>
              <div class="tier-item" :class="{ current: userTier === 'premium' }">
                <h4>Premium</h4>
                <div class="limit">100 feeds</div>
              </div>
            </div>
            
            <p>To add more feeds, either:</p>
            <ul>
              <li>Delete an existing feed to make room</li>
              <li>Upgrade to a higher tier for more feeds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useDebugStore } from '../../stores/debug'

const debugStore = useDebugStore()

interface Feed {
  id: number
  feed_id: string
  feed_name: string
  communal_enabled?: boolean
  disable_global_for_feed?: boolean
  [key: string]: any
}

interface FeedGroup {
  id: number
  group_name: string
  owner_user_id: number
  created_at: string
  group_ban_list?: string
  use_group_list_only?: boolean
}

interface ReportTypes {
  [key: string]: {
    name: string
    subcategories: { [key: string]: string }
  }
}

const props = defineProps<{
  feeds: Feed[]
  reportTypes: ReportTypes
  userTier: string
}>()

const emit = defineEmits<{
  'show-add-feed': []
  'edit-ban-list': [feed: Feed]
  'show-user-ban-info': [type: string]
  'feed-updated': [feed: Feed]
  'feed-deleted': [feedId: string]
}>()

const selectedFeed = ref<Feed | null>(null)
const activeTab = ref<'post-removal' | 'user-ban'>('post-removal')
const showGroupManager = ref(false)
const newGroupName = ref('')
const feedGroups = ref<FeedGroup[]>([])
const groupMemberships = ref<Record<number, string[]>>({})
const showModeratorModal = ref(false)
const newModeratorHandle = ref('')
const currentGroupId = ref<number | null>(null)
const currentGroupModerators = ref<any[]>([])
const groupModerators = ref<Record<number, any[]>>({})
const moderatedGroups = ref<any[]>([])
const showModeratedGroups = ref(false)
const showUpgradeModal = ref(false)
const moderatorUpdateKey = ref(0)
const fetchingName = ref(false)

onMounted(() => {
  props.feeds.forEach(feed => {
    if (feed.same_category_cross_percentage === undefined || feed.same_category_cross_percentage === null) {
      feed.same_category_cross_percentage = 50
    }
    if (feed.cross_type_percentage === undefined || feed.cross_type_percentage === null) {
      feed.cross_type_percentage = 20
    }
    if (feed.user_ban_same_category_cross_percentage === undefined || feed.user_ban_same_category_cross_percentage === null) {
      feed.user_ban_same_category_cross_percentage = 50
    }
    if (feed.user_ban_cross_type_percentage === undefined || feed.user_ban_cross_type_percentage === null) {
      feed.user_ban_cross_type_percentage = 20
    }
  })
  
  if (props.feeds.length > 0) {
    const savedFeedId = localStorage.getItem('selectedFeedId')
    if (savedFeedId) {
      const savedFeed = props.feeds.find(f => f.id === parseInt(savedFeedId))
      selectedFeed.value = savedFeed || null
    }
  }
  
  loadFeedGroups()
  loadModeratedGroups()
  loadAllGroupModerators()
  debugStore.loadDebugMode()
})

const selectFeed = (feed: Feed) => {
  selectedFeed.value = feed
  localStorage.setItem('selectedFeedId', feed.id.toString())
}

const selectFeedById = (feedId: string) => {
  const feed = props.feeds.find(f => f.id === parseInt(feedId))
  if (feed) {
    selectedFeed.value = feed
    localStorage.setItem('selectedFeedId', feed.id.toString())
  }
}

const loadFeedGroups = async () => {
  try {
    const response = await axios.get('/api/feed-groups')
    feedGroups.value = response.data.groups
    groupMemberships.value = response.data.memberships
    await loadAllGroupModerators()
  } catch (error) {
    console.error('Failed to load feed groups:', error)
  }
}

const loadModeratedGroups = async () => {
  try {
    const response = await axios.get('/api/feed-groups/moderated')
    moderatedGroups.value = response.data
  } catch (error) {
    console.error('Failed to load moderated groups:', error)
  }
}

const loadAllGroupModerators = async () => {
  try {
    for (const group of feedGroups.value) {
      const response = await axios.get(`/api/feed-groups/${group.id}/moderators`)
      groupModerators.value[group.id] = response.data
    }
  } catch (error) {
    console.error('Failed to load group moderators:', error)
  }
}

const createGroup = async () => {
  if (!newGroupName.value.trim()) return
  
  try {
    await axios.post('/api/feed-groups', { groupName: newGroupName.value.trim() })
    newGroupName.value = ''
    // Force reload all group-related data
    await Promise.all([
      loadFeedGroups(),
      loadModeratedGroups(),
      loadAllGroupModerators()
    ])
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      alert(`Group name "${newGroupName.value.trim()}" is already taken. Please choose a different name.`)
    } else {
      alert('Failed to create group. Please try again.')
    }
    console.error('Failed to create group:', error)
  }
}

const deleteGroup = async (groupId: number) => {
  if (!confirm('Delete this group? Feeds will not be deleted.')) return
  
  try {
    await axios.delete(`/api/feed-groups/${groupId}`)
    await loadFeedGroups()
  } catch (error) {
    console.error('Failed to delete group:', error)
  }
}

const isInGroup = (feedId: string, groupId: number): boolean => {
  return groupMemberships.value[groupId]?.includes(feedId) || false
}

const toggleFeedInGroup = async (feedId: string, groupId: number, add: boolean) => {
  try {
    if (add) {
      await axios.post(`/api/feed-groups/${groupId}/feeds`, { feedId })
    } else {
      await axios.delete(`/api/feed-groups/${groupId}/feeds/${feedId}`)
    }
    await loadFeedGroups()
  } catch (error) {
    console.error('Failed to update group membership:', error)
  }
}

const getFeedGroups = (feedId: string): FeedGroup[] => {
  return feedGroups.value.filter(group => 
    groupMemberships.value[group.id]?.includes(feedId)
  )
}

const getGroupModerators = (feedId: string): any[] => {
  const groups = getFeedGroups(feedId)
  const allModerators: any[] = []
  
  for (const group of groups) {
    const mods = groupModerators.value[group.id] || []
    allModerators.push(...mods)
  }
  
  const unique = allModerators.filter((mod, index, self) => 
    index === self.findIndex(m => m.moderator_did === mod.moderator_did)
  )
  
  return unique
}

const showModeratorManager = async (feedId: string) => {
  const groups = getFeedGroups(feedId)
  if (groups.length === 0) {
    alert('This feed is not in any groups. Add it to a group first to manage moderators.')
    return
  }
  
  const group = groups[0]
  currentGroupId.value = group.id
  
  try {
    // Always fetch fresh data when opening modal
    const response = await axios.get(`/api/feed-groups/${group.id}/moderators?t=${Date.now()}`)
    currentGroupModerators.value = response.data
    // Update cache with fresh data
    groupModerators.value[group.id] = response.data
    showModeratorModal.value = true
  } catch (error) {
    console.error('Failed to load moderators:', error)
  }
}

const addModerator = async () => {
  if (!newModeratorHandle.value.trim() || !currentGroupId.value) return
  
  try {
    const handle = newModeratorHandle.value.trim()
    await axios.post(`/api/feed-groups/${currentGroupId.value}/moderators`, {
      moderatorHandle: handle
    })
    newModeratorHandle.value = ''
    
    // Poll until moderator appears
    let attempts = 0
    while (attempts < 10) {
      const response = await axios.get(`/api/feed-groups/${currentGroupId.value}/moderators?t=${Date.now()}`)
      if (response.data.some((mod: any) => mod.moderator_handle === handle)) {
        currentGroupModerators.value = response.data
        groupModerators.value[currentGroupId.value] = response.data
        moderatorUpdateKey.value++
        break
      }
      await new Promise(resolve => setTimeout(resolve, 200))
      attempts++
    }
  } catch (error: any) {
    if (error.response?.status === 400) {
      alert('Invalid handle or handle not found')
    } else {
      alert('Failed to add moderator')
    }
    console.error('Failed to add moderator:', error)
  }
}

const removeModerator = async (moderatorDid: string) => {
  if (!currentGroupId.value) return
  
  try {
    await axios.delete(`/api/feed-groups/${currentGroupId.value}/moderators/${moderatorDid}`)
    
    // Poll until moderator is gone
    let attempts = 0
    while (attempts < 10) {
      const response = await axios.get(`/api/feed-groups/${currentGroupId.value}/moderators?t=${Date.now()}`)
      if (!response.data.some((mod: any) => mod.moderator_did === moderatorDid)) {
        currentGroupModerators.value = response.data
        groupModerators.value[currentGroupId.value] = response.data
        moderatorUpdateKey.value++
        break
      }
      await new Promise(resolve => setTimeout(resolve, 200))
      attempts++
    }
  } catch (error) {
    console.error('Failed to remove moderator:', error)
  }
}

const updateMainThreshold = async (feed: Feed, categoryKey: string, value: string) => {
  const thresholdKey = `threshold_${categoryKey.replace('-', '_')}`
  feed[thresholdKey] = parseInt(value) || 3
  
  try {
    const updateData = { [thresholdKey]: feed[thresholdKey] }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update main threshold:', error)
  }
}

const updateSubcategoryOptIn = async (feed: Feed, subKey: string, checked: boolean) => {
  const optInKey = `opt_in_${subKey.replace('-', '_')}`
  feed[optInKey] = checked
  
  try {
    const updateData = { [optInKey]: checked }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update opt-in:', error)
  }
}

const updateSubcategoryThreshold = async (feed: Feed, subKey: string, value: string) => {
  const thresholdKey = `threshold_${subKey.replace('-', '_')}`
  feed[thresholdKey] = value ? parseInt(value) : null
  
  try {
    const updateData = { [thresholdKey]: feed[thresholdKey] }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update threshold:', error)
  }
}

const updateUserBanMainThreshold = async (feed: Feed, categoryKey: string, value: string) => {
  const thresholdKey = `user_ban_threshold_${categoryKey.replace('-', '_')}`
  feed[thresholdKey] = parseInt(value) || getUserBanDefaultThreshold(categoryKey)
  
  try {
    const updateData = { [thresholdKey]: feed[thresholdKey] }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update user ban main threshold:', error)
  }
}

const updateUserBanSubcategoryOptIn = async (feed: Feed, subKey: string, checked: boolean) => {
  const optInKey = `user_ban_opt_in_${subKey.replace('-', '_')}`
  feed[optInKey] = checked
  
  try {
    const updateData = { [optInKey]: checked }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update user ban opt-in:', error)
  }
}

const updateUserBanSubcategoryThreshold = async (feed: Feed, subKey: string, value: string) => {
  const thresholdKey = `user_ban_threshold_${subKey.replace('-', '_')}`
  feed[thresholdKey] = value ? parseInt(value) : null
  
  try {
    const updateData = { [thresholdKey]: feed[thresholdKey] }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
  } catch (error) {
    console.error('Failed to update user ban threshold:', error)
  }
}

const getUserBanDefaultThreshold = (category: string): number => {
  const defaults = {
    misleading: 15,
    harassment: 8,
    violence: 5,
    sexual: 8,
    child_safety: 3,
    self_harm: 5,
    rule: 8
  }
  return defaults[category as keyof typeof defaults] || 15
}

const updateFeed = async (feed: Feed) => {
  try {
    const updateData = {
      communal_enabled: feed.communal_enabled !== false,
      disable_global_for_feed: feed.disable_global_for_feed || false,
      cross_type_percentage: feed.cross_type_percentage ?? 20,
      same_category_cross_percentage: feed.same_category_cross_percentage ?? 50,
      user_ban_cross_type_percentage: feed.user_ban_cross_type_percentage ?? 20,
      user_ban_same_category_cross_percentage: feed.user_ban_same_category_cross_percentage ?? 50
    }
    
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
    emit('feed-updated', feed)
  } catch (error) {
    console.error('Failed to update feed:', error)
  }
}

const updateFeedSyncSettings = async (feed: Feed) => {
  try {
    const updateData = {
      sync_feed_post_thresholds: feed.sync_feed_post_thresholds || false,
      sync_feed_ban_thresholds: feed.sync_feed_ban_thresholds || false
    }
    
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
    emit('feed-updated', feed)
  } catch (error) {
    console.error('Failed to update feed sync settings:', error)
  }
}

const deleteFeed = async (feed: Feed) => {
  if (confirm(`Delete feed "${feed.feed_name}"?`)) {
    try {
      await axios.delete(`/api/feeds/${feed.feed_id}`)
      emit('feed-deleted', feed.feed_id)
      if (selectedFeed.value?.id === feed.id) {
        selectedFeed.value = props.feeds.length > 1 ? props.feeds[0] : null
      }
    } catch (error) {
      console.error('Failed to delete feed:', error)
    }
  }
}



const isExcludedFromCommunal = (subKey: string): boolean => {
  const excludedTypes = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other']
  return excludedTypes.includes(subKey)
}

const checkFeedLimitAndAdd = () => {
  const limits = { free: 3, paid: 30, premium: 100 }
  const currentLimit = limits[props.userTier as keyof typeof limits] || 3
  
  console.log('Feed limit check:', { userTier: props.userTier, feedCount: props.feeds.length, limit: currentLimit })
  
  if (props.feeds.length >= currentLimit) {
    showUpgradeModal.value = true
  } else {
    emit('show-add-feed')
  }
}

const updateFeedUrl = async (feed: Feed) => {
  try {
    // Extract slug from URL if it's a full URL
    let slugToSave = null
    if (feed.feed_url && feed.feed_url.includes('/feed/')) {
      const slugMatch = feed.feed_url.match(/\/feed\/([^/?]+)/)
      if (slugMatch) {
        slugToSave = slugMatch[1]
      }
    }
    
    const updateData = { 
      feed_url: feed.feed_url || null,
      feed_slug: slugToSave
    }
    await axios.put(`/api/feeds/${feed.feed_id}`, updateData)
    
    // Update the local feed object
    feed.feed_slug = slugToSave
    emit('feed-updated', feed)
  } catch (error) {
    console.error('Failed to update feed URL:', error)
  }
}

const fetchBlueskyName = async (feed: Feed) => {
  if (!feed.feed_url) {
    alert('Please enter a feed URL first')
    return
  }
  
  console.log('Starting fetchBlueskyName with URL:', feed.feed_url)
  fetchingName.value = true
  
  try {
    // Extract DID from URL
    let creatorDid = ''
    if (feed.feed_url.includes('/profile/')) {
      const didMatch = feed.feed_url.match(/\/profile\/([^/]+)/)
      if (didMatch) {
        creatorDid = didMatch[1]
      }
    }
    
    console.log('Extracted DID:', creatorDid)
    console.log('Making API call to /api/bluesky/fetch-feed-name')
    
    const response = await axios.post('/api/bluesky/fetch-feed-name', {
      feedSlug: feed.feed_url,
      creatorDid
    })
    
    console.log('API response:', response.data)
    
    if (response.data.success) {
      feed.bluesky_feed_name = response.data.feedName
      emit('feed-updated', feed)
      console.log('Successfully updated feed name:', response.data.feedName)
    }
  } catch (error: any) {
    console.error('=== FETCH BLUESKY NAME ERROR ===')
    console.error('Full error object:', error)
    console.error('Error message:', error.message)
    console.error('Error status:', error.response?.status)
    console.error('Error data:', error.response?.data)
    console.error('Error config URL:', error.config?.url)
    console.error('=================================')
    
    let errorMessage = 'Failed to fetch feed name from Bluesky'
    if (error.response?.status === 400) {
      errorMessage = error.response.data?.error || 'Please provide a valid feed URL'
    } else if (error.response?.status === 404) {
      errorMessage = 'Feed not found on Bluesky'
    }
    
    alert(errorMessage)
  } finally {
    fetchingName.value = false
  }
}

const testFunction = () => {
  console.log('TEST FUNCTION CALLED!')
  alert('Test function works!')
}

const toggleDebugMode = () => {
  debugStore.setDebugMode(debugStore.showDebugMode.value)
}
</script>

<style scoped>
.feeds-container {
  display: flex;
  gap: 1rem;
  height: calc(100vh - 200px);
  min-height: 600px;
}

@media (max-width: 768px) {
  .feeds-container {
    display: block;
    height: auto;
  }
}

.feeds-sidebar {
  width: 280px;
  background: var(--bg-primary, white);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow, rgba(0,0,0,0.1));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 768px) {
  .feeds-sidebar {
    display: none;
  }
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary, #1e293b);
}

.btn-add {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-add:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.sidebar-actions {
  padding: 0.75rem;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.btn-secondary-small {
  flex: 1;
  padding: 0.5rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary-small:hover {
  background: #4b5563;
}

.moderated-groups-list {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
  background: var(--bg-secondary, #f8fafc);
}

.moderated-groups-list h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.moderated-group-item {
  padding: 0.5rem;
  background: var(--bg-primary, white);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.moderated-group-item strong {
  display: block;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
}

.moderated-group-item small {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.group-owner {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-tertiary, #9ca3af) !important;
  font-style: italic;
}

.empty-feeds {
  padding: 2rem 1rem;
  text-align: center;
  color: #6b7280;
}

.feeds-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.feed-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.feed-item:hover {
  background: var(--bg-secondary, #f8fafc);
}

.feed-item.active {
  background: var(--bg-tertiary, #eff6ff);
  border-color: #3b82f6;
}

.feed-item-name {
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.25rem;
}

.feed-item-id {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
  font-family: monospace;
}

.feed-settings-panel {
  flex: 1;
  background: var(--bg-primary, white);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow, rgba(0,0,0,0.1));
  overflow-y: auto;
}

@media (max-width: 768px) {
  .feed-settings-panel {
    min-height: 400px;
  }
  
  .mobile-feed-selector {
    display: block;
    margin-bottom: 1rem;
  }
  
  .mobile-feed-selector select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-primary, #d1d5db);
    border-radius: 6px;
    background: var(--bg-primary, white);
    color: var(--text-primary, #1e293b);
    font-size: 1rem;
    font-weight: 600;
  }
  
  .mobile-feed-selector select option {
    background: var(--bg-primary, white);
    color: var(--text-primary, #1e293b);
  }
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary, #6b7280);
  font-size: 1.125rem;
}

@media (max-width: 768px) {
  .no-selection {
    display: none;
  }
}

.feed-settings {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.settings-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.5rem;
}

.feed-links {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.feed-link {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.external-link {
  color: #3b82f6;
  text-decoration: none;
  font-family: monospace;
  font-weight: 500;
}

.external-link:hover {
  text-decoration: underline;
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

.url-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  font-size: 0.875rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1e293b);
  font-family: monospace;
}

.url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.url-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.url-input-container input {
  flex: 1;
}

.slug-display {
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-primary, #374151);
  font-family: monospace;
  font-weight: 500;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary, #6b7280);
  font-size: 0.75rem;
}

.btn-delete {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #dc2626;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.settings-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.125rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-header h4 {
  margin: 0;
}

.btn-edit {
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  border: 1px solid var(--border-primary, #d1d5db);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: var(--bg-secondary, #f9fafb);
  border-color: var(--border-secondary, #9ca3af);
}

.section-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.875rem;
  font-style: italic;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.tag-moderator {
  background: #10b981;
}

.empty-text {
  color: #6b7280;
  font-style: italic;
  font-size: 0.875rem;
}

.toggle-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  align-items: flex-start;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.toggle-switch input {
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
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.toggle-content {
  flex: 1;
}

.toggle-title {
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.25rem;
}

.toggle-description {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

.category-block {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.category-threshold {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--border-primary, #e2e8f0);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  font-weight: 700;
  transition: all 0.2s;
}

.category-header:hover {
  background: #2563eb;
}

.subcategory-row {
  margin-bottom: 0.75rem;
}

.subcategory-row label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #374151;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  font-weight: 500;
  width: 100%;
}

.subcategory-row label:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.subcategory-row input[type="checkbox"] {
  display: none;
}

.subcategory-row label:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.threshold-input {
  width: 60px;
  padding: 0.25rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  text-align: center;
  font-size: 0.875rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1e293b);
  font-weight: 600;
}

.percentage-control {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 4px;
}

.percentage-control label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #374151);
  font-weight: 500;
}

.percentage-control input[type="range"] {
  width: 100%;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary, white);
  border-radius: 2px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 2px 8px var(--shadow, rgba(0,0,0,0.1));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text-primary, #374151);
}

.modal-body {
  padding: 1.5rem;
}

.input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.input-field {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 2px;
  font-size: 0.875rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1e293b);
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.groups-list {
  margin-top: 1rem;
}

.group-item {
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 2px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--bg-secondary, #f8fafc);
}

.group-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.group-item-header h4 {
  margin: 0;
  color: var(--text-primary, #374151);
}

.btn-delete-small {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete-small:hover {
  background: #dc2626;
}

.feed-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toggle-item-compact {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary, white);
  border-radius: 6px;
  align-items: center;
  border: 1px solid var(--border-primary, #e5e7eb);
  transition: all 0.2s;
}

.toggle-item-compact:hover {
  background: var(--bg-secondary, #f8fafc);
}

.toggle-item-compact .toggle-content {
  flex: 1;
}

.toggle-item-compact .toggle-title {
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin: 0;
  font-size: 0.875rem;
}

.moderators-list {
  margin-top: 1rem;
}

.moderator-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 2px;
  margin-bottom: 0.5rem;
}

.moderator-item strong {
  display: block;
  color: var(--text-primary, #1e293b);
}

.moderator-item small {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

.mobile-feed-selector {
  display: none;
}

@media (max-width: 768px) {
  .mobile-feed-selector {
    display: block;
    padding: 1rem;
    background: var(--bg-primary, white);
  }
  
  .mobile-select-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    align-items: center;
  }
  
  .mobile-select-row select {
    flex: 1;
  }
  
  .mobile-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-add-mobile {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  
  .btn-add-mobile:hover {
    background: #2563eb;
    transform: scale(1.1);
  }
  
  .feed-settings-panel {
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}

.settings-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-primary, #e5e7eb);
}

.settings-tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-secondary, #64748b);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.settings-tab:hover {
  color: var(--text-primary, #1e293b);
}

.settings-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}





.disabled-setting {
  opacity: 0.6;
}

.subcategory-row label.disabled {
  cursor: not-allowed;
  background: #6b7280 !important;
  border-color: #6b7280 !important;
}

.subcategory-row label.disabled:hover {
  background: #6b7280 !important;
  border-color: #6b7280 !important;
}

.excluded-note {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  margin-left: 0.5rem;
}

.label-with-reset {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.reset-btn {
  background: #6b7280;
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #4b5563;
  transform: scale(1.1);
}

.upgrade-info {
  text-align: center;
}

.upgrade-info p {
  margin-bottom: 1.5rem;
  color: var(--text-primary, #1e293b);
}

.tier-limits {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 2rem 0;
}

.tier-item {
  padding: 1rem;
  border: 2px solid var(--border-primary, #e5e7eb);
  border-radius: 8px;
  text-align: center;
  min-width: 100px;
  transition: all 0.2s;
}

.tier-item.current {
  border-color: #3b82f6;
  background: var(--bg-tertiary, #eff6ff);
}

.tier-item h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1rem;
}

.tier-item .limit {
  font-weight: 600;
  color: #3b82f6;
  font-size: 0.875rem;
}

.upgrade-info ul {
  text-align: left;
  margin: 1.5rem 0;
  padding-left: 1.5rem;
}

.upgrade-info li {
  margin-bottom: 0.5rem;
  color: var(--text-secondary, #64748b);
}

.create-group-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.create-group-section h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.125rem;
}

.groups-list h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.125rem;
}

.bluesky-name-container {
  margin-top: 0.5rem;
}

.bluesky-name-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-secondary, #f9fafb);
  color: var(--text-primary, #374151);
}

.bluesky-name-display span {
  flex: 1;
  font-weight: 500;
}

.refresh-btn {
  padding: 0.5rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 4px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  cursor: pointer;
  font-size: 0.875rem;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover {
  background: var(--bg-tertiary, #f3f4f6);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
