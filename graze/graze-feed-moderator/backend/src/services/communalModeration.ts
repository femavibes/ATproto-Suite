import { Database } from './database.js';
import { GrazeService } from './graze.js';

export class CommunalModerationService {
  constructor(
    private db: Database,
    private grazeService: GrazeService
  ) {}
  
  private async createNotification(
    userId: number,
    type: string,
    title: string,
    message: string,
    data?: any
  ) {
    try {
      await this.db.getPool().query(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, type, title, message, data ? JSON.stringify(data) : null])
      
      // Clean up old notifications (keep only last 50 per user)
      await this.db.getPool().query(`
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

  async processReport(postUri: string, reportType: string, reporterDid: string): Promise<void> {
    // Add report to database
    await this.db.addPostReport(postUri, reportType, reporterDid);
    
    // Exclude all *-other subcategories and main "other" category from communal moderation
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    
    if (!excludedFromCommunal.includes(reportType)) {
      // Check if any feeds should remove this post
      await this.checkThresholds(postUri, reportType);
      
      // Add user report and check user ban thresholds
      const reportedUserDid = this.extractAuthorFromUri(postUri);
      if (reportedUserDid) {
        await this.db.addUserReport(reportedUserDid, reportType, reporterDid, postUri, 'app');
        await this.checkUserBanThresholds(reportedUserDid, reportType);
      }
    }
  }

  private async checkThresholds(postUri: string, primaryReportType: string): Promise<void> {
    // Get all feeds with their users
    const feeds = await this.db.getAllFeedsWithUsers();
    
    // Group feeds by user and check thresholds
    const userFeeds = new Map<number, any[]>();
    const usersForGlobalCheck = new Set<number>();
    
    for (const feed of feeds) {
      // Check if communal moderation is enabled (either globally or per-feed)
      const globalEnabled = feed.global_communal_enabled && !feed.disable_global_for_feed;
      if (!globalEnabled && !feed.communal_enabled) continue;
      
      // Check if feed opts into this report type (per-feed override or global)
      const optsIn = feed[`opt_in_${primaryReportType}`] !== false;
      if (!optsIn) continue;
      
      if (!userFeeds.has(feed.user_id)) {
        userFeeds.set(feed.user_id, []);
      }
      userFeeds.get(feed.user_id)!.push(feed);
      
      // Track users for global threshold checking
      if (globalEnabled) {
        usersForGlobalCheck.add(feed.user_id);
      }
    }
    
    // Check global thresholds first
    for (const userId of usersForGlobalCheck) {
      const shouldRemoveGlobally = await this.shouldRemovePostGlobally(postUri, primaryReportType, userId);
      if (shouldRemoveGlobally.remove) {
        try {
          // Get user's first feed for context
          const userFeedList = userFeeds.get(userId) || [];
          if (userFeedList.length > 0) {
            const contextFeed = userFeedList[0];
            
            // Remove from all user's feeds
            await this.grazeService.removePost(postUri, 'all', contextFeed);
            
            // Log for all feeds
            for (const feed of userFeedList) {
              await this.db.logModerationAction({
                post_uri: postUri,
                action: 'communal_removal',
                feed_id: feed.feed_id,
                moderator_did: 'system',
                reason: `global_${shouldRemoveGlobally.triggerType}_threshold_${shouldRemoveGlobally.count}_reports`
              });
            }
            
            // Add communal report
            await this.db.addPostReport(postUri, primaryReportType, 'system', 'communal');
            
            // Create notification
            const feedNames = userFeedList.map(f => f.feed_name).join(', ');
            await this.createNotification(
              userId,
              'communal_post_removal',
              'Post Removed by Global Communal Moderation',
              `A post was automatically removed from all feeds (${feedNames}) due to global communal threshold`,
              {
                postUri,
                postAuthor: this.extractAuthorFromUri(postUri),
                feedNames,
                feedCount: userFeedList.length,
                reportType: primaryReportType,
                reason: 'global_communal_threshold_reached'
              }
            );
            
            console.log(`Global communal removal: ${postUri} from all feeds for user ${contextFeed.handle}`);
          }
        } catch (error) {
          console.error(`Failed to remove post ${postUri} globally for user ${userId}:`, error);
        }
        
        // Skip per-feed checking for this user since global action was taken
        userFeeds.delete(userId);
      }
    }
    
    // Process each user's feeds for per-feed thresholds
    for (const [userId, userFeedList] of userFeeds) {
      const feedsToRemoveFrom: any[] = [];
      
      // Check each feed for threshold violations
      for (const feed of userFeedList) {
        const shouldRemove = await this.shouldRemovePost(postUri, primaryReportType, feed);
        if (shouldRemove.remove) {
          feedsToRemoveFrom.push({ feed, shouldRemove });
        }
      }
      
      if (feedsToRemoveFrom.length > 0) {
        try {
          // Group feeds by their actual effective threshold values
          const thresholdGroups = new Map<string, any[]>();
          
          for (const { feed, shouldRemove } of feedsToRemoveFrom) {
            const effectiveThreshold = await this.db.getThresholdForReportType(feed.feed_id, primaryReportType);
            const crossTypePercentage = feed.cross_type_percentage || feed.global_cross_type_percentage || 20;
            const sameCategoryPercentage = feed.same_category_cross_percentage || feed.global_same_category_cross_percentage || 50;
            
            // Create a key that represents the effective threshold configuration
            const thresholdKey = `${effectiveThreshold}_${crossTypePercentage}_${sameCategoryPercentage}`;
            
            if (!thresholdGroups.has(thresholdKey)) {
              thresholdGroups.set(thresholdKey, []);
            }
            thresholdGroups.get(thresholdKey)!.push({ feed, shouldRemove });
          }
          
          // Process each threshold group
          for (const [thresholdKey, groupFeeds] of thresholdGroups) {
            const allUserFeedsCount = userFeedList.length;
            const groupFeedsCount = groupFeeds.length;
            
            // If all user's feeds have the same effective threshold, use 'all'
            if (groupFeedsCount === allUserFeedsCount && thresholdGroups.size === 1) {
              // All feeds have identical thresholds - remove from 'all'
              await this.grazeService.removePost(postUri, 'all', groupFeeds[0].feed);
              
              // Log for all feeds
              for (const { feed, shouldRemove } of groupFeeds) {
                await this.logRemovalAction(postUri, feed, shouldRemove);
              }
              
              console.log(`Communal removal: ${postUri} from all feeds for user ${groupFeeds[0].feed.handle} (identical thresholds)`);
            } else {
              // Mixed thresholds or partial group - remove individually
              for (const { feed, shouldRemove } of groupFeeds) {
                await this.grazeService.removePost(postUri, feed.feed_id, feed);
                await this.logRemovalAction(postUri, feed, shouldRemove);
                console.log(`Communal removal: ${postUri} from feed ${feed.feed_name} for user ${feed.handle}`);
              }
            }
          }
          
          // Add communal report to track this auto-removal
          await this.db.addPostReport(postUri, primaryReportType, 'system', 'communal');
          
          // Create notification (one per user)
          const firstFeed = feedsToRemoveFrom[0].feed;
          const postAuthor = this.extractAuthorFromUri(postUri);
          const feedNames = feedsToRemoveFrom.map(({ feed }) => feed.feed_name).join(', ');
          
          await this.createNotification(
            userId,
            'communal_post_removal',
            'Post Removed by Communal Moderation',
            `A post was automatically removed from ${feedNames} due to communal reports`,
            {
              postUri,
              postAuthor,
              feedNames,
              feedCount: feedsToRemoveFrom.length,
              reportType: primaryReportType,
              reason: 'communal_threshold_reached'
            }
          );
          
        } catch (error) {
          console.error(`Failed to remove post ${postUri} for user ${userId}:`, error);
        }
      }
    }
  }
  
  private async logRemovalAction(postUri: string, feed: any, shouldRemove: any): Promise<void> {
    await this.db.logModerationAction({
      post_uri: postUri,
      action: 'communal_removal',
      feed_id: feed.feed_id,
      moderator_did: 'system',
      reason: `${shouldRemove.triggerType}_threshold_${shouldRemove.count}_reports`
    });
  }

  private async shouldRemovePost(postUri: string, primaryType: string, feed: any): Promise<{
    remove: boolean;
    triggerType: string;
    count: number;
  }> {
    // Check if post author is whitelisted
    const postAuthorDid = this.extractAuthorFromUri(postUri);
    if (postAuthorDid) {
      const { WhitelistService } = await import('./whitelist.js');
      const whitelistService = new WhitelistService(this.db);
      const isWhitelisted = await whitelistService.isWhitelisted(postAuthorDid, feed.user_id, feed.feed_id);
      if (isWhitelisted) {
        return { remove: false, triggerType: 'whitelisted', count: 0 };
      }
    }
    
    // Check if post is protected from automated removal
    const protectionCheck = await this.db.getPool().query(
      'SELECT 1 FROM protected_posts WHERE user_id = $1 AND post_uri = $2 AND feed_id = $3',
      [feed.user_id, postUri, feed.feed_id]
    );
    if (protectionCheck.rows.length > 0) {
      return { remove: false, triggerType: 'protected', count: 0 };
    }
    
    // Get all hierarchical report counts (excluding all *-other subcategories)
    const allReportTypes = await this.db.getAllReportTypesForPost(postUri);
    
    // Filter out excluded types
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    
    const counts: Record<string, number> = {};
    Object.entries(allReportTypes).forEach(([type, count]) => {
      if (!excludedFromCommunal.includes(type)) {
        counts[type] = count;
      }
    });

    const sameCategoryPercentage = feed.same_category_cross_percentage || feed.global_same_category_cross_percentage || 50;
    const crossTypePercentage = feed.cross_type_percentage || feed.global_cross_type_percentage || 20;

    // Check each report type against its own threshold
    for (const [type, count] of Object.entries(counts)) {
      if (count === 0) continue;
      
      const threshold = await this.db.getThresholdForReportType(feed.feed_id, type);
      if (threshold === 0) continue;
      
      const mainCategory = type.includes('-') ? type.split('-')[0] : type;
      
      // Calculate contributions TO this type's threshold FROM other report types
      let exactCount = count;
      let categoryEffective = exactCount;
      let crossEffective = exactCount;
      
      // Calculate caps based on threshold and percentages
      const maxSameCategoryContributions = Math.floor(threshold * (sameCategoryPercentage / 100));
      const maxCrossTypeContributions = Math.floor(threshold * (crossTypePercentage / 100));
      
      // Collect same-category contributions (excluding exact type)
      let sameCategoryContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (otherType !== type && otherType.startsWith(mainCategory)) {
          sameCategoryContributions += otherCount;
        }
      });
      
      // Collect cross-type contributions (excluding same category)
      let crossTypeContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (!otherType.startsWith(mainCategory)) {
          crossTypeContributions += otherCount;
        }
      });
      
      // Apply caps to contributions
      const cappedSameCategoryContributions = Math.min(sameCategoryContributions, maxSameCategoryContributions);
      const cappedCrossTypeContributions = Math.min(crossTypeContributions, maxCrossTypeContributions);
      
      // Calculate effective counts
      categoryEffective = exactCount + cappedSameCategoryContributions;
      crossEffective = exactCount + cappedSameCategoryContributions + cappedCrossTypeContributions;
      
      if (crossEffective >= threshold) {
        return {
          remove: true,
          triggerType: type,
          count: crossEffective
        };
      }
    }

    return { remove: false, triggerType: '', count: 0 };
  }

  private async shouldRemovePostGlobally(postUri: string, primaryType: string, userId: number): Promise<{
    remove: boolean;
    triggerType: string;
    count: number;
  }> {
    // Check if post author is whitelisted globally
    const postAuthorDid = this.extractAuthorFromUri(postUri);
    if (postAuthorDid) {
      const { WhitelistService } = await import('./whitelist.js');
      const whitelistService = new WhitelistService(this.db);
      const isWhitelisted = await whitelistService.isWhitelisted(postAuthorDid, userId, undefined); // undefined = global whitelist
      if (isWhitelisted) {
        return { remove: false, triggerType: 'whitelisted', count: 0 };
      }
    }
    
    // Get all hierarchical report counts (excluding all *-other subcategories)
    const allReportTypes = await this.db.getAllReportTypesForPost(postUri);
    
    // Filter out excluded types
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    
    const counts: Record<string, number> = {};
    Object.entries(allReportTypes).forEach(([type, count]) => {
      if (!excludedFromCommunal.includes(type)) {
        counts[type] = count;
      }
    });

    // Get global percentages (use defaults if not set)
    const sameCategoryPercentage = 50; // Global default
    const crossTypePercentage = 20; // Global default

    // Check each report type against its own global threshold
    for (const [type, count] of Object.entries(counts)) {
      if (count === 0) continue;
      
      const threshold = await this.db.getGlobalThresholdForReportType(userId, type);
      if (threshold === 0) continue;
      
      const mainCategory = type.includes('-') ? type.split('-')[0] : type;
      
      // Calculate contributions TO this type's threshold FROM other report types
      let exactCount = count;
      let categoryEffective = exactCount;
      let crossEffective = exactCount;
      
      // Calculate caps based on threshold and percentages
      const maxSameCategoryContributions = Math.floor(threshold * (sameCategoryPercentage / 100));
      const maxCrossTypeContributions = Math.floor(threshold * (crossTypePercentage / 100));
      
      // Collect same-category contributions (excluding exact type)
      let sameCategoryContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (otherType !== type && otherType.startsWith(mainCategory)) {
          sameCategoryContributions += otherCount;
        }
      });
      
      // Collect cross-type contributions (excluding same category)
      let crossTypeContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (!otherType.startsWith(mainCategory)) {
          crossTypeContributions += otherCount;
        }
      });
      
      // Apply caps to contributions
      const cappedSameCategoryContributions = Math.min(sameCategoryContributions, maxSameCategoryContributions);
      const cappedCrossTypeContributions = Math.min(crossTypeContributions, maxCrossTypeContributions);
      
      // Calculate effective counts
      categoryEffective = exactCount + cappedSameCategoryContributions;
      crossEffective = exactCount + cappedSameCategoryContributions + cappedCrossTypeContributions;
      
      if (crossEffective >= threshold) {
        return {
          remove: true,
          triggerType: type,
          count: crossEffective
        };
      }
    }

    return { remove: false, triggerType: '', count: 0 };
  }

  private async checkUserBanThresholds(reportedUserDid: string, primaryReportType: string): Promise<void> {
    // Get all feeds with their users
    const feeds = await this.db.getAllFeedsWithUsers();
    
    // Group feeds by user and check thresholds
    const userFeeds = new Map<number, any[]>();
    const usersForGlobalCheck = new Set<number>();
    
    for (const feed of feeds) {
      // Check if communal moderation is enabled (either globally or per-feed)
      const globalEnabled = feed.global_communal_enabled && !feed.disable_global_for_feed;
      if (!globalEnabled && !feed.communal_enabled) continue;
      
      // Check if feed opts into this report type
      const optsIn = feed[`opt_in_${primaryReportType}`] !== false;
      if (!optsIn) continue;
      
      if (!userFeeds.has(feed.user_id)) {
        userFeeds.set(feed.user_id, []);
      }
      userFeeds.get(feed.user_id)!.push(feed);
      
      // Track users for global threshold checking
      if (globalEnabled) {
        usersForGlobalCheck.add(feed.user_id);
      }
    }
    
    // Check global ban thresholds first
    for (const userId of usersForGlobalCheck) {
      const shouldBanGlobally = await this.shouldBanUserGlobally(reportedUserDid, primaryReportType, userId);
      if (shouldBanGlobally.ban) {
        try {
          // Get user handle and create profile for banned user
          let bannedHandle = '';
          try {
            const { AtpAgent } = await import('@atproto/api');
            const agent = new AtpAgent({ service: 'https://bsky.social' });
            const profile = await agent.api.app.bsky.actor.getProfile({ actor: reportedUserDid });
            bannedHandle = profile.data.handle;
            
            // Get or create user profile for banned user
            let bannedUserProfile = await this.db.getPool().query(
              'SELECT id FROM user_profiles WHERE did = $1',
              [reportedUserDid]
            );
            
            if (bannedUserProfile.rows.length === 0) {
              await this.db.getPool().query(
                'INSERT INTO user_profiles (did, handle, subscription_tier, display_name, avatar_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [reportedUserDid, bannedHandle, 'none', profile.data.displayName || null, profile.data.avatar || null]
              );
            }
          } catch (error) {
            console.error('Failed to resolve handle for banned user:', error);
            bannedHandle = reportedUserDid;
          }
          
          // Get user's feeds for context
          const userFeedList = userFeeds.get(userId) || [];
          if (userFeedList.length > 0) {
            const contextFeed = userFeedList[0];
            
            // Ban user globally (add to global ban list)
            await this.db.banUser(
              userId,
              bannedHandle,
              reportedUserDid,
              'global',
              null,
              `global_${shouldBanGlobally.triggerType}_threshold_${shouldBanGlobally.count}_reports`,
              'system'
            );
            
            // Add to global Bluesky ban list
            let blueskyBanFailed = false;
            try {
              if (contextFeed.global_ban_list) {
                const { BlueskyService } = await import('./bluesky.js');
                const blueskyService = new BlueskyService();
                await blueskyService.banUser(bannedHandle, contextFeed.global_ban_list, contextFeed);
              }
            } catch (error) {
              console.error('Failed to add to global Bluesky ban list:', error);
              blueskyBanFailed = true;
              // Mark ban as needing sync
              await this.db.getPool().query(
                'UPDATE banned_users SET sync_failed = true WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
                [userId, bannedHandle, 'global']
              );
            }
            
            // Remove last 10 posts from all feeds
            try {
              const { BlueskyService } = await import('./bluesky.js');
              const blueskyService = new BlueskyService();
              const postLimit = 10;
              const recentPosts = await blueskyService.getUserRecentPosts(bannedHandle, postLimit, contextFeed);
              
              for (const postUri of recentPosts) {
                try {
                  await this.grazeService.removePost(postUri, 'all', contextFeed);
                  
                  // Log the post removal for all feeds
                  for (const feed of userFeedList) {
                    await this.db.logModerationAction({
                      post_uri: postUri,
                      account_did: reportedUserDid,
                      action: 'ban_removal',
                      feed_id: feed.feed_id,
                      moderator_did: 'system',
                      reason: `Global communal ban removal: ${shouldBanGlobally.triggerType}_threshold_${shouldBanGlobally.count}_reports`,
                      target_handle: bannedHandle
                    });
                  }
                } catch (postError) {
                  if (postError instanceof Error && postError.message === 'POST_NOT_FOUND') {
                    console.log(`Post ${postUri} not found in feeds (already removed or not present)`);
                  } else {
                    console.error(`Failed to remove post ${postUri} during global communal ban:`, postError);
                  }
                }
              }
              
              console.log(`Global communal ban: Removed ${recentPosts.length} recent posts for ${bannedHandle} from all feeds`);
            } catch (error) {
              console.error('Failed to remove recent posts during global communal ban:', error);
            }
            
            // Log the global ban action
            await this.db.logModerationAction({
              account_did: reportedUserDid,
              action: 'communal_ban',
              feed_id: undefined, // Global ban
              moderator_did: 'system',
              reason: `global_${shouldBanGlobally.triggerType}_threshold_${shouldBanGlobally.count}_reports`,
              target_handle: bannedHandle
            });
            
            // Create notification
            const feedNames = userFeedList.map(f => f.feed_name).join(', ');
            const totalPostsRemoved = userFeedList.length * 10;
            await this.createNotification(
              userId,
              'communal_user_ban',
              'User Banned by Global Communal Moderation',
              `${bannedHandle} was automatically banned globally from all feeds (${feedNames}) and ${totalPostsRemoved} recent posts removed due to global communal threshold`,
              {
                bannedUserHandle: bannedHandle,
                bannedUserDid: reportedUserDid,
                feedNames,
                feedCount: userFeedList.length,
                reportType: primaryReportType,
                reason: 'global_communal_threshold_reached',
                postsRemoved: totalPostsRemoved
              }
            );
            
            console.log(`Global communal ban: ${bannedHandle} from all feeds for user ${contextFeed.handle} (${shouldBanGlobally.count} ${shouldBanGlobally.triggerType} reports)`);
          }
        } catch (error) {
          console.error(`Failed to ban user ${reportedUserDid} globally for user ${userId}:`, error);
        }
        
        // Skip per-feed checking for this user since global action was taken
        userFeeds.delete(userId);
      }
    }
    
    // Process each user's feeds for per-feed bans
    for (const [userId, userFeedList] of userFeeds) {
      const feedsToBanFrom: any[] = [];
      
      // Check each feed for ban threshold violations
      for (const feed of userFeedList) {
        const shouldBan = await this.shouldBanUser(reportedUserDid, primaryReportType, feed);
        if (shouldBan.ban) {
          feedsToBanFrom.push({ feed, shouldBan });
        }
      }
      
      if (feedsToBanFrom.length > 0) {
        try {
          // Get user handle and create profile for banned user
          let bannedHandle = '';
          try {
            const { AtpAgent } = await import('@atproto/api');
            const agent = new AtpAgent({ service: 'https://bsky.social' });
            const profile = await agent.api.app.bsky.actor.getProfile({ actor: reportedUserDid });
            bannedHandle = profile.data.handle;
            
            // Get or create user profile for banned user
            let bannedUserProfile = await this.db.getPool().query(
              'SELECT id FROM user_profiles WHERE did = $1',
              [reportedUserDid]
            );
            
            if (bannedUserProfile.rows.length === 0) {
              await this.db.getPool().query(
                'INSERT INTO user_profiles (did, handle, subscription_tier, display_name, avatar_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [reportedUserDid, bannedHandle, 'none', profile.data.displayName || null, profile.data.avatar || null]
              );
            }
          } catch (error) {
            console.error('Failed to resolve handle for banned user:', error);
            bannedHandle = reportedUserDid; // Fallback to DID
          }
          
          // Process each feed that should ban the user
          for (const { feed, shouldBan } of feedsToBanFrom) {
            // Ban user from internal database
            await this.db.banUser(
              feed.user_id,
              bannedHandle,
              reportedUserDid,
              'communal',
              feed.feed_id,
              `${shouldBan.triggerType}_threshold_${shouldBan.count}_reports`,
              'system'
            );
            
            // Add to Bluesky ban list
            let blueskyBanFailed = false;
            try {
              if (feed.feed_ban_list) {
                const { BlueskyService } = await import('./bluesky.js');
                const blueskyService = new BlueskyService();
                await blueskyService.banUser(bannedHandle, feed.feed_ban_list, feed);
              }
            } catch (error) {
              console.error('Failed to add to Bluesky ban list:', error);
              blueskyBanFailed = true;
              // Mark ban as needing sync
              await this.db.getPool().query(
                'UPDATE banned_users SET sync_failed = true WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
                [feed.user_id, bannedHandle, feed.feed_id]
              );
            }
            
            // Remove last 10 posts from this feed
            try {
              const { BlueskyService } = await import('./bluesky.js');
              const blueskyService = new BlueskyService();
              const postLimit = 10;
              const recentPosts = await blueskyService.getUserRecentPosts(bannedHandle, postLimit, feed);
              
              for (const postUri of recentPosts) {
                try {
                  await this.grazeService.removePost(postUri, feed.feed_id, feed);
                  
                  // Log the post removal
                  await this.db.logModerationAction({
                    post_uri: postUri,
                    account_did: reportedUserDid,
                    action: 'ban_removal',
                    feed_id: feed.feed_id,
                    moderator_did: 'system',
                    reason: `Communal ban removal: ${shouldBan.triggerType}_threshold_${shouldBan.count}_reports`,
                    target_handle: bannedHandle
                  });
                } catch (postError) {
                  if (postError instanceof Error && postError.message === 'POST_NOT_FOUND') {
                    console.log(`Post ${postUri} not found in feed ${feed.feed_id} (already removed or not present)`);
                  } else {
                    console.error(`Failed to remove post ${postUri} during communal ban:`, postError);
                  }
                }
              }
              
              console.log(`Communal ban: Removed ${recentPosts.length} recent posts for ${bannedHandle} from feed ${feed.feed_name}`);
            } catch (error) {
              console.error('Failed to remove recent posts during communal ban:', error);
            }
            
            // Log the ban action
            await this.db.logModerationAction({
              account_did: reportedUserDid,
              action: 'communal_ban',
              feed_id: feed.feed_id,
              moderator_did: 'system',
              reason: `${shouldBan.triggerType}_threshold_${shouldBan.count}_reports`,
              target_handle: bannedHandle
            });
            
            console.log(`Communal ban: ${bannedHandle} from feed ${feed.feed_name} (${shouldBan.count} ${shouldBan.triggerType} reports)`);
          }
          
          // Create notification (one per user)
          const feedNames = feedsToBanFrom.map(({ feed }) => feed.feed_name).join(', ');
          const totalPostsRemoved = feedsToBanFrom.length * 10; // Estimate
          await this.createNotification(
            userId,
            'communal_user_ban',
            'User Banned by Communal Moderation',
            `${bannedHandle} was automatically banned from ${feedNames} and ${totalPostsRemoved} recent posts removed due to communal reports`,
            {
              bannedUserHandle: bannedHandle,
              bannedUserDid: reportedUserDid,
              feedNames,
              feedCount: feedsToBanFrom.length,
              reportType: primaryReportType,
              reason: 'communal_threshold_reached',
              postsRemoved: totalPostsRemoved
            }
          );
          
        } catch (error) {
          console.error(`Failed to ban user ${reportedUserDid} for user ${userId}:`, error);
        }
      }
    }
  }

  private async shouldBanUser(reportedUserDid: string, primaryType: string, feed: any): Promise<{
    ban: boolean;
    triggerType: string;
    count: number;
  }> {
    // Check if user is protected from communal bans (unbanned within last 7 days)
    const protectionCheck = await this.db.getPool().query(`
      SELECT 1 FROM moderation_log 
      WHERE account_did = $1 
      AND action = 'unban' 
      AND created_at > NOW() - INTERVAL '7 days'
      AND (feed_id = $2 OR feed_id IS NULL)
      LIMIT 1
    `, [reportedUserDid, feed.feed_id]);
    
    if (protectionCheck.rows.length > 0) {
      return { ban: false, triggerType: 'protected_from_communal_ban', count: 0 };
    }
    
    // Get all hierarchical user report counts (excluding all *-other subcategories)
    const allUserReportTypes = await this.db.getAllReportTypesForUser(reportedUserDid);
    
    // Filter out excluded types
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    
    const counts: Record<string, number> = {};
    Object.entries(allUserReportTypes).forEach(([type, count]) => {
      if (!excludedFromCommunal.includes(type)) {
        counts[type] = count;
      }
    });

    const sameCategoryPercentage = feed.user_ban_same_category_cross_percentage || feed.global_user_ban_same_category_cross_percentage || 50;
    const crossTypePercentage = feed.user_ban_cross_type_percentage || feed.global_user_ban_cross_type_percentage || 20;

    // Check each report type against its own threshold
    for (const [type, count] of Object.entries(counts)) {
      if (count === 0) continue;
      
      const threshold = await this.db.getUserBanThresholdForReportType(feed.feed_id, type);
      if (threshold === 0) continue;
      
      const mainCategory = type.includes('-') ? type.split('-')[0] : type;
      
      // Calculate contributions TO this type's threshold FROM other report types
      let exactCount = count;
      let categoryEffective = exactCount;
      let crossEffective = exactCount;
      
      // Calculate caps based on threshold and percentages
      const maxSameCategoryContributions = Math.floor(threshold * (sameCategoryPercentage / 100));
      const maxCrossTypeContributions = Math.floor(threshold * (crossTypePercentage / 100));
      
      // Collect same-category contributions (excluding exact type)
      let sameCategoryContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (otherType !== type && otherType.startsWith(mainCategory)) {
          sameCategoryContributions += otherCount;
        }
      });
      
      // Collect cross-type contributions (excluding same category)
      let crossTypeContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (!otherType.startsWith(mainCategory)) {
          crossTypeContributions += otherCount;
        }
      });
      
      // Apply caps to contributions
      const cappedSameCategoryContributions = Math.min(sameCategoryContributions, maxSameCategoryContributions);
      const cappedCrossTypeContributions = Math.min(crossTypeContributions, maxCrossTypeContributions);
      
      // Calculate effective counts
      categoryEffective = exactCount + cappedSameCategoryContributions;
      crossEffective = exactCount + cappedSameCategoryContributions + cappedCrossTypeContributions;
      
      if (crossEffective >= threshold) {
        return {
          ban: true,
          triggerType: type,
          count: crossEffective
        };
      }
    }

    return { ban: false, triggerType: '', count: 0 };
  }

  private async shouldBanUserGlobally(reportedUserDid: string, primaryType: string, userId: number): Promise<{
    ban: boolean;
    triggerType: string;
    count: number;
  }> {
    // Check if user is protected from communal bans (unbanned within last 7 days)
    const protectionCheck = await this.db.getPool().query(`
      SELECT 1 FROM moderation_log 
      WHERE account_did = $1 
      AND action = 'unban' 
      AND created_at > NOW() - INTERVAL '7 days'
      AND (feed_id IS NULL OR feed_id IN (
        SELECT feed_id FROM feeds WHERE user_id = $2
      ))
      LIMIT 1
    `, [reportedUserDid, userId]);
    
    if (protectionCheck.rows.length > 0) {
      return { ban: false, triggerType: 'protected_from_communal_ban', count: 0 };
    }
    
    // Get all hierarchical user report counts (excluding all *-other subcategories)
    const allUserReportTypes = await this.db.getAllReportTypesForUser(reportedUserDid);
    
    // Filter out excluded types
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    
    const counts: Record<string, number> = {};
    Object.entries(allUserReportTypes).forEach(([type, count]) => {
      if (!excludedFromCommunal.includes(type)) {
        counts[type] = count;
      }
    });

    // Use global defaults for percentages
    const sameCategoryPercentage = 50;
    const crossTypePercentage = 20;

    // Check each report type against its own global threshold
    for (const [type, count] of Object.entries(counts)) {
      if (count === 0) continue;
      
      const threshold = await this.db.getGlobalUserBanThresholdForReportType(userId, type);
      if (threshold === 0) continue;
      
      const mainCategory = type.includes('-') ? type.split('-')[0] : type;
      
      // Calculate contributions TO this type's threshold FROM other report types
      let exactCount = count;
      let categoryEffective = exactCount;
      let crossEffective = exactCount;
      
      // Calculate caps based on threshold and percentages
      const maxSameCategoryContributions = Math.floor(threshold * (sameCategoryPercentage / 100));
      const maxCrossTypeContributions = Math.floor(threshold * (crossTypePercentage / 100));
      
      // Collect same-category contributions (excluding exact type)
      let sameCategoryContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (otherType !== type && otherType.startsWith(mainCategory)) {
          sameCategoryContributions += otherCount;
        }
      });
      
      // Collect cross-type contributions (excluding same category)
      let crossTypeContributions = 0;
      Object.entries(counts).forEach(([otherType, otherCount]) => {
        if (!otherType.startsWith(mainCategory)) {
          crossTypeContributions += otherCount;
        }
      });
      
      // Apply caps to contributions
      const cappedSameCategoryContributions = Math.min(sameCategoryContributions, maxSameCategoryContributions);
      const cappedCrossTypeContributions = Math.min(crossTypeContributions, maxCrossTypeContributions);
      
      // Calculate effective counts
      categoryEffective = exactCount + cappedSameCategoryContributions;
      crossEffective = exactCount + cappedSameCategoryContributions + cappedCrossTypeContributions;
      
      if (crossEffective >= threshold) {
        return {
          ban: true,
          triggerType: type,
          count: crossEffective
        };
      }
    }

    return { ban: false, triggerType: '', count: 0 };
  }

  private extractAuthorFromUri(postUri: string): string | null {
    // Extract DID from AT URI: at://did:plc:xxx/app.bsky.feed.post/postid
    const match = postUri.match(/^at:\/\/(did:[^/]+)/);
    return match ? match[1] : null;
  }
}