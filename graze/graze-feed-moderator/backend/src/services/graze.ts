import bcrypt from 'bcrypt';
import { User } from '../types/index.js';
import { ZeroTrustProxyClient } from './zeroTrustProxy.js';

interface GrazeSession {
  sessionString: string;
  userId: number;
  expiresAt: Date;
}

export class GrazeService {
  private static sessionCache = new Map<number, GrazeSession>();
  private sessions = GrazeService.sessionCache;
  
  static clearUserSession(userId: number): void {
    GrazeService.sessionCache.delete(userId);
  }

  private async createNotification(userId: number, type: string, title: string, message: string) {
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    try {
      await db.getPool().query(
        'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
        [userId, type, title, message]
      );
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }



  async removePostFromAllFeeds(postUri: string, user: User): Promise<void> {
    const sessionString = await this.getSessionString(user);
    
    // No algo_id = removes from ALL user's feeds
    const payload = { at_uri: postUri };
    
    const response = await fetch('https://api.graze.social/app/hide_post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${sessionString}`
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 200 || response.status === 204) {
      const responseText = await response.text();
      console.log(`Removed post ${postUri} from ALL account feeds. Response: ${responseText}`);
      return;
    }
    
    if (response.status === 401) {
      this.sessions.delete(user.id);
      const newSessionString = await this.getSessionString(user);
      
      const retryResponse = await fetch('https://api.graze.social/app/hide_post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_cookie=${newSessionString}`
        },
        body: JSON.stringify(payload)
      });
      
      if (retryResponse.status === 200 || retryResponse.status === 204) {
        const retryResponseText = await retryResponse.text();
        console.log(`Removed post ${postUri} from ALL account feeds (retry). Response: ${retryResponseText}`);
        return;
      }
      
      throw new Error(`Authentication failed for user ${user.handle}`);
    }
    
    if (response.status === 404) {
      console.warn(`Post not found: ${postUri}`);
      throw new Error('POST_NOT_FOUND');
    }
    
    const errorText = await response.text();
    throw new Error(`Failed to remove post from all feeds: ${response.status} - ${errorText}`);
  }

  async removePost(postUri: string, feedId: string, user: User): Promise<void> {
    const sessionString = await this.getSessionString(user);
    
    const payload = feedId === 'all' 
      ? { at_uri: postUri }
      : { at_uri: postUri, algo_id: parseInt(feedId) };
    
    console.log(`[GrazeService] Removing post ${postUri} from feed ${feedId}, payload:`, JSON.stringify(payload));
    
    const response = await fetch('https://api.graze.social/app/hide_post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${sessionString}`
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 200 || response.status === 204) {
      const responseText = await response.text();
      console.log(`Removed post ${postUri} from feed ${feedId} (algo_id: ${feedId === 'all' ? 'none' : feedId}). Response: ${responseText}`);
      return;
    }
    
    if (response.status === 401) {
      // Session expired, clear and retry once
      this.sessions.delete(user.id);
      const newSessionString = await this.getSessionString(user);
      
      const retryResponse = await fetch('https://api.graze.social/app/hide_post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_cookie=${newSessionString}`
        },
        body: JSON.stringify(payload)
      });
      
      if (retryResponse.status === 200 || retryResponse.status === 204) {
        const retryResponseText = await retryResponse.text();
        console.log(`Removed post ${postUri} from feed ${feedId} (retry). Response: ${retryResponseText}`);
        return;
      }
      
      throw new Error(`Authentication failed for user ${user.handle}`);
    }
    
    if (response.status === 404) {
      console.warn(`Post not found in feed ${feedId}: ${postUri}`);
      throw new Error('POST_NOT_FOUND');
    }
    
    const errorText = await response.text();
    throw new Error(`Failed to remove post from feed ${feedId}: ${response.status} - ${errorText}`);
  }

  async unhidePost(postUri: string, feedId: string, user: User): Promise<void> {
    const sessionString = await this.getSessionString(user);
    
    const payload = feedId === 'all' 
      ? { at_uri: postUri }
      : { at_uri: postUri, algo_id: parseInt(feedId) };
    
    const response = await fetch('https://api.graze.social/app/unhide_post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${sessionString}`
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 200 || response.status === 204) {
      const responseText = await response.text();
      console.log(`Unhid post ${postUri} from feed ${feedId}. Response: ${responseText}`);
      return;
    }
    
    if (response.status === 401) {
      this.sessions.delete(user.id);
      const newSessionString = await this.getSessionString(user);
      
      const retryResponse = await fetch('https://api.graze.social/app/unhide_post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_cookie=${newSessionString}`
        },
        body: JSON.stringify(payload)
      });
      
      if (retryResponse.status === 200 || retryResponse.status === 204) {
        const retryResponseText = await retryResponse.text();
        console.log(`Unhid post ${postUri} from feed ${feedId} (retry). Response: ${retryResponseText}`);
        return;
      }
      
      throw new Error(`Authentication failed for user ${user.handle}`);
    }
    
    if (response.status === 404) {
      console.warn(`Post not found in feed ${feedId}: ${postUri}`);
      return;
    }
    
    const errorText = await response.text();
    throw new Error(`Failed to unhide post in feed ${feedId}: ${response.status} - ${errorText}`);
  }

  // Alias for unhidePost to match command naming
  async restorePost(postUri: string, feedId: string, user: User): Promise<void> {
    return this.unhidePost(postUri, feedId, user);
  }

  private convertAtUriToUrl(atUri: string): string {
    const match = atUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/(.+)$/);
    if (match) {
      const [, did, postId] = match;
      return `https://bsky.app/profile/${did}/post/${postId}`;
    }
    return atUri;
  }

  private async getSessionString(user: User): Promise<string> {
    // Zero-trust mode: get session from user's proxy
    if (user.zero_trust_mode && user.zero_trust_proxy_url && user.zero_trust_api_key) {
      return this.getZeroTrustSession(user);
    }

    // Check if user has basic password without zero trust - this won't work
    if (user.password_type === 'basic' && !user.zero_trust_mode) {
      throw new Error(`Cannot authenticate: You have a basic password but zero trust is disabled. Please set a Bluesky app password or enable zero trust mode.`);
    }

    // Check cached session
    const cached = this.sessions.get(user.id);
    if (cached && cached.expiresAt > new Date()) {
      return cached.sessionString;
    }

    // Authenticate with Graze
    if (!user.bsky_password) {
      throw new Error(`No Bluesky credentials stored for user ${user.handle}`);
    }

    // Decrypt password
    const decryptedPassword = await GrazeService.decryptPassword(user.bsky_password);
    
    const response = await fetch('https://api.graze.social/app/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: user.handle,
        password: decryptedPassword,
        service_domain: ''
      })
    });
    
    if (!response.ok) {
      throw new Error(`Graze auth failed for ${user.handle}: ${response.status}`);
    }
    
    // Extract session cookie
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const match = setCookieHeader.match(/session_cookie=([^;]+)/);
      if (match) {
        const sessionString = match[1];
        
        // Cache session (expires in 1 hour)
        this.sessions.set(user.id, {
          sessionString,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });
        
        console.log(`Authenticated with Graze for user ${user.handle}`);
        return sessionString;
      }
    }
    
    throw new Error(`Failed to extract session cookie for ${user.handle}`);
  }

  // Helper to encrypt passwords before storing (always use current key)
  static async encryptPassword(password: string): Promise<string> {
    const crypto = await import('crypto');
    const key = process.env.ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Helper to decrypt passwords with multiple key support
  private async getZeroTrustSession(user: User): Promise<string> {
    try {
      const client = new ZeroTrustProxyClient(user.zero_trust_proxy_url!, user.zero_trust_api_key!, user.handle);
      const sessionString = await client.getGrazeSession('POST_MODERATION');
      
      // Cache the session
      this.sessions.set(user.id, {
        sessionString,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });
      
      return sessionString;
    } catch (error) {
      await this.createNotification(user.id, 'zero_trust_proxy_offline',
        'Zero-Trust Proxy Offline',
        'Your authentication proxy is unreachable. Operations will be queued until it comes back online.');
      throw new Error('Zero-trust proxy offline');
    }
  }

  static async decryptPassword(encrypted: string): Promise<string> {
    const crypto = await import('crypto');
    const currentKey = process.env.ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
    const legacyKey = process.env.LEGACY_ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
    
    const parts = encrypted.split(':');
    
    if (parts.length === 2) {
      // New format with IV - try current key first, then legacy
      for (const key of [currentKey, legacyKey]) {
        try {
          const keyBuffer = crypto.scryptSync(key, 'salt', 32);
          const iv = Buffer.from(parts[0], 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
          let decrypted = decipher.update(parts[1], 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        } catch (error) {
          continue; // Try next key
        }
      }
      throw new Error('Password decryption failed - please re-enter your Bluesky app password');
    } else {
      // Old format - try both keys
      for (const key of [currentKey, legacyKey]) {
        try {
          const decipher = crypto.createDecipher('aes256', key);
          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        } catch (error) {
          continue;
        }
      }
      throw new Error('Password decryption failed - please re-enter your Bluesky app password');
    }
  }

}