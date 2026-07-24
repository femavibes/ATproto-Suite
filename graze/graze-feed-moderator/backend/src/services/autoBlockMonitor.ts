import { Pool } from 'pg'
import { AtpAgent } from '@atproto/api'
import { GrazeService } from './graze.js'
import { BlueskyService } from './bluesky.js'
import { SessionManager } from './sessionManager.js'

const LISTIFICATIONS_DID = 'did:plc:yatb2t26fw7u3c7qcacq7rje'

interface UserAccount {
  id: number
  user_id: number
  did: string
  handle: string
  app_password: string
  is_active: boolean
  account_type?: string
}

interface BlockList {
  id: number
  user_id: number
  list_uri: string
  list_name: string
  is_global: boolean
  target_account_id: number | null
}

interface AuthenticatedAccount {
  account: UserAccount
  agent: AtpAgent
  sessionValid: boolean
  failureCount: number
  lastFailure?: Date
  lastSuccessLog?: number
}

export class AutoBlockMonitor {
  private pool: Pool
  private blueskyService: BlueskyService
  private sessionManager: SessionManager
  private authenticatedAccounts: AuthenticatedAccount[] = []
  private pollInterval: number = 30000 // 30 seconds
  private isRunning: boolean = false

  constructor(pool: Pool) {
    this.pool = pool
    this.blueskyService = new BlueskyService()
    this.sessionManager = new SessionManager(pool)
  }

  async start() {
    if (this.isRunning) return
    
    console.log('Starting auto-block monitor...')
    this.isRunning = true
    
    // Initial authentication and check
    await this.authenticateAllAccounts()
    await this.checkAllAccounts()
    
    // Set up polling interval
    setInterval(() => {
      if (this.isRunning) {
        this.checkAllAccounts().catch((error) => {
          console.error('[AUTOBLOCK] Critical error in checkAllAccounts:', error)
          console.error('[AUTOBLOCK] Stack trace:', error.stack)
          // Log to system events for all users
          this.authenticatedAccounts.forEach(auth => {
            this.logSystemEvent(auth.account.user_id, 'system_error', 'AutoBlock service error', error.message, 'system').catch(console.error)
          })
        })
      }
    }, this.pollInterval)
    
    console.log(`Auto-block monitor started with ${this.authenticatedAccounts.length} accounts`)
  }

  stop() {
    this.isRunning = false
    console.log('Auto-block monitor stopped')
  }

  private async authenticateAllAccounts() {
    try {
      // Get monitored accounts
      const monitoredResult = await this.pool.query(`
        SELECT id, owner_user_id as user_id, did, handle, true as is_active, 'monitored' as account_type
        FROM monitored_accounts
        WHERE is_active = true
      `)
      
      // Get main accounts
      const mainResult = await this.pool.query(`
        SELECT id, id as user_id, did, handle, true as is_active, 'main' as account_type
        FROM user_profiles
        WHERE autoblock_main_account = true AND bsky_password IS NOT NULL
      `)
      
      const allAccounts = [...monitoredResult.rows, ...mainResult.rows]
      this.authenticatedAccounts = []
      
      for (const account of allAccounts) {
        try {
          let agent: AtpAgent
          
          if (account.account_type === 'main') {
            agent = await this.sessionManager.getMainAccountAgent(account.id)
          } else {
            agent = await this.sessionManager.getMonitoredAccountAgent(account.id)
          }
          
          this.authenticatedAccounts.push({
            account,
            agent,
            sessionValid: true,
            failureCount: 0
          })
          
          const accountType = account.account_type?.toUpperCase() || 'UNKNOWN'
          console.log(`[${accountType}] ✓ Session ready for account: ${account.handle}`)
          
          // Log successful authentication (only on startup)
          await this.markAccountAsActive(account, 'Authentication successful')
          await this.logSystemEvent(account.user_id, 'auth_success', `Account @${account.handle} authenticated successfully`, 'Session ready for auto-block monitoring', account.account_type)
        } catch (error: any) {
          const accountType = account.account_type?.toUpperCase() || 'UNKNOWN'
          console.error(`[${accountType}] ✗ Failed to get session for ${account.handle}:`, error.message)
          
          // Log authentication failure
          await this.logSystemEvent(account.user_id, 'auth_failure', `Account @${account.handle} authentication failed on startup`, error.message, account.account_type)
          
          if (account.account_type === 'monitored') {
            await this.pool.query(`
              UPDATE monitored_accounts 
              SET is_active = false 
              WHERE id = $1
            `, [account.id])
            await this.logSystemEvent(account.user_id, 'account_disabled', `Monitored account @${account.handle} disabled`, 'Set is_active = false after auth failure', account.account_type)
          }
        }
      }
    } catch (error) {
      console.error('Error setting up account sessions:', error)
    }
  }

  private async checkAllAccounts() {
    const monitoredAccounts = this.authenticatedAccounts.filter(a => a.account.account_type === 'monitored')
    const mainAccounts = this.authenticatedAccounts.filter(a => a.account.account_type === 'main')
    
    if (monitoredAccounts.length > 0) {
      console.log(`[MONITORED] Checking ${monitoredAccounts.length} monitored accounts...`)
    }
    if (mainAccounts.length > 0) {
      console.log(`[MAIN] Checking ${mainAccounts.length} main accounts...`)
    }
    
    // Process each account independently to prevent one failure from affecting others
    const checkPromises = this.authenticatedAccounts.map(async (auth) => {
      try {
        await this.checkAccountForBlocks(auth)
      } catch (error) {
        const accountType = auth.account.account_type?.toUpperCase() || 'UNKNOWN'
        console.error(`[${accountType}] Error checking ${auth.account.handle}:`, error)
        // Continue processing other accounts even if this one fails
      }
    })
    
    // Wait for all checks to complete (or fail independently)
    await Promise.allSettled(checkPromises)
  }

  private async checkAccountForBlocks(auth: AuthenticatedAccount) {
    const { account, agent } = auth
    const accountType = account.account_type?.toUpperCase() || 'UNKNOWN'
    
    try {
      // Only re-authenticate if session is actually invalid
      if (!agent.session?.accessJwt) {
        console.log(`No valid session for ${account.handle}, getting cached session...`)
        if (account.account_type === 'main') {
          const newAgent = await this.sessionManager.getMainAccountAgent(account.id)
          auth.agent = newAgent
        } else {
          const newAgent = await this.sessionManager.getMonitoredAccountAgent(account.id)
          auth.agent = newAgent
        }
      }
      
      // Check DMs for listifications messages
      console.log(`[${accountType}] Auto-block monitor using token for ${account.handle}: ${auth.agent.session?.accessJwt?.substring(0, 20)}...`)
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=10', {
        headers: {
          'Authorization': `Bearer ${auth.agent.session?.accessJwt}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[${accountType}] DM API error for ${account.handle}: ${response.status} - ${errorText}`)
        
        if (response.status === 401) {
          // Track auth failures but retry before notifying
          auth.failureCount = (auth.failureCount || 0) + 1
          auth.lastFailure = new Date()
          
          console.log(`[${accountType}] Session expired for ${account.handle} (attempt ${auth.failureCount}/3), refreshing...`)
          
          // Only retry if we haven't failed recently (prevent rapid retries)
          const timeSinceLastFailure = auth.lastFailure ? Date.now() - auth.lastFailure.getTime() : Infinity
          if (timeSinceLastFailure < 60000) { // Less than 1 minute ago
            console.log(`[${accountType}] Recent failure for ${account.handle}, skipping retry to prevent rate limiting`)
            return
          }
          
          // Exponential backoff with longer delays
          await new Promise(resolve => setTimeout(resolve, 5000 * auth.failureCount))
          
          // FORCE session refresh by clearing cached session first
          if (account.account_type === 'main') {
            await this.sessionManager.clearMainAccountSession(account.id)
            auth.agent = await this.sessionManager.getMainAccountAgent(account.id)
          } else {
            await this.sessionManager.clearMonitoredAccountSession(account.id)
            auth.agent = await this.sessionManager.getMonitoredAccountAgent(account.id)
          }
          
          // Retry the request
          const retryResponse = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=10', {
            headers: {
              'Authorization': `Bearer ${auth.agent.session?.accessJwt}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (retryResponse.ok) {
            const convos = await retryResponse.json()
            await this.processConversations(convos, account)
            // Reset failure count on success
            auth.failureCount = 0
            auth.lastFailure = undefined
            await this.clearAccountFailure(account)
          } else if (auth.failureCount >= 3) {
            // Only show notification after 3 failed attempts
            const retryErrorText = await retryResponse.text()
            await this.markAccountAsFailed(account, `Authentication failed after ${auth.failureCount} attempts`)
            throw new Error(`DM API failed after ${auth.failureCount} refresh attempts: ${retryResponse.status} - ${retryErrorText}`)
          } else {
            // Don't throw error, just log and continue
            console.log(`[${accountType}] Retry ${auth.failureCount} failed for ${account.handle}, will try again next cycle`)
            return
          }
        } else if (response.status === 400 && (errorText.includes('Bad token scope') || errorText.includes('InvalidToken') || errorText.includes('ExpiredToken'))) {
          // Track failures to avoid endless retries
          auth.failureCount = (auth.failureCount || 0) + 1
          auth.lastFailure = new Date()
          
          if (auth.failureCount >= 3) {
            console.log(`[${accountType}] Account ${account.handle} has failed ${auth.failureCount} times, marking as failed`)
            await this.markAccountAsFailed(account, 'Token scope error - requires re-authentication')
            // Create notification only after multiple failures
            await this.createNotification(
              account.user_id,
              'auth_failure',
              'Auto-block Authentication Failed',
              `Account ${account.handle} needs re-authentication. Auto-block is disabled.`,
              { accountHandle: account.handle, accountType: account.account_type }
            )
            return
          }
          
          console.log(`[${accountType}] Token scope issue for ${account.handle} (attempt ${auth.failureCount}/3), clearing session and retrying...`)
          // Clear cached session to force fresh authentication
          if (account.account_type === 'main') {
            await this.sessionManager.clearMainAccountSession(account.id)
            auth.agent = await this.sessionManager.getMainAccountAgent(account.id)
          } else {
            await this.sessionManager.clearMonitoredAccountSession(account.id)
            auth.agent = await this.sessionManager.getMonitoredAccountAgent(account.id)
          }
          
          // Retry with fresh session
          const retryResponse = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=10', {
            headers: {
              'Authorization': `Bearer ${auth.agent.session?.accessJwt}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (retryResponse.ok) {
            const convosData = await retryResponse.json()
            await this.processConversations(convosData, account)
            // Reset failure count on success
            auth.failureCount = 0
            auth.lastFailure = undefined
            await this.clearAccountFailure(account)
          } else {
            console.log(`[${accountType}] Still getting scope error for ${account.handle} after fresh auth (attempt ${auth.failureCount}/3)`)
            if (auth.failureCount >= 3) {
              await this.markAccountAsFailed(account, 'Persistent token scope error')
              await this.logSystemEvent(account.user_id, 'account_failed', `Account @${account.handle} marked as failed after ${auth.failureCount} token scope errors`, 'Persistent token scope error', account.account_type)
            }
            return
          }
        } else if (response.status >= 500) {
          // Server errors - don't count as auth failures
          console.log(`[${accountType}] Server error ${response.status} for ${account.handle}, will retry next cycle`)
          return
        } else if (response.status === 429) {
          // Rate limiting - don't count as auth failures
          console.log(`[${accountType}] Rate limited for ${account.handle}, will retry next cycle`)
          return
        } else {
          throw new Error(`DM API failed: ${response.status} - ${errorText}`)
        }
      } else {
        const convosData = await response.json()
        await this.processConversations(convosData, account)
        
        // Success! Clear any previous failures
        if (auth.failureCount > 0) {
          console.log(`[${accountType}] Account ${account.handle} recovered, clearing failure status`)
          auth.failureCount = 0
          auth.lastFailure = undefined
          await this.clearAccountFailure(account)
        } else {
          // Only update status, don't log routine successful checks
          const now = Date.now()
          if (!auth.lastSuccessLog || now - auth.lastSuccessLog > 600000) { // 10 minutes
            await this.markAccountAsActive(account, 'DM check successful')
            auth.lastSuccessLog = now
          }
        }
      }
      
    } catch (error: any) {
      console.error(`[${accountType}] Failed to check DMs for ${account.handle}:`, error.message)
      
      // Only track failures for authentication-related errors, not network issues
      const isAuthError = error.message.includes('401') || 
                         error.message.includes('InvalidToken') || 
                         error.message.includes('Bad token scope') ||
                         error.message.includes('authentication')
      
      if (isAuthError) {
        auth.failureCount = (auth.failureCount || 0) + 1
        auth.lastFailure = new Date()
        
        if (auth.failureCount >= 3) {
          console.log(`[${accountType}] Account ${account.handle} has failed ${auth.failureCount} times with auth errors, marking as failed`)
          await this.markAccountAsFailed(account, error.message)
          await this.logSystemEvent(account.user_id, 'account_failed', `Account @${account.handle} marked as failed after ${auth.failureCount} auth errors`, error.message, account.account_type)
        }
      } else {
        // Network/temporary errors - don't count towards failure limit
        console.log(`[${accountType}] Temporary error for ${account.handle}, will retry next cycle: ${error.message}`)
      }
    }
  }
  
  private async processConversations(convosData: any, account: any) {
    const accountType = account.account_type?.toUpperCase() || 'UNKNOWN'
    const listificationsConvo = convosData.convos?.find(
      (convo: any) => convo.members.some((member: any) => 
        member.did === LISTIFICATIONS_DID || 
        member.handle?.includes('listifications')
      )
    )
    
    if (listificationsConvo) {
      const msgResponse = await fetch(
        `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${listificationsConvo.id}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${this.authenticatedAccounts.find(a => a.account.id === account.id)?.agent.session?.accessJwt}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      const messages = await msgResponse.json()
      
      for (const message of messages.messages || []) {
        if (message.sender.did === LISTIFICATIONS_DID) {
          const messageId = message.id || message.sentAt
          
          // Check if we've already processed this message
          const processed = await this.pool.query(`
            SELECT id FROM processed_blocks 
            WHERE message_id = $1
          `, [messageId])
          
          if (processed.rows.length === 0) {
            console.log(`[${accountType}] Processing new block message for ${account.handle}: ${message.text}`)
            
            // Mark as processed using the actual message ID
            try {
              await this.pool.query(`
                INSERT INTO processed_blocks (user_account_id, message_id, blocker_did)
                VALUES ($1, $2, $3)
              `, [account.account_type === 'monitored' ? account.id : null, messageId, 'unknown'])
            } catch (error: any) {
              if (error.code !== '23505') throw error // Ignore duplicate key errors
            }
            
            await this.processBlockMessage(message.text, account)
          }
        }
      }
    }
  }

  private async processBlockMessage(text: string, account: UserAccount) {
    const blockPattern = /@([\w.-]+)\s+has blocked you/i
    const modListPattern = /@([\w.-]+)\s+has added you to the "[^"]*"\s+moderation list/i
    
    const blockMatch = text.match(blockPattern)
    const modListMatch = text.match(modListPattern)
    
    if (!blockMatch && !modListMatch) {
      return
    }
    
    const offenderHandle = blockMatch ? blockMatch[1] : modListMatch![1]
    const action = blockMatch ? 'blocked' : 'added to moderation list'
    const accountType = account.account_type?.toUpperCase() || 'UNKNOWN'
    
    try {
      // Resolve offender handle to DID
      const agent = new AtpAgent({ service: 'https://bsky.social' })
      const resolved = await agent.api.com.atproto.identity.resolveHandle({ 
        handle: offenderHandle 
      })
      const offenderDid = resolved.data.did
      
      console.log(`[${accountType}] Detected: ${offenderHandle} (${offenderDid}) ${action} ${account.handle}`)
      
      // Get autoblock configuration for this account
      // For main accounts, check both the actual handle and 'main' key
      // For monitored accounts, check both the actual handle and 'main' key (some configs use 'main' generically)
      const configResult = await this.pool.query(`
        SELECT list_type, feed_id FROM autoblock_account_lists 
        WHERE user_id = $1 AND (
          account_handle = $2 OR 
          (account_type = $3 AND account_handle = 'main') OR
          account_handle = 'main'
        )
      `, [account.user_id, account.handle, account.account_type])
      
      if (configResult.rows.length === 0) {
        console.log(`[${accountType}] No autoblock configuration for ${account.handle}`)
        return
      }
      
      console.log(`[${accountType}] Found ${configResult.rows.length} autoblock configurations for ${account.handle}`)
      
      // Process each configured list
      const processedLists = new Set()
      for (const config of configResult.rows) {
        const listKey = config.list_type === 'global' ? 'global' : `feed:${config.feed_id}`
        
        // Skip if we've already processed this list type/feed combination
        if (processedLists.has(listKey)) {
          continue
        }
        processedLists.add(listKey)
        
        if (config.list_type === 'global') {
          await this.addToGlobalList(offenderDid, offenderHandle, account)
        } else if (config.list_type === 'feed') {
          await this.addToFeedList(offenderDid, offenderHandle, account, config.feed_id)
        }
      }
      
    } catch (error) {
      console.error(`Failed to process block for ${offenderHandle}:`, error)
    }
  }

  private async addToGlobalList(offenderDid: string, offenderHandle: string, account: UserAccount) {
    try {
      console.log(`Adding ${offenderHandle} to global list via autoblock...`)
      
      // Check if already banned globally to avoid duplicates
      const existing = await this.pool.query(`
        SELECT id FROM banned_users 
        WHERE user_id = $1 AND banned_handle = $2 AND list_type = 'global'
      `, [account.user_id, offenderHandle.toLowerCase()])
      
      if (existing.rows.length > 0) {
        console.log(`${offenderHandle} already in global list - skipping`)
        return
      }
      
      // Get or create user profile for banned user
      let bannedUserProfile = await this.pool.query(
        'SELECT id FROM user_profiles WHERE did = $1',
        [offenderDid]
      )
      
      let bannedUserId = null
      if (bannedUserProfile.rows.length === 0) {
        const newProfile = await this.pool.query(
          'INSERT INTO user_profiles (did, handle, subscription_tier, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
          [offenderDid, offenderHandle, 'none']
        )
        bannedUserId = newProfile.rows[0].id
      } else {
        bannedUserId = bannedUserProfile.rows[0].id
      }
      
      // Get user profile to access Bluesky credentials and global ban list
      const userProfile = await this.pool.query(
        'SELECT * FROM user_profiles WHERE id = $1',
        [account.user_id]
      )
      
      if (userProfile.rows.length === 0) {
        throw new Error('User profile not found')
      }
      
      const user = userProfile.rows[0]
      
      // Add to banned_users table (unified system)
      await this.pool.query(`
        INSERT INTO banned_users (user_id, banned_handle, banned_did, banned_user_id, list_type, banned_by_did, reason)
        VALUES ($1, $2, $3, $4, 'global', $5, 'autoblock')
      `, [account.user_id, offenderHandle.toLowerCase(), offenderDid, bannedUserId, account.did])
      
      // Actually add to Bluesky global ban list if configured
      if (user.global_ban_list) {
        try {
          await this.blueskyService.banUser(offenderHandle, user.global_ban_list, user)
          console.log(`✅ Added ${offenderHandle} to Bluesky global list: ${user.global_ban_list}`)
        } catch (blueskyError: any) {
          console.error(`Failed to add ${offenderHandle} to Bluesky global list:`, blueskyError)
          await this.logSystemEvent(account.user_id, 'autoblock_failure', `Failed to sync @${offenderHandle} to Bluesky`, `Database updated but Bluesky sync failed: ${blueskyError.message}`, account.account_type)
        }
      } else {
        console.log(`⚠️ No global ban list configured for user ${user.handle} - only added to database`)
        await this.logSystemEvent(account.user_id, 'autoblock_warning', `Auto-blocked @${offenderHandle} (database only)`, `No global ban list configured - user not added to Bluesky list`, account.account_type)
      }
      
      console.log(`✅ Added ${offenderHandle} to global list via autoblock`)
      await this.logSystemEvent(account.user_id, 'autoblock_success', `Auto-blocked @${offenderHandle}`, `Added to global list via @${account.handle} (${account.account_type})`, account.account_type)
      
      await this.createNotification(
        account.user_id,
        'autoblock_success',
        'User Auto-Blocked',
        `@${offenderHandle} was automatically added to global list`,
        {
          offenderHandle,
          offenderDid,
          listName: 'Global',
          accountHandle: account.handle,
          accountType: account.account_type
        }
      )
      
    } catch (error: any) {
      console.error(`Failed to add ${offenderHandle} to global list:`, error)
      await this.logSystemEvent(account.user_id, 'autoblock_failure', `Failed to auto-block @${offenderHandle}`, `Error adding to global list via @${account.handle}: ${error.message}`, account.account_type)
    }
  }
  
  private async addToFeedList(offenderDid: string, offenderHandle: string, account: UserAccount, feedId: string) {
    try {
      console.log(`Adding ${offenderHandle} to feed ${feedId} list via autoblock...`)
      
      // Check if already banned for this feed to avoid duplicates
      const existing = await this.pool.query(`
        SELECT id FROM banned_users 
        WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3
      `, [account.user_id, offenderHandle.toLowerCase(), feedId])
      
      if (existing.rows.length > 0) {
        console.log(`${offenderHandle} already in feed ${feedId} list - skipping`)
        return
      }
      
      // Get or create user profile for banned user
      let bannedUserProfile = await this.pool.query(
        'SELECT id FROM user_profiles WHERE did = $1',
        [offenderDid]
      )
      
      let bannedUserId = null
      if (bannedUserProfile.rows.length === 0) {
        const newProfile = await this.pool.query(
          'INSERT INTO user_profiles (did, handle, subscription_tier, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
          [offenderDid, offenderHandle, 'none']
        )
        bannedUserId = newProfile.rows[0].id
      } else {
        bannedUserId = bannedUserProfile.rows[0].id
      }
      
      // Get feed name and ban list for logging and Bluesky sync
      const feedResult = await this.pool.query(`
        SELECT f.feed_name, f.feed_ban_list, up.* FROM feeds f
        JOIN user_profiles up ON f.user_id = up.id
        WHERE f.feed_id = $1 AND f.user_id = $2
      `, [feedId, account.user_id])
      
      if (feedResult.rows.length === 0) {
        throw new Error(`Feed ${feedId} not found for user ${account.user_id}`)
      }
      
      const feed = feedResult.rows[0]
      const feedName = feed.feed_name || feedId
      
      // Add to banned_users table (unified system)
      await this.pool.query(`
        INSERT INTO banned_users (user_id, banned_handle, banned_did, banned_user_id, list_type, banned_by_did, reason)
        VALUES ($1, $2, $3, $4, $5, $6, 'autoblock')
      `, [account.user_id, offenderHandle.toLowerCase(), offenderDid, bannedUserId, feedId, account.did])
      
      // Actually add to Bluesky feed ban list if configured
      if (feed.feed_ban_list) {
        try {
          await this.blueskyService.banUser(offenderHandle, feed.feed_ban_list, feed)
          console.log(`✅ Added ${offenderHandle} to Bluesky feed list: ${feed.feed_ban_list}`)
        } catch (blueskyError: any) {
          console.error(`Failed to add ${offenderHandle} to Bluesky feed list:`, blueskyError)
          await this.logSystemEvent(account.user_id, 'autoblock_failure', `Failed to sync @${offenderHandle} to Bluesky`, `Database updated but Bluesky sync failed: ${blueskyError.message}`, account.account_type)
        }
      } else {
        console.log(`⚠️ No ban list configured for feed ${feedName} - only added to database`)
        await this.logSystemEvent(account.user_id, 'autoblock_warning', `Auto-blocked @${offenderHandle} (database only)`, `No ban list configured for feed ${feedName} - user not added to Bluesky list`, account.account_type)
      }
      
      console.log(`✅ Added ${offenderHandle} to feed ${feedName} list via autoblock`)
      await this.logSystemEvent(account.user_id, 'autoblock_success', `Auto-blocked @${offenderHandle}`, `Added to ${feedName} list via @${account.handle} (${account.account_type})`, account.account_type)
      
      await this.createNotification(
        account.user_id,
        'autoblock_success',
        'User Auto-Blocked',
        `@${offenderHandle} was automatically added to ${feedName} list`,
        {
          offenderHandle,
          offenderDid,
          listName: feedName,
          accountHandle: account.handle,
          accountType: account.account_type
        }
      )
      
    } catch (error: any) {
      console.error(`Failed to add ${offenderHandle} to feed ${feedId} list:`, error)
      await this.logSystemEvent(account.user_id, 'autoblock_failure', `Failed to auto-block @${offenderHandle}`, `Error adding to feed list via @${account.handle}: ${error.message}`, account.account_type)
    }
  }

  private async markAccountAsFailed(account: UserAccount, errorMessage: string) {
    try {
      await this.pool.query(`
        INSERT INTO account_status (account_id, account_type, handle, status, error_message, updated_at)
        VALUES ($1, $2, $3, 'failed', $4, NOW())
        ON CONFLICT (account_id, account_type) 
        DO UPDATE SET status = 'failed', error_message = $4, updated_at = NOW()
      `, [account.id, account.account_type, account.handle, errorMessage])
      
      // Also log to autoblock_system_logs for historical tracking
      await this.logSystemEvent(account.user_id, 'auth_failure', `Account @${account.handle} authentication failed`, errorMessage, account.account_type)
      
      // Log to console for immediate visibility
      console.error(`[AUTOBLOCK] Account @${account.handle} marked as FAILED: ${errorMessage}`)
    } catch (error) {
      console.error('Failed to mark account as failed:', error)
      console.error('Original error that caused failure:', errorMessage)
    }
  }
  
  private async clearAccountFailure(account: UserAccount) {
    try {
      await this.pool.query(`
        INSERT INTO account_status (account_id, account_type, handle, status, error_message, updated_at)
        VALUES ($1, $2, $3, 'active', NULL, NOW())
        ON CONFLICT (account_id, account_type) 
        DO UPDATE SET status = 'active', error_message = NULL, updated_at = NOW()
      `, [account.id, account.account_type, account.handle])
      
      await this.logSystemEvent(account.user_id, 'auth_recovery', `Account @${account.handle} recovered and re-enabled`, 'Authentication successful after previous failures', account.account_type)
      
      if (account.account_type === 'monitored') {
        await this.pool.query(`UPDATE monitored_accounts SET is_active = true WHERE id = $1`, [account.id])
        await this.logSystemEvent(account.user_id, 'account_enabled', `Monitored account @${account.handle} re-enabled`, 'Set is_active = true after recovery', account.account_type)
      }
    } catch (error) {
      console.error('Failed to clear account failure:', error)
    }
  }
  
  private async markAccountAsActive(account: UserAccount, message: string) {
    try {
      await this.pool.query(`
        INSERT INTO account_status (account_id, account_type, handle, status, error_message, updated_at)
        VALUES ($1, $2, $3, 'active', $4, NOW())
        ON CONFLICT (account_id, account_type) 
        DO UPDATE SET status = 'active', error_message = $4, updated_at = NOW()
      `, [account.id, account.account_type, account.handle, message])
    } catch (error) {
      console.error('Failed to mark account as active:', error)
    }
  }

  private async createNotification(
    userId: number,
    type: string,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      await this.pool.query(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, type, title, message, data ? JSON.stringify(data) : null])
      
      // Clean up old notifications (keep only last 50 per user)
      await this.pool.query(`
        DELETE FROM notifications 
        WHERE user_id = $1 AND id NOT IN (
          SELECT id FROM notifications 
          WHERE user_id = $1 
          ORDER BY created_at DESC 
          LIMIT 50
        )
      `, [userId])
    } catch (error) {
      console.error('Failed to create notification:', error)
    }
  }

  private async logAction(
    userId: number,
    blockerDid: string,
    blockerHandle: string,
    blockedAccountId: number,
    listId: number,
    action: string,
    blockedAccountHandle?: string
  ) {
    try {
      // Always use NULL for blocked_account_id to avoid foreign key issues
      // Store the handle directly instead
      await this.pool.query(`
        INSERT INTO autoblock_log (user_id, blocker_did, blocker_handle, blocked_account_id, list_id, action, blocked_account_handle)
        VALUES ($1, $2, $3, NULL, $4, $5, $6)
      `, [userId, blockerDid, blockerHandle, listId, action, blockedAccountHandle])
    } catch (error) {
      console.error('Failed to log action:', error)
    }
  }

  private async logSystemEvent(
    userId: number,
    eventType: string,
    message: string,
    details: string,
    accountType?: string
  ) {
    try {
      await this.pool.query(`
        INSERT INTO autoblock_system_logs (user_id, event_type, message, details, account_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, eventType, message, details, accountType])
      
      // Skip cleanup to reduce DB load - do it less frequently
      if (Math.random() < 0.01) { // Only 1% of the time
        await this.pool.query(`
          DELETE FROM autoblock_system_logs 
          WHERE user_id = $1 AND created_at < NOW() - INTERVAL '7 days'
        `, [userId])
      }
    } catch (error) {
      console.error('Failed to log system event:', error)
      console.error('Event details:', { userId, eventType, message, details, accountType })
    }
  }
}