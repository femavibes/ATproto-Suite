import express from 'express';
import { Database } from '../services/database.js';
import { authenticateToken } from './auth.js';
import { checkApiRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();
const db = Database.getInstance();

// Get user's feeds
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const feeds = await db.getUserFeeds(req.user.userId);
    res.json(feeds);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// Get user's feeds for Bluesky client (with AT Protocol URIs)
router.get('/bluesky', authenticateToken, async (req: any, res) => {
  try {
    const feeds = await db.getUserFeeds(req.user.userId);
    
    // Add feed_uri for Bluesky client compatibility
    const feedsWithUri = feeds.map(feed => {
      let feed_uri = null;
      
      if (feed.feed_url) {
        // Convert Bluesky web URL to AT Protocol URI
        // https://bsky.app/profile/did:plc:xxx/feed/yyy -> at://did:plc:xxx/app.bsky.feed.generator/yyy
        const match = feed.feed_url.match(/https:\/\/bsky\.app\/profile\/(did:plc:[^/]+)\/feed\/([^/?]+)/);
        if (match) {
          const [, did, feedId] = match;
          feed_uri = `at://${did}/app.bsky.feed.generator/${feedId}`;
        }
      }
      
      return {
        ...feed,
        feed_uri
      };
    }).filter(feed => feed.feed_uri); // Only include feeds with valid URIs
    
    res.json(feedsWithUri);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// Add new feed
router.post('/', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { feedId, feedName, feedSlug, feedUrl } = req.body;
    
    console.log('Add feed request:', { feedId, feedName, feedSlug, feedUrl, userId: req.user.userId });
    
    if (!feedId || !feedName) {
      return res.status(400).json({ error: 'Feed ID and name required' });
    }
    
    // Check subscription limits
    const user = await db.getUserById(req.user.userId);
    if (!user) {
      console.log('User not found:', req.user.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const existingFeeds = await db.getUserFeeds(req.user.userId);
    
    console.log('User subscription check:', {
      userId: req.user.userId,
      subscriptionTier: user.subscription_tier,
      existingFeedsCount: existingFeeds.length,
      feedIds: existingFeeds.map(f => f.feed_id)
    });
    
    // Check subscription limits
    if (user.subscription_tier === 'free' && existingFeeds.length >= 3) {
      console.log('Free tier limit exceeded');
      return res.status(403).json({ error: 'Free tier limited to 3 feeds' });
    }
    if (user.subscription_tier === 'paid' && existingFeeds.length >= 30) {
      console.log('Paid tier limit exceeded');
      return res.status(403).json({ error: 'Paid tier limited to 30 feeds' });
    }
    if (user.subscription_tier === 'premium' && existingFeeds.length >= 100) {
      console.log('Premium tier limit exceeded');
      return res.status(403).json({ error: 'Premium tier limited to 100 feeds' });
    }
    
    console.log('Creating feed...');
    const feed = await db.createFeed(req.user.userId, feedId, feedName, feedSlug, feedUrl);
    console.log('Feed created successfully:', feed);
    res.json(feed);
    
  } catch (error: any) {
    console.error('Error creating feed:', error);
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      if (error.constraint === 'feeds_user_id_feed_id_unique') {
        res.status(409).json({ error: `Feed ID "${req.body.feedId}" already exists. Each feed can only be added once.` });
      } else if (error.constraint === 'feeds_user_id_feed_name_unique') {
        res.status(409).json({ error: `Feed name "${req.body.feedName}" already exists. Please choose a different name.` });
      } else {
        res.status(409).json({ error: 'Feed already exists' });
      }
    } else {
      res.status(500).json({ error: 'Failed to create feed' });
    }
  }
});

// Update feed settings
router.put('/:feedId', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { feedId } = req.params;
    const updateData = req.body;
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Build dynamic update query for all possible columns
    const columns = [];
    const values = [];
    let paramIndex = 1;
    
    // Handle sync settings with backup/restore
    if (updateData.sync_feed_post_thresholds !== undefined || updateData.sync_feed_ban_thresholds !== undefined) {
      // Get current sync state
      const currentResult = await db.getPool().query(
        'SELECT sync_feed_post_thresholds, sync_feed_ban_thresholds FROM feeds WHERE feed_id = $1',
        [feedId]
      );
      const current = currentResult.rows[0];
      
      const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
      const syncService = AdminThresholdSync.getInstance();
      
      // Handle post threshold sync changes
      if (updateData.sync_feed_post_thresholds !== undefined && updateData.sync_feed_post_thresholds !== current.sync_feed_post_thresholds) {
        if (updateData.sync_feed_post_thresholds) {
          // Enabling sync - backup current settings first
          await syncService.enableFeedSync(feedId, 'post');
        } else {
          // Disabling sync - restore backed up settings
          await syncService.disableFeedSync(feedId, 'post');
        }
      }
      
      // Handle ban threshold sync changes
      if (updateData.sync_feed_ban_thresholds !== undefined && updateData.sync_feed_ban_thresholds !== current.sync_feed_ban_thresholds) {
        if (updateData.sync_feed_ban_thresholds) {
          // Enabling sync - backup current settings first
          await syncService.enableFeedSync(feedId, 'ban');
        } else {
          // Disabling sync - restore backed up settings
          await syncService.disableFeedSync(feedId, 'ban');
        }
      }
      
      // Add sync columns to update
      if (updateData.sync_feed_post_thresholds !== undefined) {
        columns.push(`sync_feed_post_thresholds = $${paramIndex++}`);
        values.push(updateData.sync_feed_post_thresholds || false);
      }
      if (updateData.sync_feed_ban_thresholds !== undefined) {
        columns.push(`sync_feed_ban_thresholds = $${paramIndex++}`);
        values.push(updateData.sync_feed_ban_thresholds || false);
      }
      
      // If user enables sync, apply admin defaults after backup
      if (updateData.sync_feed_post_thresholds || updateData.sync_feed_ban_thresholds) {
        await syncService.syncUsersWithAdminDefaults('feed');
      }
    }
    
    // Core settings
    if (updateData.communal_enabled !== undefined) {
      columns.push(`communal_enabled = $${paramIndex++}`);
      values.push(updateData.communal_enabled !== false);
    }
    if (updateData.cross_type_percentage !== undefined) {
      columns.push(`cross_type_percentage = $${paramIndex++}`);
      values.push(updateData.cross_type_percentage || 20);
    }
    if (updateData.same_category_cross_percentage !== undefined) {
      columns.push(`same_category_cross_percentage = $${paramIndex++}`);
      values.push(updateData.same_category_cross_percentage || 50);
    }
    if (updateData.user_ban_same_category_cross_percentage !== undefined) {
      columns.push(`user_ban_same_category_cross_percentage = $${paramIndex++}`);
      values.push(updateData.user_ban_same_category_cross_percentage || 50);
    }
    if (updateData.global_ban_list !== undefined) {
      columns.push(`global_ban_list = $${paramIndex++}`);
      values.push(updateData.global_ban_list || null);
    }
    if (updateData.feed_ban_list !== undefined) {
      columns.push(`feed_ban_list = $${paramIndex++}`);
      values.push(updateData.feed_ban_list || null);
    }
    if (updateData.feed_ban_list_name !== undefined) {
      columns.push(`feed_ban_list_name = $${paramIndex++}`);
      values.push(updateData.feed_ban_list_name || null);
    }
    if (updateData.feed_slug !== undefined) {
      columns.push(`feed_slug = $${paramIndex++}`);
      values.push(updateData.feed_slug || null);
    }
    if (updateData.feed_url !== undefined) {
      columns.push(`feed_url = $${paramIndex++}`);
      values.push(updateData.feed_url || null);
    }
    
    // Track processed columns to avoid duplicates
    const processedColumns = new Set();
    
    // Helper function to add column if not already processed
    const addColumn = (col: string, value: any) => {
      if (!processedColumns.has(col)) {
        columns.push(`${col} = $${paramIndex++}`);
        values.push(value);
        processedColumns.add(col);
      }
    };
    
    // Legacy columns (for backward compatibility)
    const legacyColumns = [
      'opt_in_spam', 'opt_in_misleading', 'opt_in_sexual', 'opt_in_harassment', 'opt_in_illegal', 'opt_in_other',
      'threshold_spam', 'threshold_misleading', 'threshold_sexual', 'threshold_harassment', 'threshold_illegal', 'threshold_other',
      'user_ban_threshold_spam', 'user_ban_threshold_sexual', 'user_ban_threshold_harassment', 'user_ban_threshold_illegal',
      'user_ban_cross_type_percentage'
    ];
    
    legacyColumns.forEach(col => {
      if (updateData[col] !== undefined) {
        const value = (col.startsWith('threshold_') || col.startsWith('user_ban_threshold_')) 
          ? Math.max(updateData[col] || 3, 1)
          : updateData[col];
        addColumn(col, value);
      }
    });
    
    // Hierarchical opt-in columns (30 subcategories)
    const hierarchicalOptIns = [
      'opt_in_misleading_spam', 'opt_in_misleading_scam', 'opt_in_misleading_bot', 'opt_in_misleading_impersonation', 'opt_in_misleading_elections', 'opt_in_misleading_other',
      'opt_in_harassment_troll', 'opt_in_harassment_targeted', 'opt_in_harassment_hate_speech', 'opt_in_harassment_doxxing', 'opt_in_harassment_other',
      'opt_in_violence_animal', 'opt_in_violence_threats', 'opt_in_violence_graphic_content', 'opt_in_violence_glorification', 'opt_in_violence_trafficking', 'opt_in_violence_other',
      'opt_in_sexual_unlabeled', 'opt_in_sexual_abuse_content', 'opt_in_sexual_ncii', 'opt_in_sexual_deepfake', 'opt_in_sexual_animal', 'opt_in_sexual_other',
      'opt_in_child_safety_privacy', 'opt_in_child_safety_harassment',
      'opt_in_self_harm_content', 'opt_in_self_harm_ed', 'opt_in_self_harm_stunts', 'opt_in_self_harm_substances', 'opt_in_self_harm_other',
      'opt_in_rule_site_security', 'opt_in_rule_prohibited_sales', 'opt_in_rule_ban_evasion', 'opt_in_rule_other'
    ];
    
    hierarchicalOptIns.forEach(col => {
      if (updateData[col] !== undefined) {
        addColumn(col, updateData[col] || false);
      }
    });
    
    // Main category thresholds (8 categories)
    const mainThresholds = [
      'threshold_misleading', 'threshold_harassment', 'threshold_violence', 'threshold_sexual',
      'threshold_child_safety', 'threshold_self_harm', 'threshold_rule', 'threshold_other'
    ];
    
    mainThresholds.forEach(col => {
      if (updateData[col] !== undefined) {
        addColumn(col, Math.max(updateData[col] || 3, 1));
      }
    });
    
    // Subcategory threshold overrides (30 columns)
    const subcategoryThresholds = [
      'threshold_misleading_spam', 'threshold_misleading_scam', 'threshold_misleading_bot', 'threshold_misleading_impersonation', 'threshold_misleading_elections', 'threshold_misleading_other',
      'threshold_harassment_troll', 'threshold_harassment_targeted', 'threshold_harassment_hate_speech', 'threshold_harassment_doxxing', 'threshold_harassment_other',
      'threshold_violence_animal', 'threshold_violence_threats', 'threshold_violence_graphic_content', 'threshold_violence_glorification', 'threshold_violence_trafficking', 'threshold_violence_other',
      'threshold_sexual_unlabeled', 'threshold_sexual_abuse_content', 'threshold_sexual_ncii', 'threshold_sexual_deepfake', 'threshold_sexual_animal', 'threshold_sexual_other',
      'threshold_child_safety_privacy', 'threshold_child_safety_harassment',
      'threshold_self_harm_content', 'threshold_self_harm_ed', 'threshold_self_harm_stunts', 'threshold_self_harm_substances', 'threshold_self_harm_other',
      'threshold_rule_site_security', 'threshold_rule_prohibited_sales', 'threshold_rule_ban_evasion', 'threshold_rule_other',
      'threshold_other_main'
    ];
    
    subcategoryThresholds.forEach(col => {
      if (updateData[col] !== undefined) {
        addColumn(col, updateData[col] ? Math.max(updateData[col], 1) : null);
      }
    });
    
    if (columns.length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }
    
    // Execute update
    const query = `UPDATE feeds SET ${columns.join(', ')} WHERE feed_id = $${paramIndex} AND user_id = $${paramIndex + 1}`;
    values.push(feedId, req.user.userId);
    
    await db.getPool().query(query, values);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating feed:', error);
    res.status(500).json({ error: 'Failed to update feed' });
  }
});

// Get users on feed ban list
router.get('/:feedId/ban-list-users', authenticateToken, async (req: any, res) => {
  try {
    const { feedId } = req.params;
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Get users banned on this specific feed
    const users = await db.getPool().query(`
      SELECT bu.*, up.avatar_url, up.display_name
      FROM banned_users bu 
      LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
      WHERE bu.user_id = $1 AND (bu.list_identifier = $2 OR bu.list_type = $2)
      ORDER BY bu.banned_at DESC
    `, [req.user.userId, feedId]);
    
    res.json({ users: users.rows });
    
  } catch (error) {
    console.error('Error fetching feed ban list users:', error);
    res.status(500).json({ error: 'Failed to fetch ban list users' });
  }
});

// Update feed ban list
router.post('/update-ban-list', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { feedId, listUri, listName } = req.body;
    
    if (!feedId || !listUri) {
      return res.status(400).json({ error: 'Feed ID and list URI required' });
    }
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Update the feed ban list
    await db.getPool().query(
      'UPDATE feeds SET feed_ban_list = $1, feed_ban_list_name = $2 WHERE feed_id = $3 AND user_id = $4',
      [listUri, listName || null, feedId, req.user.userId]
    );
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating feed ban list:', error);
    res.status(500).json({ error: 'Failed to update feed ban list' });
  }
});

// Delete feed
router.delete('/:feedId', authenticateToken, checkApiRateLimit, async (req: any, res) => {
  try {
    const { feedId } = req.params;
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    await db.getPool().query('DELETE FROM feeds WHERE feed_id = $1 AND user_id = $2', [
      feedId, 
      req.user.userId
    ]);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting feed:', error);
    res.status(500).json({ error: 'Failed to delete feed' });
  }
});

export default router;