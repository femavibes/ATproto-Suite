<template>
  <div class="search-container">
    <div class="search-header">
      <div class="search-input-container">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input 
          v-model="searchQuery"
          @keyup.enter="performSearch"
          placeholder="Search Bluesky..."
          class="search-input"
        >
        <button v-if="searchQuery" @click="clearSearch" class="clear-btn">×</button>
      </div>
      
      <div class="search-filters">
        <button 
          v-for="filter in searchFilters" 
          :key="filter.key"
          @click="activeFilter = filter.key"
          :class="{ active: activeFilter === filter.key }"
          class="filter-btn"
        >
          {{ filter.label }}
        </button>
        <button @click="showAdvancedFilters = !showAdvancedFilters" class="advanced-filter-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
          </svg>
          Filters
        </button>
      </div>
      
      <!-- Advanced Filters Panel -->
      <div v-if="showAdvancedFilters" class="advanced-filters">
        <div class="filter-row">
          <label>Date Range:</label>
          <select v-model="dateFilter" class="filter-select">
            <option value="">Any time</option>
            <option value="1d">Past 24 hours</option>
            <option value="7d">Past week</option>
            <option value="30d">Past month</option>
            <option value="custom">Custom range</option>
          </select>
          <div v-if="dateFilter === 'custom'" class="date-inputs">
            <input v-model="startDate" type="date" class="date-input">
            <span>to</span>
            <input v-model="endDate" type="date" class="date-input">
          </div>
        </div>
        
        <div class="filter-row">
          <label>From User:</label>
          <input v-model="userFilter" placeholder="@username" class="filter-input">
        </div>
        
        <div class="filter-row">
          <label>Content Type:</label>
          <div class="content-type-filters">
            <label class="checkbox-label">
              <input v-model="contentFilters.text" type="checkbox">
              Text posts
            </label>
            <label class="checkbox-label">
              <input v-model="contentFilters.images" type="checkbox">
              With images
            </label>
            <label class="checkbox-label">
              <input v-model="contentFilters.links" type="checkbox">
              With links
            </label>
            <label class="checkbox-label">
              <input v-model="contentFilters.replies" type="checkbox">
              Include replies
            </label>
          </div>
        </div>
        
        <div class="filter-row">
          <label>Language:</label>
          <select v-model="languageFilter" class="filter-select">
            <option value="">Any language</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
        
        <div class="filter-actions">
          <button @click="clearFilters" class="clear-filters-btn">Clear Filters</button>
          <button @click="applyFilters" class="apply-filters-btn">Apply Filters</button>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      Searching...
    </div>
    
    <div v-else-if="searchResults.length === 0 && hasSearched" class="no-results">
      No results found for "{{ searchQuery }}"
    </div>
    
    <div v-else class="search-results">
      <!-- User Results -->
      <div v-if="activeFilter === 'users' || activeFilter === 'all'" class="results-section">
        <h3 v-if="activeFilter === 'all' && userResults.length > 0">Users</h3>
        <div v-for="user in userResults" :key="user.did" class="user-result">
          <img :src="user.avatar || '/icon-192.svg'" :alt="user.displayName || user.handle" class="user-avatar">
          <div class="user-info">
            <div class="user-name">{{ user.displayName || user.handle }}</div>
            <div class="user-handle">@{{ user.handle }}</div>
            <div v-if="user.description" class="user-description">{{ user.description }}</div>
          </div>
          <button @click="followUser(user)" class="follow-btn" :class="{ following: user.viewer?.following }">
            {{ user.viewer?.following ? 'Following' : 'Follow' }}
          </button>
        </div>
      </div>
      
      <!-- Post Results -->
      <div v-if="activeFilter === 'posts' || activeFilter === 'all'" class="results-section">
        <h3 v-if="activeFilter === 'all' && postResults.length > 0">Posts</h3>
        <BskyPost 
          v-for="post in postResults" 
          :key="post.post.uri"
          :post="post"
          @reply="$emit('reply', $event)"
          @repost="$emit('repost', $event)"
          @quote="$emit('quote', $event)"
          @like="$emit('like', $event)"
          @moderate="$emit('moderate', $event, $event)"
        />
      </div>
      
      <!-- Hashtag Results -->
      <div v-if="activeFilter === 'hashtags' || activeFilter === 'all'" class="results-section">
        <h3 v-if="activeFilter === 'all' && hashtagResults.length > 0">Hashtags</h3>
        <div v-for="hashtag in hashtagResults" :key="hashtag.tag" class="hashtag-result">
          <div class="hashtag-info">
            <div class="hashtag-name">#{{ hashtag.tag }}</div>
            <div class="hashtag-count">{{ hashtag.count }} posts</div>
          </div>
          <button @click="searchHashtag(hashtag.tag)" class="hashtag-btn">View Posts</button>
        </div>
      </div>
    </div>
    
    <!-- Recent Searches -->
    <div v-if="!hasSearched && recentSearches.length > 0" class="recent-searches">
      <h3>Recent Searches</h3>
      <div class="recent-list">
        <button 
          v-for="search in recentSearches" 
          :key="search"
          @click="searchQuery = search; performSearch()"
          class="recent-item"
        >
          {{ search }}
        </button>
      </div>
    </div>
    
    <!-- Trending -->
    <div v-if="!hasSearched" class="trending">
      <h3>Trending</h3>
      <div class="trending-list">
        <button 
          v-for="trend in trendingTopics" 
          :key="trend"
          @click="searchQuery = trend; performSearch()"
          class="trending-item"
        >
          #{{ trend }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BskyPost from './BskyPost.vue'
import { blueskyService } from '../../services/bluesky'

defineEmits<{
  reply: [post: any]
  repost: [post: any]
  quote: [post: any]
  like: [post: any]
  moderate: [post: any, action: string]
}>()

const searchQuery = ref('')
const activeFilter = ref('all')
const loading = ref(false)
const hasSearched = ref(false)
const searchResults = ref([])
const userResults = ref([])
const postResults = ref([])
const hashtagResults = ref([])
const recentSearches = ref<string[]>([])
const trendingTopics = ref(['bluesky', 'atprotocol', 'decentralized', 'social'])

// Advanced filters
const showAdvancedFilters = ref(false)
const dateFilter = ref('')
const startDate = ref('')
const endDate = ref('')
const userFilter = ref('')
const languageFilter = ref('')
const contentFilters = ref({
  text: true,
  images: false,
  links: false,
  replies: false
})

const searchFilters = [
  { key: 'all', label: 'All' },
  { key: 'posts', label: 'Posts' },
  { key: 'users', label: 'Users' },
  { key: 'hashtags', label: 'Hashtags' }
]

const performSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  loading.value = true
  hasSearched.value = true
  
  try {
    // Add to recent searches
    if (!recentSearches.value.includes(searchQuery.value)) {
      recentSearches.value.unshift(searchQuery.value)
      recentSearches.value = recentSearches.value.slice(0, 5)
      localStorage.setItem('bsky-recent-searches', JSON.stringify(recentSearches.value))
    }
    
    // Build search parameters with filters
    const searchParams = buildSearchParams()
    
    // Perform different searches based on active filter
    if (activeFilter.value === 'all' || activeFilter.value === 'posts') {
      const postSearch = await blueskyService.searchPosts(searchParams.query, searchParams.limit)
      if (postSearch.success) {
        let posts = postSearch.posts || []
        
        // Apply client-side filters
        posts = applyClientFilters(posts)
        
        postResults.value = posts
      }
    }
    
    if (activeFilter.value === 'all' || activeFilter.value === 'users') {
      const userSearch = await blueskyService.searchUsers(searchParams.query, searchParams.limit)
      if (userSearch.success) {
        userResults.value = userSearch.actors || []
      }
    }
    
    if (activeFilter.value === 'all' || activeFilter.value === 'hashtags') {
      // Mock hashtag search - implement when available in AT Protocol
      hashtagResults.value = [
        { tag: searchQuery.value.replace('#', ''), count: Math.floor(Math.random() * 1000) + 100 }
      ]
    }
    
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    loading.value = false
  }
}

const buildSearchParams = () => {
  let query = searchQuery.value
  
  // Add user filter to query
  if (userFilter.value) {
    query += ` from:${userFilter.value.replace('@', '')}`
  }
  
  return {
    query,
    limit: 25
  }
}

const applyClientFilters = (posts: any[]) => {
  return posts.filter(postItem => {
    const post = postItem.post
    
    // Date filter
    if (dateFilter.value) {
      const postDate = new Date(post.createdAt)
      const now = new Date()
      
      if (dateFilter.value === '1d') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        if (postDate < oneDayAgo) return false
      } else if (dateFilter.value === '7d') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (postDate < oneWeekAgo) return false
      } else if (dateFilter.value === '30d') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (postDate < oneMonthAgo) return false
      } else if (dateFilter.value === 'custom' && startDate.value && endDate.value) {
        const start = new Date(startDate.value)
        const end = new Date(endDate.value)
        if (postDate < start || postDate > end) return false
      }
    }
    
    // Content type filters
    if (!contentFilters.value.text && !post.embed) return false
    if (!contentFilters.value.images && post.embed?.images) return false
    if (!contentFilters.value.links && post.embed?.external) return false
    if (!contentFilters.value.replies && post.reply) return false
    
    // Language filter (basic implementation)
    if (languageFilter.value) {
      // This is a simplified language detection - in a real app, use proper language detection
      const text = post.record?.text || ''
      if (languageFilter.value === 'en' && !/[a-zA-Z]/.test(text)) return false
    }
    
    return true
  })
}

const clearFilters = () => {
  dateFilter.value = ''
  startDate.value = ''
  endDate.value = ''
  userFilter.value = ''
  languageFilter.value = ''
  contentFilters.value = {
    text: true,
    images: false,
    links: false,
    replies: false
  }
}

const applyFilters = () => {
  if (hasSearched.value) {
    performSearch()
  }
  showAdvancedFilters.value = false
}

const clearSearch = () => {
  searchQuery.value = ''
  hasSearched.value = false
  searchResults.value = []
  userResults.value = []
  postResults.value = []
  hashtagResults.value = []
}

const followUser = async (user: any) => {
  try {
    const agent = blueskyService.getAgent()
    if (user.viewer?.following) {
      await agent.deleteFollow(user.viewer.following)
      user.viewer.following = undefined
    } else {
      const result = await agent.follow(user.did)
      user.viewer = user.viewer || {}
      user.viewer.following = result.uri
    }
  } catch (error) {
    console.error('Failed to toggle follow:', error)
  }
}

const searchHashtag = (hashtag: string) => {
  searchQuery.value = `#${hashtag}`
  activeFilter.value = 'posts'
  performSearch()
}

onMounted(() => {
  // Load recent searches from localStorage
  const saved = localStorage.getItem('bsky-recent-searches')
  if (saved) {
    recentSearches.value = JSON.parse(saved)
  }
})
</script>

<style scoped>
.search-container {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
}

.search-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.search-icon {
  color: var(--text-secondary);
  margin-right: 0.5rem;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.clear-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-filters {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--bg-primary);
}

.filter-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.advanced-filter-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.advanced-filter-btn:hover {
  background: var(--bg-primary);
}

.advanced-filters {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-row label {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 100px;
}

.filter-select,
.filter-input {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.filter-select {
  min-width: 150px;
}

.filter-input {
  min-width: 200px;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.content-type-filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  min-width: auto !important;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.clear-filters-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.apply-filters-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.search-results {
  max-height: 600px;
  overflow-y: auto;
}

.results-section {
  padding: 1rem;
}

.results-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  border-bottom: 1px solid var(--border-primary);
  padding-bottom: 0.5rem;
}

.user-result {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  transition: background-color 0.2s;
  margin-bottom: 0.5rem;
}

.user-result:hover {
  background: var(--bg-primary);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
}

.user-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.user-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.follow-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.follow-btn.following {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.hashtag-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-radius: 8px;
  transition: background-color 0.2s;
  margin-bottom: 0.5rem;
}

.hashtag-result:hover {
  background: var(--bg-primary);
}

.hashtag-name {
  font-weight: 600;
  color: #3b82f6;
  font-size: 1.125rem;
}

.hashtag-count {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.hashtag-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.recent-searches, .trending {
  padding: 1rem;
  border-top: 1px solid var(--border-primary);
}

.recent-searches h3, .trending h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.recent-list, .trending-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.recent-item, .trending-item {
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.recent-item:hover, .trending-item:hover {
  background: #f0f9ff;
  border-color: #3b82f6;
  color: #3b82f6;
}
</style>