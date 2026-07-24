import { Router } from 'express'
import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'

const router = Router()

interface LinkMetadata {
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
}

router.get('/link-preview', async (req, res) => {
  try {
    const { url } = req.query
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      },
      timeout: 10000
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const document = dom.window.document

    const metadata: LinkMetadata = {}

    // Extract title
    metadata.title = 
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      document.querySelector('title')?.textContent ||
      undefined

    // Extract description
    metadata.description = 
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      undefined

    // Extract image
    let imageUrl = 
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
      undefined

    // Make image URL absolute if it's relative
    if (imageUrl && !imageUrl.startsWith('http')) {
      const baseUrl = new URL(url)
      imageUrl = new URL(imageUrl, baseUrl.origin).href
    }
    metadata.image = imageUrl

    // Extract site name
    metadata.siteName = 
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      new URL(url).hostname

    // Extract type
    metadata.type = 
      document.querySelector('meta[property="og:type"]')?.getAttribute('content') ||
      'website'

    res.json(metadata)
  } catch (error) {
    console.error('Link preview error:', error)
    res.status(500).json({ error: 'Failed to fetch link preview' })
  }
})

export default router