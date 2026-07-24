import express from 'express';
import { Database } from '../services/database.js';
import crypto from 'crypto';

const router = express.Router();

// Encryption helper
function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY!;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Custom labeler configuration
router.post('/custom-labeler', async (req, res) => {
  try {
    const { userId, labelerDid, ozoneUrl, password } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const db = Database.getInstance();
    
    // If removing custom labeler
    if (!labelerDid) {
      await db.updateCustomLabeler(userId, null, null, null);
      return res.json({ success: true, message: 'Custom labeler removed' });
    }

    // Validate inputs
    if (!ozoneUrl || !password) {
      return res.status(400).json({ error: 'Ozone URL and password required' });
    }

    // Encrypt password
    const encryptedPassword = encrypt(password);

    await db.updateCustomLabeler(userId, labelerDid, ozoneUrl, encryptedPassword);
    res.json({ success: true, message: 'Custom labeler configured' });
  } catch (error) {
    console.error('Error configuring custom labeler:', error);
    res.status(500).json({ error: 'Failed to configure custom labeler' });
  }
});

router.get('/custom-labeler/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const labeler = await db.getCustomLabeler(parseInt(userId));
    
    if (!labeler) {
      return res.json({ configured: false });
    }

    // Don't send password to client
    res.json({
      configured: true,
      labelerDid: labeler.did,
      ozoneUrl: labeler.ozoneUrl
    });
  } catch (error) {
    console.error('Error getting custom labeler:', error);
    res.status(500).json({ error: 'Failed to get custom labeler' });
  }
});

// ModMaster settings
router.post('/settings', async (req, res) => {
  try {
    const { userId, enabled, weight } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const db = Database.getInstance();
    await db.updateModmasterSettings(userId, enabled, weight);
    
    res.json({ success: true, message: 'ModMaster settings updated' });
  } catch (error) {
    console.error('Error updating ModMaster settings:', error);
    res.status(500).json({ error: 'Failed to update ModMaster settings' });
  }
});

router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const settings = await db.getModmasterSettings(parseInt(userId));
    res.json(settings || { enabled: true, weight: 1.0 });
  } catch (error) {
    console.error('Error getting ModMaster settings:', error);
    res.status(500).json({ error: 'Failed to get ModMaster settings' });
  }
});

// ModMaster report settings
router.post('/report-settings', async (req, res) => {
  try {
    const { userId, reportType, targetType, action, selectedFeeds } = req.body;
    
    if (!userId || !reportType || !targetType || !action) {
      return res.status(400).json({ error: 'User ID, report type, target type, and action required' });
    }

    const validActions = ['remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Force command_only for "other" types
    const commandOnlyTypes = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'];
    const finalAction = commandOnlyTypes.includes(reportType) ? 'command_only' : action;

    const db = Database.getInstance();
    await db.setModmasterReportSetting(userId, reportType, targetType, finalAction, selectedFeeds);
    
    res.json({ success: true, message: 'ModMaster report setting updated' });
  } catch (error) {
    console.error('Error setting ModMaster report setting:', error);
    res.status(500).json({ error: 'Failed to set ModMaster report setting' });
  }
});

router.get('/report-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const result = await db.getModmasterReportSettings(parseInt(userId));
    res.json({ settings: { posts: result.posts, users: result.users }, selectedFeeds: result.selectedFeeds });
  } catch (error) {
    console.error('Error getting ModMaster report settings:', error);
    res.status(500).json({ error: 'Failed to get ModMaster report settings' });
  }
});

// Custom labeler report settings
router.post('/custom-labeler/report-settings', async (req, res) => {
  try {
    const { userId, reportType, targetType, action, selectedFeeds } = req.body;
    
    if (!userId || !reportType || !targetType || !action) {
      return res.status(400).json({ error: 'User ID, report type, target type, and action required' });
    }

    const validActions = ['remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Force command_only for "other" types
    const commandOnlyTypes = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'];
    const finalAction = commandOnlyTypes.includes(reportType) ? 'command_only' : action;

    const db = Database.getInstance();
    await db.setCustomLabelerReportSetting(userId, reportType, targetType, finalAction, selectedFeeds);
    
    res.json({ success: true, message: 'Custom labeler report setting updated' });
  } catch (error) {
    console.error('Error setting custom labeler report setting:', error);
    res.status(500).json({ error: 'Failed to set custom labeler report setting' });
  }
});

router.get('/custom-labeler/report-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const result = await db.getCustomLabelerReportSettings(parseInt(userId));
    res.json({ settings: { posts: result.posts, users: result.users }, selectedFeeds: result.selectedFeeds });
  } catch (error) {
    console.error('Error getting custom labeler report settings:', error);
    res.status(500).json({ error: 'Failed to get custom labeler report settings' });
  }
});

// Feed report type overrides
router.post('/feed-overrides', async (req, res) => {
  try {
    const { feedId, reportType, action, nonUserPostWeight, nonUserBanWeight } = req.body;
    
    if (!feedId || !reportType) {
      return res.status(400).json({ error: 'Feed ID and report type required' });
    }

    const db = Database.getInstance();
    await db.setFeedReportTypeOverride(feedId, reportType, action, nonUserPostWeight, nonUserBanWeight);
    
    res.json({ success: true, message: 'Feed override updated' });
  } catch (error) {
    console.error('Error setting feed override:', error);
    res.status(500).json({ error: 'Failed to set feed override' });
  }
});

router.get('/feed-overrides/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;
    const db = Database.getInstance();
    
    const overrides = await db.getAllFeedReportTypeOverrides(feedId);
    res.json({ overrides });
  } catch (error) {
    console.error('Error getting feed overrides:', error);
    res.status(500).json({ error: 'Failed to get feed overrides' });
  }
});

// Logs endpoint
router.get('/logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    // Get moderation logs for this user's labelers
    const logs = await db.getLabelerLogs(parseInt(userId));
    
    res.json({
      modmaster: logs.filter(log => log.labeler_type === 'modmaster'),
      custom: logs.filter(log => log.labeler_type === 'custom')
    });
  } catch (error) {
    console.error('Error getting labeler logs:', error);
    res.status(500).json({ error: 'Failed to get labeler logs' });
  }
});

// Non-user report weights
router.post('/non-user-weights', async (req, res) => {
  try {
    const { userId, postWeight, banWeight } = req.body;
    
    if (!userId || postWeight === undefined || banWeight === undefined) {
      return res.status(400).json({ error: 'User ID and weights required' });
    }

    // Validate weights
    if (postWeight < 0 || postWeight > 1 || banWeight < 0 || banWeight > 1) {
      return res.status(400).json({ error: 'Weights must be between 0 and 1' });
    }

    const db = Database.getInstance();
    await db.updateNonUserWeights(userId, postWeight, banWeight);
    
    res.json({ success: true, message: 'Non-user weights updated' });
  } catch (error) {
    console.error('Error updating non-user weights:', error);
    res.status(500).json({ error: 'Failed to update non-user weights' });
  }
});

router.get('/non-user-weights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const weights = await db.getNonUserWeights(parseInt(userId));
    res.json(weights);
  } catch (error) {
    console.error('Error getting non-user weights:', error);
    res.status(500).json({ error: 'Failed to get non-user weights' });
  }
});

export default router;
