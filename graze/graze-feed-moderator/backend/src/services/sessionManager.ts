import { Pool } from 'pg'
import { AtpAgent } from '@atproto/api'
import { PasswordService } from './passwordService.js'

interface SessionData {
  accessJwt: string
  refreshJwt: string
  expiresAt: Date
}

export class SessionManager {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  // Get authenticated agent for main account (users table)
  async getMainAccountAgent(userId: number): Promise<AtpAgent> {
    const result = await this.pool.query(`
      SELECT did, handle, bsky_password, password_type, access_jwt, refresh_jwt, session_expires_at,
             zero_trust_mode, zero_trust_proxy_url, zero_trust_api_key
      FROM user_profiles WHERE id = $1
    `, [userId])

    if (result.rows.length === 0) {
      throw new Error('Main account not found')
    }

    const account = result.rows[0]
    const agent = new AtpAgent({ service: 'https://bsky.social' })
    
    // Zero-trust mode: get tokens from user's proxy
    if (account.zero_trust_mode && account.zero_trust_proxy_url && account.zero_trust_api_key) {
      const { ZeroTrustProxyClient } = await import('./zeroTrustProxy.js')
      const client = new ZeroTrustProxyClient(account.zero_trust_proxy_url, account.zero_trust_api_key, account.handle)
      const auth = await client.getBlueskyToken('AUTOBLOCK')
      agent.session = {
        did: account.did,
        handle: account.handle,
        accessJwt: auth.accessToken!,
        refreshJwt: auth.refreshToken!,
        active: true
      }
      return agent
    }
    
    // Check if user has basic password without zero trust
    if (account.password_type === 'basic' && !account.zero_trust_mode) {
      throw new Error('Cannot authenticate: You have a basic password but zero trust is disabled. Please set a Bluesky app password or enable zero trust mode.')
    }
    
    if (!account.bsky_password) {
      throw new Error('Main account password not configured')
    }

    // Check if we have valid session (with 10 minute buffer)
    const sessionBuffer = 10 * 60 * 1000 // 10 minutes
    if (account.access_jwt && account.session_expires_at && 
        new Date(account.session_expires_at).getTime() > Date.now() + sessionBuffer) {
      const decryptedAccessJwt = await PasswordService.decryptSessionToken(account.access_jwt)
      const decryptedRefreshJwt = await PasswordService.decryptSessionToken(account.refresh_jwt)
      agent.session = {
        accessJwt: decryptedAccessJwt,
        refreshJwt: decryptedRefreshJwt,
        did: account.did,
        handle: account.handle,
        active: true
      }
      return agent
    }

    // Try to refresh if we have refresh token
    if (account.refresh_jwt) {
      try {
        const decryptedAccessJwt = await PasswordService.decryptSessionToken(account.access_jwt)
        const decryptedRefreshJwt = await PasswordService.decryptSessionToken(account.refresh_jwt)
        agent.session = {
          accessJwt: decryptedAccessJwt,
          refreshJwt: decryptedRefreshJwt,
          did: account.did,
          handle: account.handle,
          active: true
        }
        await agent.resumeSession(agent.session)
        if (agent.session) {
          await this.saveMainAccountSession(userId, agent.session)
        }
        return agent
      } catch (error) {
        console.log('Session refresh failed, will re-authenticate')
      }
    }

    // Full re-authentication with chat scope
    const decryptedPassword = await PasswordService.decryptPassword(account.bsky_password)
    await agent.login({
      identifier: account.did || account.handle,
      password: decryptedPassword
    })
    
    // Request additional scopes for chat if needed
    if (agent.session?.accessJwt) {
      try {
        // Try to get a chat-enabled token
        const chatResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: account.did || account.handle,
            password: decryptedPassword,
            scopes: ['atproto', 'chat']
          })
        })
        
        if (chatResponse.ok) {
          const chatSession = await chatResponse.json()
          agent.session = {
            accessJwt: chatSession.accessJwt,
            refreshJwt: chatSession.refreshJwt,
            did: chatSession.did,
            handle: chatSession.handle,
            active: true
          }
        }
      } catch (error) {
        console.log('Failed to get chat-enabled session, using regular session')
      }
    }

    if (agent.session) {
      await this.saveMainAccountSession(userId, agent.session)
    }
    return agent
  }

  // Get authenticated agent for monitored account
  async getMonitoredAccountAgent(accountId: number): Promise<AtpAgent> {
    const result = await this.pool.query(`
      SELECT ma.did, ma.handle, ma.app_password, ma.access_jwt, ma.refresh_jwt, ma.session_expires_at, ma.use_zero_trust,
             up.zero_trust_mode, up.zero_trust_proxy_url, up.zero_trust_api_key, ma.owner_user_id
      FROM monitored_accounts ma
      JOIN user_profiles up ON ma.owner_user_id = up.id
      WHERE ma.id = $1
    `, [accountId])

    if (result.rows.length === 0) {
      throw new Error('Monitored account not found')
    }

    const account = result.rows[0]
    const agent = new AtpAgent({ service: 'https://bsky.social' })
    
    // Zero-trust mode: get tokens from user's proxy for this monitored account
    if (account.use_zero_trust && account.zero_trust_mode && account.zero_trust_proxy_url && account.zero_trust_api_key) {
      // Get master user handle
      const masterResult = await this.pool.query('SELECT handle FROM user_profiles WHERE id = $1', [account.owner_user_id])
      const masterHandle = masterResult.rows[0]?.handle
      
      const { ZeroTrustProxyClient } = await import('./zeroTrustProxy.js')
      const client = new ZeroTrustProxyClient(account.zero_trust_proxy_url, account.zero_trust_api_key, masterHandle)
      // Send both handle and DID - proxy will try to match either
      const auth = await client.getMonitoredAccountToken(account.handle, account.did)
      agent.session = {
        did: account.did,
        handle: account.handle,
        accessJwt: auth.accessToken!,
        refreshJwt: auth.refreshToken!,
        active: true
      }
      return agent
    }
    
    if (!account.app_password) {
      throw new Error(`No app password configured for monitored account @${account.handle}`)
    }

    // Check if we have valid session
    if (account.access_jwt && account.session_expires_at && new Date(account.session_expires_at) > new Date()) {
      const decryptedAccessJwt = await PasswordService.decryptSessionToken(account.access_jwt)
      const decryptedRefreshJwt = await PasswordService.decryptSessionToken(account.refresh_jwt)
      agent.session = {
        accessJwt: decryptedAccessJwt,
        refreshJwt: decryptedRefreshJwt,
        did: account.did,
        handle: account.handle,
        active: true
      }
      return agent
    }

    // Try to refresh if we have refresh token
    if (account.refresh_jwt) {
      try {
        const decryptedAccessJwt = await PasswordService.decryptSessionToken(account.access_jwt)
        const decryptedRefreshJwt = await PasswordService.decryptSessionToken(account.refresh_jwt)
        agent.session = {
          accessJwt: decryptedAccessJwt,
          refreshJwt: decryptedRefreshJwt,
          did: account.did,
          handle: account.handle,
          active: true
        }
        await agent.resumeSession(agent.session)
        if (agent.session) {
          await this.saveMonitoredAccountSession(accountId, agent.session)
        }
        return agent
      } catch (error) {
        console.log('Session refresh failed, will re-authenticate')
      }
    }

    // Full re-authentication - use secure encryption for monitored accounts too
    const decryptedPassword = await PasswordService.decryptPassword(account.app_password)
    await agent.login({
      identifier: account.did || account.handle,
      password: decryptedPassword
    })
    
    // Request additional scopes for chat if needed
    if (agent.session?.accessJwt) {
      try {
        // Try to get a chat-enabled token
        const chatResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: account.did || account.handle,
            password: decryptedPassword,
            scopes: ['atproto', 'chat']
          })
        })
        
        if (chatResponse.ok) {
          const chatSession = await chatResponse.json()
          agent.session = {
            accessJwt: chatSession.accessJwt,
            refreshJwt: chatSession.refreshJwt,
            did: chatSession.did,
            handle: chatSession.handle,
            active: true
          }
        }
      } catch (error) {
        console.log('Failed to get chat-enabled session, using regular session')
      }
    }

    if (agent.session) {
      await this.saveMonitoredAccountSession(accountId, agent.session)
    }
    return agent
  }

  private async saveMainAccountSession(userId: number, session: any) {
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
    const encryptedAccessJwt = await PasswordService.encryptSessionToken(session.accessJwt)
    const encryptedRefreshJwt = await PasswordService.encryptSessionToken(session.refreshJwt)
    await this.pool.query(`
      UPDATE user_profiles 
      SET access_jwt = $1, refresh_jwt = $2, session_expires_at = $3
      WHERE id = $4
    `, [encryptedAccessJwt, encryptedRefreshJwt, expiresAt, userId])
  }

  private async saveMonitoredAccountSession(accountId: number, session: any) {
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
    const encryptedAccessJwt = await PasswordService.encryptSessionToken(session.accessJwt)
    const encryptedRefreshJwt = await PasswordService.encryptSessionToken(session.refreshJwt)
    await this.pool.query(`
      UPDATE monitored_accounts 
      SET access_jwt = $1, refresh_jwt = $2, session_expires_at = $3
      WHERE id = $4
    `, [encryptedAccessJwt, encryptedRefreshJwt, expiresAt, accountId])
  }



  // Clear session on authentication failure
  async clearMainAccountSession(userId: number) {
    await this.pool.query(`
      UPDATE user_profiles 
      SET access_jwt = NULL, refresh_jwt = NULL, session_expires_at = NULL
      WHERE id = $1
    `, [userId])
  }

  async clearMonitoredAccountSession(accountId: number) {
    await this.pool.query(`
      UPDATE monitored_accounts 
      SET access_jwt = NULL, refresh_jwt = NULL, session_expires_at = NULL
      WHERE id = $1
    `, [accountId])
  }
}