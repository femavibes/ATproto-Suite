<template>
  <div class="admin-activity">
    <div class="page-header">
      <h1>📊 Moderation Activity</h1>
      <router-link to="/dashboard" class="back-btn">← Back to Dashboard</router-link>
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

    <div class="activity-log">
      <h2>Recent Activity</h2>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const activities = ref([])

const totalActions = computed(() => activities.value.length)
const uniquePosts = computed(() => {
  const posts = new Set(activities.value.map(a => a.post_uri).filter(Boolean))
  return posts.size
})
const activeFeeds = computed(() => {
  const feeds = new Set(activities.value.map(a => a.feed_id).filter(Boolean))
  return feeds.size
})

onMounted(async () => {
  await loadActivity()
})

const loadActivity = async () => {
  try {
    const response = await axios.get('/api/admin/activity')
    activities.value = response.data
  } catch (error) {
    console.error('Failed to load activity:', error)
  }
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
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-btn {
  background: #6b7280;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
}

.activity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  font-size: 2rem;
  font-weight: bold;
  color: #1d4ed8;
  margin: 0;
}

.activity-log {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.log-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th {
  background: #f9fafb;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
}

.time {
  color: #6b7280;
  white-space: nowrap;
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
  background: #f3f4f6;
  color: #374151;
}

.moderator {
  font-weight: 500;
}

.feed {
  color: #059669;
}

.reason {
  color: #6b7280;
  font-style: italic;
}

.post-uri {
  font-family: monospace;
  color: #6b7280;
}

.uri-short {
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
}
</style>