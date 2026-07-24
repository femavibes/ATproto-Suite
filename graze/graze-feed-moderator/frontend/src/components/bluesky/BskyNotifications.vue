<template>
  <div class="notifications-container">
    <div class="notifications-header">
      <h2>Notifications</h2>
      <div class="notification-actions">
        <button @click="markAllAsRead" class="action-btn" :disabled="unreadCount === 0">
          Mark all read
        </button>
        <button @click="refreshNotifications" class="action-btn" :disabled="loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="notification-filters">
      <button 
        v-for="filter in notificationFilters" 
        :key="filter.key"
        @click="activeFilter = filter.key"
        :class="{ active: activeFilter === filter.key }"
        class="filter-btn"
      >
        {{ filter.label }}
        <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
      </button>
    </div>
    
    <div v-if="loading" class="loading">
      Loading notifications...
    </div>
    
    <div v-else-if="filteredNotifications.length === 0" class="no-notifications">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="no-notif-icon">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <p>No notifications yet</p>
    </div>
    
    <div v-else class="notifications-list">
      <div 
        v-for="notification in filteredNotifications" 
        :key="notification.uri"
        class="notification-item"
        :class="{ unread: !notification.isRead }"
        @click="handleNotificationClick(notification)"
      >
        <div class="notification-header">
          <img 
            :src="notification.author?.avatar || '/icon-192.svg'" 
            :alt="notification.author?.displayName || notification.author?.handle"
            class="notification-avatar"
          >
          <div class="notification-user-info">
            <span class="notification-author">
              {{ notification.author?.displayName || notification.author?.handle }}
            </span>
            <span class="notification-handle">@{{ notification.author?.handle }}</span>
          </div>
          <span class="notification-time">{{ formatTime(notification.indexedAt) }}</span>
          <div class="notification-actions">
            <button v-if="!notification.isRead" @click.stop="markAsRead(notification)" class="mark-read-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </button>
            <button @click.stop="deleteNotification(notification)" class="delete-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="notification-content">
          <div class="notification-reason">
            <svg v-if="notification.reason === 'like'" width="16" height="16" viewBox="0 0 24 24" fill="#e91e63">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <svg v-else-if="notification.reason === 'repost'" width="16" height="16" viewBox="0 0 24 24" fill="#10b981">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
            <svg v-else-if="notification.reason === 'follow'" width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6">
              <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A2.996 2.996 0 0 0 16.5 6c-.77 0-1.47.3-2 .78-.53-.48-1.23-.78-2-.78-1.66 0-3 1.34-3 3 0 .24.04.47.09.7L8.04 10.9C7.54 8.1 5.1 6 2.5 6v2c1.86 0 3.43 1.27 3.87 3H4v2h2.5c-.44 1.73-2.01 3-3.87 3v2c2.6 0 5.04-2.1 5.54-4.9L9.91 12.3c-.05.23-.09.46-.09.7 0 1.66 1.34 3 3 3s3-1.34 3-3V9h2v13h4z"/>
            </svg>
            <svg v-else-if="notification.reason === 'reply'" width="16" height="16" viewBox="0 0 24 24" fill="#8b5cf6">
              <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
            </svg>
            <svg v-else-if="notification.reason === 'mention'" width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8v1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.93 0 3.5-1.57 3.5-3.5V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
            </svg>
            <svg v-else-if="notification.reason === 'subscribed-post'" width="16" height="16" viewBox="0 0 24 24" fill="#06b6d4">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            
            <span class="reason-text">
              {{ getReasonText(notification.reason) }}
            </span>
          </div>
          
          <div v-if="notification.record?.text" class="notification-text">
            {{ notification.record.text }}
          </div>
          
          <div v-if="notification.reasonSubject" class="original-post">
            <p class="original-text">{{ originalPostTexts.get(notification.reasonSubject) || 'Loading...' }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="cursor && !loading" class="load-more">
      <button @click="loadMoreNotifications" :disabled="loadingMore" class="load-more-btn">
        {{ loadingMore ? 'Loading...' : 'Load More' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { blueskyService } from '../../services/bluesky'

const notifications = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const cursor = ref<string | undefined>(undefined)
const activeFilter = ref('all')

const notificationFilters = computed(() => [
  { key: 'all', label: 'All', count: notifications.value.length },
  { key: 'likes', label: 'Likes', count: notifications.value.filter(n => n.reason === 'like').length },
  { key: 'subscribed', label: 'Subscribed', count: notifications.value.filter(n => n.reason === 'subscribed-post').length },
  { key: 'reposts', label: 'Reposts', count: notifications.value.filter(n => n.reason === 'repost').length },
  { key: 'follows', label: 'Follows', count: notifications.value.filter(n => n.reason === 'follow').length },
  { key: 'replies', label: 'Replies', count: notifications.value.filter(n => n.reason === 'reply').length },
  { key: 'mentions', label: 'Mentions', count: notifications.value.filter(n => n.reason === 'mention').length }
])

const filteredNotifications = computed(() => {
  if (activeFilter.value === 'all') return notifications.value
  
  const filterMap = {
    likes: 'like',
    reposts: 'repost', 
    follows: 'follow',
    replies: 'reply',
    mentions: 'mention',
    subscribed: 'subscribed-post'
  }
  
  return notifications.value.filter(n => n.reason === filterMap[activeFilter.value])
})

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.isRead).length
})

const loadNotifications = async (loadMore = false) => {
  if (loadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    notifications.value = []
    cursor.value = undefined
  }
  
  try {
    const result = await blueskyService.getNotifications(50, loadMore ? cursor.value : undefined)
    if (result.success) {
      const newNotifications = result.notifications || []
      
      if (loadMore) {
        notifications.value = [...notifications.value, ...newNotifications]
      } else {
        notifications.value = newNotifications
      }
      cursor.value = result.cursor
      
      // Fetch original post texts for notifications that have reasonSubject
      for (const notification of newNotifications) {
        if (notification.reasonSubject && !originalPostTexts.value.has(notification.reasonSubject)) {
          getOriginalPostText(notification)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load notifications:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMoreNotifications = () => {
  if (cursor.value && !loadingMore.value) {
    loadNotifications(true)
  }
}

const refreshNotifications = () => {
  loadNotifications(false)
}

const markAsRead = async (notification: any) => {
  try {
    // Mark as read locally
    notification.isRead = true
    
    // TODO: Implement server-side read tracking
    console.log('Marked notification as read:', notification.uri)
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
  }
}

const markAllAsRead = async () => {
  try {
    notifications.value.forEach(n => n.isRead = true)
    
    // TODO: Implement server-side bulk read marking
    console.log('Marked all notifications as read')
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
  }
}

const deleteNotification = async (notification: any) => {
  try {
    const index = notifications.value.findIndex(n => n.uri === notification.uri)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
    
    // TODO: Implement server-side notification deletion
    console.log('Deleted notification:', notification.uri)
  } catch (error) {
    console.error('Failed to delete notification:', error)
  }
}

const handleNotificationClick = (notification: any) => {
  // Mark as read when clicked
  if (!notification.isRead) {
    markAsRead(notification)
  }
  
  // Navigate to the relevant post/profile
  if (notification.reasonSubject) {
    // Navigate to post
    console.log('Navigate to post:', notification.reasonSubject)
  } else if (notification.reason === 'follow') {
    // Navigate to profile
    console.log('Navigate to profile:', notification.author.handle)
  }
}

const getReasonText = (reason: string) => {
  const reasonMap = {
    like: 'liked your post',
    repost: 'reposted your post',
    follow: 'followed you',
    reply: 'replied to your post',
    mention: 'mentioned you',
    quote: 'quoted your post',
    'subscribed-post': 'posted (subscribed)'
  }
  return reasonMap[reason] || reason
}

const originalPostTexts = ref(new Map())

const getOriginalPostText = async (notification: any) => {
  if (!notification.reasonSubject) return null
  
  const uri = notification.reasonSubject
  
  // Check cache first
  if (originalPostTexts.value.has(uri)) {
    return originalPostTexts.value.get(uri)
  }
  
  try {
    // Fetch the actual post
    const result = await blueskyService.getPost(uri)
    if (result.success && result.post?.record?.text) {
      const text = result.post.record.text
      originalPostTexts.value.set(uri, text)
      return text
    }
  } catch (error) {
    console.error('Failed to fetch original post:', error)
  }
  
  originalPostTexts.value.set(uri, 'Could not load post')
  return 'Could not load post'
}

const formatTime = (timestamp: string) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diff = now.getTime() - time.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  
  return time.toLocaleDateString()
}

onMounted(() => {
  loadNotifications()
})
</script>

<style scoped>
.notifications-container {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.notifications-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.notifications-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
}

.notification-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: #3b82f6;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notification-filters {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--bg-secondary);
}

.filter-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.filter-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-btn.active .filter-count {
  background: rgba(255, 255, 255, 0.3);
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.no-notifications {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.no-notif-icon {
  opacity: 0.5;
  margin-bottom: 1rem;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-item {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 1.5rem;
  display: block;
}

.notification-item:hover {
  background: var(--bg-secondary);
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.notification-item.unread {
  border-left: 4px solid #3b82f6;
  background: #f8faff;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  width: 100%;
}

.notification-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.notification-user-info {
  flex: 1;
  min-width: 0;
}

.notification-author {
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}

.notification-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: block;
}

.notification-time {
  color: var(--text-secondary);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.notification-content {
  width: 100%;
  display: block;
}

.notification-reason {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.reason-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.notification-text {
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 6px;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

.original-post {
  margin-top: 0.75rem;
  padding: 1rem;
  background: var(--bg-primary);
  border-left: 2px solid var(--border-primary);
  border-radius: 0;
}

.original-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}

.notification-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  align-items: flex-start;
}

.mark-read-btn, .delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.mark-read-btn:hover {
  background: #dcfce7;
  color: #16a34a;
}

.delete-btn:hover {
  background: #fef2f2;
  color: #dc2626;
}

.load-more {
  text-align: center;
  padding: 2rem;
}

.load-more-btn {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.load-more-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}


</style>