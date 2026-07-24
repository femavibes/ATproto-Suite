import express from 'express';
import { authenticateToken } from './auth.js';

// CSRF protection middleware
function csrfProtection(req: any, res: any, next: any) {
  // Check origin
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.DEV_FRONTEND_URL_ALT,
    // Development origins
    ...(process.env.NODE_ENV === 'development' ? [
      /^http:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}:(3000|5173)$/,
      /^http:\/\/10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:(3000|5173)$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3}:(3000|5173)$/
    ] : [])
  ].filter(Boolean);
  
  if (!origin || !allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed instanceof RegExp && allowed.test(origin)
  )) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  
  // Check CSRF token
  const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
  if (!csrfToken || csrfToken !== req.user?.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

const router = express.Router();

// Middleware to check admin privileges
async function requireAdmin(req: any, res: any, next: any) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const pool = req.app.get('db');
    const result = await pool.query('SELECT * FROM user_profiles WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin authorization check failed:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(`
      SELECT 
        u.id, u.did, u.handle, u.subscription_tier, u.is_admin, u.created_at,
        COUNT(f.id) as feed_count
      FROM user_profiles u
      LEFT JOIN feeds f ON u.id = f.user_id
      GROUP BY u.id, u.did, u.handle, u.subscription_tier, u.is_admin, u.created_at
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user subscription tier
router.put('/users/:userId/subscription', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { subscription_tier } = req.body;
    
    if (!['none', 'free', 'paid', 'premium'].includes(subscription_tier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }
    
    const pool = req.app.get('db');
    await pool.query(
      'UPDATE user_profiles SET subscription_tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [subscription_tier, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Get system stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      req.app.get('db').query('SELECT COUNT(*) as total_users FROM user_profiles WHERE subscription_tier != \'none\''),
      req.app.get('db').query('SELECT COUNT(*) as paid_users FROM user_profiles WHERE subscription_tier IN (\'paid\', \'premium\')'),
      req.app.get('db').query('SELECT COUNT(*) as total_feeds FROM feeds'),
      req.app.get('db').query('SELECT COUNT(*) as total_reports FROM post_reports WHERE reported_at > NOW() - INTERVAL \'24 hours\''),
      req.app.get('db').query('SELECT COUNT(*) as total_actions FROM moderation_log WHERE created_at > NOW() - INTERVAL \'24 hours\'')
    ]);
    
    res.json({
      total_users: parseInt(stats[0].rows[0].total_users),
      paid_users: parseInt(stats[1].rows[0].paid_users),
      total_feeds: parseInt(stats[2].rows[0].total_feeds),
      reports_24h: parseInt(stats[3].rows[0].total_reports),
      actions_24h: parseInt(stats[4].rows[0].total_actions)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get recent moderation activity
router.get('/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(`
      SELECT 
        ml.*, 
        u.handle as moderator_handle,
        f.feed_name
      FROM moderation_log ml
      LEFT JOIN user_profiles u ON ml.moderator_did = u.did
      LEFT JOIN feeds f ON ml.feed_id = f.feed_id
      ORDER BY ml.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Manual communal moderation backfill
router.post('/communal-backfill', csrfProtection, authenticateToken, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.body; // Optional: backfill for specific user
    
    const { CommunalWorker } = await import('../services/communalWorker.js');
    const worker = CommunalWorker.getInstance();
    
    const backfillResult = await worker.runBackfill(userId);
    
    res.json({ 
      success: true, 
      message: `Backfill completed: ${backfillResult.processed}/${backfillResult.total} posts processed`,
      ...backfillResult
    });
    
  } catch (error) {
    console.error('Communal backfill error:', error);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

// Get admin default thresholds
router.get('/defaults', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
    const syncService = AdminThresholdSync.getInstance();
    
    const defaults = await syncService.getAdminDefaults();
    res.json(defaults);
  } catch (error) {
    console.error('Error fetching admin defaults:', error);
    res.status(500).json({ error: 'Failed to fetch admin defaults' });
  }
});

// Update admin default thresholds
router.put('/defaults', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { defaults } = req.body;
    
    if (!Array.isArray(defaults)) {
      return res.status(400).json({ error: 'Defaults must be an array' });
    }
    
    // Validate each default
    for (const def of defaults) {
      const { threshold_type, category, subcategory, post_threshold, user_ban_threshold } = def;
      
      if (!['global', 'feed'].includes(threshold_type)) {
        return res.status(400).json({ error: `Invalid threshold_type: ${threshold_type}` });
      }
      
      if (!post_threshold || post_threshold < 1 || post_threshold > 1000) {
        return res.status(400).json({ error: `Invalid post_threshold: ${post_threshold}` });
      }
      
      if (!user_ban_threshold || user_ban_threshold < 1 || user_ban_threshold > 1000) {
        return res.status(400).json({ error: `Invalid user_ban_threshold: ${user_ban_threshold}` });
      }
    }
    
    // Use sync service to update defaults and sync users
    const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
    const syncService = AdminThresholdSync.getInstance();
    
    const result = await syncService.updateAdminDefaults(defaults);
    
    res.json({ 
      success: true, 
      updated: result.updated,
      synced_users: {
        post_thresholds: result.postSyncCount,
        ban_thresholds: result.banSyncCount
      }
    });
  } catch (error) {
    console.error('Error updating admin defaults:', error);
    res.status(500).json({ error: 'Failed to update admin defaults' });
  }
});

// Sync users to admin defaults
router.post('/sync-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
    const syncService = AdminThresholdSync.getInstance();
    
    const result = await syncService.syncUsersWithAdminDefaults('global');
    
    res.json({ 
      success: true, 
      synced_users: {
        post_thresholds: result.postSyncCount,
        ban_thresholds: result.banSyncCount
      },
      message: `Synced ${result.postSyncCount} users with post thresholds, ${result.banSyncCount} users with ban thresholds`
    });
  } catch (error) {
    console.error('Error syncing users:', error);
    res.status(500).json({ error: 'Failed to sync users' });
  }
});

export default router;