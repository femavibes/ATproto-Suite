import { Pool } from 'pg';
import { User, Feed, PostReport, ModerationAction } from '../types/index.js';

export class Database {
  private static instance: Database;
  public pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 15, // Increased pool size for Docker environment
      min: 2, 
      idleTimeoutMillis: 30000, // Release idle connections faster
      connectionTimeoutMillis: 5000, // Increased timeout
      statement_timeout: 15000, // Increased timeout
      query_timeout: 15000, // Increased timeout
    });
    
    // Add error handling for pool
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect() {
    await this.pool.connect();
  }

  // User operations (removed - use user_profiles)

  async getUserByDid(did: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM user_profiles WHERE did = $1', [did]);
    return result.rows[0] || null;
  }

  async getUserProfileByDid(did: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM user_profiles WHERE did = $1', [did]);
    return result.rows[0] || null;
  }

  async createUserProfile(did: string, handle: string, subscriptionTier: string = 'none'): Promise<User> {
    const result = await this.pool.query(
      'INSERT INTO user_profiles (did, handle, subscription_tier, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [did, handle, subscriptionTier]
    );
    return result.rows[0];
  }



  async updateUserProfileCredentials(userId: number, encryptedPassword: string): Promise<void> {
    await this.pool.query(
      'UPDATE user_profiles SET bsky_password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [encryptedPassword, userId]
    );
  }

  // Feed operations
  async createFeed(userId: number, feedId: string, feedName: string, feedSlug?: string, feedUrl?: string): Promise<Feed> {
    // Define excluded subcategories that should be false by default
    const excludedTypes = ['misleading_other', 'harassment_other', 'violence_other', 'sexual_other', 'self_harm_other', 'rule_other'];
    
    // Define all subcategory opt-in columns
    const subcategoryOptIns = [
      'opt_in_misleading_spam', 'opt_in_misleading_scam', 'opt_in_misleading_bot', 'opt_in_misleading_impersonation', 'opt_in_misleading_elections', 'opt_in_misleading_other',
      'opt_in_harassment_troll', 'opt_in_harassment_targeted', 'opt_in_harassment_hate_speech', 'opt_in_harassment_doxxing', 'opt_in_harassment_other',
      'opt_in_violence_animal', 'opt_in_violence_threats', 'opt_in_violence_graphic_content', 'opt_in_violence_glorification', 'opt_in_violence_trafficking', 'opt_in_violence_other',
      'opt_in_sexual_unlabeled', 'opt_in_sexual_abuse_content', 'opt_in_sexual_ncii', 'opt_in_sexual_deepfake', 'opt_in_sexual_animal', 'opt_in_sexual_other',
      'opt_in_child_safety_privacy', 'opt_in_child_safety_harassment',
      'opt_in_self_harm_content', 'opt_in_self_harm_ed', 'opt_in_self_harm_stunts', 'opt_in_self_harm_substances', 'opt_in_self_harm_other',
      'opt_in_rule_site_security', 'opt_in_rule_prohibited_sales', 'opt_in_rule_ban_evasion', 'opt_in_rule_other'
    ];
    
    // User ban opt-ins
    const userBanOptIns = [
      'user_ban_opt_in_misleading_spam', 'user_ban_opt_in_misleading_scam', 'user_ban_opt_in_misleading_bot', 'user_ban_opt_in_misleading_impersonation', 'user_ban_opt_in_misleading_elections', 'user_ban_opt_in_misleading_other',
      'user_ban_opt_in_harassment_troll', 'user_ban_opt_in_harassment_targeted', 'user_ban_opt_in_harassment_hate_speech', 'user_ban_opt_in_harassment_doxxing', 'user_ban_opt_in_harassment_other',
      'user_ban_opt_in_violence_animal', 'user_ban_opt_in_violence_threats', 'user_ban_opt_in_violence_graphic_content', 'user_ban_opt_in_violence_glorification', 'user_ban_opt_in_violence_trafficking', 'user_ban_opt_in_violence_other',
      'user_ban_opt_in_sexual_unlabeled', 'user_ban_opt_in_sexual_abuse_content', 'user_ban_opt_in_sexual_ncii', 'user_ban_opt_in_sexual_deepfake', 'user_ban_opt_in_sexual_animal', 'user_ban_opt_in_sexual_other',
      'user_ban_opt_in_child_safety_privacy', 'user_ban_opt_in_child_safety_harassment',
      'user_ban_opt_in_self_harm_content', 'user_ban_opt_in_self_harm_ed', 'user_ban_opt_in_self_harm_stunts', 'user_ban_opt_in_self_harm_substances', 'user_ban_opt_in_self_harm_other',
      'user_ban_opt_in_rule_site_security', 'user_ban_opt_in_rule_prohibited_sales', 'user_ban_opt_in_rule_ban_evasion', 'user_ban_opt_in_rule_other'
    ];
    
    // Build columns and values for insert
    const columns = ['user_id', 'feed_id', 'feed_name'];
    const values = [userId, feedId, feedName];
    
    // Add feed_slug if provided
    if (feedSlug) {
      columns.push('feed_slug');
      values.push(feedSlug);
    }
    
    // Add feed_url if provided
    if (feedUrl) {
      columns.push('feed_url');
      values.push(feedUrl);
    }
    
    // Add subcategory opt-ins (true for allowed, false for excluded)
    subcategoryOptIns.forEach(col => {
      const typeKey = col.replace('opt_in_', '');
      const isExcluded = excludedTypes.includes(typeKey);
      columns.push(col);
      values.push(!isExcluded as any); // true for allowed types, false for excluded
    });
    
    // Add user ban opt-ins (true for allowed, false for excluded)
    userBanOptIns.forEach(col => {
      const typeKey = col.replace('user_ban_opt_in_', '');
      const isExcluded = excludedTypes.includes(typeKey);
      columns.push(col);
      values.push(!isExcluded as any); // true for allowed types, false for excluded
    });
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO feeds (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getUserFeeds(userId: number): Promise<Feed[]> {
    const result = await this.pool.query('SELECT * FROM feeds WHERE user_id = $1', [userId]);
    return result.rows;
  }

  async updateFeedBlueskyName(feedId: string, blueskyFeedName: string): Promise<void> {
    await this.pool.query(
      'UPDATE feeds SET bluesky_feed_name = $1 WHERE feed_id = $2',
      [blueskyFeedName, feedId]
    );
  }

  async getFeedById(feedId: string): Promise<Feed | null> {
    const result = await this.pool.query('SELECT * FROM feeds WHERE feed_id = $1', [feedId]);
    return result.rows[0] || null;
  }

  async getUserById(userId: number): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
    return result.rows[0] || null;
  }

  async getUserProfileById(userId: number): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
    return result.rows[0] || null;
  }

  // Expose pool for admin routes
  getPool() {
    return this.pool;
  }

  async syncBanLists(userId: number, specificListType?: string): Promise<{added: number, removed: number}> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    return await blueskyService.syncBanLists(user, specificListType);
  }

  async getFeedsByOptIn(reportType: string): Promise<Feed[]> {
    const column = `opt_in_${reportType.replace(/-/g, '_')}`;
    const result = await this.pool.query(
      `SELECT * FROM feeds WHERE ${column} = true`
    );
    return result.rows;
  }

  async getThresholdForReportType(feedId: string, reportType: string): Promise<number> {
    // Skip communal moderation for 'other' report types - they're command-only
    if (reportType === 'other' || reportType.endsWith('-other')) {
      return 999999; // Effectively disable communal thresholds for 'other' types
    }
    
    const subcategoryColumn = `threshold_${reportType.replace(/-/g, '_')}`;
    const mainCategory = reportType.split('-')[0];
    const mainCategoryColumn = `threshold_${mainCategory.replace(/-/g, '_')}`;
    const globalSubcategoryColumn = `global_threshold_${reportType.replace(/-/g, '_')}`;
    const globalMainCategoryColumn = `global_threshold_${mainCategory.replace(/-/g, '_')}`;
    
    const result = await this.pool.query(
      `SELECT f.${subcategoryColumn}, f.${mainCategoryColumn}, up.${globalSubcategoryColumn}, up.${globalMainCategoryColumn}
       FROM feeds f 
       JOIN user_profiles up ON f.user_id = up.id 
       WHERE f.feed_id = $1`,
      [feedId]
    );
    
    if (result.rows.length === 0) return 3; // Default fallback
    
    const row = result.rows[0];
    
    // Priority: per-feed subcategory > per-feed main category > global subcategory > global main category > default
    return row[subcategoryColumn] !== null ? row[subcategoryColumn] :
           row[mainCategoryColumn] !== null ? row[mainCategoryColumn] :
           row[globalSubcategoryColumn] !== null ? row[globalSubcategoryColumn] :
           row[globalMainCategoryColumn] !== null ? row[globalMainCategoryColumn] : 3;
  }

  async logCommandExecution(execution: {
    reporter_did: string;
    post_uri: string;
    command_type: string;
    command_text: string;
    affected_feeds: string[];
    execution_status: 'success' | 'failed' | 'unauthorized';
    error_message?: string;
  }): Promise<void> {
    await this.pool.query(
      'INSERT INTO command_executions (reporter_did, post_uri, command_type, command_text, affected_feeds, execution_status, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [execution.reporter_did, execution.post_uri, execution.command_type, execution.command_text, execution.affected_feeds, execution.execution_status, execution.error_message]
    );
  }

  // Report tracking
  async addPostReport(postUri: string, reportType: string, reporterDid: string, source: string = 'ozone', labelerDid?: string, weight: number = 1.0): Promise<void> {
    await this.pool.query(
      'INSERT INTO post_reports (post_uri, report_type, reporter_did, source, labeler_did, report_weight) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (post_uri, report_type, reporter_did) DO NOTHING',
      [postUri, reportType, reporterDid, source, labelerDid, weight]
    );
  }

  async getReportCount(postUri: string, reportType: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM post_reports WHERE post_uri = $1 AND report_type = $2',
      [postUri, reportType]
    );
    return parseInt(result.rows[0].count);
  }

  async getUserFeedsByDid(userDid: string): Promise<Feed[]> {
    const result = await this.pool.query(`
      SELECT f.* FROM feeds f
      JOIN user_profiles u ON f.user_id = u.id
      WHERE u.did = $1
    `, [userDid]);
    return result.rows;
  }

  // Subscription management
  async updateUserSubscription(userId: number, tier: string): Promise<void> {
    await this.pool.query(
      'UPDATE user_profiles SET subscription_tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [tier, userId]
    );
  }

  // Audit logging
  async logModerationAction(action: ModerationAction): Promise<void> {
    // Only add to history if post_uri exists (moderation_history requires post_uri)
    if (action.post_uri) {
      await this.pool.query(
        'INSERT INTO moderation_history (post_uri, action, feed_id, moderator_did, reason, target_handle) VALUES ($1, $2, $3, $4, $5, $6)',
        [action.post_uri, action.action, action.feed_id, action.moderator_did, action.reason, action.target_handle]
      );
    }
    
    // Always insert into moderation_log (supports NULL post_uri)
    await this.pool.query(
      'INSERT INTO moderation_log (post_uri, account_did, action, feed_id, moderator_did, reason, target_handle) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [action.post_uri || null, action.account_did || null, action.action, action.feed_id || null, action.moderator_did, action.reason || null, action.target_handle || null]
    );
  }

  // Banned users management
  async banUser(userId: number, bannedHandle: string, bannedDid: string | null, listType: string, listIdentifier: string | null, reason: string | null, bannedByDid: string): Promise<void> {
    // Normalize handle to lowercase
    const normalizedHandle = bannedHandle.toLowerCase();
    
    // Get banned user profile ID if we have the DID
    let bannedUserId = null;
    
    if (bannedDid) {
      const profileResult = await this.pool.query(
        'SELECT id FROM user_profiles WHERE did = $1',
        [bannedDid]
      );
      if (profileResult.rows.length > 0) {
        bannedUserId = profileResult.rows[0].id;
      }
    }
    
    // Add to database with foreign key reference - handle duplicates gracefully
    await this.pool.query(
      'INSERT INTO banned_users (user_id, banned_handle, banned_did, banned_user_id, list_type, list_identifier, reason, banned_by_did) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (user_id, banned_handle, list_type, list_identifier) DO UPDATE SET banned_user_id = EXCLUDED.banned_user_id, reason = EXCLUDED.reason, banned_at = CURRENT_TIMESTAMP',
      [userId, normalizedHandle, bannedDid, bannedUserId, listType, listIdentifier, reason, bannedByDid]
    );
  }

  // Legacy unban method - keeping for compatibility
  async unbanUserLegacy(userId: number, bannedHandle: string, listType: string, listIdentifier: string | null): Promise<void> {
    // Normalize handle to lowercase
    const normalizedHandle = bannedHandle.toLowerCase();
    
    // Remove from database
    await this.pool.query(
      'DELETE FROM banned_users WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3 AND (list_identifier = $4 OR (list_identifier IS NULL AND $4 IS NULL))',
      [userId, normalizedHandle, listType, listIdentifier]
    );
  }



  async getBannedUsers(userId: number): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT bu.*, up.avatar_url, up.display_name, f.feed_name
      FROM banned_users bu 
      LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
      LEFT JOIN feeds f ON bu.list_identifier = f.feed_id AND bu.user_id = f.user_id
      WHERE bu.user_id = $1 
      ORDER BY bu.banned_at DESC
    `, [userId]);
    return result.rows;
  }

  async isUserBanned(userId: number, handle: string, listType: string, listIdentifier: string | null): Promise<boolean> {
    // Normalize handle to lowercase
    const normalizedHandle = handle.toLowerCase();
    
    const result = await this.pool.query(
      'SELECT 1 FROM banned_users WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3 AND (list_identifier = $4 OR (list_identifier IS NULL AND $4 IS NULL))',
      [userId, normalizedHandle, listType, listIdentifier]
    );
    return result.rows.length > 0;
  }

  async getBannedUsersByList(userId: number, listType: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT bu.*, up.avatar_url, up.display_name, f.feed_name
      FROM banned_users bu 
      LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
      LEFT JOIN feeds f ON bu.list_identifier = f.feed_id AND bu.user_id = f.user_id
      WHERE bu.user_id = $1 AND bu.list_type = $2
      ORDER BY bu.banned_at DESC
    `, [userId, listType]);
    return result.rows;
  }

  // User report tracking for communal moderation
  async addUserReport(reportedUserDid: string, reportType: string, reporterDid: string, postUri?: string, source: string = 'ozone', labelerDid?: string, weight: number = 1.0): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO user_reports (reported_user_did, report_type, reporter_did, post_uri, source, labeler_did, report_weight) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [reportedUserDid, reportType, reporterDid, postUri, source, labelerDid, weight]
      );
    } catch (error: any) {
      // Ignore duplicate key errors (23505 is PostgreSQL unique constraint violation)
      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  async getUserReportCount(reportedUserDid: string, reportType: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM user_reports WHERE reported_user_did = $1 AND report_type = $2',
      [reportedUserDid, reportType]
    );
    return parseInt(result.rows[0].count);
  }

  async getAllFeedsWithUsers(): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT f.*, u.global_communal_enabled, u.global_threshold_spam, u.global_threshold_sexual, 
             u.global_threshold_harassment, u.global_threshold_illegal, u.global_cross_type_percentage,
             u.global_user_ban_threshold_spam, u.global_user_ban_threshold_sexual, 
             u.global_user_ban_threshold_harassment, u.global_user_ban_threshold_illegal, 
             u.global_user_ban_cross_type_percentage, u.did, u.handle, u.bsky_password
      FROM feeds f 
      JOIN user_profiles u ON f.user_id = u.id
    `);
    return result.rows;
  }

  async getPostHistory(postUri: string, moderatorDid: string, feedId?: string): Promise<any[]> {
    let query = `
      SELECT mh.*, f.feed_name
      FROM moderation_history mh
      LEFT JOIN feeds f ON mh.feed_id = f.feed_id
      WHERE mh.post_uri = $1 AND mh.moderator_did = $2
    `;
    const params = [postUri, moderatorDid];
    
    if (feedId) {
      query += ' AND mh.feed_id = $3';
      params.push(feedId);
    }
    
    query += ' ORDER BY mh.created_at DESC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getAllReportTypesForPost(postUri: string): Promise<Record<string, number>> {
    const result = await this.pool.query(
      'SELECT report_type, COUNT(DISTINCT reporter_did) as count FROM post_reports WHERE post_uri = $1 GROUP BY report_type',
      [postUri]
    );
    
    const reportCounts: Record<string, number> = {};
    for (const row of result.rows) {
      reportCounts[row.report_type] = parseInt(row.count);
    }
    return reportCounts;
  }

  async getFeedSettings(feedId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT cross_type_percentage, same_category_cross_percentage, user_ban_cross_type_percentage, user_ban_same_category_cross_percentage FROM feeds WHERE feed_id = $1',
      [feedId]
    );
    return result.rows[0] || null;
  }

  async getAllReportTypesForUser(userDid: string): Promise<Record<string, number>> {
    const result = await this.pool.query(
      'SELECT report_type, COUNT(DISTINCT reporter_did) as count FROM user_reports WHERE reported_user_did = $1 GROUP BY report_type',
      [userDid]
    );
    
    const reportCounts: Record<string, number> = {};
    for (const row of result.rows) {
      reportCounts[row.report_type] = parseInt(row.count);
    }
    return reportCounts;
  }

  async getUserBanThresholdForReportType(feedId: string, reportType: string): Promise<number> {
    // Skip communal moderation for 'other' report types - they're command-only
    if (reportType === 'other' || reportType.endsWith('-other')) {
      return 999999; // Effectively disable communal thresholds for 'other' types
    }
    
    const subcategoryColumn = `user_ban_threshold_${reportType.replace(/-/g, '_')}`;
    const mainCategory = reportType.split('-')[0];
    const mainCategoryColumn = `user_ban_threshold_${mainCategory.replace(/-/g, '_')}`;
    const globalSubcategoryColumn = `global_user_ban_threshold_${reportType.replace(/-/g, '_')}`;
    const globalMainCategoryColumn = `global_user_ban_threshold_${mainCategory.replace(/-/g, '_')}`;
    
    const result = await this.pool.query(
      `SELECT f.${subcategoryColumn}, f.${mainCategoryColumn}, up.${globalSubcategoryColumn}, up.${globalMainCategoryColumn}
       FROM feeds f 
       JOIN user_profiles up ON f.user_id = up.id 
       WHERE f.feed_id = $1`,
      [feedId]
    );
    
    if (result.rows.length === 0) return 5; // Default user ban threshold
    
    const row = result.rows[0];
    
    // Priority: per-feed subcategory > per-feed main category > global subcategory > global main category > default
    return row[subcategoryColumn] !== null ? row[subcategoryColumn] :
           row[mainCategoryColumn] !== null ? row[mainCategoryColumn] :
           row[globalSubcategoryColumn] !== null ? row[globalSubcategoryColumn] :
           row[globalMainCategoryColumn] !== null ? row[globalMainCategoryColumn] : 5;
  }

  async getGlobalThresholdForReportType(userId: number, reportType: string): Promise<number> {
    const subcategoryColumn = `global_threshold_${reportType.replace(/-/g, '_')}`;
    const mainCategory = reportType.split('-')[0];
    const mainCategoryColumn = `global_threshold_${mainCategory.replace(/-/g, '_')}`;
    
    const result = await this.pool.query(
      `SELECT ${subcategoryColumn}, ${mainCategoryColumn} FROM user_profiles WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) return 3; // Default fallback
    
    const user = result.rows[0];
    // Return subcategory threshold if explicitly set, otherwise inherit from main category, otherwise default
    return user[subcategoryColumn] !== null ? user[subcategoryColumn] :
           user[mainCategoryColumn] !== null ? user[mainCategoryColumn] : 3;
  }

  async getGlobalUserBanThresholdForReportType(userId: number, reportType: string): Promise<number> {
    const subcategoryColumn = `global_user_ban_threshold_${reportType.replace(/-/g, '_')}`;
    const mainCategory = reportType.split('-')[0];
    const mainCategoryColumn = `global_user_ban_threshold_${mainCategory.replace(/-/g, '_')}`;
    
    const result = await this.pool.query(
      `SELECT ${subcategoryColumn}, ${mainCategoryColumn} FROM user_profiles WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) return 5; // Default user ban threshold
    
    const user = result.rows[0];
    // Return subcategory threshold if explicitly set, otherwise inherit from main category, otherwise default
    return user[subcategoryColumn] !== null ? user[subcategoryColumn] :
           user[mainCategoryColumn] !== null ? user[mainCategoryColumn] : 5;
  }

  // Feed Groups operations
  async createFeedGroup(userId: number, groupName: string): Promise<any> {
    const result = await this.pool.query(
      'INSERT INTO feed_groups (owner_user_id, group_name) VALUES ($1, $2) RETURNING *',
      [userId, groupName]
    );
    return result.rows[0];
  }

  async getUserFeedGroups(userId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM feed_groups WHERE owner_user_id = $1 ORDER BY group_name',
      [userId]
    );
    return result.rows;
  }

  async addFeedToGroup(feedId: string, groupId: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO feed_group_members (feed_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [feedId, groupId]
    );
  }

  async removeFeedFromGroup(feedId: string, groupId: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM feed_group_members WHERE feed_id = $1 AND group_id = $2',
      [feedId, groupId]
    );
  }

  async getFeedsInGroup(groupId: number): Promise<Feed[]> {
    const result = await this.pool.query(`
      SELECT f.* FROM feeds f
      JOIN feed_group_members fgm ON f.feed_id = fgm.feed_id
      WHERE fgm.group_id = $1
    `, [groupId]);
    return result.rows;
  }

  async findFeedGroupByName(userId: number, groupName: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM feed_groups WHERE owner_user_id = $1 AND group_name = $2',
      [userId, groupName]
    );
    return result.rows[0] || null;
  }

  async getFeedsByGroupOrFeedName(userId: number, name: string, userDid: string): Promise<Feed[]> {
    // First try to find as group name (globally unique - supports delegation)
    const globalGroup = await this.pool.query(
      'SELECT * FROM feed_groups WHERE group_name = $1',
      [name]
    );
    
    if (globalGroup.rows.length > 0) {
      const group = globalGroup.rows[0];
      
      // Check if user owns the group
      if (group.owner_user_id === userId) {
        return await this.getFeedsInGroup(group.id);
      }
      
      // Check if user has permission to moderate this group
      const hasPermission = await this.hasGroupPermission(name, userDid, 'remove');
      if (hasPermission) {
        return await this.getFeedsInGroup(group.id);
      }
      
      // No permission, return empty
      return [];
    }
    
    // Then try to find as individual feed name (ONLY for own feeds - no delegation)
    const userFeeds = await this.getUserFeeds(userId);
    const feed = userFeeds.find(f => 
      f.feed_name.toLowerCase() === name.toLowerCase() || 
      f.feed_display_name?.toLowerCase() === name.toLowerCase()
    );
    
    return feed ? [feed] : [];
  }

  async findGlobalFeedGroup(groupName: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM feed_groups WHERE group_name = $1',
      [groupName]
    );
    return result.rows[0] || null;
  }

  // Group Moderator Permissions
  async addGroupModerator(groupId: number, moderatorDid: string, moderatorHandle: string, grantedByDid: string, permissions: string[] = ['remove', 'ban']): Promise<void> {
    await this.pool.query(
      'INSERT INTO group_moderators (group_id, moderator_did, moderator_handle, permissions, granted_by_did) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (group_id, moderator_did) DO UPDATE SET permissions = EXCLUDED.permissions',
      [groupId, moderatorDid, moderatorHandle, permissions, grantedByDid]
    );
  }

  async removeGroupModerator(groupId: number, moderatorDid: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM group_moderators WHERE group_id = $1 AND moderator_did = $2',
      [groupId, moderatorDid]
    );
  }

  async getGroupModerators(groupId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM group_moderators WHERE group_id = $1 ORDER BY created_at',
      [groupId]
    );
    return result.rows;
  }

  async hasGroupPermission(groupName: string, moderatorDid: string, permission: string = 'remove'): Promise<boolean> {
    const result = await this.pool.query(`
      SELECT 1 FROM group_moderators gm
      JOIN feed_groups fg ON gm.group_id = fg.id
      WHERE fg.group_name = $1 AND gm.moderator_did = $2 AND $3 = ANY(gm.permissions)
    `, [groupName, moderatorDid, permission]);
    return result.rows.length > 0;
  }

  async getModeratedGroups(moderatorDid: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT fg.*, gm.permissions, up.handle as owner_handle FROM feed_groups fg
      JOIN group_moderators gm ON fg.id = gm.group_id
      JOIN user_profiles up ON fg.owner_user_id = up.id
      WHERE gm.moderator_did = $1
      ORDER BY fg.group_name
    `, [moderatorDid]);
    return result.rows;
  }

  // Get all groups user can moderate with feed counts
  async getModeratedGroupsWithFeeds(moderatorDid: string): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT 
        fg.id,
        fg.group_name,
        fg.owner_user_id,
        up.handle as owner_handle,
        gm.permissions,
        COUNT(fgm.feed_id) as feed_count
      FROM feed_groups fg
      JOIN group_moderators gm ON fg.id = gm.group_id
      JOIN user_profiles up ON fg.owner_user_id = up.id
      LEFT JOIN feed_group_members fgm ON fg.id = fgm.group_id
      WHERE gm.moderator_did = $1
      GROUP BY fg.id, fg.group_name, fg.owner_user_id, up.handle, gm.permissions
      ORDER BY fg.group_name
    `, [moderatorDid]);
    return result.rows;
  }

  // ModMaster: Custom labeler support
  async updateCustomLabeler(userId: number, labelerDid: string | null, ozoneUrl: string | null, encryptedPassword: string | null): Promise<void> {
    await this.pool.query(
      'UPDATE user_profiles SET custom_labeler_did = $1, custom_labeler_ozone_url = $2, custom_labeler_password = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [labelerDid, ozoneUrl, encryptedPassword, userId]
    );
  }

  async getCustomLabeler(userId: number): Promise<{did: string, ozoneUrl: string, password: string} | null> {
    const result = await this.pool.query(
      'SELECT custom_labeler_did as did, custom_labeler_ozone_url as "ozoneUrl", custom_labeler_password as password FROM user_profiles WHERE id = $1',
      [userId]
    );
    if (!result.rows[0]?.did) return null;
    return result.rows[0];
  }

  // ModMaster: Report type settings
  async setUserReportTypeSetting(userId: number, reportType: string, action: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO user_report_type_settings (user_id, report_type, action, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, report_type) DO UPDATE SET action = EXCLUDED.action, updated_at = NOW()',
      [userId, reportType, action]
    );
  }

  async getUserReportTypeSetting(userId: number, reportType: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT action FROM user_report_type_settings WHERE user_id = $1 AND report_type = $2',
      [userId, reportType]
    );
    return result.rows[0]?.action || null;
  }

  async getAllUserReportTypeSettings(userId: number): Promise<Record<string, string>> {
    const result = await this.pool.query(
      'SELECT report_type, action FROM user_report_type_settings WHERE user_id = $1',
      [userId]
    );
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.report_type] = row.action;
    }
    return settings;
  }

  async setFeedReportTypeOverride(feedId: string, reportType: string, action: string | null, nonUserPostWeight: number | null, nonUserBanWeight: number | null): Promise<void> {
    await this.pool.query(
      'INSERT INTO feed_report_type_overrides (feed_id, report_type, action, non_user_post_weight, non_user_ban_weight, updated_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (feed_id, report_type) DO UPDATE SET action = EXCLUDED.action, non_user_post_weight = EXCLUDED.non_user_post_weight, non_user_ban_weight = EXCLUDED.non_user_ban_weight, updated_at = NOW()',
      [feedId, reportType, action, nonUserPostWeight, nonUserBanWeight]
    );
  }

  async getFeedReportTypeOverride(feedId: string, reportType: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT action, non_user_post_weight, non_user_ban_weight FROM feed_report_type_overrides WHERE feed_id = $1 AND report_type = $2',
      [feedId, reportType]
    );
    return result.rows[0] || null;
  }

  async getAllFeedReportTypeOverrides(feedId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT report_type, action, non_user_post_weight, non_user_ban_weight FROM feed_report_type_overrides WHERE feed_id = $1',
      [feedId]
    );
    return result.rows;
  }

  // ModMaster: User tier check
  async isAppUser(did: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT subscription_tier FROM user_profiles WHERE did = $1',
      [did]
    );
    const tier = result.rows[0]?.subscription_tier;
    return tier === 'paid' || tier === 'premium' || tier === 'free';
  }

  // ModMaster: Get or create user profile for non-app users
  async getOrCreateUserProfile(did: string, handle: string): Promise<User> {
    let user = await this.getUserByDid(did);
    if (!user) {
      user = await this.createUserProfile(did, handle, 'none');
    }
    return user;
  }

  // ModMaster: Get non-user report weights
  async getNonUserWeights(userId: number): Promise<{postWeight: number, banWeight: number}> {
    const result = await this.pool.query(
      'SELECT non_user_post_removal_weight, non_user_ban_weight FROM user_profiles WHERE id = $1',
      [userId]
    );
    return {
      postWeight: result.rows[0]?.non_user_post_removal_weight || 0.5,
      banWeight: result.rows[0]?.non_user_ban_weight || 0.5
    };
  }

  async updateNonUserWeights(userId: number, postWeight: number, banWeight: number): Promise<void> {
    await this.pool.query(
      'UPDATE user_profiles SET non_user_post_removal_weight = $1, non_user_ban_weight = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [postWeight, banWeight, userId]
    );
  }

  // ModMaster settings
  async updateModmasterSettings(userId: number, enabled: boolean, weight: number): Promise<void> {
    await this.pool.query(
      'UPDATE user_profiles SET modmaster_enabled = $1, modmaster_weight = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [enabled, weight, userId]
    );
  }

  async getModmasterSettings(userId: number): Promise<{enabled: boolean, weight: number} | null> {
    const result = await this.pool.query(
      'SELECT modmaster_enabled as enabled, modmaster_weight as weight FROM user_profiles WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  // ModMaster report settings
  async setModmasterReportSetting(userId: number, reportType: string, targetType: string, action: string, selectedFeeds?: string[]): Promise<void> {
    await this.pool.query(
      'INSERT INTO modmaster_report_settings (user_id, report_type, target_type, action, selected_feeds, updated_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (user_id, report_type, target_type) DO UPDATE SET action = EXCLUDED.action, selected_feeds = EXCLUDED.selected_feeds, updated_at = NOW()',
      [userId, reportType, targetType, action, selectedFeeds]
    );
  }

  async getModmasterReportSettings(userId: number): Promise<{posts: Record<string, string>, users: Record<string, string>, selectedFeeds: {posts: Record<string, string[]>, users: Record<string, string[]>}}> {
    const result = await this.pool.query(
      'SELECT report_type, target_type, action, selected_feeds FROM modmaster_report_settings WHERE user_id = $1',
      [userId]
    );
    const settings: {posts: Record<string, string>, users: Record<string, string>, selectedFeeds: {posts: Record<string, string[]>, users: Record<string, string[]>}} = { posts: {}, users: {}, selectedFeeds: { posts: {}, users: {} } };
    for (const row of result.rows) {
      (settings as any)[row.target_type][row.report_type] = row.action;
      if (row.selected_feeds) {
        (settings.selectedFeeds as any)[row.target_type][row.report_type] = row.selected_feeds;
      }
    }
    return settings;
  }

  // Custom labeler report settings
  async setCustomLabelerReportSetting(userId: number, reportType: string, targetType: string, action: string, selectedFeeds?: string[]): Promise<void> {
    await this.pool.query(
      'INSERT INTO custom_labeler_report_settings (user_id, report_type, target_type, action, selected_feeds, updated_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (user_id, report_type, target_type) DO UPDATE SET action = EXCLUDED.action, selected_feeds = EXCLUDED.selected_feeds, updated_at = NOW()',
      [userId, reportType, targetType, action, selectedFeeds]
    );
  }

  async getCustomLabelerReportSettings(userId: number): Promise<{posts: Record<string, string>, users: Record<string, string>, selectedFeeds: {posts: Record<string, string[]>, users: Record<string, string[]>}}> {
    const result = await this.pool.query(
      'SELECT report_type, target_type, action, selected_feeds FROM custom_labeler_report_settings WHERE user_id = $1',
      [userId]
    );
    const settings: {posts: Record<string, string>, users: Record<string, string>, selectedFeeds: {posts: Record<string, string[]>, users: Record<string, string[]>}} = { posts: {}, users: {}, selectedFeeds: { posts: {}, users: {} } };
    for (const row of result.rows) {
      (settings as any)[row.target_type][row.report_type] = row.action;
      if (row.selected_feeds) {
        (settings.selectedFeeds as any)[row.target_type][row.report_type] = row.selected_feeds;
      }
    }
    return settings;
  }

  // Autoblock configuration methods
  async setAutoblockAccountList(userId: number, accountHandle: string, accountType: string, listType: string, feedId?: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO autoblock_account_lists (user_id, account_handle, account_type, list_type, feed_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, account_handle, list_type, feed_id) DO NOTHING',
      [userId, accountHandle, accountType, listType, feedId]
    );
  }

  async removeAutoblockAccountList(userId: number, accountHandle: string, listType: string, feedId?: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM autoblock_account_lists WHERE user_id = $1 AND account_handle = $2 AND list_type = $3 AND (feed_id = $4 OR (feed_id IS NULL AND $4 IS NULL))',
      [userId, accountHandle, listType, feedId]
    );
  }

  async getAutoblockAccountLists(userId: number): Promise<Record<string, any[]>> {
    const result = await this.pool.query(
      'SELECT * FROM autoblock_account_lists WHERE user_id = $1 ORDER BY account_handle, list_type, feed_id',
      [userId]
    );
    
    // Group by account handle for frontend consumption
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.account_handle]) {
        grouped[row.account_handle] = [];
      }
      grouped[row.account_handle].push({
        listType: row.list_type,
        feedId: row.feed_id
      });
    }
    
    return grouped;
  }

  // Get labeler processing logs
  async getLabelerLogs(userId: number): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT 
        lpl.*,
        f.feed_name
      FROM labeler_processing_logs lpl
      LEFT JOIN feeds f ON lpl.feed_id = f.feed_id
      WHERE lpl.user_id = $1
      ORDER BY lpl.created_at DESC
      LIMIT 100
    `, [userId]);
    return result.rows;
  }

  // Add labeler processing log
  async addLabelerProcessingLog(log: {
    userId: number;
    labelerType: 'modmaster' | 'custom';
    reportType: string;
    targetType: 'post' | 'user';
    postUri?: string;
    targetHandle?: string;
    targetDid?: string;
    actionTaken: string;
    feedId?: string;
    status?: 'success' | 'error' | 'pending';
    errorMessage?: string;
  }): Promise<void> {
    await this.pool.query(
      'INSERT INTO labeler_processing_logs (user_id, labeler_type, report_type, target_type, post_uri, target_handle, target_did, action_taken, feed_id, status, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [log.userId, log.labelerType, log.reportType, log.targetType, log.postUri, log.targetHandle, log.targetDid, log.actionTaken, log.feedId, log.status || 'success', log.errorMessage]
    );
  }

  // Command system database methods
  async logPostRemoval(postUri: string, feedIds: string[], userId: number, reason: string): Promise<void> {
    for (const feedId of feedIds) {
      await this.pool.query(
        'INSERT INTO post_removals (post_uri, feed_id, user_id, reason, removed_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (post_uri, feed_id, user_id) DO UPDATE SET removed_at = NOW(), reason = EXCLUDED.reason',
        [postUri, feedId === 'all' ? null : feedId, userId, reason]
      );
    }
  }

  async logPostRestoration(postUri: string, feedIds: string[], userId: number, reason: string): Promise<void> {
    for (const feedId of feedIds) {
      // Remove from removals table to restore
      await this.pool.query(
        'DELETE FROM post_removals WHERE post_uri = $1 AND (feed_id = $2 OR (feed_id IS NULL AND $2 = \'all\')) AND user_id = $3',
        [postUri, feedId === 'all' ? null : feedId, userId]
      );
      
      // Log restoration
      await this.pool.query(
        'INSERT INTO post_restorations (post_uri, feed_id, user_id, reason, restored_at) VALUES ($1, $2, $3, $4, NOW())',
        [postUri, feedId === 'all' ? null : feedId, userId, reason]
      );
    }
  }

  async getRecentlyRemovedPosts(accountDid: string, count: number, userId: number): Promise<string[]> {
    // Extract DID from post URIs and match against account DID
    const result = await this.pool.query(
      'SELECT DISTINCT post_uri, removed_at FROM post_removals WHERE post_uri LIKE $1 AND user_id = $2 ORDER BY removed_at DESC LIMIT $3',
      [`at://${accountDid}/%`, userId, count]
    );
    return result.rows.map(row => row.post_uri);
  }

  async unbanUser(userId: number, bannedHandle: string, bannedDid: string | null, listType: string): Promise<void> {
    const normalizedHandle = bannedHandle.toLowerCase();
    
    if (listType === 'global') {
      await this.pool.query(
        'DELETE FROM banned_users WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
        [userId, normalizedHandle, 'global']
      );
    } else {
      // Unban from specific feed - use list_type for feed IDs
      await this.pool.query(
        'DELETE FROM banned_users WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
        [userId, normalizedHandle, listType]
      );
    }
  }

  // API Key management
  async createApiKey(userId: number, keyHash: string, name: string, expiresAt?: Date): Promise<any> {
    const result = await this.pool.query(
      'INSERT INTO api_keys (user_id, key_hash, name, expires_at) VALUES ($1, $2, $3, $4) RETURNING id, name, created_at, expires_at',
      [userId, keyHash, name, expiresAt]
    );
    return result.rows[0];
  }

  async getUserApiKeys(userId: number): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT id, name, created_at, last_used, expires_at, is_active FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async validateApiKey(keyHash: string): Promise<{userId: number, keyId: number} | null> {
    const result = await this.pool.query(
      'SELECT id, user_id FROM api_keys WHERE key_hash = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())',
      [keyHash]
    );
    
    if (result.rows.length === 0) return null;
    
    // Update last_used timestamp
    await this.pool.query(
      'UPDATE api_keys SET last_used = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    
    return {
      userId: result.rows[0].user_id,
      keyId: result.rows[0].id
    };
  }

  async revokeApiKey(userId: number, keyId: number): Promise<void> {
    await this.pool.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );
  }

  async deleteApiKey(userId: number, keyId: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );
  }

}