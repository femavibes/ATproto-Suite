import { Database } from './database.js';

interface UserWhitelistEntry {
  id: number;
  user_id: number;
  whitelisted_did: string;
  whitelisted_handle?: string;
  created_at: Date;
}

interface FeedWhitelistEntry {
  id: number;
  feed_id: string;
  whitelisted_did: string;
  whitelisted_handle?: string;
  is_blacklist: boolean;
  created_at: Date;
}

export class WhitelistService {
  constructor(private db: Database) {}

  async isWhitelisted(postAuthorDid: string, userId: number, feedId?: string): Promise<boolean> {
    // Check global user whitelist first
    const globalWhitelist = await this.db.getPool().query(
      'SELECT 1 FROM user_whitelists WHERE user_id = $1 AND whitelisted_did = $2',
      [userId, postAuthorDid]
    );
    
    if (globalWhitelist.rows.length > 0) {
      // Check if feed has blacklist override (premium only)
      if (feedId) {
        const user = await this.db.getUserById(userId);
        if (user?.subscription_tier === 'paid' || user?.subscription_tier === 'premium') {
          const blacklist = await this.db.getPool().query(
            'SELECT 1 FROM feed_whitelists WHERE feed_id = $1 AND whitelisted_did = $2 AND is_blacklist = true',
            [feedId, postAuthorDid]
          );
          if (blacklist.rows.length > 0) {
            return false; // Blacklisted for this feed
          }
        }
      }
      return true; // Globally whitelisted
    }

    // Check per-feed whitelist (paid+ only)
    if (feedId) {
      const user = await this.db.getUserById(userId);
      if (user?.subscription_tier === 'paid' || user?.subscription_tier === 'premium') {
        const feedWhitelist = await this.db.getPool().query(
          'SELECT 1 FROM feed_whitelists WHERE feed_id = $1 AND whitelisted_did = $2 AND is_blacklist = false',
          [feedId, postAuthorDid]
        );
        return feedWhitelist.rows.length > 0;
      }
    }

    return false;
  }

  async addToUserWhitelist(userId: number, did: string, handle?: string): Promise<void> {
    await this.db.getPool().query(
      'INSERT INTO user_whitelists (user_id, whitelisted_did, whitelisted_handle) VALUES ($1, $2, $3) ON CONFLICT (user_id, whitelisted_did) DO NOTHING',
      [userId, did, handle]
    );
  }

  async addToFeedWhitelist(feedId: string, did: string, handle?: string, isBlacklist = false): Promise<void> {
    await this.db.getPool().query(
      'INSERT INTO feed_whitelists (feed_id, whitelisted_did, whitelisted_handle, is_blacklist) VALUES ($1, $2, $3, $4) ON CONFLICT (feed_id, whitelisted_did) DO NOTHING',
      [feedId, did, handle, isBlacklist]
    );
  }

  async removeFromUserWhitelist(userId: number, did: string): Promise<void> {
    await this.db.getPool().query(
      'DELETE FROM user_whitelists WHERE user_id = $1 AND whitelisted_did = $2',
      [userId, did]
    );
  }

  async removeFromFeedWhitelist(feedId: string, did: string): Promise<void> {
    await this.db.getPool().query(
      'DELETE FROM feed_whitelists WHERE feed_id = $1 AND whitelisted_did = $2',
      [feedId, did]
    );
  }

  async getUserWhitelist(userId: number): Promise<UserWhitelistEntry[]> {
    const result = await this.db.getPool().query(
      'SELECT * FROM user_whitelists WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async getFeedWhitelist(feedId: string): Promise<FeedWhitelistEntry[]> {
    const result = await this.db.getPool().query(
      'SELECT * FROM feed_whitelists WHERE feed_id = $1 ORDER BY created_at DESC',
      [feedId]
    );
    return result.rows;
  }
}