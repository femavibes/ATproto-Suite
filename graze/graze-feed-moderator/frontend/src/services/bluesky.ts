import { BskyAgent } from '@atproto/api'

class BlueskyService {
  private agent: BskyAgent
  private isAuthenticated = false

  constructor() {
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    })
  }

  async login(identifier: string, password: string) {
    try {
      await this.agent.login({ identifier, password })
      this.isAuthenticated = true
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getTimeline(limit = 20, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.getTimeline({ limit, cursor })
      return {
        success: true,
        posts: response.data.feed,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getDiscover(limit = 20, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      // Use timeline as discover for now since discover endpoints are unreliable
      const response = await this.agent.getTimeline({ limit, cursor })
      return {
        success: true,
        posts: response.data.feed,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
  async getFeed(feedUri: string, limit = 20, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.app.bsky.feed.getFeed({
        feed: feedUri,
        limit,
        cursor
      })
      return {
        success: true,
        posts: response.data.feed,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getPopularFeeds() {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.app.bsky.unspecced.getPopularFeedGenerators({
        limit: 50
      })
      return {
        success: true,
        feeds: response.data.feeds
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async autoLogin() {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempting auto-login (attempt ${attempt + 1}/${maxRetries})...`)
        const token = localStorage.getItem('token')
        console.log('Token exists:', !!token)
        
        if (!token) {
          return { success: false, error: 'No token found' }
        }
        
        const response = await fetch('/api/user/bsky-credentials', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        console.log('API response status:', response.status)
        
        // If we get a 502, retry after delay
        if (response.status === 502 && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`Server not ready, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        if (response.ok) {
          const data = await response.json()
          console.log('API response data:', data)
          if (data.hasCredentials) {
            if (data.useZeroTrust) {
              // Use resumeSession for zero-trust tokens
              await this.agent.resumeSession({
                did: data.did,
                handle: data.handle,
                accessJwt: data.accessToken,
                refreshJwt: data.refreshToken,
                active: true
              })
              
              this.isAuthenticated = true
              return { success: true }
            } else {
              // Use handle/password login
              const result = await this.login(data.handle, data.password)
              console.log('Login result:', result)
              return result
            }
          }
        }
        
        return { success: false, error: 'No saved credentials' }
      } catch (error: any) {
        console.error(`Auto-login attempt ${attempt + 1} failed:`, error)
        
        // If it's a network error and we have retries left, wait and retry
        if (attempt < maxRetries - 1 && (error.name === 'TypeError' || error.message.includes('fetch'))) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`Network error, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        return { success: false, error: error.message }
      }
    }
    
    return { success: false, error: 'Max retries exceeded' }
  }

  async saveCredentials(identifier: string, password: string) {
    // Completely disabled to prevent overwriting app passwords
    console.log('Credential saving disabled to protect app passwords')
    return
  }

  async getPostThread(postUri: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.app.bsky.feed.getPostThread({
        uri: postUri,
        depth: 10
      })
      return {
        success: true,
        thread: response.data.thread
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  isLoggedIn() {
    return this.isAuthenticated
  }

  async searchPosts(query: string, limit = 25) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.app.bsky.feed.searchPosts({
        q: query,
        limit
      })
      return {
        success: true,
        posts: response.data.posts
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async searchUsers(query: string, limit = 25) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.searchActors({
        q: query,
        limit
      })
      return {
        success: true,
        actors: response.data.actors
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getPost(uri: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.app.bsky.feed.getPosts({
        uris: [uri]
      })
      return {
        success: true,
        post: response.data.posts[0]
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getNotifications(limit = 50, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.listNotifications({
        limit,
        cursor
      })
      return {
        success: true,
        notifications: response.data.notifications,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async createPost(text: string, images?: Array<{ file: File, alt: string }>, videos?: Array<{ file: File }>, gif?: any, replyTo?: any, quotedPost?: any) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      let embed: any = undefined
      let reply: any = undefined
      
      // Process rich text formatting
      const richText = this.processRichText(text)
      
      // Handle media (GIF, videos, or images - only one type allowed)
      if (gif) {
        // Handle GIF as external link embed
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: gif.images.original.url,
            title: gif.title || 'GIF',
            description: 'Animated GIF',
            thumb: {
              $type: 'blob',
              ref: {
                $link: gif.images.fixed_height_small.url
              },
              mimeType: 'image/gif',
              size: 0
            }
          }
        }
      } else if (videos && videos.length > 0) {
        // Handle video upload
        const uploadedVideo = await this.agent.uploadBlob(videos[0].file, {
          encoding: videos[0].file.type
        })
        embed = {
          $type: 'app.bsky.embed.video',
          video: uploadedVideo.data.blob
        }
      } else if (images && images.length > 0) {
        // Handle images
        const uploadedImages = []
        for (const img of images) {
          const response = await this.agent.uploadBlob(img.file, {
            encoding: img.file.type
          })
          uploadedImages.push({
            alt: img.alt || '',
            image: response.data.blob
          })
        }
        embed = {
          $type: 'app.bsky.embed.images',
          images: uploadedImages
        }
      }
      
      // Handle quote post
      if (quotedPost) {
        embed = {
          $type: 'app.bsky.embed.record',
          record: {
            uri: quotedPost.post.uri,
            cid: quotedPost.post.cid
          }
        }
      }
      
      // Handle reply
      if (replyTo) {
        reply = {
          root: {
            uri: replyTo.post.uri,
            cid: replyTo.post.cid
          },
          parent: {
            uri: replyTo.post.uri,
            cid: replyTo.post.cid
          }
        }
      }
      
      const response = await this.agent.post({
        text: richText.text,
        facets: richText.facets,
        embed,
        reply
      })
      
      return {
        success: true,
        post: response
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async createThread(posts: Array<{ text: string, images?: Array<{ file: File, alt: string }>, videos?: Array<{ file: File }> }>) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const createdPosts = []
      let previousPost: any = null
      
      for (const postData of posts) {
        let embed: any = undefined
        let reply: any = undefined
        
        // Handle media (videos or images)
        if (postData.videos && postData.videos.length > 0) {
          const uploadedVideo = await this.agent.uploadBlob(postData.videos[0].file, {
            encoding: postData.videos[0].file.type
          })
          embed = {
            $type: 'app.bsky.embed.video',
            video: uploadedVideo.data.blob
          }
        } else if (postData.images && postData.images.length > 0) {
          const uploadedImages = []
          for (const img of postData.images) {
            const response = await this.agent.uploadBlob(img.file, {
              encoding: img.file.type
            })
            uploadedImages.push({
              alt: img.alt || '',
              image: response.data.blob
            })
          }
          embed = {
            $type: 'app.bsky.embed.images',
            images: uploadedImages
          }
        }
        
        // If this is not the first post, make it a reply to the previous post
        if (previousPost) {
          reply = {
            root: {
              uri: createdPosts[0].uri,
              cid: createdPosts[0].cid
            },
            parent: {
              uri: previousPost.uri,
              cid: previousPost.cid
            }
          }
        }
        
        const response = await this.agent.post({
          text: postData.text,
          embed,
          reply
        })
        
        createdPosts.push(response)
        previousPost = response
      }
      
      return {
        success: true,
        posts: createdPosts
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async followUser(handle: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const result = await this.agent.follow(handle)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async muteUser(handle: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const result = await this.agent.mute(handle)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async unmuteUser(handle: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      await this.agent.unmute(handle)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async blockUser(handle: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const result = await this.agent.app.bsky.graph.block.create(
        { repo: this.agent.session?.did },
        { subject: handle, createdAt: new Date().toISOString() }
      )
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async unblockUser(blockUri: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      await this.agent.app.bsky.graph.block.delete(
        { repo: this.agent.session?.did, rkey: blockUri.split('/').pop() }
      )
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getFollows(actor: string, limit = 50, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.getFollows({ actor, limit, cursor })
      return {
        success: true,
        follows: response.data.follows,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getFollowers(actor: string, limit = 50, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.getFollowers({ actor, limit, cursor })
      return {
        success: true,
        followers: response.data.followers,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getBookmarks(limit = 50, cursor?: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      // Note: Native bookmarks may not be available in AT Protocol yet
      // This is a placeholder for when they become available
      const response = await this.agent.app.bsky.feed.getActorLikes({
        actor: this.agent.session?.did || '',
        limit,
        cursor
      })
      return {
        success: true,
        bookmarks: response.data.feed,
        cursor: response.data.cursor
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async bookmarkPost(postUri: string, postCid: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      // Using likes as bookmarks for now since native bookmarks aren't available
      const response = await this.agent.like(postUri, postCid)
      return { success: true, uri: response.uri }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async unbookmarkPost(likeUri: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      await this.agent.deleteLike(likeUri)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async getProfile(actor: string) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const response = await this.agent.getProfile({ actor })
      return {
        success: true,
        profile: response.data
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  async updateProfile(displayName?: string, description?: string, avatar?: File) {
    if (!this.isAuthenticated) throw new Error('Not authenticated')
    
    try {
      const updates: any = {}
      
      if (displayName !== undefined) updates.displayName = displayName
      if (description !== undefined) updates.description = description
      
      if (avatar) {
        const response = await this.agent.uploadBlob(avatar, {
          encoding: avatar.type
        })
        updates.avatar = response.data.blob
      }
      
      await this.agent.upsertProfile(updates)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  getPostUrl(post: any): string {
    // Extract handle and post ID from AT URI
    // Format: at://did:plc:xxx/app.bsky.feed.post/xxx
    const uri = post.uri
    const parts = uri.split('/')
    const postId = parts[parts.length - 1]
    const handle = post.author.handle
    
    return `https://bsky.app/profile/${handle}/post/${postId}`
  }

  private processRichText(text: string) {
    const facets = []
    let processedText = text
    
    // Process bold text (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g
    let match
    while ((match = boldRegex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [{
          $type: 'app.bsky.richtext.facet#tag',
          tag: 'bold'
        }]
      })
    }
    
    // Process italic text (*text*)
    const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g
    while ((match = italicRegex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [{
          $type: 'app.bsky.richtext.facet#tag',
          tag: 'italic'
        }]
      })
    }
    
    // Process mentions (@handle)
    const mentionRegex = /@([a-zA-Z0-9._-]+(?:\.[a-zA-Z]{2,})?)/g
    while ((match = mentionRegex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [{
          $type: 'app.bsky.richtext.facet#mention',
          did: `did:plc:${match[1]}` // Simplified - in real app, resolve handle to DID
        }]
      })
    }
    
    // Process hashtags (#tag)
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g
    while ((match = hashtagRegex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [{
          $type: 'app.bsky.richtext.facet#tag',
          tag: match[1]
        }]
      })
    }
    
    // Process URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g
    while ((match = urlRegex.exec(text)) !== null) {
      const start = match.index
      const end = match.index + match[0].length
      facets.push({
        index: {
          byteStart: start,
          byteEnd: end
        },
        features: [{
          $type: 'app.bsky.richtext.facet#link',
          uri: match[0]
        }]
      })
    }
    
    return {
      text: processedText,
      facets: facets.length > 0 ? facets : undefined
    }
  }

  getAgent() {
    return this.agent
  }
}

export const blueskyService = new BlueskyService()