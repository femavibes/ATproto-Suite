import { Database } from './database.js';

export class AdminThresholdSync {
  private static instance: AdminThresholdSync;
  private db: Database;

  private constructor() {
    this.db = Database.getInstance();
  }

  public static getInstance(): AdminThresholdSync {
    if (!AdminThresholdSync.instance) {
      AdminThresholdSync.instance = new AdminThresholdSync();
    }
    return AdminThresholdSync.instance;
  }

  /**
   * Sync users with admin defaults when admin updates thresholds
   */
  async syncUsersWithAdminDefaults(thresholdType: 'global' | 'feed' = 'global'): Promise<{ postSyncCount: number, banSyncCount: number }> {
    const pool = this.db.getPool();
    
    // Get admin defaults
    const defaultsResult = await pool.query(`
      SELECT category, subcategory, post_threshold, user_ban_threshold
      FROM admin_defaults
      WHERE threshold_type = $1
    `, [thresholdType]);
    
    const defaults = defaultsResult.rows;
    let postSyncCount = 0;
    let banSyncCount = 0;
    
    if (thresholdType === 'global') {
      // Sync global post thresholds for users who have sync enabled
      const postSyncUsers = await pool.query(`
        SELECT id FROM user_profiles WHERE sync_global_post_thresholds = true
      `);
      
      for (const user of postSyncUsers.rows) {
        for (const def of defaults) {
          if (def.post_threshold === null) continue; // Skip excluded categories
          const columnName = def.subcategory 
            ? `global_threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
            : `global_threshold_${def.category.replace('-', '_')}`;
          
          await pool.query(`
            UPDATE user_profiles 
            SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [def.post_threshold, user.id]);
        }
        postSyncCount++;
      }
      
      // Sync global ban thresholds for users who have sync enabled
      const banSyncUsers = await pool.query(`
        SELECT id FROM user_profiles WHERE sync_global_ban_thresholds = true
      `);
      
      for (const user of banSyncUsers.rows) {
        for (const def of defaults) {
          if (def.user_ban_threshold === null) continue; // Skip excluded categories
          const columnName = def.subcategory 
            ? `global_user_ban_threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
            : `global_user_ban_threshold_${def.category.replace('-', '_')}`;
          
          await pool.query(`
            UPDATE user_profiles 
            SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
          `, [def.user_ban_threshold, user.id]);
        }
        banSyncCount++;
      }
    } else {
      // Sync feed post thresholds
      const postSyncFeeds = await pool.query(`
        SELECT feed_id FROM feeds WHERE sync_feed_post_thresholds = true
      `);
      
      for (const feed of postSyncFeeds.rows) {
        for (const def of defaults) {
          if (def.post_threshold === null) continue; // Skip excluded categories
          const columnName = def.subcategory 
            ? `threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
            : `threshold_${def.category.replace('-', '_')}`;
          
          await pool.query(`
            UPDATE feeds 
            SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE feed_id = $2
          `, [def.post_threshold, feed.feed_id]);
        }
        postSyncCount++;
      }
      
      // Sync feed ban thresholds
      const banSyncFeeds = await pool.query(`
        SELECT feed_id FROM feeds WHERE sync_feed_ban_thresholds = true
      `);
      
      for (const feed of banSyncFeeds.rows) {
        for (const def of defaults) {
          if (def.user_ban_threshold === null) continue; // Skip excluded categories
          const columnName = def.subcategory 
            ? `user_ban_threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
            : `user_ban_threshold_${def.category.replace('-', '_')}`;
          
          await pool.query(`
            UPDATE feeds 
            SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE feed_id = $2
          `, [def.user_ban_threshold, feed.feed_id]);
        }
        banSyncCount++;
      }
    }
    
    return { postSyncCount, banSyncCount };
  }

  /**
   * Apply admin defaults to a specific user (used during registration)
   */
  async applyAdminDefaultsToUser(userId: number): Promise<void> {
    const pool = this.db.getPool();
    
    // Get admin defaults for global thresholds
    const defaultsResult = await pool.query(`
      SELECT category, subcategory, post_threshold, user_ban_threshold
      FROM admin_defaults
      WHERE threshold_type = 'global'
    `);
    
    for (const def of defaultsResult.rows) {
      if (def.post_threshold === null || def.user_ban_threshold === null) continue; // Skip excluded categories
      
      const postColumnName = def.subcategory 
        ? `global_threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
        : `global_threshold_${def.category.replace('-', '_')}`;
      const banColumnName = def.subcategory 
        ? `global_user_ban_threshold_${def.category.replace('-', '_')}_${def.subcategory.replace('-', '_')}`
        : `global_user_ban_threshold_${def.category.replace('-', '_')}`;
      
      await pool.query(`
        UPDATE user_profiles 
        SET ${postColumnName} = $1, ${banColumnName} = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [def.post_threshold, def.user_ban_threshold, userId]);
    }
  }

  /**
   * Get current admin defaults
   */
  async getAdminDefaults(thresholdType?: 'global' | 'feed'): Promise<any[]> {
    const pool = this.db.getPool();
    
    let query = `
      SELECT threshold_type, category, subcategory, post_threshold, user_ban_threshold, updated_at
      FROM admin_defaults
    `;
    let params: any[] = [];
    
    if (thresholdType) {
      query += ` WHERE threshold_type = $1`;
      params = [thresholdType];
    }
    
    query += ` ORDER BY threshold_type, category, subcategory NULLS FIRST`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update admin defaults and sync affected users
   */
  async updateAdminDefaults(defaults: any[]): Promise<{ updated: number, postSyncCount: number, banSyncCount: number }> {
    const pool = this.db.getPool();
    let updated = 0;
    
    // Update each default
    for (const def of defaults) {
      const { threshold_type, category, subcategory, post_threshold, user_ban_threshold } = def;
      
      await pool.query(`
        INSERT INTO admin_defaults (threshold_type, category, subcategory, post_threshold, user_ban_threshold)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (threshold_type, category, subcategory)
        DO UPDATE SET 
          post_threshold = EXCLUDED.post_threshold,
          user_ban_threshold = EXCLUDED.user_ban_threshold,
          updated_at = CURRENT_TIMESTAMP
      `, [threshold_type, category, subcategory, post_threshold, user_ban_threshold]);
      
      updated++;
    }
    
    // Auto-sync users who have sync enabled
    const globalSyncResult = await this.syncUsersWithAdminDefaults('global');
    const feedSyncResult = await this.syncUsersWithAdminDefaults('feed');
    
    return {
      updated,
      postSyncCount: globalSyncResult.postSyncCount + feedSyncResult.postSyncCount,
      banSyncCount: globalSyncResult.banSyncCount + feedSyncResult.banSyncCount
    };
  }

  /**
   * Enable sync for user - backup current settings first
   */
  async enableUserSync(userId: number, syncType: 'post' | 'ban'): Promise<void> {
    const pool = this.db.getPool();
    
    if (syncType === 'post') {
      // Backup current post thresholds
      await pool.query(`
        UPDATE user_profiles SET
          backup_global_threshold_misleading = global_threshold_misleading,
          backup_global_threshold_harassment = global_threshold_harassment,
          backup_global_threshold_violence = global_threshold_violence,
          backup_global_threshold_sexual = global_threshold_sexual,
          backup_global_threshold_child_safety = global_threshold_child_safety,
          backup_global_threshold_self_harm = global_threshold_self_harm,
          backup_global_threshold_rule = global_threshold_rule,
          backup_global_threshold_misleading_spam = global_threshold_misleading_spam,
          backup_global_threshold_misleading_scam = global_threshold_misleading_scam,
          backup_global_threshold_misleading_bot = global_threshold_misleading_bot,
          backup_global_threshold_misleading_impersonation = global_threshold_misleading_impersonation,
          backup_global_threshold_misleading_elections = global_threshold_misleading_elections,
          backup_global_threshold_harassment_troll = global_threshold_harassment_troll,
          backup_global_threshold_harassment_targeted = global_threshold_harassment_targeted,
          backup_global_threshold_harassment_hate_speech = global_threshold_harassment_hate_speech,
          backup_global_threshold_harassment_doxxing = global_threshold_harassment_doxxing
        WHERE id = $1 AND sync_global_post_thresholds = false
      `, [userId]);
    } else {
      // Backup current ban thresholds
      await pool.query(`
        UPDATE user_profiles SET
          backup_global_user_ban_threshold_misleading = global_user_ban_threshold_misleading,
          backup_global_user_ban_threshold_harassment = global_user_ban_threshold_harassment,
          backup_global_user_ban_threshold_violence = global_user_ban_threshold_violence,
          backup_global_user_ban_threshold_sexual = global_user_ban_threshold_sexual,
          backup_global_user_ban_threshold_child_safety = global_user_ban_threshold_child_safety,
          backup_global_user_ban_threshold_self_harm = global_user_ban_threshold_self_harm,
          backup_global_user_ban_threshold_rule = global_user_ban_threshold_rule,
          backup_global_user_ban_threshold_misleading_spam = global_user_ban_threshold_misleading_spam,
          backup_global_user_ban_threshold_misleading_scam = global_user_ban_threshold_misleading_scam,
          backup_global_user_ban_threshold_misleading_bot = global_user_ban_threshold_misleading_bot,
          backup_global_user_ban_threshold_misleading_impersonation = global_user_ban_threshold_misleading_impersonation,
          backup_global_user_ban_threshold_misleading_elections = global_user_ban_threshold_misleading_elections,
          backup_global_user_ban_threshold_harassment_troll = global_user_ban_threshold_harassment_troll,
          backup_global_user_ban_threshold_harassment_targeted = global_user_ban_threshold_harassment_targeted,
          backup_global_user_ban_threshold_harassment_hate_speech = global_user_ban_threshold_harassment_hate_speech,
          backup_global_user_ban_threshold_harassment_doxxing = global_user_ban_threshold_harassment_doxxing
        WHERE id = $1 AND sync_global_ban_thresholds = false
      `, [userId]);
    }
  }

  /**
   * Disable sync for user - restore backed up settings
   */
  async disableUserSync(userId: number, syncType: 'post' | 'ban'): Promise<void> {
    const pool = this.db.getPool();
    
    if (syncType === 'post') {
      // Restore backed up post thresholds
      await pool.query(`
        UPDATE user_profiles SET
          global_threshold_misleading = COALESCE(backup_global_threshold_misleading, global_threshold_misleading),
          global_threshold_harassment = COALESCE(backup_global_threshold_harassment, global_threshold_harassment),
          global_threshold_violence = COALESCE(backup_global_threshold_violence, global_threshold_violence),
          global_threshold_sexual = COALESCE(backup_global_threshold_sexual, global_threshold_sexual),
          global_threshold_child_safety = COALESCE(backup_global_threshold_child_safety, global_threshold_child_safety),
          global_threshold_self_harm = COALESCE(backup_global_threshold_self_harm, global_threshold_self_harm),
          global_threshold_rule = COALESCE(backup_global_threshold_rule, global_threshold_rule),
          global_threshold_misleading_spam = COALESCE(backup_global_threshold_misleading_spam, global_threshold_misleading_spam),
          global_threshold_misleading_scam = COALESCE(backup_global_threshold_misleading_scam, global_threshold_misleading_scam),
          global_threshold_misleading_bot = COALESCE(backup_global_threshold_misleading_bot, global_threshold_misleading_bot),
          global_threshold_misleading_impersonation = COALESCE(backup_global_threshold_misleading_impersonation, global_threshold_misleading_impersonation),
          global_threshold_misleading_elections = COALESCE(backup_global_threshold_misleading_elections, global_threshold_misleading_elections),
          global_threshold_harassment_troll = COALESCE(backup_global_threshold_harassment_troll, global_threshold_harassment_troll),
          global_threshold_harassment_targeted = COALESCE(backup_global_threshold_harassment_targeted, global_threshold_harassment_targeted),
          global_threshold_harassment_hate_speech = COALESCE(backup_global_threshold_harassment_hate_speech, global_threshold_harassment_hate_speech),
          global_threshold_harassment_doxxing = COALESCE(backup_global_threshold_harassment_doxxing, global_threshold_harassment_doxxing)
        WHERE id = $1
      `, [userId]);
    } else {
      // Restore backed up ban thresholds
      await pool.query(`
        UPDATE user_profiles SET
          global_user_ban_threshold_misleading = COALESCE(backup_global_user_ban_threshold_misleading, global_user_ban_threshold_misleading),
          global_user_ban_threshold_harassment = COALESCE(backup_global_user_ban_threshold_harassment, global_user_ban_threshold_harassment),
          global_user_ban_threshold_violence = COALESCE(backup_global_user_ban_threshold_violence, global_user_ban_threshold_violence),
          global_user_ban_threshold_sexual = COALESCE(backup_global_user_ban_threshold_sexual, global_user_ban_threshold_sexual),
          global_user_ban_threshold_child_safety = COALESCE(backup_global_user_ban_threshold_child_safety, global_user_ban_threshold_child_safety),
          global_user_ban_threshold_self_harm = COALESCE(backup_global_user_ban_threshold_self_harm, global_user_ban_threshold_self_harm),
          global_user_ban_threshold_rule = COALESCE(backup_global_user_ban_threshold_rule, global_user_ban_threshold_rule),
          global_user_ban_threshold_misleading_spam = COALESCE(backup_global_user_ban_threshold_misleading_spam, global_user_ban_threshold_misleading_spam),
          global_user_ban_threshold_misleading_scam = COALESCE(backup_global_user_ban_threshold_misleading_scam, global_user_ban_threshold_misleading_scam),
          global_user_ban_threshold_misleading_bot = COALESCE(backup_global_user_ban_threshold_misleading_bot, global_user_ban_threshold_misleading_bot),
          global_user_ban_threshold_misleading_impersonation = COALESCE(backup_global_user_ban_threshold_misleading_impersonation, global_user_ban_threshold_misleading_impersonation),
          global_user_ban_threshold_misleading_elections = COALESCE(backup_global_user_ban_threshold_misleading_elections, global_user_ban_threshold_misleading_elections),
          global_user_ban_threshold_harassment_troll = COALESCE(backup_global_user_ban_threshold_harassment_troll, global_user_ban_threshold_harassment_troll),
          global_user_ban_threshold_harassment_targeted = COALESCE(backup_global_user_ban_threshold_harassment_targeted, global_user_ban_threshold_harassment_targeted),
          global_user_ban_threshold_harassment_hate_speech = COALESCE(backup_global_user_ban_threshold_harassment_hate_speech, global_user_ban_threshold_harassment_hate_speech),
          global_user_ban_threshold_harassment_doxxing = COALESCE(backup_global_user_ban_threshold_harassment_doxxing, global_user_ban_threshold_harassment_doxxing)
        WHERE id = $1
      `, [userId]);
    }
  }

  /**
   * Enable sync for feed - backup current settings first
   */
  async enableFeedSync(feedId: string, syncType: 'post' | 'ban'): Promise<void> {
    const pool = this.db.getPool();
    
    if (syncType === 'post') {
      // Backup current post thresholds
      await pool.query(`
        UPDATE feeds SET
          backup_threshold_misleading = threshold_misleading,
          backup_threshold_harassment = threshold_harassment,
          backup_threshold_violence = threshold_violence,
          backup_threshold_sexual = threshold_sexual,
          backup_threshold_child_safety = threshold_child_safety,
          backup_threshold_self_harm = threshold_self_harm,
          backup_threshold_rule = threshold_rule,
          backup_threshold_misleading_spam = threshold_misleading_spam,
          backup_threshold_misleading_scam = threshold_misleading_scam,
          backup_threshold_misleading_bot = threshold_misleading_bot,
          backup_threshold_misleading_impersonation = threshold_misleading_impersonation,
          backup_threshold_misleading_elections = threshold_misleading_elections,
          backup_threshold_harassment_troll = threshold_harassment_troll,
          backup_threshold_harassment_targeted = threshold_harassment_targeted,
          backup_threshold_harassment_hate_speech = threshold_harassment_hate_speech,
          backup_threshold_harassment_doxxing = threshold_harassment_doxxing
        WHERE feed_id = $1 AND sync_feed_post_thresholds = false
      `, [feedId]);
    } else {
      // Backup current ban thresholds
      await pool.query(`
        UPDATE feeds SET
          backup_user_ban_threshold_misleading = user_ban_threshold_misleading,
          backup_user_ban_threshold_harassment = user_ban_threshold_harassment,
          backup_user_ban_threshold_violence = user_ban_threshold_violence,
          backup_user_ban_threshold_sexual = user_ban_threshold_sexual,
          backup_user_ban_threshold_child_safety = user_ban_threshold_child_safety,
          backup_user_ban_threshold_self_harm = user_ban_threshold_self_harm,
          backup_user_ban_threshold_rule = user_ban_threshold_rule,
          backup_user_ban_threshold_misleading_spam = user_ban_threshold_misleading_spam,
          backup_user_ban_threshold_misleading_scam = user_ban_threshold_misleading_scam,
          backup_user_ban_threshold_misleading_bot = user_ban_threshold_misleading_bot,
          backup_user_ban_threshold_misleading_impersonation = user_ban_threshold_misleading_impersonation,
          backup_user_ban_threshold_misleading_elections = user_ban_threshold_misleading_elections,
          backup_user_ban_threshold_harassment_troll = user_ban_threshold_harassment_troll,
          backup_user_ban_threshold_harassment_targeted = user_ban_threshold_harassment_targeted,
          backup_user_ban_threshold_harassment_hate_speech = user_ban_threshold_harassment_hate_speech,
          backup_user_ban_threshold_harassment_doxxing = user_ban_threshold_harassment_doxxing
        WHERE feed_id = $1 AND sync_feed_ban_thresholds = false
      `, [feedId]);
    }
  }

  /**
   * Disable sync for feed - restore backed up settings
   */
  async disableFeedSync(feedId: string, syncType: 'post' | 'ban'): Promise<void> {
    const pool = this.db.getPool();
    
    if (syncType === 'post') {
      // Restore backed up post thresholds
      await pool.query(`
        UPDATE feeds SET
          threshold_misleading = COALESCE(backup_threshold_misleading, threshold_misleading),
          threshold_harassment = COALESCE(backup_threshold_harassment, threshold_harassment),
          threshold_violence = COALESCE(backup_threshold_violence, threshold_violence),
          threshold_sexual = COALESCE(backup_threshold_sexual, threshold_sexual),
          threshold_child_safety = COALESCE(backup_threshold_child_safety, threshold_child_safety),
          threshold_self_harm = COALESCE(backup_threshold_self_harm, threshold_self_harm),
          threshold_rule = COALESCE(backup_threshold_rule, threshold_rule),
          threshold_misleading_spam = COALESCE(backup_threshold_misleading_spam, threshold_misleading_spam),
          threshold_misleading_scam = COALESCE(backup_threshold_misleading_scam, threshold_misleading_scam),
          threshold_misleading_bot = COALESCE(backup_threshold_misleading_bot, threshold_misleading_bot),
          threshold_misleading_impersonation = COALESCE(backup_threshold_misleading_impersonation, threshold_misleading_impersonation),
          threshold_misleading_elections = COALESCE(backup_threshold_misleading_elections, threshold_misleading_elections),
          threshold_harassment_troll = COALESCE(backup_threshold_harassment_troll, threshold_harassment_troll),
          threshold_harassment_targeted = COALESCE(backup_threshold_harassment_targeted, threshold_harassment_targeted),
          threshold_harassment_hate_speech = COALESCE(backup_threshold_harassment_hate_speech, threshold_harassment_hate_speech),
          threshold_harassment_doxxing = COALESCE(backup_threshold_harassment_doxxing, threshold_harassment_doxxing)
        WHERE feed_id = $1
      `, [feedId]);
    } else {
      // Restore backed up ban thresholds
      await pool.query(`
        UPDATE feeds SET
          user_ban_threshold_misleading = COALESCE(backup_user_ban_threshold_misleading, user_ban_threshold_misleading),
          user_ban_threshold_harassment = COALESCE(backup_user_ban_threshold_harassment, user_ban_threshold_harassment),
          user_ban_threshold_violence = COALESCE(backup_user_ban_threshold_violence, user_ban_threshold_violence),
          user_ban_threshold_sexual = COALESCE(backup_user_ban_threshold_sexual, user_ban_threshold_sexual),
          user_ban_threshold_child_safety = COALESCE(backup_user_ban_threshold_child_safety, user_ban_threshold_child_safety),
          user_ban_threshold_self_harm = COALESCE(backup_user_ban_threshold_self_harm, user_ban_threshold_self_harm),
          user_ban_threshold_rule = COALESCE(backup_user_ban_threshold_rule, user_ban_threshold_rule),
          user_ban_threshold_misleading_spam = COALESCE(backup_user_ban_threshold_misleading_spam, user_ban_threshold_misleading_spam),
          user_ban_threshold_misleading_scam = COALESCE(backup_user_ban_threshold_misleading_scam, user_ban_threshold_misleading_scam),
          user_ban_threshold_misleading_bot = COALESCE(backup_user_ban_threshold_misleading_bot, user_ban_threshold_misleading_bot),
          user_ban_threshold_misleading_impersonation = COALESCE(backup_user_ban_threshold_misleading_impersonation, user_ban_threshold_misleading_impersonation),
          user_ban_threshold_misleading_elections = COALESCE(backup_user_ban_threshold_misleading_elections, user_ban_threshold_misleading_elections),
          user_ban_threshold_harassment_troll = COALESCE(backup_user_ban_threshold_harassment_troll, user_ban_threshold_harassment_troll),
          user_ban_threshold_harassment_targeted = COALESCE(backup_user_ban_threshold_harassment_targeted, user_ban_threshold_harassment_targeted),
          user_ban_threshold_harassment_hate_speech = COALESCE(backup_user_ban_threshold_harassment_hate_speech, user_ban_threshold_harassment_hate_speech),
          user_ban_threshold_harassment_doxxing = COALESCE(backup_user_ban_threshold_harassment_doxxing, user_ban_threshold_harassment_doxxing)
        WHERE feed_id = $1
      `, [feedId]);
    }
  }
}