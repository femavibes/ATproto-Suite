import express from 'express';
import { AtpAgent } from '@atproto/api';
import { Database } from '../services/database.js';
import { GrazeService } from '../services/graze.js';
import { authenticateToken } from './auth.js';
import { checkApiRateLimit, checkRemovalRateLimit } from '../middleware/rateLimiter.js';
import { RateLimiterService } from '../services/rateLimiter.js';

// Helper function to convert AT URI to Bluesky URL
function convertAtUriToBskyUrl(atUri: string): string {
  const match = atUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.graph\.list\/(.+)$/);
  if (match) {
    const [, did, listId] = match;
    return `https://bsky.app/profile/${did}/lists/${listId}`;
  }
  return atUri;
}

// Helper function to convert Bluesky URL to AT URI
async function convertBskyUrlToAtUri(url: string): Promise<string> {
  // Handle different URL formats:
  // https://bsky.app/profile/handle/post/postid
  // at://did:plc:xxx/app.bsky.feed.post/postid
  
  if (url.startsWith('at://')) {
    return url;
  }
  
  const match = url.match(/https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?]+)/);
  if (!match) {
    throw new Error('Invalid Bluesky post URL format');
  }
  
  const [, handle, postId] = match;
  
  try {
    // Resolve handle to DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const response = await agent.resolveHandle({ handle });
    const did = response.data.did;
    
    return `at://${did}/app.bsky.feed.post/${postId}`;
  } catch (error) {
    console.error(`Failed to resolve handle ${handle}:`, error);
    throw new Error(`Failed to resolve handle: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const router = express.Router();
const db = Database.getInstance();
const grazeService = new GrazeService();

// Helper function to resolve targets (feed IDs or group names) to actual feed IDs
async function resolveTargetsToFeeds(targets: string[], userId: number, userDid: string): Promise<string[]> {
  console.log('[resolveTargetsToFeeds] Input:', { targets, userId, userDid });
  const resolvedFeeds: string[] = [];
  const userFeeds = await db.getUserFeeds(userId);
  const userFeedIds = userFeeds.map(f => f.feed_id);
  console.log('[resolveTargetsToFeeds] User feeds:', userFeedIds);
  
  for (const target of targets) {
    // Sanitize input
    if (typeof target !== 'string' || target.length > 100) {
      console.error('[SECURITY] Invalid target format:', target);
      continue;
    }
    
    console.log('[resolveTargetsToFeeds] Processing target:', target);
    
    if (target === 'all') {
      console.log('[resolveTargetsToFeeds] Target is all owned feeds');
      resolvedFeeds.push('all');
      continue;
    }
    
    const group = await db.findGlobalFeedGroup(target);
    console.log('[resolveTargetsToFeeds] Group lookup result:', group);
    if (group) {
      console.log('[resolveTargetsToFeeds] Group owner check:', { groupOwnerId: group.owner_user_id, userId });
      if (group.owner_user_id === userId) {
        const groupFeeds = await db.getFeedsInGroup(group.id);
        console.log('[resolveTargetsToFeeds] User owns group, feeds:', groupFeeds.map(f => f.feed_id));
        resolvedFeeds.push(...groupFeeds.map(f => f.feed_id));
      } else {
        console.log('[resolveTargetsToFeeds] Checking permission for:', { target, userDid });
        const hasPermission = await db.hasGroupPermission(target, userDid, 'remove');
        console.log('[resolveTargetsToFeeds] Has permission:', hasPermission);
        if (hasPermission) {
          const groupFeeds = await db.getFeedsInGroup(group.id);
          console.log('[resolveTargetsToFeeds] User has permission, feeds:', groupFeeds.map(f => f.feed_id));
          resolvedFeeds.push(...groupFeeds.map(f => f.feed_id));
        } else {
          console.error('[SECURITY] User', userDid, 'denied access to group', target);
        }
      }
    } else if (userFeedIds.includes(target)) {
      console.log('[resolveTargetsToFeeds] Target is owned feed ID:', target);
      resolvedFeeds.push(target);
    } else {
      console.error('[SECURITY] User', userDid, 'attempted direct feed access without ownership:', target);
    }
  }
  
  console.log('[resolveTargetsToFeeds] Final resolved feeds:', resolvedFeeds);
  return [...new Set(resolvedFeeds)];
}

// Ban user using Bluesky lists
router.post('/ban-user', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { userHandle, reportType = 'spam', useGlobal, selectedFeeds, reason } = req.body;
    
    if (!userHandle || (!useGlobal && (!selectedFeeds || selectedFeeds.length === 0))) {
      return res.status(400).json({ error: 'User handle and at least one ban list required' });
    }
    
    // Get user
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Resolve handle to DID and get profile data using public API
    let bannedDid: string | null = null;
    let bannedUserId: number | null = null;
    
    try {
      // Use public API to get profile (doesn't require auth)
      const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${userHandle}`);
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        bannedDid = profile.did;
        
        if (bannedDid) {
          // Get or create user_profiles entry for banned user
          let bannedUserProfile = await db.getUserProfileByDid(bannedDid);
          if (!bannedUserProfile) {
            bannedUserProfile = await db.createUserProfile(bannedDid, userHandle, 'none');
          }
          
          // Update with profile data
          await db.getPool().query(
            'UPDATE user_profiles SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [profile.displayName || null, profile.avatar || null, bannedUserProfile.id]
          );
          
          bannedUserId = bannedUserProfile.id;
        }
      }
    } catch (error) {
      console.error('Failed to resolve user profile:', error);
      // Continue without DID if resolution fails
    }
    
    let totalPostsRemoved = 0;
    let blueskyListSuccess = false;
    let blueskyListError = null;
    let blueskyListName = null;
    let blueskyListUrl = null;
    let attemptedPosts = [];
    
    // Process global ban list
    if (useGlobal) {
      // Add to Bluesky list FIRST - if this fails, we shouldn't add to our database
      try {
        if (user.global_ban_list) {
          const { BlueskyService } = await import('../services/bluesky.js');
          const blueskyService = new BlueskyService();
          await blueskyService.banUser(userHandle, user.global_ban_list, user);
          blueskyListSuccess = true;
          blueskyListName = 'Global Ban List';
          blueskyListUrl = convertAtUriToBskyUrl(user.global_ban_list);
        }
      } catch (error) {
        console.error('Failed to add to Bluesky global list:', error);
        blueskyListError = error instanceof Error ? error.message : 'Unknown error';
        // If Bluesky ban fails, return error immediately
        return res.status(500).json({ 
          success: false,
          error: blueskyListError,
          message: 'Failed to add user to Bluesky ban list. User was not banned locally.'
        });
      }
      
      // Only add to local database if Bluesky ban succeeded
      await db.banUser(req.user.userId, userHandle, bannedDid, 'global', null, reason, user.did);
      
      // Log the ban action
      await db.logModerationAction({
        post_uri: undefined,
        account_did: bannedDid || undefined,
        action: 'manual_ban',
        feed_id: undefined,
        moderator_did: user.did,
        reason: reason || 'Manual ban',
        target_handle: userHandle
      });
      
      // Add user report for tracking with hierarchical type
      if (bannedDid) {
        await db.addUserReport(bannedDid, reportType, user.did, undefined, 'app');
      }
      
      // Remove recent posts from all feeds
      try {
        const { BlueskyService } = await import('../services/bluesky.js');
        const blueskyService = new BlueskyService();
        const postLimit = 10;
        const recentPosts = await blueskyService.getUserRecentPosts(userHandle, postLimit, user);
        
        console.log(`Found ${recentPosts.length} recent posts for ${userHandle}, attempting removal...`);
        
        for (const postUri of recentPosts) {
          let success = false;
          let error = null;
          
          try {
            await grazeService.removePost(postUri, 'all', user);
            totalPostsRemoved++;
            success = true;
            console.log(`Successfully removed post ${postUri} during ban`);
            
            // Log the action
            await db.logModerationAction({
              post_uri: postUri,
              account_did: bannedDid || undefined,
              action: 'ban_removal',
              feed_id: undefined,
              moderator_did: user.did,
              reason: `Ban removal: ${reason || 'User banned'}`,
              target_handle: userHandle
            });
          } catch (err) {
            if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
              console.log(`Post ${postUri} not found in feeds (already removed or not present)`);
              error = 'Not found in feeds';
            } else {
              console.error(`Failed to remove post ${postUri} during ban:`, err);
              error = err instanceof Error ? err.message : 'Unknown error';
            }
          }
          
          attemptedPosts.push({ postUri, success, error });
        }
        
        console.log(`Removed ${totalPostsRemoved} out of ${recentPosts.length} recent posts for ${userHandle}`);
      } catch (error) {
        console.error('Failed to remove recent posts during ban:', error);
      }
    }
    
    // Process per-feed ban lists
    if (selectedFeeds && selectedFeeds.length > 0) {
      if (!Array.isArray(selectedFeeds) || selectedFeeds.length > 50) {
        return res.status(400).json({ error: 'Invalid feed selection' });
      }
      
      // Resolve targets (feed IDs or group names) to actual feed IDs
      const resolvedFeedIds = await resolveTargetsToFeeds(selectedFeeds, req.user.userId, user.did);
      
      if (resolvedFeedIds.length === 0) {
        return res.status(403).json({ error: 'No authorized feeds found' });
      }
      
      const bannedLists = new Set<string>();
      const feedsWithoutLists: string[] = [];
      
      for (const feedId of resolvedFeedIds) {
        const feed = await db.getFeedById(feedId);
        if (feed) {
          // Security: Re-verify permission at action time
          let authUser = user;
          if (feed.user_id !== req.user.userId) {
            const group = await db.pool.query(`
              SELECT fg.id, fg.owner_user_id FROM feed_groups fg
              JOIN feed_group_members fgm ON fg.id = fgm.group_id
              WHERE fgm.feed_id = $1
            `, [feedId]);
            
            if (group.rows.length === 0) {
              console.error('[SECURITY] Feed', feedId, 'not in any group');
              continue;
            }
            
            const groupId = group.rows[0].id;
            const ownerId = group.rows[0].owner_user_id;
            
            const permCheck = await db.pool.query(`
              SELECT 1 FROM group_moderators
              WHERE group_id = $1 AND moderator_did = $2 AND 'ban' = ANY(permissions)
            `, [groupId, user.did]);
            
            if (permCheck.rows.length === 0 && ownerId !== req.user.userId) {
              console.error('[SECURITY] User', user.did, 'lacks ban permission for feed', feedId);
              return res.status(403).json({ 
                success: false,
                error: 'Permission denied',
                message: 'You do not have ban permission for this feed'
              });
            }
            
            const ownerUser = await db.getUserProfileById(feed.user_id);
            if (!ownerUser) {
              console.error('Feed owner not found for feed:', feedId);
              continue;
            }
            authUser = ownerUser;
            console.log('[ban-user] Moderator', user.handle, 'using owner auth:', authUser.handle);
          }
          
          // Only use individual feed ban lists - no group ban lists
          if (feed.feed_ban_list && !bannedLists.has(feed.feed_ban_list)) {
            try {
              const { BlueskyService } = await import('../services/bluesky.js');
              const blueskyService = new BlueskyService();
              await blueskyService.banUser(userHandle, feed.feed_ban_list, authUser);
              bannedLists.add(feed.feed_ban_list);
              if (!blueskyListSuccess) {
                blueskyListSuccess = true;
                blueskyListName = `${feed.feed_name} Ban List`;
                blueskyListUrl = convertAtUriToBskyUrl(feed.feed_ban_list);
              }
              console.log(`Added ${userHandle} to ban list ${feed.feed_ban_list}`);
            } catch (error) {
              console.error(`Failed to add to ban list ${feed.feed_ban_list}:`, error);
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              if (!blueskyListError) {
                blueskyListError = errorMsg;
              }
              return res.status(500).json({ 
                success: false,
                error: errorMsg,
                message: `Failed to add user to Bluesky ban list. User was not banned locally.`
              });
            }
          } else if (!feed.feed_ban_list) {
            feedsWithoutLists.push(feed.feed_name || feedId);
          }
          
          // Only add to local database if feed has a ban list and Bluesky ban succeeded
          if (feed.feed_ban_list) {
            await db.banUser(req.user.userId, userHandle, bannedDid, feedId, null, reason, user.did);
          }
          
          // Log the ban action
          await db.logModerationAction({
            post_uri: undefined,
            account_did: bannedDid || undefined,
            action: 'manual_ban',
            feed_id: feedId,
            moderator_did: user.did,
            reason: reason || 'Manual ban',
            target_handle: userHandle
          });
          
          // Add user report for tracking with hierarchical type
          if (bannedDid) {
            await db.addUserReport(bannedDid, reportType, user.did, undefined, 'app');
          }
          
          // Remove recent posts from this specific feed (only if not already done globally)
          if (!useGlobal) {
            try {
              const { BlueskyService } = await import('../services/bluesky.js');
              const blueskyService = new BlueskyService();
              const postLimit = 10;
              const recentPosts = await blueskyService.getUserRecentPosts(userHandle, postLimit, user);
              
              console.log(`Found ${recentPosts.length} recent posts for ${userHandle}, attempting removal from feed ${feedId}...`);
              
              for (const postUri of recentPosts) {
                try {
                  await grazeService.removePost(postUri, feedId, authUser);
                  totalPostsRemoved++;
                  console.log(`Successfully removed post ${postUri} from feed ${feedId} during ban`);
                  
                  // Log the action
                  await db.logModerationAction({
                    post_uri: postUri,
                    account_did: bannedDid || undefined,
                    action: 'ban_removal',
                    feed_id: feedId,
                    moderator_did: user.did,
                    reason: `Ban removal: ${reason || 'User banned'}`,
                    target_handle: userHandle
                  });
                } catch (error) {
                  if (error instanceof Error && error.message === 'POST_NOT_FOUND') {
                    console.log(`Post ${postUri} not found in feed ${feedId} (already removed or not present)`);
                  } else {
                    console.error(`Failed to remove post ${postUri} from feed ${feedId} during ban:`, error);
                  }
                }
              }
              
              console.log(`Removed ${totalPostsRemoved} posts from feed ${feedId} for ${userHandle}`);
            } catch (error) {
              console.error(`Failed to remove recent posts from feed ${feedId} during ban:`, error);
            }
          }
        }
      }
      
      // Check if no feeds had configured ban lists
      if (bannedLists.size === 0 && feedsWithoutLists.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Ban failed: No feeds in the selected group(s) have configured ban lists. Feeds without lists: ${feedsWithoutLists.join(', ')}`,
          message: 'Configure ban lists for feeds before attempting group bans'
        });
      }
    }
    
    res.json({ 
      success: true, 
      postsRemoved: totalPostsRemoved,
      blueskyListSuccess,
      blueskyListError,
      blueskyListName,
      blueskyListUrl,
      attemptedPosts
    });
    
  } catch (error) {
    console.error('User ban error:', error);
    // Return error if ban operation failed
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to ban user'
    });
  }
});

// Get user's ban lists
router.get('/ban-lists', authenticateToken, async (req: any, res) => {
  try {
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { BlueskyService } = await import('../services/bluesky.js');
    const blueskyService = new BlueskyService();
    
    const lists = await blueskyService.getBanLists(user);
    res.json({ lists });
    
  } catch (error) {
    console.error('Get ban lists error:', error);
    res.status(500).json({ error: 'Failed to get ban lists' });
  }
});

// Retry failed Bluesky ban syncs
router.post('/retry-ban-sync', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { userHandle, listType } = req.body;
    if (!userHandle || !listType) {
      return res.status(400).json({ error: 'User handle and list type required' });
    }
    
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get the ban record
    const banRecord = await db.getPool().query(
      'SELECT * FROM banned_users WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
      [req.user.userId, userHandle, listType]
    );
    
    if (banRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Ban record not found' });
    }
    
    // Get the appropriate ban list URI
    let banListUri = null;
    if (listType === 'global') {
      banListUri = user.global_ban_list;
    } else {
      const feed = await db.getFeedById(listType);
      if (feed && feed.user_id === req.user.userId) {
        banListUri = feed.feed_ban_list;
      }
    }
    
    if (!banListUri) {
      return res.status(400).json({ error: 'No ban list configured for this type' });
    }
    
    // Try to add to Bluesky list
    try {
      const { BlueskyService } = await import('../services/bluesky.js');
      const blueskyService = new BlueskyService();
      await blueskyService.banUser(userHandle, banListUri, user);
      
      // Clear sync_failed flag
      await db.getPool().query(
        'UPDATE banned_users SET sync_failed = false WHERE user_id = $1 AND banned_handle = $2 AND list_type = $3',
        [req.user.userId, userHandle, listType]
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to retry ban sync:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Retry ban sync error:', error);
    res.status(500).json({ error: 'Retry failed' });
  }
});

// Get banned users
router.get('/banned-users', authenticateToken, async (req: any, res) => {
  try {
    const { includeHistory } = req.query;
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (includeHistory === 'true') {
      // Get formerly banned users (users with unban logs)
      const result = await db.getPool().query(`
        SELECT DISTINCT
          ml.target_handle as banned_handle,
          ml.account_did as banned_did,
          'history' as list_type,
          CASE 
            WHEN ml.feed_id IS NULL THEN 'Global Ban List'
            ELSE COALESCE(f.feed_name, 'Feed ' || ml.feed_id || ' (deleted)')
          END as feed_name,
          MAX(ml.created_at) as banned_at,
          ml.reason,
          up.avatar_url,
          up.display_name,
          (
            SELECT json_agg(json_build_object(
              'report_type', ur.report_type,
              'source', ur.source,
              'reporter_did', ur.reporter_did,
              'reported_at', ur.reported_at
            ))
            FROM user_reports ur 
            WHERE ur.reported_user_did = ml.account_did
          ) as user_reports
        FROM moderation_log ml
        LEFT JOIN feeds f ON ml.feed_id = f.feed_id
        LEFT JOIN user_profiles up ON ml.account_did = up.did
        WHERE ml.target_handle IS NOT NULL 
        AND ml.action = 'unban'
        AND ml.moderator_did = $1
        GROUP BY ml.target_handle, ml.account_did, ml.feed_id, f.feed_name, ml.reason, up.avatar_url, up.display_name
        ORDER BY banned_at DESC
      `, [user.did]);
      
      res.json(result.rows);
    } else {
      // Get currently banned users only
      const result = await db.getPool().query(`
        SELECT 
          bu.*,
          CASE 
            WHEN bu.list_type = 'global' THEN 'Global'
            ELSE COALESCE(f.feed_name, bu.list_type)
          END as feed_name,
          up.avatar_url,
          up.display_name,
          COALESCE(bu.sync_failed, false) as sync_failed,
          (
            SELECT json_agg(json_build_object(
              'report_type', ur.report_type,
              'source', ur.source,
              'reporter_did', ur.reporter_did,
              'reported_at', ur.reported_at
            ))
            FROM user_reports ur 
            WHERE ur.reported_user_did = bu.banned_did
          ) as user_reports,
          (
            SELECT ml.action
            FROM moderation_log ml
            WHERE ml.target_handle = bu.banned_handle
            AND ml.moderator_did = bu.banned_by_did
            AND ml.action IN ('manual_ban', 'ban_user', 'auto_ban', 'modmaster_ban', 'modmaster_auto_ban')
            AND (ml.feed_id = bu.list_type OR (ml.feed_id IS NULL AND bu.list_type = 'global'))
            ORDER BY ml.created_at DESC
            LIMIT 1
          ) as action
        FROM banned_users bu
        LEFT JOIN feeds f ON bu.list_type = f.feed_id
        LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
        WHERE bu.user_id = $1
        ORDER BY bu.sync_failed DESC, bu.banned_at DESC
      `, [req.user.userId]);
      
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Get banned users error:', error);
    res.status(500).json({ error: 'Failed to get banned users' });
  }
});

// Get user's own moderation activity
router.get('/user-activity', authenticateToken, async (req: any, res) => {
  try {
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await db.getPool().query(`
      SELECT 
        ml.*, 
        f.feed_name,
        CASE 
          WHEN ml.action = 'backfill_removal' AND ml.target_handle IS NOT NULL THEN
            (SELECT display_name FROM user_profiles WHERE handle = ml.target_handle LIMIT 1)
          ELSE up.display_name
        END as target_display_name,
        CASE 
          WHEN ml.action = 'backfill_removal' AND ml.target_handle IS NOT NULL THEN
            (SELECT avatar_url FROM user_profiles WHERE handle = ml.target_handle LIMIT 1)
          ELSE up.avatar_url
        END as target_avatar,
        (
          SELECT json_agg(json_build_object(
            'report_type', pr.report_type,
            'source', pr.source,
            'reporter_did', pr.reporter_did,
            'reported_at', pr.reported_at
          ))
          FROM post_reports pr 
          WHERE pr.post_uri = ml.post_uri
        ) as post_reports,
        CASE WHEN pp.id IS NOT NULL THEN true ELSE false END as is_protected,
        (
          SELECT json_agg(json_build_object(
            'feed_id', pp2.feed_id,
            'feed_name', f2.feed_name
          ))
          FROM protected_posts pp2
          LEFT JOIN feeds f2 ON pp2.feed_id = f2.feed_id
          WHERE pp2.user_id = $2 AND pp2.post_uri = ml.post_uri
        ) as protected_feeds
      FROM moderation_log ml
      LEFT JOIN feeds f ON ml.feed_id = f.feed_id
      LEFT JOIN protected_posts pp ON pp.user_id = $2 AND pp.post_uri = ml.post_uri AND pp.feed_id = ml.feed_id
      LEFT JOIN user_profiles up ON ml.account_did = up.did
      WHERE (
        (ml.moderator_did = $1 AND ml.action IN ('manual_removal', 'backfill_removal', 'remove_post'))
        OR 
        (f.user_id = $2 AND ml.action IN ('communal_removal'))
      )
      ORDER BY ml.created_at DESC
      LIMIT 50
    `, [user.did, req.user.userId]);
    
    // Fetch post details for activities with post URIs
    const activities = result.rows;
    const { BlueskyService } = await import('../services/bluesky.js');
    const blueskyService = new BlueskyService();
    
    for (const activity of activities) {
      if (activity.post_uri) {
        try {
          const postDetails = await blueskyService.getPostDetails(activity.post_uri);
          activity.post_details = postDetails;
        } catch (error) {
          console.error(`Failed to fetch post details for ${activity.post_uri}:`, error);
          activity.post_details = null;
        }
      }
    }
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Get trending removals
router.get('/trending-removals', authenticateToken, async (req: any, res) => {
  try {
    console.log('Trending removals endpoint called');
    const { timeframe = '1d', showHidden = 'false', showRemoved = 'false' } = req.query;
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const days = timeframe === '7d' ? 7 : 1;
    
    const result = await db.getPool().query(`
      WITH post_reports AS (
        SELECT 
          pr.post_uri,
          COUNT(*) as total_reports,
          array_agg(DISTINCT pr.report_type) as report_types,
          -- Count by main categories for threshold calculations
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'misleading%' OR pr.report_type = 'misleading') as misleading_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'harassment%' OR pr.report_type = 'harassment') as harassment_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'violence%' OR pr.report_type = 'violence') as violence_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'sexual%' OR pr.report_type = 'sexual') as sexual_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'child-safety%' OR pr.report_type = 'child-safety') as child_safety_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'self-harm%' OR pr.report_type = 'self-harm') as self_harm_reports,
          COUNT(*) FILTER (WHERE pr.report_type LIKE 'rule%' OR pr.report_type = 'rule') as rule_reports
        FROM post_reports pr
        WHERE pr.source IN ('ozone', 'communal', 'app')
        GROUP BY pr.post_uri
      ),
      trending_posts AS (
        SELECT 
          ml.post_uri,
          COUNT(DISTINCT ml.moderator_did) as unique_removers,
          COUNT(DISTINCT ml.moderator_did)::float / $1 as velocity,
          MIN(ml.created_at) as first_removal,
          MAX(ml.created_at) as last_removal,
          EXISTS(
            SELECT 1 FROM moderation_log ml2 
            WHERE ml2.post_uri = ml.post_uri 
            AND ml2.moderator_did = $2
            AND ml2.action IN ('manual_removal', 'backfill_removal', 'communal_removal', 'remove_post')
          ) as already_removed,
          EXISTS(
            SELECT 1 FROM hidden_trending_posts htp
            WHERE htp.post_uri = ml.post_uri AND htp.user_id = $3
          ) as is_hidden,
          COALESCE(pr.total_reports, 0) as total_reports,
          COALESCE(pr.report_types, ARRAY[]::text[]) as report_types,
          COALESCE(pr.misleading_reports, 0) as misleading_reports,
          COALESCE(pr.harassment_reports, 0) as harassment_reports,
          COALESCE(pr.violence_reports, 0) as violence_reports,
          COALESCE(pr.sexual_reports, 0) as sexual_reports,
          COALESCE(pr.child_safety_reports, 0) as child_safety_reports,
          COALESCE(pr.self_harm_reports, 0) as self_harm_reports,
          COALESCE(pr.rule_reports, 0) as rule_reports
        FROM moderation_log ml
        LEFT JOIN post_reports pr ON ml.post_uri = pr.post_uri
        LEFT JOIN user_profiles u ON u.id = $3
        WHERE ml.post_uri IS NOT NULL 
        AND ml.action IN ('manual_removal', 'backfill_removal', 'communal_removal', 'remove_post')
        AND ml.created_at > NOW() - INTERVAL '${days} days'
        GROUP BY ml.post_uri, pr.total_reports, pr.report_types, pr.misleading_reports, pr.harassment_reports, pr.violence_reports, pr.sexual_reports, pr.child_safety_reports, pr.self_harm_reports, pr.rule_reports
        HAVING COUNT(DISTINCT ml.moderator_did) >= 1
      )
      SELECT * FROM trending_posts
      ORDER BY velocity DESC, unique_removers DESC
      LIMIT 50
    `, [days, user.did, req.user.userId]);
    
    // Get user's feeds for feed status calculation
    const userFeeds = await db.getUserFeeds(req.user.userId);
    const userFeedIds = userFeeds.map(f => f.feed_id);
    
    // Filter based on hidden and removed status using OR logic
    let filteredResults = [];
    for (const post of result.rows) {
      const removedFromQuery = await db.getPool().query(`
        SELECT DISTINCT feed_id 
        FROM moderation_log 
        WHERE post_uri = $1 
        AND moderator_did = $2 
        AND action IN ('manual_removal', 'backfill_removal', 'communal_removal', 'remove_post')
        AND feed_id IS NOT NULL
      `, [post.post_uri, user.did]);
      
      const removedFromFeeds = removedFromQuery.rows.map(r => r.feed_id);
      const existsOnFeeds = userFeedIds.filter(feedId => !removedFromFeeds.includes(feedId));
      const isFullyRemoved = existsOnFeeds.length === 0;
      
      // Apply showHidden and showRemoved filters using OR logic
      let shouldShow = false;
      
      // Show by default if not hidden and not removed
      if (!post.is_hidden && !isFullyRemoved) {
        shouldShow = true;
      }
      
      // Show if hidden and showHidden toggle is on
      if (post.is_hidden && showHidden === 'true') {
        shouldShow = true;
      }
      
      // Show if removed and showRemoved toggle is on
      if (isFullyRemoved && showRemoved === 'true') {
        shouldShow = true;
      }
      
      if (shouldShow) {
        filteredResults.push(post);
      }
    }
    
    // Fetch post details and calculate proper feed status for trending removals
    const trendingWithDetails = filteredResults;
    console.log(`Found ${trendingWithDetails.length} trending posts`);
    const { BlueskyService } = await import('../services/bluesky.js');
    const blueskyService = new BlueskyService();
    
    for (const post of trendingWithDetails) {
      console.log(`Processing post: ${post.post_uri}`);
      
      // Calculate proper feed status
      const removedFromQuery = await db.getPool().query(`
        SELECT DISTINCT feed_id 
        FROM moderation_log 
        WHERE post_uri = $1 
        AND moderator_did = $2 
        AND action IN ('manual_removal', 'backfill_removal', 'communal_removal', 'remove_post')
        AND feed_id IS NOT NULL
      `, [post.post_uri, user.did]);
      
      const removedFromFeeds = removedFromQuery.rows.map(r => r.feed_id);
      const existsOnFeeds = userFeedIds.filter(feedId => !removedFromFeeds.includes(feedId));
      
      post.feed_status = {
        removed_from: removedFromFeeds,
        exists_on: existsOnFeeds
      };
      
      if (post.post_uri) {
        try {
          const postDetails = await blueskyService.getPostDetails(post.post_uri);
          post.post_details = postDetails;
        } catch (error) {
          console.error(`Failed to fetch post details for ${post.post_uri}:`, error);
          post.post_details = null;
        }
      }
    }
    
    res.json(trendingWithDetails.slice(0, 20));
  } catch (error) {
    console.error('Error fetching trending removals:', error);
    res.status(500).json({ error: 'Failed to fetch trending removals' });
  }
});

// Get trending banned users
router.get('/trending-banned-users', authenticateToken, async (req: any, res) => {
  try {
    const { timeframe = '1d', showHidden = 'false', showRemoved = 'false' } = req.query;
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const days = timeframe === '7d' ? 7 : 1;
    
    console.log(`Fetching trending banned users with params: timeframe=${timeframe}, showHidden=${showHidden}, showRemoved=${showRemoved}`);
    
    const result = await db.getPool().query(`
      WITH user_ban_reports AS (
        SELECT 
          ur.reported_user_did,
          COUNT(*) as total_reports,
          array_agg(DISTINCT ur.report_type) as report_types,
          -- Count by main categories for threshold calculations
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'misleading%' OR ur.report_type = 'misleading') as misleading_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'harassment%' OR ur.report_type = 'harassment') as harassment_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'violence%' OR ur.report_type = 'violence') as violence_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'sexual%' OR ur.report_type = 'sexual') as sexual_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'child-safety%' OR ur.report_type = 'child-safety') as child_safety_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'self-harm%' OR ur.report_type = 'self-harm') as self_harm_reports,
          COUNT(*) FILTER (WHERE ur.report_type LIKE 'rule%' OR ur.report_type = 'rule') as rule_reports
        FROM user_reports ur
        WHERE ur.source IN ('ozone', 'communal', 'app')
        GROUP BY ur.reported_user_did
      ),
      trending_bans AS (
        SELECT 
          bu.banned_handle,
          bu.banned_did,
          COUNT(DISTINCT bu.banned_by_did) as unique_banners,
          COUNT(DISTINCT bu.banned_by_did)::float / $1 as velocity,
          MIN(bu.banned_at) as first_ban,
          MAX(bu.banned_at) as last_ban,
          BOOL_OR(
            bu.banned_by_did = $2
          ) as already_banned,
          BOOL_OR(
            EXISTS(SELECT 1 FROM hidden_trending_banned_users htbu WHERE LOWER(htbu.banned_handle) = LOWER(bu.banned_handle) AND htbu.user_id = $3)
          ) as is_hidden,
          COALESCE(ubr.total_reports, 0) as total_reports,
          COALESCE(ubr.report_types, ARRAY[]::text[]) as report_types,
          COALESCE(ubr.misleading_reports, 0) as misleading_reports,
          COALESCE(ubr.harassment_reports, 0) as harassment_reports,
          COALESCE(ubr.violence_reports, 0) as violence_reports,
          COALESCE(ubr.sexual_reports, 0) as sexual_reports,
          COALESCE(ubr.child_safety_reports, 0) as child_safety_reports,
          COALESCE(ubr.self_harm_reports, 0) as self_harm_reports,
          COALESCE(ubr.rule_reports, 0) as rule_reports,
          up.avatar_url,
          up.display_name
        FROM banned_users bu
        LEFT JOIN user_ban_reports ubr ON bu.banned_did = ubr.reported_user_did
        LEFT JOIN user_profiles u ON u.id = $3
        LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
        WHERE bu.banned_at > NOW() - INTERVAL '${days} days'
        GROUP BY bu.banned_handle, bu.banned_did, ubr.total_reports, ubr.report_types, ubr.misleading_reports, ubr.harassment_reports, ubr.violence_reports, ubr.sexual_reports, ubr.child_safety_reports, ubr.self_harm_reports, ubr.rule_reports, up.avatar_url, up.display_name
        HAVING COUNT(DISTINCT bu.banned_by_did) >= 1
      )
      SELECT * FROM trending_bans
      ORDER BY velocity DESC, unique_banners DESC
      LIMIT 20
    `, [days, user.did, req.user.userId]);
    
    console.log(`Found ${result.rows.length} trending banned users before filtering`);
    
    // Get user's feeds for ban status calculation
    const userFeeds = await db.getUserFeeds(req.user.userId);
    const userFeedIds = userFeeds.map(f => f.feed_id);
    
    // Calculate ban status for each trending user and filter based on showRemoved
    const trendingWithBanStatus = [];
    for (const trendingUser of result.rows) {
      // Get feeds where this user is banned by the current user
      const bannedFromQuery = await db.getPool().query(`
        SELECT DISTINCT list_type 
        FROM banned_users 
        WHERE banned_handle = $1 
        AND banned_by_did = $2
        AND list_type != 'global'
      `, [trendingUser.banned_handle, user.did]);
      
      const bannedFromFeeds = bannedFromQuery.rows.map(r => r.list_type);
      
      // Check if banned from global
      const globalBanQuery = await db.getPool().query(`
        SELECT 1 FROM banned_users 
        WHERE banned_handle = $1 
        AND banned_by_did = $2
        AND list_type = 'global'
      `, [trendingUser.banned_handle, user.did]);
      
      const isBannedGlobally = globalBanQuery.rows.length > 0;
      
      // If banned globally, they're banned from all feeds
      let notBannedFromFeeds: string[] = [];
      if (isBannedGlobally) {
        bannedFromFeeds.push('global');
      } else {
        notBannedFromFeeds = userFeedIds.filter(feedId => !bannedFromFeeds.includes(feedId));
        // Add global to not banned from if not globally banned
        notBannedFromFeeds.push('global');
      }
      
      trendingUser.ban_status = {
        banned_from: bannedFromFeeds,
        not_banned_from: notBannedFromFeeds
      };
      
      // Determine if user is "removed" (banned from all feeds)
      const isFullyBanned = notBannedFromFeeds.length === 0;
      
      // Apply showHidden and showRemoved filters using OR logic
      // Default: show if neither hidden nor removed
      // OR show if hidden and showHidden is enabled
      // OR show if removed and showRemoved is enabled
      let shouldShow = false;
      
      // Show by default if not hidden and not removed
      if (!trendingUser.is_hidden && !isFullyBanned) {
        shouldShow = true;
      }
      
      // Show if hidden and showHidden toggle is on
      if (trendingUser.is_hidden && showHidden === 'true') {
        shouldShow = true;
      }
      
      // Show if removed and showRemoved toggle is on
      if (isFullyBanned && showRemoved === 'true') {
        shouldShow = true;
      }
      
      console.log(`User ${trendingUser.banned_handle}: hidden=${trendingUser.is_hidden}, fullyBanned=${isFullyBanned}, showHidden=${showHidden}, showRemoved=${showRemoved}, shouldShow=${shouldShow}`);
      console.log(`  - notBannedFromFeeds: ${JSON.stringify(notBannedFromFeeds)}`);
      console.log(`  - bannedFromFeeds: ${JSON.stringify(bannedFromFeeds)}`);
      
      if (shouldShow) {
        trendingWithBanStatus.push(trendingUser);
      }
    }
    
    console.log(`Returning ${trendingWithBanStatus.length} trending banned users after filtering`);
    
    res.json(trendingWithBanStatus);
  } catch (error) {
    console.error('Error fetching trending banned users:', error);
    res.status(500).json({ error: 'Failed to fetch trending banned users' });
  }
});

// Backfill post removal
router.post('/backfill-removal', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { userHandle, postCount, feedIds } = req.body;
    if (!userHandle || !postCount) {
      return res.status(400).json({ error: 'User handle and post count required' });
    }
    
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check post count limits (now available to all users)
    if (![25, 50, 100].includes(postCount)) {
      return res.status(400).json({ error: 'Post count must be 25, 50, or 100' });
    }
    
    // Check monthly backfill limits based on post count
    let maxBackfills: number;
    if (postCount === 25) {
      maxBackfills = 20;
    } else if (postCount === 50) {
      maxBackfills = 10;
    } else { // postCount === 100
      maxBackfills = 5;
    }
    
    const today = new Date();
    const resetDate = new Date(user.backfill_reset_date || today);
    
    // Reset counter if month has passed
    if (today > resetDate) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      await db.getPool().query('UPDATE user_profiles SET backfill_count_25 = 0, backfill_count_50 = 0, backfill_count_100 = 0, backfill_reset_date = $1 WHERE id = $2', [nextMonth, req.user.userId]);
      user.backfill_count_25 = 0;
      user.backfill_count_50 = 0;
      user.backfill_count_100 = 0;
    }
    
    // Check specific limit for this post count
    const currentCount = postCount === 25 ? (user.backfill_count_25 || 0) : 
                       postCount === 50 ? (user.backfill_count_50 || 0) : 
                       (user.backfill_count_100 || 0);
    
    if (currentCount >= maxBackfills) {
      return res.status(429).json({ error: `Monthly limit reached for ${postCount} posts (${maxBackfills} times per month)` });
    }
    
    // Get recent posts and remove them
    const { BlueskyService } = await import('../services/bluesky.js');
    const blueskyService = new BlueskyService();
    const recentPosts = await blueskyService.getUserRecentPosts(userHandle, postCount, user);
    
    // Resolve targets (feed IDs or group names) to actual feed IDs
    const resolvedFeedIds = await resolveTargetsToFeeds(feedIds, req.user.userId, user.did);
    
    if (resolvedFeedIds.length === 0) {
      return res.status(403).json({ error: 'No authorized feeds found' });
    }
    
    let removedCount = 0;
    for (const postUri of recentPosts) {
      if (resolvedFeedIds.includes('all')) {
        try {
          await grazeService.removePostFromAllFeeds(postUri, user);
          removedCount++;
        } catch (error) {
          // Continue on error
        }
      } else {
        for (const feedId of resolvedFeedIds) {
          try {
            await grazeService.removePost(postUri, feedId, user);
            removedCount++;
          } catch (error) {
            // Continue on error
          }
        }
      }
    }
    
    // Increment specific backfill count
    const countColumn = postCount === 25 ? 'backfill_count_25' : 
                       postCount === 50 ? 'backfill_count_50' : 
                       'backfill_count_100';
    await db.getPool().query(`UPDATE user_profiles SET ${countColumn} = COALESCE(${countColumn}, 0) + 1 WHERE id = $1`, [req.user.userId]);
    
    // Log the action
    await db.logModerationAction({
      post_uri: undefined,
      account_did: undefined,
      action: 'backfill_removal',
      feed_id: undefined,
      moderator_did: user.did,
      reason: `Backfill removal of ${postCount} posts`,
      target_handle: userHandle
    });
    
    res.json({
      success: true,
      postsProcessed: recentPosts.length,
      removalsAttempted: removedCount,
      backfillsRemaining: maxBackfills - (currentCount + 1)
    });
    
  } catch (error) {
    console.error('Backfill removal error:', error);
    res.status(500).json({ error: 'Backfill removal failed' });
  }
});

// Remove post from user's feeds
router.post('/remove-post', authenticateToken, checkRemovalRateLimit, async (req: any, res) => {
  try {
    const { postUri, feedIds, reportType = 'other' } = req.body;
    if (!postUri || !feedIds || !Array.isArray(feedIds) || feedIds.length === 0 || feedIds.length > 50) {
      return res.status(400).json({ error: 'Invalid request: post URI and 1-50 feed IDs required' });
    }
    
    // Convert Bluesky URL to AT URI if needed
    let atUri;
    try {
      atUri = await convertBskyUrlToAtUri(postUri);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid post URL format' });
    }
    
    // Get user
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Resolve targets (feed IDs or group names) to actual feed IDs
    const resolvedFeedIds = await resolveTargetsToFeeds(feedIds, req.user.userId, user.did);
    console.log('[remove-post] Resolved feed IDs:', resolvedFeedIds);
    
    if (resolvedFeedIds.length === 0) {
      return res.status(403).json({ error: 'No authorized feeds found' });
    }
    
    const results = [];
    
    // Handle 'all' feeds case specially
    if (resolvedFeedIds.includes('all')) {
      try {
        await grazeService.removePostFromAllFeeds(atUri, user);
        
        // Add to post_reports
        await db.addPostReport(atUri, reportType, user.did, 'app');
        
        // Track user report
        if (reportType !== 'other') {
          const match = atUri.match(/^at:\/\/([^/]+)/);
          if (match) {
            const authorDid = match[1];
            await db.addUserReport(authorDid, reportType, user.did, atUri, 'app');
          }
        }
        
        // Log the action
        await db.logModerationAction({
          post_uri: atUri,
          account_did: undefined,
          action: 'manual_removal',
          feed_id: undefined,
          moderator_did: user.did,
          reason: 'manual_dashboard_removal_all_account'
        });
        
        results.push({ feedId: 'all', feedName: 'All Account Feeds', success: true });
        
        // Increment removal count
        const rateLimiter = new RateLimiterService(db);
        await rateLimiter.incrementRemovalCount(req.user.userId);
        
      } catch (error) {
        console.log('[remove-post] Error removing from all feeds:', error);
        results.push({
          feedId: 'all',
          feedName: 'All Account Feeds',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      // Handle specific feeds
      for (const feedId of resolvedFeedIds) {
        console.log('[remove-post] Processing feed:', feedId);
        try {
          const feed = await db.getFeedById(feedId);
          if (!feed) {
            throw new Error('Feed not found');
          }
        
        // Security: Verify this feed came from authorized resolution
        let authUser = user;
        if (feed.user_id !== req.user.userId) {
          // Re-verify permission at action time (defense against TOCTOU)
          const group = await db.pool.query(`
            SELECT fg.id, fg.owner_user_id FROM feed_groups fg
            JOIN feed_group_members fgm ON fg.id = fgm.group_id
            WHERE fgm.feed_id = $1
          `, [feedId]);
          
          if (group.rows.length === 0) {
            console.error('[SECURITY] Feed', feedId, 'not in any group');
            throw new Error('Permission denied');
          }
          
          const groupId = group.rows[0].id;
          const ownerId = group.rows[0].owner_user_id;
          
          // Verify user still has permission
          const permCheck = await db.pool.query(`
            SELECT 1 FROM group_moderators
            WHERE group_id = $1 AND moderator_did = $2 AND 'remove' = ANY(permissions)
          `, [groupId, user.did]);
          
          if (permCheck.rows.length === 0 && ownerId !== req.user.userId) {
            console.error('[SECURITY] User', user.did, 'permission revoked for feed', feedId);
            throw new Error('Permission denied');
          }
          
          const ownerUser = await db.getUserProfileById(feed.user_id);
          if (!ownerUser) {
            throw new Error('Feed owner not found');
          }
          authUser = ownerUser;
          console.log('[remove-post] Moderator', user.handle, 'using owner auth:', authUser.handle);
        }
        
        // Make sure to pass the specific feedId, not 'all'
        await grazeService.removePost(atUri, feedId, authUser);
        
        // Add to post_reports with hierarchical report type for manual removals
        await db.addPostReport(atUri, reportType, user.did, 'app');
        
        // Also track user report for hierarchical types
        if (reportType !== 'other') {
          // Extract user DID from post URI for user reporting
          const match = atUri.match(/^at:\/\/([^/]+)/);
          if (match) {
            const authorDid = match[1];
            await db.addUserReport(authorDid, reportType, user.did, atUri, 'app');
          }
        }
        
        // Log the action
        await db.logModerationAction({
          post_uri: atUri,
          account_did: undefined,
          action: 'manual_removal',
          feed_id: feedId === 'all' ? undefined : feedId,
          moderator_did: user.did,
          reason: 'manual_dashboard_removal'
        });
        
        const feedName = feed.feed_name || feed.feed_display_name || feedId;
          results.push({ feedId, feedName, success: true });
          
          // Increment removal count
          const rateLimiter = new RateLimiterService(db);
          await rateLimiter.incrementRemovalCount(req.user.userId);
          
        } catch (error) {
          console.log('[remove-post] Error removing from feed:', feedId, error);
          const feed = await db.getFeedById(feedId);
          const feedName = feed?.feed_name || feed?.feed_display_name || feedId;
          results.push({
            feedId,
            feedName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    console.log('[remove-post] Final results:', results);
    res.json({ results });
    
  } catch (error) {
    console.error('Manual removal error:', error);
    res.status(500).json({ error: 'Removal failed' });
  }
});

// Unban user
router.post('/unban-user', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { userHandle, listType, listIdentifier } = req.body;
    if (!userHandle) {
      return res.status(400).json({ error: 'User handle required' });
    }
    
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get the specific ban being unbanned
    const bannedUsers = await db.getBannedUsers(req.user.userId);
    let userBan;
    
    if (listType && listIdentifier !== undefined) {
      // Find specific ban by list type and identifier
      userBan = bannedUsers.find(u => 
        u.banned_handle.toLowerCase() === userHandle.toLowerCase() && 
        u.list_type === listType && 
        u.list_identifier === listIdentifier
      );
    } else if (listType) {
      // Find by list type only
      userBan = bannedUsers.find(u => 
        u.banned_handle.toLowerCase() === userHandle.toLowerCase() && 
        u.list_type === listType
      );
    } else {
      // Fallback to first ban found
      userBan = bannedUsers.find(u => u.banned_handle.toLowerCase() === userHandle.toLowerCase());
    }
    
    if (!userBan) {
      return res.status(404).json({ error: 'User not found in ban list' });
    }
    
    // Remove from Bluesky list FIRST
    let blueskySuccess = false;
    let blueskyError = null;
    try {
      const { BlueskyService } = await import('../services/bluesky.js');
      const blueskyService = new BlueskyService();
      await blueskyService.unbanUser(userHandle, userBan.list_type, user);
      blueskySuccess = true;
      console.log(`Successfully removed ${userHandle} from Bluesky ${userBan.list_type} ban list`);
    } catch (error) {
      console.error('Failed to remove from Bluesky list:', error);
      blueskyError = error instanceof Error ? error.message : 'Unknown error';
      // Continue with database removal even if Bluesky fails
    }
    
    // Remove from database
    await db.unbanUser(req.user.userId, userHandle, userBan.banned_did, userBan.list_type);
    console.log(`Successfully removed ${userHandle} from database ${userBan.list_type} ban list`);
    
    // Log the unban action after successful database removal
    await db.logModerationAction({
      post_uri: undefined,
      account_did: userBan.banned_did || undefined,
      action: 'unban',
      feed_id: userBan.list_type === 'global' ? null : userBan.list_type,
      moderator_did: user.did,
      reason: 'Manual unban',
      target_handle: userHandle
    });
    
    res.json({ 
      success: true,
      blueskySuccess,
      blueskyError,
      message: blueskySuccess ? 'User unbanned from both database and Bluesky list' : 'User unbanned from database only (Bluesky removal failed)'
    });
    
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Unban failed' });
  }
});

// Sync ban lists with Bluesky
router.post('/sync-ban-lists', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { listType } = req.body;
    const cooldownKey = listType || 'all';
    
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Import enhanced sync service
    const { EnhancedBlueskySync } = await import('../services/enhancedBlueskySync.js');
    const enhancedSync = new EnhancedBlueskySync();
    
    // Check if sync is needed (1 hour cooldown per list)
    const syncNeeded = await enhancedSync.isSyncNeeded(req.user.userId, cooldownKey, 1);
    if (!syncNeeded) {
      return res.status(429).json({ 
        error: 'Sync cooldown active. Try again in 1 hour.',
        nextSyncAvailable: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
    }
    
    // Perform enhanced sync
    const result = await enhancedSync.syncBanListsEnhanced(user, listType);
    
    res.json({
      success: true,
      ...result,
      message: `Sync completed: ${result.added} added, ${result.removed} removed, ${result.deduplicated} duplicates cleaned`
    });
    
  } catch (error) {
    console.error('Sync ban lists error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed' 
    });
  }
});

// Get sync status
router.get('/sync-status', authenticateToken, async (req: any, res) => {
  try {
    const { listType } = req.query;
    
    const { EnhancedBlueskySync } = await import('../services/enhancedBlueskySync.js');
    const enhancedSync = new EnhancedBlueskySync();
    
    const status = await enhancedSync.getSyncStatus(req.user.userId, listType);
    res.json(status);
    
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Hide trending post
router.post('/hide-trending-post', authenticateToken, async (req: any, res) => {
  try {
    const { postUri } = req.body;
    if (!postUri) {
      return res.status(400).json({ error: 'Post URI required' });
    }
    
    await db.getPool().query(
      'INSERT INTO hidden_trending_posts (user_id, post_uri) VALUES ($1, $2) ON CONFLICT (user_id, post_uri) DO NOTHING',
      [req.user.userId, postUri]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error hiding trending post:', error);
    res.status(500).json({ error: 'Failed to hide post' });
  }
});

// Hide trending banned user
router.post('/hide-trending-banned-user', authenticateToken, async (req: any, res) => {
  try {
    const { bannedHandle } = req.body;
    if (!bannedHandle) {
      return res.status(400).json({ error: 'Banned handle required' });
    }
    
    await db.getPool().query(
      'INSERT INTO hidden_trending_banned_users (user_id, banned_handle) VALUES ($1, $2) ON CONFLICT (user_id, banned_handle) DO NOTHING',
      [req.user.userId, bannedHandle]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error hiding trending banned user:', error);
    res.status(500).json({ error: 'Failed to hide banned user' });
  }
});

// Get post history
router.get('/post-history/:postUri(*)', authenticateToken, async (req: any, res) => {
  try {
    const { postUri } = req.params;
    const { feedId } = req.query;
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const history = await db.getPostHistory(decodeURIComponent(postUri), user.did, feedId);
    res.json(history);
    
  } catch (error) {
    console.error('Error fetching post history:', error);
    res.status(500).json({ error: 'Failed to fetch post history' });
  }
});

// Get post reports
router.get('/post-reports/:postUri(*)', authenticateToken, async (req: any, res) => {
  try {
    const { postUri } = req.params;
    const result = await db.getPool().query(`
      SELECT pr.*, 
        CASE 
          WHEN pr.reporter_did LIKE 'did:plc:%' THEN 
            COALESCE(
              (SELECT handle FROM user_profiles WHERE did = pr.reporter_did LIMIT 1),
              SUBSTRING(pr.reporter_did FROM 9 FOR 8) || '...'
            )
          ELSE pr.reporter_did
        END as reporter_display
      FROM post_reports pr
      WHERE pr.post_uri = $1
      ORDER BY pr.reported_at DESC
    `, [decodeURIComponent(postUri)]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching post reports:', error);
    res.status(500).json({ error: 'Failed to fetch post reports' });
  }
});

// Reverse post removal
router.post('/reverse-removal', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { postUri, feedIds } = req.body;
    if (!postUri || !feedIds || !Array.isArray(feedIds) || feedIds.length === 0) {
      return res.status(400).json({ error: 'Post URI and feed IDs array required' });
    }
    
    // Get user
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const results = [];
    for (const feedId of feedIds) {
      try {
        // Verify user owns the feed
        const feed = await db.getFeedById(feedId);
        if (!feed || feed.user_id !== req.user.userId) {
          results.push({ feedId, success: false, error: 'Feed not owned by user' });
          continue;
        }
        
        // Unhide post in feed
        await grazeService.unhidePost(postUri, feedId, user);
        
        // Add to protected posts to prevent automated re-removal
        await db.getPool().query(`
          INSERT INTO protected_posts (user_id, post_uri, feed_id) 
          VALUES ($1, $2, $3) 
          ON CONFLICT (user_id, post_uri, feed_id) DO NOTHING
        `, [req.user.userId, postUri, feedId]);
        
        // Log the reversal action to history
        await db.logModerationAction({
          post_uri: postUri,
          account_did: undefined,
          action: 'reverse_removal',
          feed_id: feedId,
          moderator_did: user.did,
          reason: 'manual_reversal'
        });
        
        results.push({ feedId, success: true, feedName: feed.feed_name });
        
      } catch (error) {
        console.error(`Failed to reverse removal for feed ${feedId}:`, error);
        results.push({ feedId, success: false, error: 'Failed to re-add post' });
      }
    }
    
    res.json({ success: true, results });
    
  } catch (error) {
    console.error('Reverse removal error:', error);
    res.status(500).json({ error: 'Reversal failed' });
  }
});

// Get user reports
router.get('/user-reports/:handle', authenticateToken, async (req: any, res) => {
  try {
    const { handle } = req.params;
    
    // First resolve handle to DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    let userDid: string | null = null;
    try {
      const response = await agent.resolveHandle({ handle });
      userDid = response.data.did;
    } catch (error) {
      return res.status(404).json({ error: 'User handle not found' });
    }
    
    const result = await db.getPool().query(`
      SELECT ur.*, 
        CASE 
          WHEN ur.reporter_did LIKE 'did:plc:%' THEN 
            COALESCE(
              (SELECT handle FROM user_profiles WHERE did = ur.reporter_did LIMIT 1),
              SUBSTRING(ur.reporter_did FROM 9 FOR 8) || '...'
            )
          ELSE ur.reporter_did
        END as reporter_display
      FROM user_reports ur
      WHERE ur.reported_user_did = $1
      ORDER BY ur.reported_at DESC
    `, [userDid]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ error: 'Failed to fetch user reports' });
  }
});

// Get user history (ban/unban events for a specific user)
router.get('/user-history/:handle', authenticateToken, async (req: any, res) => {
  try {
    const { handle } = req.params;
    const { feedId } = req.query;
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let query = `
      SELECT 
        ml.*,
        f.feed_name,
        CASE 
          WHEN ml.action = 'manual_ban' THEN 'banned'
          WHEN ml.action = 'ban_user' THEN 'banned'
          WHEN ml.action = 'auto_ban' THEN 'banned'
          WHEN ml.action = 'modmaster_ban' THEN 'banned'
          WHEN ml.action = 'modmaster_auto_ban' THEN 'banned'
          WHEN ml.action = 'unban' THEN 'unbanned'
          WHEN ml.action = 'ban_removal' THEN 'post_removed'
          WHEN ml.action = 'manual_removal' THEN 'post_removed'
          WHEN ml.action = 'backfill_removal' THEN 'post_removed'
          WHEN ml.action = 'communal_removal' THEN 'post_removed'
          WHEN ml.action = 'remove_post' THEN 'post_removed'
          ELSE ml.action
        END as event_type
      FROM moderation_log ml
      LEFT JOIN feeds f ON ml.feed_id = f.feed_id
      WHERE ml.target_handle = $1
      AND ml.moderator_did = $2
      AND ml.action IN ('manual_ban', 'ban_user', 'auto_ban', 'modmaster_ban', 'modmaster_auto_ban', 'unban', 'ban_removal', 'manual_removal', 'backfill_removal', 'communal_removal', 'remove_post')
    `;
    
    const params = [handle, user.did];
    
    if (feedId && feedId !== 'undefined') {
      query += ' AND ml.feed_id = $3';
      params.push(feedId);
    }
    
    query += ' ORDER BY ml.created_at DESC LIMIT 50';
    
    const result = await db.getPool().query(query, params);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

export default router;