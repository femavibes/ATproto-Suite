<template>
  <div class="analytics-container">
    <div class="analytics-header">
      <h2>Analytics Dashboard</h2>
      <div class="time-filter">
        <select v-model="timeRange" @change="loadAnalytics" class="time-select">
          <option value="7d">Past 7 days</option>
          <option value="30d">Past 30 days</option>
          <option value="90d">Past 90 days</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading analytics...</div>

    <div v-else class="analytics-content">
      <!-- Overview Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon">📝</div>
          <div class="metric-info">
            <div class="metric-value">{{ analytics.totalPosts }}</div>
            <div class="metric-label">Posts</div>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-icon">❤️</div>
          <div class="metric-info">
            <div class="metric-value">{{ analytics.totalLikes }}</div>
            <div class="metric-label">Total Likes</div>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-icon">🔄</div>
          <div class="metric-info">
            <div class="metric-value">{{ analytics.totalReposts }}</div>
            <div class="metric-label">Total Reposts</div>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-icon">💬</div>
          <div class="metric-info">
            <div class="metric-value">{{ analytics.totalReplies }}</div>
            <div class="metric-label">Total Replies</div>
          </div>
        </div>
      </div>

      <!-- Top Posts -->
      <div class="section">
        <h3>Top Performing Posts</h3>
        <div class="top-posts">
          <div v-for="post in analytics.topPosts" :key="post.uri" class="post-analytics">
            <div class="post-preview">
              <div class="post-text">{{ truncateText(post.text, 100) }}</div>
              <div class="post-date">{{ formatDate(post.createdAt) }}</div>
            </div>
            <div class="post-metrics">
              <div class="post-metric">
                <span class="metric-icon">❤️</span>
                <span>{{ post.likeCount || 0 }}</span>
              </div>
              <div class="post-metric">
                <span class="metric-icon">🔄</span>
                <span>{{ post.repostCount || 0 }}</span>
              </div>
              <div class="post-metric">
                <span class="metric-icon">💬</span>
                <span>{{ post.replyCount || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Engagement Chart -->
      <div class="section">
        <h3>Engagement Over Time</h3>
        <div class="chart-container">
          <div class="simple-chart">
            <div v-for="(day, index) in analytics.dailyStats" :key="index" class="chart-bar">
              <div 
                class="bar" 
                :style="{ height: `${(day.engagement / analytics.maxEngagement) * 100}%` }"
                :title="`${day.date}: ${day.engagement} engagements`"
              ></div>
              <div class="bar-label">{{ formatShortDate(day.date) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Follower Growth -->
      <div class="section">
        <h3>Profile Stats</h3>
        <div class="profile-stats">
          <div class="stat-item">
            <div class="stat-label">Followers</div>
            <div class="stat-value">{{ userProfile?.followersCount || 0 }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Following</div>
            <div class="stat-value">{{ userProfile?.followsCount || 0 }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Posts</div>
            <div class="stat-value">{{ userProfile?.postsCount || 0 }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { blueskyService } from '../../services/bluesky'

const loading = ref(true)
const timeRange = ref('30d')
const userProfile = ref(null)

const analytics = ref({
  totalPosts: 0,
  totalLikes: 0,
  totalReposts: 0,
  totalReplies: 0,
  topPosts: [],
  dailyStats: [],
  maxEngagement: 1
})

const loadAnalytics = async () => {
  loading.value = true
  
  try {
    // Get user profile for basic stats
    const agent = blueskyService.getAgent()
    const session = agent.session
    if (session) {
      const profileResult = await blueskyService.getProfile(session.handle)
      if (profileResult.success) {
        userProfile.value = profileResult.profile
      }
    }

    // Mock analytics data - in real implementation, this would come from AT Protocol or your backend
    const mockData = generateMockAnalytics(timeRange.value)
    analytics.value = mockData
    
  } catch (error) {
    console.error('Failed to load analytics:', error)
  } finally {
    loading.value = false
  }
}

const generateMockAnalytics = (range: string) => {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const dailyStats = []
  let maxEngagement = 0
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const engagement = Math.floor(Math.random() * 50) + 5
    maxEngagement = Math.max(maxEngagement, engagement)
    
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      engagement
    })
  }
  
  return {
    totalPosts: Math.floor(Math.random() * 100) + 20,
    totalLikes: Math.floor(Math.random() * 500) + 100,
    totalReposts: Math.floor(Math.random() * 200) + 50,
    totalReplies: Math.floor(Math.random() * 300) + 75,
    topPosts: [
      {
        uri: 'mock1',
        text: 'Just shipped a new feature for our PWA! The analytics dashboard is looking great 🚀',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 42,
        repostCount: 12,
        replyCount: 8
      },
      {
        uri: 'mock2', 
        text: 'Working on some exciting Bluesky integrations. The AT Protocol is really powerful!',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 38,
        repostCount: 15,
        replyCount: 6
      },
      {
        uri: 'mock3',
        text: 'Love how the decentralized social web is evolving. Building the future! 🌐',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        likeCount: 35,
        repostCount: 9,
        replyCount: 11
      }
    ],
    dailyStats,
    maxEngagement
  }
}

const truncateText = (text: string, length: number) => {
  return text.length > length ? text.substring(0, length) + '...' : text
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString()
}

const formatShortDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  loadAnalytics()
})
</script>

<style scoped>
.analytics-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.analytics-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.time-select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.metric-icon {
  font-size: 2rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.section {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.top-posts {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.post-analytics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.post-preview {
  flex: 1;
}

.post-text {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.post-date {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.post-metrics {
  display: flex;
  gap: 1rem;
}

.post-metric {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.chart-container {
  height: 200px;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.simple-chart {
  display: flex;
  align-items: end;
  height: 100%;
  gap: 4px;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar {
  background: #3b82f6;
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  transition: all 0.2s;
  cursor: pointer;
}

.bar:hover {
  background: #2563eb;
}

.bar-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  transform: rotate(-45deg);
  white-space: nowrap;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .analytics-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .post-analytics {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .post-metrics {
    justify-content: space-around;
  }
  
  .bar-label {
    transform: none;
    font-size: 0.625rem;
  }
}
</style>