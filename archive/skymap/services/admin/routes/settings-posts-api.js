const express = require('express');
const { generateSettingsPosts, enableFeedSettingsPosts, deleteAllSettingsPosts, FEEDS } = require('./settings-posts');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

  // List all settings posts
  router.get('/', requireAuth, async (req, res) => {
    try {
      const posts = await pool.query(
        'SELECT feed_name, settings_hash, post_uri, post_text, enabled, created_at FROM feed_settings_posts ORDER BY feed_name, settings_hash'
      );
      const config = await pool.query(
        'SELECT * FROM feed_toggle_config ORDER BY feed_name, sort_order'
      );
      res.json({ posts: posts.rows, config: config.rows, feeds: FEEDS });
    } catch (error) {
      console.error('Error fetching settings posts:', error);
      res.status(500).json({ error: 'Failed to fetch' });
    }
  });

  // Generate posts for a feed (dry run or real)
  router.post('/generate', requireAuth, async (req, res) => {
    const { feedName, dryRun } = req.body;
    if (!feedName) return res.status(400).json({ error: 'feedName required' });
    
    try {
      const results = await generateSettingsPosts(pool, feedName, dryRun === true);
      res.json({ results, count: results.length });
    } catch (error) {
      console.error('Error generating settings posts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Enable/disable settings posts for a feed
  router.post('/toggle-feed', requireAuth, async (req, res) => {
    const { feedName, enabled } = req.body;
    if (!feedName || enabled === undefined) return res.status(400).json({ error: 'feedName and enabled required' });
    
    try {
      await enableFeedSettingsPosts(pool, feedName, enabled === true);
      res.json({ success: true });
    } catch (error) {
      console.error('Error toggling feed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all settings posts for a feed (for regeneration)
  router.delete('/:feedName', requireAuth, async (req, res) => {
    const { feedName } = req.params;
    try {
      const count = await deleteAllSettingsPosts(pool, feedName);
      res.json({ success: true, deleted: count });
    } catch (error) {
      console.error('Error deleting settings posts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update toggle config
  router.put('/config', requireAuth, async (req, res) => {
    const { feedName, settingKey, options, labels, active } = req.body;
    if (!feedName || !settingKey) return res.status(400).json({ error: 'feedName and settingKey required' });
    
    try {
      await pool.query(
        `INSERT INTO feed_toggle_config (feed_name, setting_key, options, labels, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (feed_name, setting_key) DO UPDATE SET options = $3, labels = $4, active = $5`,
        [feedName, settingKey, JSON.stringify(options), JSON.stringify(labels), active !== false]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
