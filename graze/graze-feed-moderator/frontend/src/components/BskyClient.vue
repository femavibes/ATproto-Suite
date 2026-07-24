<template>
  <div class="bsky-client">
    <!-- Bluesky Login Modal -->
    <div v-if="showBskyLogin" class="login-modal">
      <div class="login-form">
        <h3>Connect to Bluesky</h3>
        <div v-if="loading" class="loading-message">
          <div class="loading-spinner">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4a9 9 0 0 1-14.85 3.36L13 14"/>
            </svg>
          </div>
          <span>Connecting to services...</span>
        </div>
        <div v-else>
          <input 
            v-model="bskyCredentials.identifier" 
            placeholder="Handle or email"
            type="text"
          >
          <input 
            v-model="bskyCredentials.password" 
            placeholder="Password"
            type="password"
          >
          <button @click="loginToBluesky" :disabled="loading">Connect</button>
        </div>
      </div>
    </div>

    <div v-else class="bsky-layout">
      <!-- Main Content Area -->
      <div class="bsky-main">
        <!-- Home Feed -->
        <div v-if="activeTab === 'home'" class="tab-content">
          <div class="feed-layout">
            <!-- Feed Sidebar -->
            <div class="feed-sidebar">
              <h3>Feeds</h3>
              <div class="feed-list">
                <div 
                  v-for="(feed, index) in sortedFeeds" 
                  :key="feed.feed_id"
                  class="feed-item-container"
                  draggable="true"
                  @dragstart="handleDragStart(index, $event)"
                  @dragover="handleDragOver($event)"
                  @drop="handleDrop(index, $event)"
                >
                  <button 
                    @click="selectFeed(feed.feed_uri)" 
                    :class="{ active: selectedFeed === feed.feed_uri }" 
                    class="feed-item draggable"
                  >
                    <span class="drag-handle">⋮⋮</span>
                    {{ feed.feed_name }}
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Posts Container -->
            <div class="posts-container" ref="postsContainer">
              <!-- Post Composer -->
              <BskyComposer 
                v-if="!replyingTo"
                ref="composerRef"
                @post="handleCreatePost"
                @thread="handleThreadPublish"
                :user-avatar="userProfile?.avatar"
                :quoted-post="quotingPost"
              />
              
              <!-- Mobile Feed Selector -->
              <div class="feed-selector-mobile">
                <div class="mobile-feed-list">
                  <button 
                    v-for="feed in sortedFeeds" 
                    :key="feed.feed_id"
                    @click="selectFeed(feed.feed_uri)" 
                    :class="{ active: selectedFeed === feed.feed_uri }" 
                    class="mobile-feed-item"
                  >
                    {{ feed.feed_name }}
                  </button>
                  <button @click="openReorderModal" class="reorder-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M3 12h18M3 18h18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div v-if="loading" class="loading">Loading posts...</div>
              
              <BskyPost 
                v-for="item in posts" 
                :key="item.post.uri"
                :post="item"
                :current-feed="selectedFeed"
                :user-feeds="userFeeds"
                :user-groups="userGroups"
                :user-profile="userProfile"
                :show-debug="debugStore.showDebugMode.value"
                @repost="handleRepost"
                @quote="handleQuote"
                @like="handleLike"
                @moderate="handleModerate"
                @view-profile="handleViewProfile"
              />
              
              <div v-if="loadingMore" class="loading-more">
                <div class="loading-spinner">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4a9 9 0 0 1-14.85 3.36L13 14"/>
                  </svg>
                </div>
                <span>Loading more posts...</span>
              </div>
            </div>
            
            <!-- Moderation Tools Sidebar -->
            <div class="moderation-sidebar placeholder">
              <h3>Moderation Tools</h3>
              <div class="mod-section">
                <h4>Quick Actions</h4>
                <button class="mod-tool-btn" disabled>Bulk Remove</button>
                <button class="mod-tool-btn" disabled>Bulk Ban</button>
                <button class="mod-tool-btn" disabled>Export Reports</button>
              </div>
              <div class="mod-section">
                <h4>Statistics</h4>
                <div class="mod-stat">Posts Moderated: {{ moderationStats.postsModerated }}</div>
                <div class="mod-stat">Users Banned: {{ moderationStats.usersBanned }}</div>
                <div class="mod-stat">Reports Today: {{ moderationStats.reportsToday }}</div>
              </div>
              <div class="mod-section">
                <h4>Filters</h4>
                <label><input type="checkbox" v-model="showModerated" disabled> Show Moderated</label>
                <label><input type="checkbox" v-model="hideSpam" disabled> Hide Spam</label>
                <label><input type="checkbox" v-model="autoModerate" disabled> Auto-moderate</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Tab -->
        <div v-if="activeTab === 'search'" class="tab-content">
          <BskySearch 
            @reply="handleReply"
            @repost="handleRepost"
            @quote="handleQuote"
            @like="handleLike"
            @moderate="handleModerate"
          />
        </div>

        <!-- Notifications Tab -->
        <div v-if="activeTab === 'notifications'" class="tab-content">
          <BskyNotifications />
        </div>

        <!-- Profile Tab -->
        <div v-if="activeTab === 'profile'" class="tab-content">
          <div class="profile-container">
            <div class="profile-header">
              <img 
                :src="userProfile?.avatar || '/icon-192.svg'" 
                class="profile-avatar"
                @error="handleAvatarError"
                @load="handleAvatarLoad"
              >
              <div class="profile-info">
                <h2>{{ userProfile?.displayName || userProfile?.handle }}</h2>
                <p class="profile-handle">@{{ userProfile?.handle }}</p>
                <p v-if="userProfile?.description" class="profile-description">{{ userProfile.description }}</p>
                <div class="profile-stats">
                  <button @click="showFollows = true" class="stat-btn">
                    {{ userProfile?.followersCount || 0 }} followers
                  </button>
                  <button @click="showFollows = true; followsTab = 'following'" class="stat-btn">
                    {{ userProfile?.followsCount || 0 }} following
                  </button>
                  <span>{{ userProfile?.postsCount || 0 }} posts</span>
                </div>
              </div>
              <div class="profile-actions">
                <button @click="editProfile = true" class="edit-profile-btn">Edit Profile</button>
              </div>
            </div>
            
            <!-- Edit Profile Modal -->
            <div v-if="editProfile" class="edit-profile-modal">
              <div class="edit-profile-form">
                <h3>Edit Profile</h3>
                <input v-model="profileForm.displayName" placeholder="Display Name">
                <textarea v-model="profileForm.description" placeholder="Bio"></textarea>
                <input type="file" @change="handleAvatarUpload" accept="image/*">
                <div class="form-actions">
                  <button @click="editProfile = false">Cancel</button>
                  <button @click="saveProfile">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Bookmarks Tab -->
        <div v-if="activeTab === 'bookmarks'" class="tab-content">
          <div class="disabled-feature">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <h3>Bookmarks Coming Soon</h3>
            <p>Native Bluesky bookmarks will be available when the AT Protocol supports them.</p>
          </div>
        </div>
        
        <!-- Follows Tab -->
        <div v-if="activeTab === 'follows'" class="tab-content">
          <BskyFollows 
            :user-handle="userProfile?.handle"
            @view-profile="handleViewProfile"
          />
        </div>
      </div>
    </div>
    
    <!-- Reorder Modal -->
    <div v-if="showReorderModal" class="modal-overlay" @click="showReorderModal = false">
      <div class="reorder-modal" @click.stop>
        <h3>Reorder Feeds</h3>
        <div class="reorder-list">
          <div v-for="(feed, index) in reorderFeeds" :key="feed.feed_id" class="reorder-item">
            <span class="feed-name">{{ feed.feed_name }}</span>
            <div class="reorder-controls">
              <button @click="moveUp(index)" :disabled="index === 0" class="move-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14l5-5 5 5z"/>
                </svg>
              </button>
              <button @click="moveDown(index)" :disabled="index === reorderFeeds.length - 1" class="move-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showReorderModal = false" class="cancel-btn">Cancel</button>
          <button @click="saveReorder" class="save-btn">Save Order</button>
        </div>
      </div>
    </div>
    
    <!-- Profile Modal -->
    <div v-if="showProfileModal" class="modal-overlay" @click="showProfileModal = false">
      <div class="profile-modal" @click.stop>
        <div class="profile-modal-header">
          <button @click="showProfileModal = false" class="close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="profile-modal-content">
          <div class="profile-header">
            <img 
              :src="profileModalUser?.avatar || '/icon-192.svg'" 
              class="profile-avatar"
              @error="handleModalAvatarError"
              @load="handleModalAvatarLoad"
            >
            <div class="profile-info">
              <h2>{{ profileModalUser?.displayName || profileModalUser?.handle }}</h2>
              <p class="profile-handle">
                @{{ profileModalUser?.handle }}
                <span v-if="profileModalUser?.viewer?.followedBy" class="follows-you-badge">Follows you</span>
              </p>
              <p v-if="profileModalUser?.description" class="profile-description">{{ profileModalUser.description }}</p>
              <div class="profile-stats">
                <span>{{ profileModalUser?.followersCount || 0 }} followers</span>
                <span>{{ profileModalUser?.followsCount || 0 }} following</span>
                <span>{{ profileModalUser?.postsCount || 0 }} posts</span>
              </div>
            </div>
            <div class="profile-actions">
              <button v-if="!isOwnProfile" @click="toggleProfileFollow" class="follow-profile-btn" :class="{ following: isFollowingProfile }">
                {{ isFollowingProfile ? 'Unfollow' : 'Follow' }}
              </button>
              <button v-if="!isOwnProfile" @click="toggleMute" class="mute-profile-btn" :class="{ muted: isMuted }">
                {{ isMuted ? 'Unmute' : 'Mute' }}
              </button>
              <button v-if="!isOwnProfile" @click="toggleBlock" class="block-profile-btn" :class="{ blocked: isBlocked }">
                {{ isBlocked ? 'Unblock' : 'Block' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Unfollow Confirmation Modal -->
    <div v-if="showUnfollowConfirm" class="modal-overlay" @click="showUnfollowConfirm = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3>Unfollow @{{ profileModalUser?.handle }}?</h3>
        </div>
        <p>Their posts will no longer show up in your home timeline.</p>
        <div class="modal-actions">
          <button @click="confirmUnfollow" class="modal-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            Unfollow
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showUnfollowConfirm = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Composer Modal -->
    <BskyComposerModal 
      :show="showComposerModal"
      :quoted-post="quotingPost"
      :user-avatar="userProfile?.avatar"
      @post="handleModalPost"
      @close="showComposerModal = false; quotingPost = null"
    />
    
    <!-- Thread Composer Modal -->
    <BskyThreadComposerModal 
      :show="showThreadModal"
      :user-avatar="userProfile?.avatar"
      @publish="handleThreadPublish"
      @close="showThreadModal = false"
    />
    
    <!-- Bottom Navigation -->
    <BskyBottomNav :active-tab="activeTab" @navigate="activeTab = $event" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useContentFilterStore } from '../stores/contentFilter'
import { useDebugStore } from '../stores/debug'
import { blueskyService } from '../services/bluesky'
import axios from 'axios'
import BskyPost from './bluesky/BskyPost.vue'
import BskyComposer from './bluesky/BskyComposer.vue'
import BskySearch from './bluesky/BskySearch.vue'
import BskyNotifications from './bluesky/BskyNotifications.vue'
import BskyFollows from './bluesky/BskyFollows.vue'
import BskyComposerModal from './bluesky/BskyComposerModal.vue'
import BskyThreadComposerModal from './bluesky/BskyThreadComposerModal.vue'
import BskyBottomNav from './bluesky/BskyBottomNav.vue'

const authStore = useAuthStore()
const contentFilterStore = useContentFilterStore()
const debugStore = useDebugStore()
const posts = ref([])
const mutedUsers = ref(new Set<string>())
const blockedUsers = ref(new Set<string>())
const userFeeds = ref([])
const userGroups = ref([])
const feedOrder = ref([])

const sortedFeeds = computed(() => {
  // Built-in feeds
  const builtInFeeds = [
    { feed_id: 'timeline', feed_name: 'Following', feed_uri: 'timeline' },
    { feed_id: 'discover', feed_name: 'Discover', feed_uri: 'discover' }
  ]
  
  const allFeeds = [...builtInFeeds, ...userFeeds.value]
  
  if (feedOrder.value.length === 0) return allFeeds
  
  const ordered = []
  const unordered = [...allFeeds]
  
  // Add feeds in saved order
  feedOrder.value.forEach(feedId => {
    const feed = unordered.find(f => f.feed_id === feedId)
    if (feed) {
      ordered.push(feed)
      unordered.splice(unordered.indexOf(feed), 1)
    }
  })
  
  // Add any new feeds that weren't in the saved order
  return [...ordered, ...unordered]
})
const selectedFeed = ref('timeline')
const loading = ref(false)
const loadingMore = ref(false)
const cursor = ref<string | undefined>(undefined)
const bskyCredentials = ref({ identifier: '', password: '' })
const showBskyLogin = ref(false)
const activeTab = ref('home')
const showProfileModal = ref(false)
const profileModalUser = ref(null)
const showUnfollowConfirm = ref(false)
const userProfile = ref(null)
const currentProfileHandle = ref(null)
const editProfile = ref(false)
const profileForm = ref({ displayName: '', description: '', avatar: null })
const isFollowingProfile = ref(false)
const isMuted = ref(false)
const isBlocked = ref(false)
const avatarLoaded = ref(false)
const modalAvatarLoaded = ref(false)
const quotingPost = ref(null)
const showComposerModal = ref(false)
const showThreadModal = ref(false)
const composerRef = ref()
const postsContainer = ref<HTMLElement>()
const isOwnProfile = computed(() => {
  const agent = blueskyService.getAgent()
  const session = agent.session
  return session && profileModalUser.value && profileModalUser.value.handle === session.handle
})

// Moderation settings
const showModerated = ref(false)
const hideSpam = ref(true)
const autoModerate = ref(false)
const moderationStats = ref({
  postsModerated: 0,
  usersBanned: 0,
  reportsToday: 0
})

const navTabs = [
  { 
    key: 'home', 
    label: 'Home', 
    icon: '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>'
  },
  { 
    key: 'search', 
    label: 'Search', 
    icon: '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>'
  },
  { 
    key: 'notifications', 
    label: 'Notifications', 
    icon: '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>'
  },
  { 
    key: 'analytics', 
    label: 'Analytics', 
    icon: '<path d="M3 3v18h18v-2H5V3H3zm4 14h2V9H7v8zm4 0h2V7h-2v10zm4 0h2v-4h-2v4z"/>'
  },
  { 
    key: 'bookmarks', 
    label: 'Bookmarks', 
    icon: '<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>'
  },
  { 
    key: 'profile', 
    label: 'Profile', 
    icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>'
  }
]

const loginToBluesky = async () => {
  loading.value = true
  try {
    const result = await blueskyService.login(
      bskyCredentials.value.identifier,
      bskyCredentials.value.password
    )
    if (result.success) {
      await blueskyService.saveCredentials(
        bskyCredentials.value.identifier,
        bskyCredentials.value.password
      )
      showBskyLogin.value = false
      await loadUserProfile()
      await loadFeed()
    } else {
      console.error('Bluesky login failed:', result.error)
    }
  } catch (error) {
    console.error('Bluesky login error:', error)
  } finally {
    loading.value = false
  }
}

const loadUserProfile = async (handle?: string) => {
  try {
    const agent = blueskyService.getAgent()
    const session = agent.session
    if (session) {
      const targetHandle = handle || session.handle
      const result = await blueskyService.getProfile(targetHandle)
      if (result.success) {
        userProfile.value = result.profile
        isFollowingProfile.value = result.profile.viewer?.following ? true : false
        
        // Only set profile form for own profile
        if (!handle || targetHandle === session.handle) {
          profileForm.value = {
            displayName: result.profile.displayName || '',
            description: result.profile.description || '',
            avatar: null
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load user profile:', error)
  }
}

const loadFeedOrder = () => {
  const saved = localStorage.getItem('bsky-feed-order')
  if (saved) {
    feedOrder.value = JSON.parse(saved)
  }
}

const saveFeedOrder = () => {
  localStorage.setItem('bsky-feed-order', JSON.stringify(feedOrder.value))
}

const handleDragStart = (index: number, event: DragEvent) => {
  event.dataTransfer?.setData('text/plain', index.toString())
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDrop = (dropIndex: number, event: DragEvent) => {
  event.preventDefault()
  const dragIndex = parseInt(event.dataTransfer?.getData('text/plain') || '0')
  
  if (dragIndex !== dropIndex) {
    const newOrder = [...sortedFeeds.value]
    const draggedFeed = newOrder.splice(dragIndex, 1)[0]
    newOrder.splice(dropIndex, 0, draggedFeed)
    
    feedOrder.value = newOrder.map(f => f.feed_id)
    saveFeedOrder()
  }
}

const showReorderModal = ref(false)
const reorderFeeds = ref([])

const openReorderModal = () => {
  reorderFeeds.value = [...sortedFeeds.value]
  showReorderModal.value = true
}

const moveUp = (index: number) => {
  if (index > 0) {
    const temp = reorderFeeds.value[index]
    reorderFeeds.value[index] = reorderFeeds.value[index - 1]
    reorderFeeds.value[index - 1] = temp
  }
}

const moveDown = (index: number) => {
  if (index < reorderFeeds.value.length - 1) {
    const temp = reorderFeeds.value[index]
    reorderFeeds.value[index] = reorderFeeds.value[index + 1]
    reorderFeeds.value[index + 1] = temp
  }
}

const saveReorder = () => {
  feedOrder.value = reorderFeeds.value.map(f => f.feed_id)
  saveFeedOrder()
  showReorderModal.value = false
}

const loadFeed = async (loadMore = false) => {
  if (!blueskyService.isLoggedIn()) {
    showBskyLogin.value = true
    return
  }

  if (loadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    cursor.value = undefined
    posts.value = []
  }
  
  try {
    let result
    
    console.log('Loading feed:', selectedFeed.value)
    
    if (selectedFeed.value === 'timeline') {
      result = await blueskyService.getTimeline(20, loadMore ? cursor.value : undefined)
    } else if (selectedFeed.value === 'discover') {
      result = await blueskyService.getDiscover(20, loadMore ? cursor.value : undefined)
    } else {
      console.log('Loading custom feed with URI:', selectedFeed.value)
      result = await blueskyService.getFeed(selectedFeed.value, 20, loadMore ? cursor.value : undefined)
    }
    
    console.log('Feed result:', result)
    
    if (result.success) {
      if (loadMore) {
        const filteredPosts = (result.posts || []).filter(post => 
          !mutedUsers.value.has(post.post.author.handle) && 
          !blockedUsers.value.has(post.post.author.handle)
        )
        posts.value = [...posts.value, ...filteredPosts]
      } else {
        const filteredPosts = (result.posts || []).filter(post => 
          !mutedUsers.value.has(post.post.author.handle) && 
          !blockedUsers.value.has(post.post.author.handle)
        )
        posts.value = filteredPosts
      }
      cursor.value = result.cursor
      console.log('Loaded posts:', posts.value.length)
    } else {
      console.error('Feed load failed:', result.error)
    }
  } catch (error) {
    console.error('Failed to load feed:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMorePosts = () => {
  if (cursor.value && !loadingMore.value) {
    loadFeed(true)
  }
}

const selectFeed = (feedValue: string) => {
  console.log('Selecting feed:', feedValue)
  console.log('Available feeds:', userFeeds.value)
  selectedFeed.value = feedValue
  loadFeed(false)
}

const handleModalPost = async (postData: any) => {
  try {
    const result = await blueskyService.createPost(
      postData.text,
      postData.images,
      postData.videos,
      postData.gif,
      postData.replyTo,
      postData.quotedPost
    )
    
    if (result.success) {
      quotingPost.value = null
      showComposerModal.value = false
      await loadFeed(false)
    }
  } catch (error) {
    console.error('Failed to create post:', error)
  }
}

const handleCreatePost = async (postData: any) => {
  try {
    const result = await blueskyService.createPost(
      postData.text,
      postData.images,
      postData.videos,
      postData.gif,
      postData.replyTo,
      postData.quotedPost
    )
    
    if (result.success) {
      // Clear quote state
      quotingPost.value = null
      // Refresh feed to show new post
      await loadFeed(false)
    }
  } catch (error) {
    console.error('Failed to create post:', error)
  }
}

const handleThreadPublish = async (posts: Array<{ text: string, images: Array<{ file: File, alt: string }>, videos: Array<{ file: File }> }>) => {
  try {
    const result = await blueskyService.createThread(posts)
    
    if (result.success) {
      showThreadModal.value = false
      await loadFeed(false)
    }
  } catch (error) {
    console.error('Failed to create thread:', error)
  }
}

const loadDraft = (draft: any) => {
  if (composerRef.value) {
    composerRef.value.loadDraft(draft)
  }
}



const handleRepost = async (post: any) => {
  try {
    const agent = blueskyService.getAgent()
    await agent.repost(post.post.uri, post.post.cid)
    post.post.repostCount = (post.post.repostCount || 0) + 1
  } catch (error) {
    console.error('Failed to repost:', error)
  }
}

const handleQuote = async (post: any) => {
  quotingPost.value = post
  showComposerModal.value = true
}

const handleLike = async (post: any) => {
  try {
    const agent = blueskyService.getAgent()
    if (post.post.viewer?.like) {
      await agent.deleteLike(post.post.viewer.like)
      post.post.viewer.like = undefined
      post.post.likeCount = Math.max((post.post.likeCount || 0) - 1, 0)
    } else {
      const result = await agent.like(post.post.uri, post.post.cid)
      post.post.viewer = post.post.viewer || {}
      post.post.viewer.like = result.uri
      post.post.likeCount = (post.post.likeCount || 0) + 1
    }
  } catch (error) {
    console.error('Failed to toggle like:', error)
  }
}

const toggleProfileFollow = async () => {
  if (!profileModalUser.value) return
  
  if (isFollowingProfile.value) {
    showUnfollowConfirm.value = true
    return
  }
  
  try {
    const result = await blueskyService.followUser(profileModalUser.value.handle)
    if (result.success) {
      isFollowingProfile.value = true
    }
  } catch (error) {
    console.error('Follow error:', error)
  }
}

const confirmUnfollow = async () => {
  if (!profileModalUser.value) return
  
  try {
    const result = await blueskyService.unfollowUser(profileModalUser.value.viewer?.following)
    if (result.success) {
      isFollowingProfile.value = false
    }
  } catch (error) {
    console.error('Unfollow error:', error)
  } finally {
    showUnfollowConfirm.value = false
  }
}

const toggleMute = async () => {
  if (!profileModalUser.value) return
  
  try {
    if (isMuted.value) {
      const result = await blueskyService.unmuteUser(profileModalUser.value.handle)
      if (result.success) {
        isMuted.value = false
        mutedUsers.value.delete(profileModalUser.value.handle)
        await loadFeed(false) // Refresh to show unmuted posts
      }
    } else {
      const result = await blueskyService.muteUser(profileModalUser.value.handle)
      if (result.success) {
        isMuted.value = true
        mutedUsers.value.add(profileModalUser.value.handle)
        // Remove posts from this user from current view
        posts.value = posts.value.filter(p => p.post.author.handle !== profileModalUser.value.handle)
      }
    }
  } catch (error) {
    console.error('Mute/unmute error:', error)
  }
}

const toggleBlock = async () => {
  if (!profileModalUser.value) return
  
  try {
    if (isBlocked.value) {
      const result = await blueskyService.unblockUser(profileModalUser.value.viewer?.blocking)
      if (result.success) {
        isBlocked.value = false
        blockedUsers.value.delete(profileModalUser.value.handle)
        await loadFeed(false) // Refresh to show unblocked posts
      }
    } else {
      const result = await blueskyService.blockUser(profileModalUser.value.handle)
      if (result.success) {
        isBlocked.value = true
        blockedUsers.value.add(profileModalUser.value.handle)
        showProfileModal.value = false
        // Remove posts from this user from current view
        posts.value = posts.value.filter(p => p.post.author.handle !== profileModalUser.value.handle)
      }
    }
  } catch (error) {
    console.error('Block/unblock error:', error)
  }
}

const handleViewProfile = async (handle: string) => {
  try {
    const result = await blueskyService.getProfile(handle)
    if (result.success) {
      profileModalUser.value = result.profile
      isFollowingProfile.value = result.profile.viewer?.following ? true : false
      isMuted.value = result.profile.viewer?.muted ? true : false
      isBlocked.value = result.profile.viewer?.blocking ? true : false
      showProfileModal.value = true
    }
  } catch (error) {
    console.error('Failed to load profile for modal:', error)
  }
}

const handleModerate = async (post: any, action: string, target?: string | any) => {
  try {
    if (action === 'remove') {
      await handleRemovePost(post, target)
    } else if (action === 'ban') {
      await handleBanUser(post, target)
    } else if (action === 'bulk-remove') {
      await handleBulkRemove(target)
    }
  } catch (error) {
    console.error('Moderation action failed:', error)
  }
}

const handleRemovePost = async (post: any, target?: string) => {
  try {
    let feedIds: string[]
    
    if (target === 'all') {
      feedIds = ['all']
    } else if (target === 'configured') {
      feedIds = userFeeds.value.map(f => f.feed_id)
    } else if (target?.startsWith('feeds:')) {
      // Handle specific feed selection
      feedIds = target.replace('feeds:', '').split(',')
    } else if (target?.startsWith('group:')) {
      // Handle group selection - get all feeds in the group
      const groupName = target.replace('group:', '')
      const group = userGroups.value.find(g => g.group_name === groupName)
      if (group && group.feeds) {
        feedIds = group.feeds.map(f => f.feed_id)
      } else {
        feedIds = userFeeds.value.map(f => f.feed_id)
      }
    } else {
      // For 'current' or default, use current feed or all configured feeds as fallback
      if (selectedFeed.value === 'timeline' || selectedFeed.value === 'discover') {
        feedIds = userFeeds.value.map(f => f.feed_id)
      } else {
        // Find the feed ID that matches the current feed URI
        const currentFeed = userFeeds.value.find(f => f.feed_uri === selectedFeed.value)
        if (currentFeed) {
          feedIds = [currentFeed.feed_id]
        } else {
          // Fallback to all configured feeds
          feedIds = userFeeds.value.map(f => f.feed_id)
        }
      }
    }
    
    console.log('Remove post request:', {
      postUri: post.post.uri,
      feedIds,
      reportType: 'other',
      selectedFeed: selectedFeed.value,
      userFeeds: userFeeds.value,
      target
    })
    
    const response = await axios.post('/api/moderation/remove-post', {
      postUri: post.post.uri,
      feedIds,
      reportType: 'other'
    })
    
    if (response.data.results) {
      const index = posts.value.findIndex(p => p.post.uri === post.post.uri)
      if (index !== -1) {
        posts.value[index].moderated = 'remove'
      }
      moderationStats.value.postsModerated++
      
      // Show success message
      const successCount = response.data.results.filter(r => r.success).length || 0
      console.log(`✓ Post removed from ${successCount} feed(s)`)
    }
  } catch (error) {
    console.error('Remove post failed:', error)
    if (error.response) {
      console.error('Error response:', error.response.data)
    }
  }
}

const handleBanUser = async (post: any, target?: string) => {
  try {
    let useGlobal = false
    let selectedFeeds: string[] = []
    
    if (target === 'global') {
      useGlobal = true
    } else if (target === 'configured') {
      selectedFeeds = userFeeds.value.map(f => f.feed_id)
    } else if (target?.startsWith('feeds:')) {
      // Handle specific feed selection
      selectedFeeds = target.replace('feeds:', '').split(',')
    } else if (target?.startsWith('group:')) {
      // Handle group selection - get all feeds in the group that have ban lists
      const groupName = target.replace('group:', '')
      const group = userGroups.value.find(g => g.group_name === groupName)
      if (group && group.feeds) {
        selectedFeeds = group.feeds.filter(f => f.feed_ban_list).map(f => f.feed_id)
      } else {
        selectedFeeds = userFeeds.value.filter(f => f.feed_ban_list).map(f => f.feed_id)
      }
    } else {
      // For 'current' or default, use current feed only if it has a ban list configured
      if (selectedFeed.value !== 'timeline' && selectedFeed.value !== 'discover') {
        const currentFeed = userFeeds.value.find(f => f.feed_uri === selectedFeed.value)
        if (currentFeed && currentFeed.feed_ban_list) {
          selectedFeeds = [currentFeed.feed_id]
        } else {
          // Fallback to all configured feeds with ban lists
          selectedFeeds = userFeeds.value.filter(f => f.feed_ban_list).map(f => f.feed_id)
        }
      } else {
        // On timeline/discover, use all configured feeds with ban lists
        selectedFeeds = userFeeds.value.filter(f => f.feed_ban_list).map(f => f.feed_id)
      }
    }
    
    console.log('Ban request:', {
      userHandle: post.post.author.handle,
      reportType: 'other',
      useGlobal,
      selectedFeeds,
      reason: 'Manual ban from PWA client',
      selectedFeed: selectedFeed.value,
      userFeeds: userFeeds.value,
      target
    })
    
    const response = await axios.post('/api/moderation/ban-user', {
      userHandle: post.post.author.handle,
      reportType: 'other',
      useGlobal,
      selectedFeeds,
      reason: 'Manual ban from PWA client'
    })
    
    console.log('API response data:', response.data)
    
    // Remove all posts by this user from current view
    posts.value = posts.value.filter(p => p.post.author.handle !== post.post.author.handle)
    moderationStats.value.usersBanned++
    
    console.log(`✓ User @${post.post.author.handle} banned`)
  } catch (error) {
    console.error('Ban user failed:', error)
    if (error.response) {
      console.error('Error response:', error.response.data)
    }
  }
}

const handleBulkRemove = async (bulkData: any) => {
  try {
    console.log('Bulk remove request:', {
      userHandle: bulkData.userHandle,
      postCount: bulkData.postCount,
      feedIds: bulkData.feedIds
    })
    
    const response = await axios.post('/api/moderation/backfill-removal', {
      userHandle: bulkData.userHandle,
      postCount: bulkData.postCount,
      feedIds: bulkData.feedIds
    })
    
    console.log('Bulk remove API response:', response.data)
    
    if (response.data.success) {
      // Remove all posts by this user from current view
      posts.value = posts.value.filter(p => p.post.author.handle !== bulkData.userHandle)
      moderationStats.value.postsModerated += response.data.removalsAttempted || 0
      
      console.log(`✓ Bulk removed ${response.data.removalsAttempted || 0} posts by @${bulkData.userHandle}`)
    } else {
      console.error('Bulk remove failed:', response.data.error)
    }
  } catch (error) {
    console.error('Bulk remove failed:', error)
    if (error.response) {
      console.error('Error response:', error.response.data)
    }
  }
}

const handleAvatarUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    profileForm.value.avatar = file
  }
}

const handleAvatarError = (event: Event) => {
  const img = event.target as HTMLImageElement
  requestIdleCallback(() => {
    img.src = '/icon-192.svg'
    avatarLoaded.value = true
  })
}

const handleAvatarLoad = () => {
  requestIdleCallback(() => {
    avatarLoaded.value = true
  })
}

const handleModalAvatarError = (event: Event) => {
  const img = event.target as HTMLImageElement
  requestIdleCallback(() => {
    img.src = '/icon-192.svg'
    modalAvatarLoaded.value = true
  })
}

const handleModalAvatarLoad = () => {
  requestIdleCallback(() => {
    modalAvatarLoaded.value = true
  })
}

const saveProfile = async () => {
  try {
    const result = await blueskyService.updateProfile(
      profileForm.value.displayName,
      profileForm.value.description,
      profileForm.value.avatar
    )
    
    if (result.success) {
      editProfile.value = false
      avatarLoaded.value = false // Reset loading state
      await loadUserProfile()
    }
  } catch (error) {
    console.error('Failed to update profile:', error)
  }
}

onMounted(async () => {
  if (!authStore.token) {
    showBskyLogin.value = true
    return
  }
  
  // Load debug mode
  debugStore.loadDebugMode()
  
  // Use window scroll for infinite scroll
  window.addEventListener('scroll', handleScroll, { passive: true })
  
  // Show loading state while initializing
  loading.value = true
  
  // Load user's configured feeds and groups with retry logic
  try {
    const maxRetries = 3
    const baseDelay = 1000
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const [feedsResponse, groupsResponse] = await Promise.all([
          axios.get('/api/feeds/bluesky?all=true'),
          axios.get('/api/feed-groups')
        ])
        console.log('Loaded feeds for BskyClient:', feedsResponse.data)
        console.log('Loaded groups for BskyClient:', groupsResponse.data)
        userFeeds.value = feedsResponse.data || []
        userGroups.value = groupsResponse.data?.groups || []
        loadFeedOrder()
        break // Success, exit retry loop
      } catch (error: any) {
        console.error(`Failed to load user feeds/groups (attempt ${attempt + 1}):`, error)
        
        // If it's a 502 error and we have retries left, wait and retry
        if (error.response?.status === 502 && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`Server not ready, retrying feeds/groups in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // If it's the last attempt or not a 502, break and continue with empty arrays
        if (attempt === maxRetries - 1) {
          console.warn('Using empty feeds/groups after max retries')
          userFeeds.value = []
          userGroups.value = []
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error loading feeds/groups:', error)
    userFeeds.value = []
    userGroups.value = []
  }
  
  // Try auto-login (now has built-in retry logic)
  const autoLoginResult = await blueskyService.autoLogin()
  if (autoLoginResult.success) {
    await loadUserProfile()
    await loadFeed()
  } else if (blueskyService.isLoggedIn()) {
    await loadUserProfile()
    loadFeed()
  } else {
    showBskyLogin.value = true
  }
  
  loading.value = false
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('scroll', handleScroll)
})

const handleScroll = throttle(() => {
  if (loadingMore.value || !cursor.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement
  const threshold = 800
  const remaining = scrollHeight - (scrollTop + clientHeight)
  
  if (remaining <= threshold) {
    loadMorePosts()
  }
}, 300)

function throttle(func, delay) {
  let timeoutId
  let lastExecTime = 0
  return function (...args) {
    const currentTime = Date.now()
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args)
      lastExecTime = currentTime
    } else {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        func.apply(this, args)
        lastExecTime = Date.now()
      }, delay - (currentTime - lastExecTime))
    }
  }
}
</script>

<style scoped>
.bsky-client {
  /* Remove container styling - let main-content handle it */
}

.bsky-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.bsky-nav {
  display: flex;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-card);
  padding: 0 1rem;
  gap: 0.5rem;
  overflow-x: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.nav-tab:hover {
  color: var(--text-primary);
  background: var(--bg-primary);
}

.nav-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.nav-tab svg {
  flex-shrink: 0;
}

.bsky-main {
  flex: 1;
  overflow: hidden;
  padding-bottom: 80px; /* Space for bottom navigation */
}

.tab-content {
  height: 100%;
  overflow-y: auto;
}

.feed-layout {
  display: flex;
  gap: 2rem;
  width: 100%;
  height: 100%;
}

.feed-sidebar {
  width: 200px;
  flex-shrink: 0;
  padding: 1rem;
  background: var(--bg-card);
  border-right: 1px solid var(--border-primary);
}

.feed-sidebar h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feed-item {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.feed-item:hover {
  background: var(--bg-primary);
}

.feed-item.active {
  background: #3b82f6;
  color: white;
}

.feed-item-container {
  cursor: grab;
}

.feed-item-container:active {
  cursor: grabbing;
}

.feed-item.draggable {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.drag-handle {
  color: #9ca3af;
  font-size: 0.75rem;
  cursor: grab;
}

.feed-item-container:hover .drag-handle {
  color: #6b7280;
}

.posts-container {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  overflow-y: visible;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.moderation-sidebar.placeholder {
  opacity: 0.5;
  pointer-events: none;
}

.moderation-sidebar.placeholder .mod-tool-btn {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.moderation-sidebar.placeholder input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.moderation-sidebar.placeholder label {
  color: #9ca3af;
  cursor: not-allowed;
}

.moderation-sidebar {
  flex: 1;
  min-width: 250px;
  max-width: 350px;
  background: var(--bg-card);
  border-left: 1px solid var(--border-primary);
  padding: 1rem;
  height: fit-content;
  position: sticky;
  top: 0;
}

.moderation-sidebar h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.mod-section {
  margin-bottom: 1.5rem;
}

.mod-section h4 {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.mod-tool-btn {
  display: block;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: #f3f4f6;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.mod-tool-btn:hover {
  background: #e5e7eb;
}

.mod-stat {
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.mod-stat:last-child {
  border-bottom: none;
}

.mod-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.mod-section input[type="checkbox"] {
  margin-right: 0.5rem;
}

.feed-selector-mobile {
  display: none;
  margin-bottom: 0.25rem;
}

.mobile-feed-list {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0;
  -webkit-overflow-scrolling: touch;
}

.mobile-feed-item {
  padding: 0.25rem 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.875rem;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.mobile-feed-item:hover {
  background: var(--bg-primary);
}

.mobile-feed-item.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.reorder-btn {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.reorder-btn svg {
  width: 16px;
  height: 16px;
}

.reorder-modal {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  z-index: 1001;
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

.reorder-modal h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.reorder-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.reorder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
}

.feed-name {
  color: var(--text-primary);
  font-weight: 500;
}

.reorder-controls {
  display: flex;
  gap: 0.25rem;
}

.move-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 2px;
  transition: all 0.2s;
}

.move-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.move-btn svg {
  width: 16px;
  height: 16px;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
}

.save-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.mobile-drag-handle {
  color: #9ca3af;
  font-size: 0.75rem;
  cursor: grab;
}

.mobile-feed-container:active .mobile-drag-handle {
  cursor: grabbing;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-secondary);
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

.loading-more span {
  font-size: 0.875rem;
  font-weight: 500;
}

.load-more {
  text-align: center;
  margin-top: 2rem;
}

.load-more-btn {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-modal {
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

.login-form {
  background: var(--bg-card);
  padding: 2rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 300px;
}

.login-form h3 {
  margin: 0;
  color: var(--text-primary);
}

.login-form input {
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.login-form button {
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.login-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
  color: var(--text-secondary);
}

.loading-message .loading-spinner {
  animation: spin 1s linear infinite;
}

.loading-message span {
  font-size: 0.875rem;
  font-weight: 500;
}

.profile-container {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding: 2rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--bg-secondary);
  transition: opacity 0.2s ease;
}

.profile-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.profile-info h2 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.profile-handle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0 0 1rem 0;
}

.profile-description {
  color: var(--text-primary);
  line-height: 1.5;
  margin: 0 0 1rem 0;
}

.profile-stats {
  display: flex;
  gap: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.stat-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
  transition: color 0.2s;
}

.stat-btn:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.edit-profile-btn {
  padding: 0.75rem 1.5rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.follow-profile-btn {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.follow-profile-btn.following {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.follow-profile-btn.following:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.mute-profile-btn {
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.mute-profile-btn.muted {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.mute-profile-btn:hover {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.block-profile-btn {
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.block-profile-btn.blocked {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.block-profile-btn:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.profile-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.profile-modal {
  background: var(--bg-card);
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-primary);
}

.profile-modal-header {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1rem 0 1rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.profile-modal-content {
  padding: 0 2rem 2rem 2rem;
}

.follows-you-badge {
  display: inline-block;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  margin-left: 0.5rem;
  font-weight: 500;
}

.edit-profile-modal {
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

.edit-profile-form {
  background: var(--bg-card);
  padding: 2rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 400px;
}

.edit-profile-form h3 {
  margin: 0;
  color: var(--text-primary);
}

.edit-profile-form input,
.edit-profile-form textarea {
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
}

.edit-profile-form textarea {
  min-height: 100px;
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.form-actions button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.form-actions button:first-child {
  background: none;
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.form-actions button:last-child {
  background: #3b82f6;
  color: white;
}

.disabled-feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
}

.disabled-feature svg {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.disabled-feature h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.disabled-feature p {
  margin: 0;
  line-height: 1.5;
}

.thread-button-container {
  margin-bottom: 1rem;
}

.thread-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
}

.thread-btn:hover {
  background: var(--bg-primary);
  border-color: #3b82f6;
  color: #3b82f6;
}

.thread-btn svg {
  flex-shrink: 0;
}

.pull-refresh-indicator {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  opacity: 0.8;
  z-index: 10;
}

.pull-refresh-indicator.active {
  opacity: 1;
  transform: translateX(-50%) scale(1.05);
}

.refresh-spinner {
  animation: spin 1s linear infinite;
}

.pull-refresh-indicator.active .refresh-spinner {
  animation: spin 0.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pull-refresh-indicator span {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .feed-layout {
    flex-direction: column;
  }
  
  .feed-sidebar {
    display: none;
  }
  
  .feed-selector-mobile {
    display: block;
  }
  
  .moderation-sidebar {
    display: none;
  }
  
  .posts-container {
    max-width: none;
    padding: 0.5rem;
    touch-action: pan-y;
  }
  
  .nav-tab {
    padding: 0.75rem 1rem;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .nav-tab span {
    display: none;
  }
  
  .profile-header {
    flex-direction: column;
    text-align: center;
  }
  
  .profile-stats {
    justify-content: center;
  }
  
  .pull-refresh-indicator {
    top: -50px;
  }
  
  .profile-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .follow-profile-btn,
  .mute-profile-btn,
  .block-profile-btn {
    width: 100%;
    min-height: 48px;
  }
  
  .modal-content {
    margin: 1rem;
    max-height: calc(100vh - 2rem);
  }
  
  .thread-btn {
    min-height: 48px;
  }
  
  .drafts-container {
    padding: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }
}
</style>