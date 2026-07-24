import bcrypt from 'bcrypt';
import { User } from '../types/index.js';

interface GrazeSession {
  sessionString: string;
  userId: number;
  expiresAt: Date;
}

export class PasswordService {
  private sessions = new Map<number, GrazeSession>();



  async removePost(postUri: string, feedId: string, user: User): Promise<void> {
    const sessionString = await this.getSessionString(user);
    
    const payload = feedId === 'all' 
      ? { at_uri: postUri }
      : { at_uri: postUri, algo_id: parseInt(feedId) };
    
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
      console.log(`Removed post ${postUri} from feed ${feedId}. Response: ${responseText}`);
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
      return;
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

  private convertAtUriToUrl(atUri: string): string {
    const match = atUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/(.+)$/);
    if (match) {
      const [, did, postId] = match;
      return `https://bsky.app/profile/${did}/post/${postId}`;
    }
    return atUri;
  }

  private async getSessionString(user: User): Promise<string> {
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
    let decryptedPassword: string;
    try {
      decryptedPassword = await PasswordService.decryptPassword(user.bsky_password);
    } catch (error) {
      if (error instanceof Error && error.message.includes('outdated')) {
        throw new Error('Your stored Bluesky password needs to be updated. Please go to your profile settings and re-enter your app password.');
      }
      throw error;
    }
    
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

  // Helper to encrypt session tokens
  static async encryptSessionToken(token: string): Promise<string> {
    const crypto = await import('crypto');
    const key = process.env.ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
    const keyBuffer = crypto.scryptSync(key, 'session-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Helper to decrypt session tokens
  static async decryptSessionToken(encrypted: string): Promise<string> {
    const crypto = await import('crypto');
    const key = process.env.ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
    const keyBuffer = crypto.scryptSync(key, 'session-salt', 32);
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Helper to decrypt passwords with multiple key support
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