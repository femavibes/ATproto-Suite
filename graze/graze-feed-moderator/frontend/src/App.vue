<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-left">
        <svg class="brand-logo" viewBox="0 0 40 40" fill="none">
          <defs>
            <linearGradient id="shield" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stop-color="#7c3aed"/>
              <stop offset="50%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
          </defs>
          <path d="M20 4L8 10v8c0 7.5 5.2 14.5 12 16 6.8-1.5 12-8.5 12-16v-8L20 4z" fill="url(#shield)"/>
          <text x="20" y="26" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="900" letter-spacing="1">MM</text>
        </svg>
      </div>
      <div class="nav-links" v-if="isAuthenticated">
        <router-link to="/dashboard" title="Dashboard" :class="{ 'router-link-active': $route.path === '/dashboard' || $route.path === '/auto-block' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </router-link>
        <router-link to="/bsky-client" title="ModMaster Client">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="m2 17 10 5 10-5"/>
            <path d="m2 12 10 5 10-5"/>
          </svg>
        </router-link>
        <router-link to="/feeds" title="Feeds">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </router-link>

        <router-link to="/settings" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </router-link>
        
        <!-- Notifications Bell -->
        <div class="notification-bell" @click="toggleNotifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="m13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span v-if="notifications.length > 0" class="notification-badge">{{ notifications.length }}</span>
          
          <!-- Notification Dropdown -->
          <div v-if="showNotifications" class="notification-dropdown">
            <div v-if="notifications.length === 0" class="notification-empty">
              No notifications
            </div>
            <div v-else>
              <div v-for="notification in notifications" :key="notification.id" 
                   :class="['notification-item', `notification-${notification.type}`]">
                <div class="notification-content" 
                     :class="{ 'clickable': notification.isGroup }"
                     @click="notification.isGroup ? toggleGroupExpansion(notification.id) : null">
                  <svg v-if="notification.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <svg v-else-if="notification.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                  </svg>
                  <svg v-else-if="notification.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <path d="M12 9v4"/>
                    <path d="m12 17 .01 0"/>
                  </svg>
                  <div class="notification-text">
                    <div class="notification-title">
                      {{ notification.title }}
                      <svg v-if="notification.isGroup" 
                           :class="['expand-icon', { 'expanded': notification.expanded }]"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </div>
                    <div class="notification-message">{{ notification.message }}</div>
                    
                    <!-- Expanded group details -->
                    <div v-if="notification.isGroup && notification.expanded" class="group-details">
                      <div v-for="item in notification.groupItems" :key="item.id" class="group-item">
                        {{ getGroupItemMessage(item) }}
                      </div>
                    </div>
                  </div>
                </div>
                <button @click="dismissNotification(notification.id)" class="notification-dismiss">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
    
    <!-- Demo Mode Banner -->
    <div v-if="isAuthenticated && authStore.token === 'demo-token'" class="demo-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="m2 17 10 5 10-5"/>
        <path d="m2 12 10 5 10-5"/>
      </svg>
      <div class="demo-text">
        <span class="demo-title">Demo Mode</span>
        <span class="demo-subtitle">Not all features active in demo mode</span>
      </div>
      <button @click="exitDemo" class="exit-demo-btn" title="Exit Demo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    
    <!-- Page Header -->
    <div v-if="isAuthenticated" class="page-header">
      <h1>{{ pageTitle }}</h1>
      <div class="user-info">
        <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" alt="Profile" class="profile-pic" />
        <div v-else class="profile-pic-placeholder" :title="`@${authStore.user?.handle}`">
          <span class="profile-initials">{{ getInitials(authStore.user?.handle || authStore.user?.display_name) }}</span>
        </div>
        <div class="user-details">
          <div v-if="authStore.user?.display_name" class="display-name">{{ authStore.user.display_name }}</div>
          <span class="handle">@{{ authStore.user?.handle }}</span>
        </div>
        <div class="tier" :class="tierClass">
          <svg v-if="authStore.user?.subscription_tier === 'free'" viewBox="0 0 24 24" fill="currentColor" class="tier-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else-if="authStore.user?.subscription_tier === 'paid'" viewBox="0 0 24 24" fill="currentColor" class="tier-icon">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <svg v-else-if="authStore.user?.subscription_tier === 'premium'" viewBox="0 0 24 24" fill="currentColor" class="tier-icon">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l.9-5.4-2.1 1.4L12 8l-3.1 2L6.8 8.6L7.7 14z"/>
          </svg>
        </div>
      </div>
    </div>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const route = useRoute()
const isAuthenticated = computed(() => authStore.isAuthenticated)

interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  isGroup?: boolean
  groupItems?: any[]
  expanded?: boolean
}

const notifications = ref<Notification[]>([])
const showNotifications = ref(false)
let checkInterval: number | null = null

const pageTitle = computed(() => {
  switch (route.name) {
    case 'Dashboard': return 'Dashboard'
    case 'BskyClient': return 'ModMaster Client'
    case 'Feeds': return 'My Feeds'
    case 'Admin': return 'Admin Panel'
    case 'Settings': return 'Settings'
    case 'AutoBlock': return 'Auto-Block'
    default: return ''
  }
})

const tierClass = computed(() => ({
  'tier-free': authStore.user?.subscription_tier === 'free',
  'tier-paid': authStore.user?.subscription_tier === 'paid',
  'tier-premium': authStore.user?.subscription_tier === 'premium'
}))

const logout = () => {
  authStore.logout()
  window.location.href = '/login'
}

const exitDemo = () => {
  authStore.logout()
  window.location.href = '/login'
}

const refreshProfile = async () => {
  try {
    const response = await fetch('/api/auth/refresh-profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      // Update user data in store
      if (authStore.user) {
        authStore.user.avatar = data.avatar
        authStore.user.display_name = data.display_name
        localStorage.setItem('user', JSON.stringify(authStore.user))
      }
    }
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  }
}

// Auto-refresh profile on app load if no avatar
if (authStore.user && !authStore.user.avatar) {
  refreshProfile()
}

const addNotification = (notification: Omit<Notification, 'id'>) => {
  const id = Date.now().toString()
  notifications.value.push({ ...notification, id })
}

const groupNotifications = (dbNotifications: any[]) => {
  const groups: { [key: string]: any[] } = {}
  
  // Group by type and recent time (last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  
  for (const notif of dbNotifications) {
    const createdAt = new Date(notif.created_at)
    if (createdAt < tenMinutesAgo) {
      // Old notifications don't get grouped
      groups[`single_${notif.id}`] = [notif]
      continue
    }
    
    let groupKey = notif.type
    
    // More specific grouping for autoblock
    if (notif.type === 'autoblock_success') {
      groupKey = 'autoblock_success'
    }
    // Group communal actions by type
    else if (notif.type === 'communal_post_removal') {
      groupKey = 'communal_post_removal'
    }
    else if (notif.type === 'communal_user_ban') {
      groupKey = 'communal_user_ban'
    }
    
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(notif)
  }
  
  return groups
}

const createGroupedNotification = (groupKey: string, notifications: any[]) => {
  const count = notifications.length
  const latest = notifications[0] // Most recent
  
  if (count === 1) {
    // Single notification, use original
    return {
      id: `db-${latest.id}`,
      type: getNotificationType(latest.type),
      title: latest.title,
      message: latest.message,
      isGroup: false
    }
  }
  
  // Multiple notifications, create grouped version
  if (groupKey === 'autoblock_success') {
    return {
      id: `group-autoblock-${Date.now()}`,
      type: 'success',
      title: `${count} Users Auto-Blocked`,
      message: `Click to see details`,
      isGroup: true,
      groupItems: notifications,
      expanded: false
    }
  }
  else if (groupKey === 'communal_post_removal') {
    return {
      id: `group-posts-${Date.now()}`,
      type: 'warning',
      title: `${count} Posts Removed`,
      message: `Click to see details`,
      isGroup: true,
      groupItems: notifications,
      expanded: false
    }
  }
  else if (groupKey === 'communal_user_ban') {
    return {
      id: `group-bans-${Date.now()}`,
      type: 'warning', 
      title: `${count} Users Banned`,
      message: `Click to see details`,
      isGroup: true,
      groupItems: notifications,
      expanded: false
    }
  }
  
  // Fallback
  return {
    id: `group-${groupKey}-${Date.now()}`,
    type: 'info',
    title: `${count} Notifications`,
    message: `Click to see details`,
    isGroup: true,
    groupItems: notifications,
    expanded: false
  }
}

const getNotificationType = (dbType: string) => {
  if (dbType === 'autoblock_success') return 'success'
  if (dbType === 'communal_post_removal') return 'warning'
  if (dbType === 'communal_user_ban') return 'warning'
  return 'info'
}

const dismissNotification = async (id: string) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
    
    // If it's a database notification, mark as read
    if (id.startsWith('db-')) {
      const dbId = id.replace('db-', '')
      try {
        await fetch(`/api/autoblock/notifications/${dbId}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authStore.token}`
          }
        })
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
    }
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const getInitials = (name: string | undefined) => {
  if (!name) return '?'
  if (name.startsWith('@')) name = name.slice(1)
  const parts = name.split('.')
  if (parts.length > 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

const toggleGroupExpansion = (notificationId: string) => {
  const notification = notifications.value.find(n => n.id === notificationId)
  if (notification && notification.isGroup) {
    notification.expanded = !notification.expanded
  }
}

const getGroupItemMessage = (item: any) => {
  if (item.type === 'autoblock_success') {
    const data = item.data ? JSON.parse(item.data) : {}
    return `@${data.offenderHandle || 'unknown'} → ${data.listName || 'block list'}`
  }
  else if (item.type === 'communal_post_removal') {
    const data = item.data ? JSON.parse(item.data) : {}
    return `Post by @${data.postAuthor?.split(':')[2]?.substring(0, 8) || 'unknown'} (${data.reportCount} ${data.reportType} reports)`
  }
  else if (item.type === 'communal_user_ban') {
    const data = item.data ? JSON.parse(item.data) : {}
    return `User banned from ${data.feedName || 'feed'} (${data.reportCount} ${data.reportType} reports)`
  }
  return item.message
}

const checkNotifications = async () => {
  if (!isAuthenticated.value || authStore.token === 'demo-token') return
  
  try {
    // Fetch account failures
    const statusResponse = await fetch('/api/autoblock/status', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    // Fetch notifications (autoblock events) - with error handling
    let notificationsResponse
    try {
      notificationsResponse = await fetch('/api/autoblock/notifications', {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
    } catch (notifError) {
      // Silently handle 500 errors from notifications endpoint
      notificationsResponse = { ok: false }
    }
    
    // Only process if at least one request succeeded
    if (!statusResponse.ok && !notificationsResponse.ok) {
      // Both failed, likely auth issue - let interceptor handle it
      return
    }
    
    // Clear existing notifications
    notifications.value = []
    
    // Add account failure notifications
    if (statusResponse.ok) {
      const failedAccounts = await statusResponse.json()
      
      if (failedAccounts.length > 0) {
        const mainFailed = failedAccounts.filter((a: any) => a.account_type === 'main')
        const monitoredFailed = failedAccounts.filter((a: any) => a.account_type === 'monitored')
        
        if (mainFailed.length > 0) {
          addNotification({
            id: 'account-main',
            type: 'error',
            title: 'Main Account Authentication Failed',
            message: `Your main account needs re-authentication. Auto-block is disabled.`
          })
        }
        
        if (monitoredFailed.length > 0) {
          addNotification({
            id: 'account-monitored',
            type: 'error', 
            title: `${monitoredFailed.length} Monitored Account${monitoredFailed.length > 1 ? 's' : ''} Failed`,
            message: `${monitoredFailed.map((a: any) => `@${a.handle}`).join(', ')} need${monitoredFailed.length === 1 ? 's' : ''} re-authentication.`
          })
        }
      }
    }
    
    // Add grouped notifications
    if (notificationsResponse.ok) {
      const dbNotifications = await notificationsResponse.json()
      
      // Only show unread notifications
      const unreadNotifications = dbNotifications.filter((n: any) => !n.is_read)
      
      // Group similar notifications
      const groups = groupNotifications(unreadNotifications)
      
      // Create notifications from groups
      for (const [groupKey, groupNotifications] of Object.entries(groups)) {
        const groupedNotif = createGroupedNotification(groupKey, groupNotifications)
        addNotification(groupedNotif)
      }
    }
    
  } catch (error: any) {
    // Only log errors that aren't authentication related
    if (error.response?.status !== 401 && error.response?.status !== 403) {
      console.error('Failed to check notifications:', error)
    }
    // If it's an auth error, the auth store interceptor will handle logout
  }
}

onMounted(async () => {
  // Load theme preferences
  if (isAuthenticated.value) {
    try {
      const response = await fetch('/api/user/preferences', {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      
      if (response.ok) {
        const prefs = await response.json()
        
        // Apply dark mode
        if (prefs.dark_mode) {
          document.documentElement.classList.add('dark')
        }
        
        // Apply theme
        if (prefs.theme && prefs.theme !== 'default') {
          document.documentElement.classList.add(`theme-${prefs.theme}`)
        }
      } else {
        // Fallback to localStorage
        const savedDarkMode = localStorage.getItem('darkMode')
        if (savedDarkMode === 'true') {
          document.documentElement.classList.add('dark')
        }
        
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme && savedTheme !== 'default') {
          document.documentElement.classList.add(`theme-${savedTheme}`)
        }
      }
    } catch (error) {
      // Fallback to localStorage
      const savedDarkMode = localStorage.getItem('darkMode')
      if (savedDarkMode === 'true') {
        document.documentElement.classList.add('dark')
      }
      
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme && savedTheme !== 'default') {
        document.documentElement.classList.add(`theme-${savedTheme}`)
      }
    }
    
    checkNotifications()
    checkInterval = setInterval(checkNotifications, 60000) // Check every minute
  } else {
    // Not authenticated, use localStorage
    const savedDarkMode = localStorage.getItem('darkMode')
    if (savedDarkMode === 'true') {
      document.documentElement.classList.add('dark')
    }
    
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme && savedTheme !== 'default') {
      document.documentElement.classList.add(`theme-${savedTheme}`)
    }
  }
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #f3f4f6;
  --bg-card: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-primary: #e5e7eb;
  --shadow: rgba(0,0,0,0.1);
}

:root.dark {
  --bg-primary: #1e293b;
  --bg-secondary: #0f172a;
  --bg-tertiary: #334155;
  --bg-card: #273548;
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --border-primary: #475569;
  --shadow: rgba(0,0,0,0.3);
}

:root.dark .author-name {
  color: #f1f5f9 !important;
}

:root.dark .author-handle {
  color: #cbd5e1 !important;
}

:root.dark .post-text {
  color: #f1f5f9 !important;
}

:root.dark .post-preview {
  background: #3f4d5e !important;
  border-color: #475569 !important;
}

:root.dark .user-display-name-large {
  color: #f1f5f9 !important;
}

:root.dark .user-handle-small {
  color: #cbd5e1 !important;
}

:root.dark .ban-method-group {
  background: #3f4d5e !important;
  border-color: #475569 !important;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: background-color 0.2s, color 0.2s;
  min-height: 100vh;
  position: relative;
}

/* Hide scrollbars globally */
* {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

*::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.navbar {
  background: var(--bg-primary);
  padding: 1rem;
  box-shadow: 0 2px 4px var(--shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-primary);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 0.25rem;
}

:root.dark .nav-left .brand-logo {
  background: #1e293b;
  padding: 3px;
  border-radius: 2px;
}



.brand-logo {
  height: 46px;
  width: 46px;
}

.brand-logo text {
  fill: white;
}

:root:not(.dark) .nav-left .brand-logo {
  background: #10b981;
  padding: 3px;
  border-radius: 2px;
}

.profile-pic {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
}

.profile-pic-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  background: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.nav-links {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-right: 0.25rem;
}

.nav-links a {
  text-decoration: none;
  color: var(--text-secondary);
  padding: 0.75rem;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-links a svg {
  width: 20px;
  height: 20px;
}

.nav-links a:hover {
  background: var(--bg-tertiary);
  color: #3b82f6;
}

.nav-links a.router-link-active {
  background: #3b82f6;
  color: white;
}



.page-header {
  background: var(--bg-primary);
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .page-header {
    max-width: 1200px;
    margin: 4px auto 0;
  }
}

@media (min-width: 640px) {
  .page-header {
    padding: 1rem;
    flex-wrap: nowrap;
  }
}

@media (min-width: 768px) {
  .page-header {
    padding: 1.5rem 2rem;
  }
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (min-width: 640px) {
  .user-info {
    gap: 1rem;
    flex-wrap: nowrap;
  }
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.display-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.handle {
  font-weight: 400;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

@media (min-width: 640px) {
  .display-name {
    font-size: 1.125rem;
  }
}

.tier {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tier-icon {
  width: 16px;
  height: 16px;
}

.tier-free {
  background: #f3f4f6;
  color: #374151;
}

.tier-paid {
  background: #dcfce7;
  color: #166534;
}

.tier-premium {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #92400e;
}

.notification-bell {
  position: relative;
  padding: 0.75rem;
  border-radius: 2px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-bell:hover {
  background: var(--bg-tertiary);
  color: #3b82f6;
}

.notification-bell svg {
  width: 20px;
  height: 20px;
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
}

.notification-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow);
  border: 1px solid var(--border-primary);
  min-width: 320px;
  max-width: 400px;
  z-index: 1000;
  margin-top: 0.5rem;
}

.notification-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.notification-item {
  padding: 1rem;
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-left: 4px solid;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item.notification-error {
  border-left-color: #ef4444;
}

.notification-item.notification-warning {
  border-left-color: #f59e0b;
}

.notification-item.notification-info {
  border-left-color: #3b82f6;
}

.notification-item.notification-success {
  border-left-color: #10b981;
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
}

.notification-content svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.notification-error svg {
  color: #ef4444;
}

.notification-warning svg {
  color: #f59e0b;
}

.notification-info svg {
  color: #3b82f6;
}

.notification-success svg {
  color: #10b981;
}

.notification-text {
  flex: 1;
}

.notification-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.notification-message {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.4;
}

.notification-dismiss {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-dismiss:hover {
  color: #6b7280;
}

.notification-dismiss svg {
  width: 14px;
  height: 14px;
}

.notification-content.clickable {
  cursor: pointer;
}

.notification-content.clickable:hover {
  background: rgba(0, 0, 0, 0.02);
}

.expand-icon {
  width: 14px;
  height: 14px;
  margin-left: 0.5rem;
  transition: transform 0.2s;
  display: inline-block;
  vertical-align: middle;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.group-details {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary);
}

.group-item {
  padding: 0.25rem 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.demo-banner {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.demo-banner svg {
  width: 16px;
  height: 16px;
}

.demo-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.demo-title {
  font-weight: 600;
}

.demo-subtitle {
  font-size: 0.75rem;
  opacity: 0.9;
}

.exit-demo-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.25rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: auto;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.exit-demo-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.exit-demo-btn svg {
  width: 14px;
  height: 14px;
}

.main-content {
  margin: 1rem auto;
  padding: 0 0.5rem;
}

@media (min-width: 768px) {
  .main-content {
    max-width: 1200px;
    padding: 0;
  }
}

/* Theme Styles */
:root.theme-pride body {
  background: repeating-linear-gradient(
    to right,
    #e40303 0%, #e40303 16.66%,
    #ff8c00 16.66%, #ff8c00 33.33%,
    #ffed00 33.33%, #ffed00 50%,
    #008018 50%, #008018 66.66%,
    #0066ff 66.66%, #0066ff 83.33%,
    #8b00ff 83.33%, #8b00ff 100%
  );
  background-size: 100px 100%;
}

:root.theme-trans body {
  background: repeating-linear-gradient(
    to right,
    #5bcefa 0%, #5bcefa 20%,
    #f5a9b8 20%, #f5a9b8 40%,
    #ffffff 40%, #ffffff 60%,
    #f5a9b8 60%, #f5a9b8 80%,
    #5bcefa 80%, #5bcefa 100%
  );
  background-size: 100px 100%;
}

:root.theme-blm body {
  background: 
    repeating-linear-gradient(
      45deg,
      #000000 0%, #000000 33.33%,
      #dc2626 33.33%, #dc2626 66.66%,
      #16a34a 66.66%, #16a34a 100%
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px, transparent 20px,
      rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px
    );
  background-size: 60px 60px, 100% 40px;
  position: relative;
}

:root.theme-blm body::before {
  content: 'BLACK LIVES MATTER ';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  font-size: 12px;
  font-weight: bold;
  color: rgba(255,255,255,0.1);
  z-index: -1;
  white-space: nowrap;
  overflow: hidden;
  animation: scroll-text 20s linear infinite;
  line-height: 40px;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

@keyframes scroll-text {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
</style>