import { defineStore } from 'pinia'
import axios from 'axios'

interface User {
  id: number
  did: string
  handle: string
  subscription_tier: string
  is_admin?: boolean
  avatar?: string
  display_name?: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null') as User | null,
    csrfToken: localStorage.getItem('csrfToken') || null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.is_admin || false,
  },

  actions: {
    async login(handle: string, bskyPassword: string) {
      try {
        const response = await axios.post('/api/auth/login', { handle, bskyPassword })
        this.token = response.data.accessToken || response.data.token
        this.user = response.data.user
        this.csrfToken = response.data.csrfToken
        localStorage.setItem('token', this.token!)
        localStorage.setItem('user', JSON.stringify(this.user))
        localStorage.setItem('csrfToken', this.csrfToken!)
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        axios.defaults.headers.common['X-CSRF-Token'] = this.csrfToken
        return true
      } catch (error: any) {
        console.error('Login failed:', error)
        // Re-throw if it's a special case (like password update prompt)
        if (error.response?.status === 409 && error.response?.data?.canUpdate) {
          throw error
        }
        return false
      }
    },

    async register(handle: string, bskyPassword: string, appPassword?: string, zeroTrustMode?: boolean, proxyUrl?: string, proxyApiKey?: string) {
      try {
        const response = await axios.post('/api/auth/register', {
          handle,
          bskyPassword,
          appPassword,
          zeroTrustMode,
          proxyUrl,
          proxyApiKey
        })
        this.token = response.data.accessToken || response.data.token
        this.user = response.data.user
        localStorage.setItem('token', this.token!)
        localStorage.setItem('user', JSON.stringify(this.user))
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        return true
      } catch (error) {
        console.error('Registration failed:', error)
        throw error
      }
    },

    demoLogin() {
      this.token = 'demo-token'
      this.user = {
        id: 999,
        did: 'did:demo:testuser',
        handle: 'demo.user',
        subscription_tier: 'free',
        is_admin: false,
        display_name: 'Demo User'
      }
      localStorage.setItem('token', this.token)
      localStorage.setItem('user', JSON.stringify(this.user))
      return true
    },

    logout() {
      this.token = null
      this.user = null
      this.csrfToken = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('csrfToken')
      delete axios.defaults.headers.common['Authorization']
      delete axios.defaults.headers.common['X-CSRF-Token']
    },

    async validateToken() {
      if (!this.token) return false
      if (this.token === 'demo-token') return true
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await axios.get('/api/auth/verify')
          return true
        } catch (error: any) {
          if (attempt === 3 || error.response?.status === 401) {
            this.logout()
            return false
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
      return false
    },

    initializeAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
      }
      if (this.csrfToken) {
        axios.defaults.headers.common['X-CSRF-Token'] = this.csrfToken
      }
      
      // Add CSRF token to all requests
      axios.interceptors.request.use(config => {
        if (this.csrfToken && ['put', 'post', 'delete'].includes(config.method?.toLowerCase() || '')) {
          config.headers['X-CSRF-Token'] = this.csrfToken
        }
        return config
      })
      
      // Add request interceptor for demo mode
      axios.interceptors.request.use(
        config => {
          if (this.token === 'demo-token') {
            // Return mock data based on URL
            const url = config.url || ''
            let mockData = []
            
            if (url.includes('trending-banned-users')) {
              mockData = [
                {
                  banned_handle: 'spammer123.bsky.social',
                  banned_did: 'did:plc:fake123456789',
                  display_name: 'Spam Bot',
                  avatar_url: null,
                  unique_banners: 12,
                  velocity: 4.8,
                  first_ban: '2024-12-07T10:00:00Z',
                  last_ban: '2024-12-08T15:30:00Z',
                  report_types: ['misleading-spam', 'misleading-bot'],
                  misleading_reports: 15,
                  harassment_reports: 8,
                  violence_reports: 2,
                  sexual_reports: 0,
                  child_safety_reports: 0,
                  self_harm_reports: 0,
                  rule_reports: 3,
                  is_hidden: false,
                  ban_status: {
                    banned_from: ['feed1'],
                    not_banned_from: ['feed2', 'global']
                  }
                },
                {
                  banned_handle: 'trollaccount.bsky.social',
                  banned_did: 'did:plc:fake987654321', 
                  display_name: 'Troll Account',
                  avatar_url: null,
                  unique_banners: 8,
                  velocity: 3.2,
                  first_ban: '2024-12-07T14:00:00Z',
                  last_ban: '2024-12-08T14:15:00Z',
                  report_types: ['harassment-troll', 'harassment-targeted'],
                  misleading_reports: 2,
                  harassment_reports: 18,
                  violence_reports: 1,
                  sexual_reports: 0,
                  child_safety_reports: 0,
                  self_harm_reports: 0,
                  rule_reports: 2,
                  is_hidden: false,
                  ban_status: {
                    banned_from: ['global'],
                    not_banned_from: []
                  }
                },
                {
                  banned_handle: 'fakebot.bsky.social',
                  banned_did: 'did:plc:fake555666777',
                  display_name: 'Fake Bot',
                  avatar_url: null,
                  unique_banners: 6,
                  velocity: 2.4,
                  first_ban: '2024-12-07T16:00:00Z',
                  last_ban: '2024-12-08T13:45:00Z',
                  report_types: ['misleading-impersonation', 'misleading-spam'],
                  misleading_reports: 12,
                  harassment_reports: 3,
                  violence_reports: 0,
                  sexual_reports: 0,
                  child_safety_reports: 0,
                  self_harm_reports: 0,
                  rule_reports: 1,
                  is_hidden: false,
                  ban_status: {
                    banned_from: ['feed1', 'feed2'],
                    not_banned_from: ['global']
                  }
                }
              ]
            } else if (url.includes('trending-removals')) {
              mockData = [
                {
                  post_uri: 'at://did:plc:fake1/app.bsky.feed.post/3l4k5j6h7g8f9d0s',
                  unique_removers: 8,
                  velocity: 3.2,
                  first_removal: '2024-12-08T12:00:00Z',
                  last_removal: '2024-12-08T16:20:00Z',
                  already_removed: false,
                  is_hidden: false,
                  total_reports: 34,
                  report_types: ['misleading-spam', 'misleading-scam'],
                  misleading_reports: 20,
                  harassment_reports: 8,
                  violence_reports: 2,
                  sexual_reports: 0,
                  child_safety_reports: 0,
                  self_harm_reports: 0,
                  rule_reports: 4,
                  feed_status: {
                    removed_from: ['feed1'],
                    exists_on: ['feed2']
                  },
                  post_details: {
                    text: 'This is a fake spam post for demo purposes...',
                    author: {
                      handle: 'spammer123.bsky.social',
                      displayName: 'Spam Bot',
                      avatar: null
                    },
                    createdAt: '2024-12-08T12:00:00Z'
                  }
                },
                {
                  post_uri: 'at://did:plc:fake2/app.bsky.feed.post/9m8n7b6v5c4x3z2a',
                  unique_removers: 6,
                  velocity: 2.4,
                  first_removal: '2024-12-08T11:30:00Z',
                  last_removal: '2024-12-08T15:45:00Z',
                  already_removed: false,
                  is_hidden: false,
                  total_reports: 28,
                  report_types: ['harassment-targeted', 'harassment-hate-speech'],
                  misleading_reports: 2,
                  harassment_reports: 22,
                  violence_reports: 3,
                  sexual_reports: 0,
                  child_safety_reports: 0,
                  self_harm_reports: 0,
                  rule_reports: 1,
                  feed_status: {
                    removed_from: ['feed1', 'feed2'],
                    exists_on: []
                  },
                  post_details: {
                    text: 'Fake harassment post content for demo...',
                    author: {
                      handle: 'trollaccount.bsky.social',
                      displayName: 'Troll Account',
                      avatar: null
                    },
                    createdAt: '2024-12-08T11:30:00Z'
                  }
                }
              ]
            } else if (url.includes('feeds')) {
              mockData = [
                {
                  feed_id: 'demo-feed-1',
                  feed_name: 'Demo Feed 1',
                  user_id: 999
                },
                {
                  feed_id: 'demo-feed-2', 
                  feed_name: 'Demo Feed 2',
                  user_id: 999
                }
              ]
            } else if (url.includes('global-settings')) {
              mockData = {
                global_threshold_misleading: 10,
                global_threshold_harassment: 5,
                global_threshold_violence: 3,
                global_threshold_sexual: 5,
                global_threshold_child_safety: 2,
                global_threshold_self_harm: 3,
                global_threshold_rule: 5,
                global_user_ban_threshold_misleading: 15,
                global_user_ban_threshold_harassment: 8,
                global_user_ban_threshold_violence: 5,
                global_user_ban_threshold_sexual: 8,
                global_user_ban_threshold_child_safety: 3,
                global_user_ban_threshold_self_harm: 5,
                global_user_ban_threshold_rule: 8,
                global_cross_type_percentage: 20,
                global_same_category_cross_percentage: 50,
                global_user_ban_cross_type_percentage: 20,
                global_user_ban_same_category_cross_percentage: 50
              }
            } else if (url.includes('banned-users')) {
              mockData = [
                {
                  banned_handle: 'banned1.bsky.social',
                  banned_did: 'did:plc:banned123',
                  banned_at: '2024-12-07T10:00:00Z',
                  list_type: 'global',
                  display_name: 'Banned User 1',
                  avatar_url: null,
                  bans: [{
                    list_type: 'global',
                    feed_name: 'Global Ban List',
                    reason: 'Spam'
                  }]
                }
              ]
            } else if (url.includes('user-activity')) {
              mockData = []
            } else if (url.includes('report-types')) {
              mockData = {
                reportTypes: {
                  misleading: {
                    name: 'Misleading',
                    subcategories: {
                      'misleading-spam': 'Spam',
                      'misleading-scam': 'Scam',
                      'misleading-bot': 'Fake account or bot'
                    }
                  },
                  harassment: {
                    name: 'Harassment',
                    subcategories: {
                      'harassment-troll': 'Trolling',
                      'harassment-targeted': 'Targeted harassment'
                    }
                  }
                }
              }
            } else if (url.includes('status')) {
              mockData = { enabled: false, running: false }
            } else if (url.includes('refresh-profile')) {
              mockData = { success: true, avatar: null, display_name: 'Demo User' }
            }
            
            // For demo mode, return mock data immediately
            if (mockData !== undefined && (Array.isArray(mockData) || Object.keys(mockData).length > 0)) {
              return Promise.reject({
                config,
                response: { data: mockData, status: 200 },
                isAxiosError: true,
                toJSON: () => ({})
              })
            }
          }
          return config
        },
        error => Promise.reject(error)
      )
      
      // Add response interceptor
      axios.interceptors.response.use(
        response => response,
        async error => {
          // Handle demo mode mock responses
          if (this.token === 'demo-token' && error.response) {
            return Promise.resolve(error.response)
          }
          
          // Only logout on auth errors, not subscription limit errors, Bluesky API errors, or moderation API errors
          if ((error.response?.status === 401 || (error.response?.status === 403 && !error.response?.data?.error?.includes('tier limited'))) && 
              this.token && this.token !== 'demo-token' && 
              !error.config?.url?.includes('/api/bluesky/') &&
              !error.config?.url?.includes('/api/moderation/')) {
            console.warn('Authentication failed - logging out')
            this.logout()
            window.location.href = '/login'
          }
          return Promise.reject(error)
        }
      )
    }
  }
})