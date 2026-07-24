import { Router } from 'express'
import { Pool } from 'pg'
import { AtpAgent } from '@atproto/api'
import crypto from 'crypto'
import { authenticateToken } from './auth.js'
import { checkApiRateLimit } from '../middleware/rateLimiter.js'
import { SessionManager } from '../services/sessionManager.js'
import { PasswordService } from '../services/passwordService.js'
import { Database } from '../services/database.js'

const router = Router()
const db = Database.getInstance()

async function resolveHandle(handle: string): Promise<{ did: string; profile: any }> {
  try {
    // Use public API endpoint which doesn't require auth
    const actor = handle.startsWith('did:') ? handle : handle
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`)
    }
    
    const profile = await response.json()
    return { did: profile.did, profile }
  } catch (error: any) {
    throw new Error(`Failed to resolve handle ${handle}: ${error.message}`)
  }
}

// Get monitored accounts
router.get('/accounts', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    
    const result = await pool.query(`
      SELECT 
        ma.id, ma.did, ma.handle, ma.avatar_url, ma.display_name, ma.is_active, ma.use_zero_trust, ma.created_at,
        (
          SELECT json_agg(json_build_object('id', bl.id, 'name', bl.list_name, 'uri', bl.list_uri))
          FROM block_lists bl
          WHERE bl.user_id = $1 AND (bl.is_global = false AND bl.target_account_id = ma.id)
        ) as assigned_lists
      FROM monitored_accounts ma
      WHERE ma.owner_user_id = $1 
      ORDER BY ma.created_at DESC
    `, [userId])
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching monitored accounts:', error)
    res.status(500).json({ error: 'Failed to fetch monitored accounts' })
  }
})

// Add monitored account
router.post('/accounts', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const { handle, appPassword, useZeroTrust } = req.body
    const pool: Pool = req.app.get('db')
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle required' })
    }
    
    // Check if user has zero-trust enabled
    const userResult = await pool.query('SELECT zero_trust_mode FROM user_profiles WHERE id = $1', [userId])
    const userZeroTrust = userResult.rows[0]?.zero_trust_mode
    
    // If zero-trust is enabled for user OR explicitly requested for this account, skip password requirement
    if (!userZeroTrust && !useZeroTrust && !appPassword) {
      return res.status(400).json({ error: 'App password required (or enable zero-trust)' })
    }
    
    // Resolve handle to get DID and profile info
    const { did, profile } = await resolveHandle(handle)
    
    const shouldUseZeroTrust = userZeroTrust || useZeroTrust
    
    // Encrypt the app password if provided, otherwise use placeholder for zero-trust
    const encryptedPassword = appPassword 
      ? await PasswordService.encryptPassword(appPassword)
      : await PasswordService.encryptPassword('ZERO_TRUST_PLACEHOLDER')
    
    // Store monitored account with proper DID
    const result = await pool.query(`
      INSERT INTO monitored_accounts (owner_user_id, did, handle, app_password, avatar_url, display_name, use_zero_trust)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ON CONSTRAINT monitored_accounts_owner_user_id_did_key
      DO UPDATE SET 
        handle = EXCLUDED.handle,
        app_password = EXCLUDED.app_password,
        avatar_url = EXCLUDED.avatar_url,
        display_name = EXCLUDED.display_name,
        use_zero_trust = EXCLUDED.use_zero_trust,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, did, handle, avatar_url, display_name, is_active, use_zero_trust, created_at
    `, [userId, did, profile.handle, encryptedPassword, profile.avatar, profile.displayName, shouldUseZeroTrust])
    
    res.json(result.rows[0])
  } catch (error: any) {
    console.error('Error adding monitored account:', error)
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a few minutes and try again.' })
    }
    
    if (error.status === 401 || error.status === 400) {
      return res.status(400).json({ error: 'Could not resolve handle: ' + (error.message || 'Invalid handle') })
    }
    
    res.status(500).json({ error: 'Failed to add monitored account: ' + (error.message || 'Unknown error') })
  }
})

// Get autoblock configuration for user
router.get('/config', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId
    console.log('Autoblock config request for userId:', userId)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const config = await db.getAutoblockAccountLists(userId)
    
    // Get user's accounts (main + monitored)
    const mainAccount = await db.pool.query(`
      SELECT handle FROM user_profiles WHERE id = $1
    `, [userId])
    
    const monitoredAccounts = await db.pool.query(`
      SELECT handle FROM monitored_accounts WHERE owner_user_id = $1
    `, [userId])
    
    // Get existing banned user lists (global + feeds)
    const existingLists = []
    
    // Add global option (always has config - it's the banned_users table)
    existingLists.push({ id: 'global', name: 'Global List', type: 'global', hasConfig: true })
    
    // Add feed-specific lists
    const feeds = await db.getUserFeeds(userId)
    
    // Check which feeds have Bluesky lists configured (feed_ban_list field)
    feeds.forEach(feed => {
      const hasConfig = !!(feed.feed_ban_list && feed.feed_ban_list.trim())
      existingLists.push({ 
        id: feed.feed_id, 
        name: feed.feed_name, 
        type: 'feed',
        hasConfig: hasConfig
      })
    })
    
    res.json({
      config,
      accounts: {
        main: mainAccount.rows[0]?.handle,
        monitored: monitoredAccounts.rows.map(row => row.handle)
      },
      lists: existingLists
    })
  } catch (error) {
    console.error('Error getting autoblock config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Set autoblock configuration
router.post('/config', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { accountHandle, accountType, listType, feedId } = req.body
    
    if (!accountHandle || !accountType || !listType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    await db.setAutoblockAccountList(userId, accountHandle, accountType, listType, feedId)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error setting autoblock config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Remove autoblock configuration
router.delete('/config', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { accountHandle, listType, feedId } = req.body
    
    if (!accountHandle || !listType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    await db.removeAutoblockAccountList(userId, accountHandle, listType, feedId)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error removing autoblock config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get block lists
router.get('/lists', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    
    const result = await pool.query(`
      SELECT bl.*, ua.handle as target_account_handle
      FROM block_lists bl
      LEFT JOIN user_accounts ua ON bl.target_account_id = ua.id
      WHERE bl.user_id = $1 
      ORDER BY bl.created_at DESC
    `, [userId])
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching lists:', error)
    res.status(500).json({ error: 'Failed to fetch lists' })
  }
})

// Get recent activity
router.get('/activity', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    
    const result = await pool.query(`
      WITH grouped_blocks AS (
        SELECT 
          bu.banned_handle as blocker_handle,
          MIN(bu.banned_at) as created_at,
          'added' as action,
          up.handle as blocked_account_handle,
          json_agg(json_build_object(
            'name', CASE 
              WHEN bu.list_type = 'global' THEN 'Global List'
              ELSE COALESCE(f.feed_name, 'Unknown Feed')
            END,
            'uri', CASE 
              WHEN bu.list_type = 'global' THEN up_owner.global_ban_list
              ELSE f.feed_ban_list
            END
          ) ORDER BY bu.list_type) as all_lists
        FROM banned_users bu
        LEFT JOIN feeds f ON bu.list_type = f.feed_id::text
        LEFT JOIN user_profiles up ON bu.banned_by_did = up.did
        LEFT JOIN user_profiles up_owner ON bu.user_id = up_owner.id
        WHERE bu.user_id = $1 
        AND bu.reason = 'autoblock'
        GROUP BY bu.banned_handle, up.handle
      )
      SELECT * FROM grouped_blocks
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId])
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching activity:', error)
    res.status(500).json({ error: 'Failed to fetch activity' })
  }
})

// Get main account status
router.get('/main-account', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    
    const result = await pool.query(`
      SELECT autoblock_main_account as enabled, zero_trust_mode as "zeroTrust"
      FROM user_profiles 
      WHERE id = $1
    `, [userId])
    
    res.json({ 
      enabled: result.rows[0]?.enabled ?? true,
      zeroTrust: result.rows[0]?.zeroTrust ?? false
    })
  } catch (error) {
    console.error('Error fetching main account status:', error)
    res.status(500).json({ error: 'Failed to fetch main account status' })
  }
})

// Update main account status
router.put('/main-account', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const { enabled } = req.body
    const pool: Pool = req.app.get('db')
    
    await pool.query(`
      UPDATE user_profiles 
      SET autoblock_main_account = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [enabled, userId])
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating main account status:', error)
    res.status(500).json({ error: 'Failed to update main account status' })
  }
})

// Test main account
router.post('/main-account/test', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    const LISTIFICATIONS_DID = 'did:plc:yatb2t26fw7u3c7qcacq7rje'
    
    const result = await pool.query(`
      SELECT handle FROM user_profiles WHERE id = $1
    `, [userId])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const { handle } = result.rows[0]
    const sessionManager = new SessionManager(pool)
    
    // Get authenticated agent using session manager
    const agent = await sessionManager.getMainAccountAgent(userId)
    
    let dmStatus = 'Unknown'
    let recentBlock = null
    
    try {
      console.log(`Test button using token for ${handle}: ${agent.session?.accessJwt?.substring(0, 20)}...`)
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=10', {
        headers: {
          'Authorization': `Bearer ${agent.session?.accessJwt}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`DM API failed: ${response.status}`)
      }
      
      const convos = await response.json()
      dmStatus = 'DM access working'
      
      const listificationsConvo = convos.convos?.find(
        (convo: any) => convo.members.some((member: any) => 
          member.did === LISTIFICATIONS_DID || 
          member.handle?.includes('listifications')
        )
      )
      
      if (listificationsConvo) {
        const msgResponse = await fetch(
          `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${listificationsConvo.id}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${agent.session?.accessJwt}`,
              'Content-Type': 'application/json'
            }
          }
        )
        
        if (msgResponse.ok) {
          const messages = await msgResponse.json()
          const listificationsMessages = messages.messages?.filter(
            (msg: any) => msg.sender.did === LISTIFICATIONS_DID
          )
          
          if (listificationsMessages?.length > 0) {
            const latestMsg = listificationsMessages[0]
            const blockPattern = /@([\w.-]+)\s+has blocked you/i
            const modListPattern = /@([\w.-]+)\s+has added you to the "[^"]*"\s+moderation list/i
            
            const blockMatch = latestMsg.text.match(blockPattern)
            const modListMatch = latestMsg.text.match(modListPattern)
            
            if (blockMatch || modListMatch) {
              const handle = blockMatch ? blockMatch[1] : modListMatch[1]
              const action = blockMatch ? 'blocked' : 'added to moderation list'
              recentBlock = `@${handle} ${action} you`
            } else {
              recentBlock = 'No recent blocks from listifications'
            }
          } else {
            recentBlock = 'No recent blocks from listifications'
          }
        } else {
          recentBlock = 'No recent blocks from listifications'
        }
      } else {
        recentBlock = 'No recent blocks from listifications or user is not subscribed'
      }
      
    } catch (dmError: any) {
      if (dmError.message.includes('400')) {
        dmStatus = 'DM API not enabled - check app password has "Chat/DM support"'
      } else {
        dmStatus = `DM test failed: ${dmError.message}`
      }
    }
    
    res.json({ 
      message: `Authentication successful for @${handle}`,
      dmStatus: dmStatus,
      recentBlock: recentBlock || 'No recent blocks from listifications or user is not subscribed'
    })
  } catch (error: any) {
    console.error('Error testing main account:', error)
    
    // Provide specific error messages for common issues
    if (error.message.includes('Password decryption failed')) {
      return res.status(400).json({ 
        error: 'Password decryption failed - please re-enter your Bluesky app password',
        action: 'update_password'
      })
    }
    
    if (error.message.includes('outdated')) {
      return res.status(400).json({ 
        error: 'Your stored password format is outdated - please re-enter your Bluesky app password',
        action: 'update_password'
      })
    }
    
    res.status(500).json({ error: error.message || 'Authentication failed - check app password' })
  }
})

// Get autoblock status (failed accounts)
router.get('/status', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    const sessionManager = new SessionManager(pool)
    const failedAccounts = []
    
    // Check main account authentication
    try {
      await sessionManager.getMainAccountAgent(userId)
    } catch (error) {
      const userResult = await pool.query('SELECT handle FROM user_profiles WHERE id = $1', [userId])
      if (userResult.rows[0]) {
        failedAccounts.push({
          account_type: 'main',
          handle: userResult.rows[0].handle
        })
      }
    }
    
    // Check monitored accounts authentication
    const monitoredResult = await pool.query(`
      SELECT id, handle FROM monitored_accounts WHERE owner_user_id = $1 AND is_active = true
    `, [userId])
    
    for (const account of monitoredResult.rows) {
      try {
        await sessionManager.getMonitoredAccountAgent(account.id)
      } catch (error) {
        failedAccounts.push({
          account_type: 'monitored',
          handle: account.handle
        })
      }
    }
    
    res.json(failedAccounts)
  } catch (error) {
    console.error('Error fetching autoblock status:', error)
    res.status(500).json({ error: 'Failed to fetch autoblock status' })
  }
})

// Get autoblock notifications
router.get('/notifications', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    
    // Get recent autoblock events and system notifications
    const result = await pool.query(`
      SELECT 
        id,
        event_type as type,
        message as title,
        COALESCE(details->>'description', message) as message,
        details as data,
        created_at,
        false as is_read
      FROM autoblock_system_logs
      WHERE user_id = $1 
        AND event_type IN ('autoblock_success', 'autoblock_failure', 'auth_failure', 'auth_recovery')
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId])
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching autoblock notifications:', error)
    res.status(500).json({ error: 'Failed to fetch autoblock notifications' })
  }
})

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const notificationId = req.params.id
    const pool: Pool = req.app.get('db')
    
    // For now, just return success since we don't have a read status in the logs table
    // In the future, you could add an is_read column to autoblock_system_logs
    res.json({ success: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

// Get system logs
router.get('/system-logs', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const pool: Pool = req.app.get('db')
    const filter = req.query.filter || 'all'
    const limit = parseInt(req.query.limit) || 100
    
    let logs = []
    
    // Get comprehensive system logs from new table
    if (filter === 'all' || filter === 'auth' || filter === 'autoblock' || filter === 'errors') {
      let whereClause = 'WHERE user_id = $1'
      const params = [userId]
      
      if (filter === 'auth') {
        whereClause += ' AND event_type IN ($2, $3, $4, $5)'
        params.push('auth_failure', 'auth_recovery', 'auth_retry', 'auth_success')
      } else if (filter === 'autoblock') {
        whereClause += ' AND event_type IN ($2, $3)'
        params.push('autoblock_success', 'autoblock_failure')
      } else if (filter === 'errors') {
        whereClause += ' AND event_type IN ($2, $3)'
        params.push('auth_failure', 'autoblock_failure')
      }
      
      const systemLogs = await pool.query(`
        SELECT 
          CASE 
            WHEN event_type IN ('auth_failure', 'autoblock_failure') THEN 'error'
            WHEN event_type IN ('auth_success', 'auth_recovery', 'autoblock_success') THEN 'success'
            WHEN event_type = 'auth_retry' THEN 'warning'
            ELSE event_type
          END as type,
          message,
          details,
          created_at,
          id,
          event_type,
          account_type
        FROM autoblock_system_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1}
      `, [...params, Math.min(limit, 500)])
      
      logs.push(...systemLogs.rows)
    }
    
    // Sort all logs by timestamp
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    // Limit results
    logs = logs.slice(0, limit)
    
    res.json(logs)
  } catch (error) {
    console.error('Error fetching system logs:', error)
    res.status(500).json({ error: 'Failed to fetch system logs' })
  }
})

export default router