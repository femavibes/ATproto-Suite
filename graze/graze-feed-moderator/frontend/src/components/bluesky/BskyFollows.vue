<template>
  <div class="follows-container">
    <div class="follows-tabs">
      <button @click="activeTab = 'following'" :class="{ active: activeTab === 'following' }" class="tab-btn">
        Following ({{ followingCount }})
      </button>
      <button @click="activeTab = 'followers'" :class="{ active: activeTab === 'followers' }" class="tab-btn">
        Followers ({{ followersCount }})
      </button>
    </div>

    <div class="follows-content">
      <div v-if="loading" class="loading">Loading...</div>
      
      <div v-else-if="activeTab === 'following'" class="follows-list">
        <div v-for="follow in following" :key="follow.did" class="follow-item">
          <img :src="follow.avatar || '/icon-192.svg'" class="follow-avatar" @click="$emit('viewProfile', follow.handle)">
          <div class="follow-info" @click="$emit('viewProfile', follow.handle)">
            <div class="follow-name">{{ follow.displayName || follow.handle }}</div>
            <div class="follow-handle">@{{ follow.handle }}</div>
            <div v-if="follow.description" class="follow-description">{{ follow.description }}</div>
          </div>
          <button @click="handleUnfollow(follow)" class="unfollow-btn">Unfollow</button>
        </div>
        
        <div v-if="followingCursor && !loading" class="load-more">
          <button @click="loadMoreFollowing" :disabled="loadingMore" class="load-more-btn">
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </button>
        </div>
      </div>

      <div v-else-if="activeTab === 'followers'" class="follows-list">
        <div v-for="follower in followers" :key="follower.did" class="follow-item">
          <img :src="follower.avatar || '/icon-192.svg'" class="follow-avatar" @click="$emit('viewProfile', follower.handle)">
          <div class="follow-info" @click="$emit('viewProfile', follower.handle)">
            <div class="follow-name">{{ follower.displayName || follower.handle }}</div>
            <div class="follow-handle">@{{ follower.handle }}</div>
            <div v-if="follower.description" class="follow-description">{{ follower.description }}</div>
          </div>
          <button v-if="!follower.viewer?.following" @click="handleFollow(follower)" class="follow-btn">Follow</button>
          <button v-else @click="handleUnfollow(follower)" class="unfollow-btn">Unfollow</button>
        </div>
        
        <div v-if="followersCursor && !loading" class="load-more">
          <button @click="loadMoreFollowers" :disabled="loadingMore" class="load-more-btn">
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { blueskyService } from '../../services/bluesky'

interface Props {
  userHandle?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  viewProfile: [handle: string]
}>()

const activeTab = ref('following')
const following = ref([])
const followers = ref([])
const followingCount = ref(0)
const followersCount = ref(0)
const followingCursor = ref<string | undefined>(undefined)
const followersCursor = ref<string | undefined>(undefined)
const loading = ref(false)
const loadingMore = ref(false)

const loadFollowing = async (loadMore = false) => {
  if (loadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    following.value = []
    followingCursor.value = undefined
  }

  try {
    const agent = blueskyService.getAgent()
    const session = agent.session
    const targetHandle = props.userHandle || session?.handle
    
    if (!targetHandle) return

    const result = await blueskyService.getFollows(
      targetHandle, 
      50, 
      loadMore ? followingCursor.value : undefined
    )
    
    if (result.success) {
      if (loadMore) {
        following.value = [...following.value, ...result.follows]
      } else {
        following.value = result.follows
        followingCount.value = result.follows.length
      }
      followingCursor.value = result.cursor
    }
  } catch (error) {
    console.error('Failed to load following:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadFollowers = async (loadMore = false) => {
  if (loadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    followers.value = []
    followersCursor.value = undefined
  }

  try {
    const agent = blueskyService.getAgent()
    const session = agent.session
    const targetHandle = props.userHandle || session?.handle
    
    if (!targetHandle) return

    const result = await blueskyService.getFollowers(
      targetHandle, 
      50, 
      loadMore ? followersCursor.value : undefined
    )
    
    if (result.success) {
      if (loadMore) {
        followers.value = [...followers.value, ...result.followers]
      } else {
        followers.value = result.followers
        followersCount.value = result.followers.length
      }
      followersCursor.value = result.cursor
    }
  } catch (error) {
    console.error('Failed to load followers:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMoreFollowing = () => {
  if (followingCursor.value && !loadingMore.value) {
    loadFollowing(true)
  }
}

const loadMoreFollowers = () => {
  if (followersCursor.value && !loadingMore.value) {
    loadFollowers(true)
  }
}

const handleFollow = async (user: any) => {
  try {
    const result = await blueskyService.followUser(user.handle)
    if (result.success) {
      user.viewer = { following: true }
    }
  } catch (error) {
    console.error('Follow error:', error)
  }
}

const handleUnfollow = async (user: any) => {
  try {
    const result = await blueskyService.unfollowUser(user.viewer?.following)
    if (result.success) {
      if (activeTab.value === 'following') {
        // Remove from following list
        following.value = following.value.filter(f => f.did !== user.did)
        followingCount.value--
      } else {
        // Update follower's follow status
        user.viewer = { following: false }
      }
    }
  } catch (error) {
    console.error('Unfollow error:', error)
  }
}

onMounted(() => {
  loadFollowing()
  if (activeTab.value === 'followers') {
    loadFollowers()
  }
})

// Watch for tab changes
const switchTab = (tab: string) => {
  activeTab.value = tab
  if (tab === 'followers' && followers.value.length === 0) {
    loadFollowers()
  }
}
</script>

<style scoped>
.follows-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.follows-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-card);
}

.tab-btn {
  flex: 1;
  padding: 1rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-primary);
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.follows-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.follows-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.follow-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  transition: background-color 0.2s;
}

.follow-item:hover {
  background: var(--bg-primary);
}

.follow-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  background: var(--bg-secondary);
}

.follow-info {
  flex: 1;
  cursor: pointer;
}

.follow-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.follow-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.follow-description {
  color: var(--text-primary);
  font-size: 0.875rem;
  line-height: 1.4;
}

.follow-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s;
}

.follow-btn:hover {
  background: #2563eb;
}

.unfollow-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.unfollow-btn:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.load-more {
  text-align: center;
  margin-top: 1rem;
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

@media (max-width: 768px) {
  .follows-content {
    padding: 0.5rem;
  }
  
  .follow-item {
    padding: 0.75rem;
  }
  
  .follow-avatar {
    width: 40px;
    height: 40px;
  }
}
</style>