import { Router } from 'express'
import { AtpAgent } from '@atproto/api'
import { GrazeService } from '../services/graze.js'
import { authenticateToken } from './auth.js'

const router = Router()

// Emergency remove all instances of a user from a list
router.post('/remove-from-list', authenticateToken, async (req: any, res) => {
  try {
    const { userHandle, listUri } = req.body
    const userId = req.user.userId
    
    if (!userHandle || !listUri) {
      return res.status(400).json({ error: 'User handle and list URI required' })
    }
    
    // Get user's credentials
    const { Database } = await import('../services/database.js')
    const db = Database.getInstance()
    const user = await db.getUserById(userId)
    
    if (!user || !user.bsky_password) {
      return res.status(400).json({ error: 'No Bluesky credentials found' })
    }
    
    // Authenticate with Bluesky
    const decryptedPassword = await GrazeService.decryptPassword(user.bsky_password)
    const agent = new AtpAgent({ service: 'https://bsky.social' })
    await agent.login({ identifier: user.handle, password: decryptedPassword })
    
    // Resolve target user handle to DID
    let targetDid: string
    try {
      if (userHandle.startsWith('did:')) {
        targetDid = userHandle
      } else {
        const resolved = await agent.api.com.atproto.identity.resolveHandle({ 
          handle: userHandle.replace('@', '') 
        })
        targetDid = resolved.data.did
      }
    } catch (error) {
      return res.status(400).json({ error: 'Could not resolve user handle' })
    }
    
    // Get all list items
    let allItems: any[] = []
    let cursor: string | undefined
    
    do {
      const listItems = await agent.com.atproto.repo.listRecords({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        cursor,
        limit: 100
      })
      
      allItems.push(...listItems.data.records)
      cursor = listItems.data.cursor
    } while (cursor)
    
    // Find all instances of the target user in the specified list
    const targetItems = allItems.filter(record => {
      const value = record.value as any
      return value.subject === targetDid && value.list === listUri
    })
    
    console.log(`Found ${targetItems.length} instances of ${userHandle} in list`)
    
    // Remove all instances
    for (const item of targetItems) {
      const rkey = item.uri.split('/').pop()!
      await agent.com.atproto.repo.deleteRecord({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        rkey: rkey
      })
    }
    
    res.json({ 
      success: true, 
      removed: targetItems.length,
      message: `Removed ${targetItems.length} instances of ${userHandle} from list`
    })
    
  } catch (error) {
    console.error('Emergency removal error:', error)
    res.status(500).json({ error: 'Emergency removal failed' })
  }
})

export default router