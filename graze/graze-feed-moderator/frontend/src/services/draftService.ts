interface Draft {
  id: string
  text: string
  images: Array<{ file: File, preview: string, alt: string }>
  gif?: any
  replyTo?: any
  quotedPost?: any
  isThread?: boolean
  threadPosts?: Array<{ text: string, images: Array<{ file: File, preview: string, alt: string }>, videos: Array<{ file: File, preview: string }> }>
  createdAt: Date
  updatedAt: Date
}

class DraftService {
  private drafts = new Map<string, Draft>()
  private readonly STORAGE_KEY = 'bsky-drafts'
  private autoSaveTimeout: NodeJS.Timeout | null = null
  private listeners: (() => void)[] = []

  constructor() {
    this.loadDrafts()
  }

  onDraftsChanged(callback: () => void) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback())
  }

  private loadDrafts() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const draftsArray = JSON.parse(stored)
        draftsArray.forEach((draft: any) => {
          this.drafts.set(draft.id, {
            ...draft,
            createdAt: new Date(draft.createdAt),
            updatedAt: new Date(draft.updatedAt)
          })
        })
      }
    } catch (error) {
      console.error('Failed to load drafts:', error)
    }
  }

  private saveDrafts() {
    try {
      const draftsArray = Array.from(this.drafts.values())
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(draftsArray))
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to save drafts:', error)
    }
  }

  private generateDraftKey(replyTo?: any, quotedPost?: any): string {
    if (replyTo) {
      return `reply_${replyTo.post.uri}`
    }
    if (quotedPost) {
      return `quote_${quotedPost.post.uri}`
    }
    return 'new_post'
  }

  saveThreadDraft(posts: Array<{ text: string, images: Array<{ file: File, preview: string, alt: string }>, videos: Array<{ file: File, preview: string }> }>): string {
    const key = 'thread_draft'
    const now = new Date()
    
    const draft: Draft = {
      id: key,
      text: posts[0]?.text || '',
      images: posts[0]?.images || [],
      isThread: true,
      threadPosts: posts,
      createdAt: this.drafts.get(key)?.createdAt || now,
      updatedAt: now
    }

    this.drafts.set(key, draft)
    this.saveDrafts()
    return key
  }

  saveDraft(text: string, images: Array<{ file: File, preview: string, alt: string }> = [], replyTo?: any, quotedPost?: any, gif?: any): string {
    const key = this.generateDraftKey(replyTo, quotedPost)
    const now = new Date()
    
    const draft: Draft = {
      id: key,
      text,
      images,
      gif,
      replyTo,
      quotedPost,
      createdAt: this.drafts.get(key)?.createdAt || now,
      updatedAt: now
    }

    this.drafts.set(key, draft)
    this.saveDrafts()
    return key
  }

  autoSave(text: string, images: Array<{ file: File, preview: string, alt: string }> = [], replyTo?: any, quotedPost?: any, gif?: any): string {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
    }

    const key = this.generateDraftKey(replyTo, quotedPost)
    
    this.autoSaveTimeout = setTimeout(() => {
      if (text.trim().length > 0 || images.length > 0 || gif) {
        this.saveDraft(text, images, replyTo, quotedPost, gif)
      }
    }, 2000)
    
    return key
  }

  getDraft(id: string): Draft | undefined {
    return this.drafts.get(id)
  }

  getAllDrafts(): Draft[] {
    return Array.from(this.drafts.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  deleteDraft(id: string) {
    this.drafts.delete(id)
    this.saveDrafts()
  }

  clearAllDrafts() {
    this.drafts.clear()
    this.saveDrafts()
  }

  private generateId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const draftService = new DraftService()