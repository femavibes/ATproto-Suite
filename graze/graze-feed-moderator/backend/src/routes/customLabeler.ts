import express from 'express';
import { Database } from '../services/database.js';

const router = express.Router();

// Custom labeler report settings
router.post('/report-settings', async (req, res) => {
  try {
    const { userId, reportType, targetType, action } = req.body;
    
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
    await db.setCustomLabelerReportSetting(userId, reportType, targetType, finalAction);
    
    res.json({ success: true, message: 'Custom labeler report setting updated' });
  } catch (error) {
    console.error('Error setting custom labeler report setting:', error);
    res.status(500).json({ error: 'Failed to set custom labeler report setting' });
  }
});

router.get('/report-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const db = Database.getInstance();
    
    const settings = await db.getCustomLabelerReportSettings(parseInt(userId));
    res.json({ settings });
  } catch (error) {
    console.error('Error getting custom labeler report settings:', error);
    res.status(500).json({ error: 'Failed to get custom labeler report settings' });
  }
});

export default router;