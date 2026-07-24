interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
}

class LinkPreviewService {
  private cache = new Map<string, LinkPreview>()

  async getPreview(url: string): Promise<LinkPreview | null> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url) || null
    }

    try {
      // Use a CORS proxy or backend endpoint to fetch metadata
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      
      if (!response.ok) {
        return this.createBasicPreview(url)
      }

      const data = await response.json()
      const preview: LinkPreview = {
        url,
        title: data.title,
        description: data.description,
        image: data.image,
        siteName: data.siteName,
        type: data.type
      }

      // Cache the result
      this.cache.set(url, preview)
      return preview
    } catch (error) {
      console.error('Failed to fetch link preview:', error)
      return this.createBasicPreview(url)
    }
  }

  private createBasicPreview(url: string): LinkPreview {
    try {
      const urlObj = new URL(url)
      return {
        url,
        title: urlObj.hostname,
        description: url,
        siteName: urlObj.hostname
      }
    } catch {
      return {
        url,
        title: url,
        description: url
      }
    }
  }

  extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return text.match(urlRegex) || []
  }
}

export const linkPreviewService = new LinkPreviewService()