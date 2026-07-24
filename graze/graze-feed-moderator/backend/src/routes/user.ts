import express from 'express';
import { Database } from '../services/database.js';
import { authenticateToken } from './auth.js';

// CSRF protection middleware (simplified for user routes)
function csrfProtection(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  next();
}

const router = express.Router();
const db = Database.getInstance();

// Get user's global ban list
router.get('/global-ban-list', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT global_ban_list FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    res.json({ globalBanList: result.rows[0]?.global_ban_list || null });
  } catch (error) {
    console.error('Error fetching global ban list:', error);
    res.status(500).json({ error: 'Failed to fetch global ban list' });
  }
});

// Update user's global ban list
router.post('/global-ban-list', authenticateToken, async (req: any, res) => {
  try {
    const { globalBanList } = req.body;
    
    await db.getPool().query(
      'UPDATE user_profiles SET global_ban_list = $1 WHERE id = $2',
      [globalBanList || null, req.user.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating global ban list:', error);
    res.status(500).json({ error: 'Failed to update global ban list' });
  }
});

// Get users on global ban list
router.get('/global-ban-list-users', authenticateToken, async (req: any, res) => {
  try {
    // Get users banned on global list
    const users = await db.getPool().query(`
      SELECT bu.*, up.avatar_url, up.display_name
      FROM banned_users bu 
      LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
      WHERE bu.user_id = $1 AND bu.list_type = 'global'
      ORDER BY bu.banned_at DESC
    `, [req.user.userId]);
    
    res.json({ users: users.rows });
    
  } catch (error) {
    console.error('Error fetching global ban list users:', error);
    res.status(500).json({ error: 'Failed to fetch global ban list users' });
  }
});

// Update user's global ban list with name
router.post('/update-global-ban-list', authenticateToken, async (req: any, res) => {
  try {
    const { listUri, listName } = req.body;
    
    if (!listUri) {
      return res.status(400).json({ error: 'List URI required' });
    }
    
    await db.getPool().query(
      'UPDATE user_profiles SET global_ban_list = $1, global_ban_list_name = $2 WHERE id = $3',
      [listUri, listName || null, req.user.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating global ban list:', error);
    res.status(500).json({ error: 'Failed to update global ban list' });
  }
});

// Get user's backfill limits
router.get('/backfill-limits', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT backfill_count_25, backfill_count_50, backfill_count_100, backfill_reset_date FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    const user = result.rows[0];
    const today = new Date();
    const resetDate = new Date(user.backfill_reset_date || today);
    
    // Reset counters if month has passed
    let count25 = user.backfill_count_25 || 0;
    let count50 = user.backfill_count_50 || 0;
    let count100 = user.backfill_count_100 || 0;
    
    if (today > resetDate) {
      count25 = 0;
      count50 = 0;
      count100 = 0;
    }
    
    const remaining25 = Math.max(0, 20 - count25);
    const remaining50 = Math.max(0, 10 - count50);
    const remaining100 = Math.max(0, 5 - count100);
    
    // Return the highest remaining count for display
    const maxRemaining = Math.max(remaining25, remaining50, remaining100);
    
    res.json({ 
      remaining: maxRemaining,
      limits: {
        '25': { remaining: remaining25, max: 20 },
        '50': { remaining: remaining50, max: 10 },
        '100': { remaining: remaining100, max: 5 }
      }
    });
  } catch (error) {
    console.error('Error fetching backfill limits:', error);
    res.status(500).json({ error: 'Failed to fetch backfill limits' });
  }
});

// Get user's global communal moderation settings
router.get('/global-settings', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT * FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching global settings:', error);
    res.status(500).json({ error: 'Failed to fetch global settings' });
  }
});

// Update user's global communal moderation settings
router.put('/global-settings', authenticateToken, async (req: any, res) => {
  try {
    const updateData = req.body;
    
    // Build dynamic update query
    const columns = [];
    const values = [];
    let paramIndex = 1;
    
    // Process all fields from request body
    for (const [key, value] of Object.entries(updateData)) {
      if (key.startsWith('global_')) {
        columns.push(`"${key}" = $${paramIndex++}`);
        
        // Apply validation based on field type
        if (key.includes('threshold') && typeof value === 'number') {
          values.push(Math.max(value, 1));
        } else if (key.includes('percentage') && typeof value === 'number') {
          values.push(Math.max(Math.min(value, 100), 0));
        } else {
          values.push(value);
        }
      }
    }
    
    if (columns.length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }
    
    const query = `UPDATE user_profiles SET ${columns.join(', ')} WHERE id = $${paramIndex}`;
    values.push(req.user.userId);
    
    await db.getPool().query(query, values);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating global settings:', error);
    res.status(500).json({ error: 'Failed to update global settings' });
  }
});

// Update decrypt service URL only
router.post('/update-decrypt-url', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    const { userDecryptUrl, userApiKey } = req.body;
    
    await db.getPool().query(
      'UPDATE user_profiles SET user_decrypt_url = $1, user_api_key = $2 WHERE id = $3',
      [userDecryptUrl, userApiKey, req.user.userId]
    );
    
    res.json({ success: true, message: 'Service URL updated successfully' });
    
  } catch (error) {
    console.error('Service URL update error:', error);
    res.status(500).json({ error: 'Service URL update failed' });
  }
});

// Get user's decrypt service settings
router.get('/decrypt-settings', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT user_decrypt_url FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    res.json({ 
      userDecryptUrl: result.rows[0]?.user_decrypt_url || null,
      hasApiKey: !!result.rows[0]?.user_api_key
    });
  } catch (error) {
    console.error('Error fetching decrypt settings:', error);
    res.status(500).json({ error: 'Failed to fetch decrypt settings' });
  }
});

// Configure zero-trust proxy
router.post('/configure-zero-trust', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    const { proxyUrl, apiKey } = req.body;
    
    if (!proxyUrl || !apiKey) {
      return res.status(400).json({ error: 'Proxy URL and API key required' });
    }
    
    // Get user's handle for proxy configuration
    const userResult = await db.getPool().query(
      'SELECT handle FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    const userHandle = userResult.rows[0]?.handle;
    
    if (!userHandle) {
      return res.status(400).json({ error: 'User handle not found' });
    }
    
    // Test proxy connection
    const { ZeroTrustProxyClient } = await import('../services/zeroTrustProxy.js');
    const client = new ZeroTrustProxyClient(proxyUrl, apiKey, userHandle);
    
    try {
      const status = await client.checkStatus();
      if (!status.healthy) {
        return res.status(400).json({ error: 'Proxy health check failed' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Cannot connect to proxy' });
    }
    
    // Save configuration
    await db.getPool().query(
      'UPDATE user_profiles SET zero_trust_mode = true, zero_trust_proxy_url = $1, zero_trust_api_key = $2, zero_trust_status = $3 WHERE id = $4',
      [proxyUrl, apiKey, 'active', req.user.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Zero-trust configuration error:', error);
    res.status(500).json({ error: 'Configuration failed' });
  }
});

// Get zero-trust settings
router.get('/zero-trust-settings', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT zero_trust_mode, zero_trust_proxy_url, zero_trust_status, password_type FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        enabled: false,
        proxyUrl: null,
        status: 'inactive',
        passwordType: null
      });
    }
    
    const user = result.rows[0];
    res.json({
      enabled: user.zero_trust_mode || false,
      proxyUrl: user.zero_trust_proxy_url || null,
      status: user.zero_trust_status || 'inactive',
      passwordType: user.password_type || null
    });
  } catch (error) {
    console.error('Error fetching zero-trust settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Disable zero-trust mode (keep config for re-enabling)
router.post('/disable-zero-trust', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    await db.getPool().query(
      'UPDATE user_profiles SET zero_trust_mode = false, zero_trust_status = $1 WHERE id = $2',
      ['inactive', req.user.userId]
    );
    
    // Clear any cached sessions
    const GrazeService = (await import('../services/graze.js')).GrazeService;
    const BlueskyService = (await import('../services/bluesky.js')).BlueskyService;
    GrazeService.clearUserSession(req.user.userId);
    BlueskyService.clearUserAgent(req.user.userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Disable zero-trust error:', error);
    res.status(500).json({ error: 'Failed to disable zero-trust' });
  }
});

// Enable zero-trust mode (using saved proxy settings)
router.post('/enable-zero-trust', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    await db.getPool().query(
      'UPDATE user_profiles SET zero_trust_mode = true, zero_trust_status = $1 WHERE id = $2',
      ['active', req.user.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Enable zero-trust error:', error);
    res.status(500).json({ error: 'Failed to enable zero-trust' });
  }
});

// Get user preferences (theme, dark mode)
router.get('/preferences', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.getPool().query(
      'SELECT dark_mode, theme FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    
    const user = result.rows[0];
    res.json({
      dark_mode: user?.dark_mode || false,
      theme: user?.theme || 'default'
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req: any, res) => {
  try {
    const { dark_mode, theme } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (typeof dark_mode === 'boolean') {
      updates.push(`dark_mode = $${paramIndex++}`);
      values.push(dark_mode);
    }
    
    if (theme && ['default', 'pride', 'trans', 'blm'].includes(theme)) {
      updates.push(`theme = $${paramIndex++}`);
      values.push(theme);
    }
    
    if (updates.length === 0) {
      return res.json({ success: true, message: 'No valid preferences to update' });
    }
    
    const query = `UPDATE user_profiles SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    values.push(req.user.userId);
    
    await db.getPool().query(query, values);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Update user sync settings
router.put('/sync-settings', authenticateToken, async (req: any, res) => {
  try {
    const { sync_global_post_thresholds, sync_global_ban_thresholds } = req.body;
    
    // Get current sync state
    const currentResult = await db.getPool().query(
      'SELECT sync_global_post_thresholds, sync_global_ban_thresholds FROM user_profiles WHERE id = $1',
      [req.user.userId]
    );
    const current = currentResult.rows[0];
    
    const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
    const syncService = AdminThresholdSync.getInstance();
    
    // Handle post threshold sync changes
    if (sync_global_post_thresholds !== current.sync_global_post_thresholds) {
      if (sync_global_post_thresholds) {
        // Enabling sync - backup current settings first
        await syncService.enableUserSync(req.user.userId, 'post');
      } else {
        // Disabling sync - restore backed up settings
        await syncService.disableUserSync(req.user.userId, 'post');
      }
    }
    
    // Handle ban threshold sync changes
    if (sync_global_ban_thresholds !== current.sync_global_ban_thresholds) {
      if (sync_global_ban_thresholds) {
        // Enabling sync - backup current settings first
        await syncService.enableUserSync(req.user.userId, 'ban');
      } else {
        // Disabling sync - restore backed up settings
        await syncService.disableUserSync(req.user.userId, 'ban');
      }
    }
    
    // Update sync preferences
    await db.getPool().query(
      'UPDATE user_profiles SET sync_global_post_thresholds = $1, sync_global_ban_thresholds = $2 WHERE id = $3',
      [sync_global_post_thresholds, sync_global_ban_thresholds, req.user.userId]
    );
    
    // If user enables sync, apply admin defaults after backup
    if (sync_global_post_thresholds || sync_global_ban_thresholds) {
      await syncService.syncUsersWithAdminDefaults('global');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating sync settings:', error);
    res.status(500).json({ error: 'Failed to update sync settings' });
  }
});

// Get Bluesky credentials
router.get('/bsky-credentials', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await db.getPool().query(
      'SELECT handle, bsky_password, zero_trust_mode, zero_trust_proxy_url, zero_trust_api_key, did FROM user_profiles WHERE id = $1',
      [userId]
    );
    
    if (!user.rows[0] || !user.rows[0].handle) {
      return res.json({ hasCredentials: false });
    }
    
    const userData = user.rows[0];
    
    if (userData.zero_trust_mode && userData.zero_trust_proxy_url && userData.zero_trust_api_key) {
      // Get Bluesky token from zero-trust proxy (same way as Graze)
      try {
        console.log('Attempting zero-trust Bluesky token for user:', userData.handle);
        const { ZeroTrustProxyClient } = await import('../services/zeroTrustProxy.js');
        const client = new ZeroTrustProxyClient(
          userData.zero_trust_proxy_url,
          userData.zero_trust_api_key,
          userData.handle
        );
        
        const blueskyAuth = await client.getBlueskyToken('PWA_BLUESKY_CLIENT');
        console.log('Zero-trust Bluesky token success:', !!blueskyAuth.accessToken);
        
        res.json({
          hasCredentials: true,
          useZeroTrust: true,
          handle: userData.handle,
          did: userData.did,
          accessToken: blueskyAuth.accessToken,
          refreshToken: blueskyAuth.refreshToken
        });
      } catch (error) {
        console.error('Zero-trust Bluesky token error:', (error as Error).message);
        // Fallback to manual login for zero-trust users
        res.json({ hasCredentials: false, zeroTrustMode: true, error: (error as Error).message });
      }
    } else if (userData.bsky_password) {
      // Use stored encrypted Bluesky password
      const { GrazeService } = await import('../services/graze.js');
      const decryptedPassword = await GrazeService.decryptPassword(userData.bsky_password);
      
      res.json({
        hasCredentials: true,
        handle: userData.handle,
        password: decryptedPassword
      });
    } else {
      res.json({ hasCredentials: false });
    }
  } catch (error) {
    console.error('Error getting Bluesky credentials:', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// Save Bluesky credentials - DISABLED to prevent password overwriting
router.post('/bsky-credentials', authenticateToken, async (req: any, res) => {
  try {
    console.log('Blocked credential save - Bluesky client should not overwrite app passwords');
    return res.json({ success: false, error: 'Credential saving disabled to protect app passwords' });
  } catch (error) {
    console.error('Error in bsky-credentials endpoint:', error);
    res.status(500).json({ error: 'Endpoint disabled' });
  }
});

export default router;