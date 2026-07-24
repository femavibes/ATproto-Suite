const express = require('express');

const NEAR_YOU_URL = process.env.NEAR_YOU_URL || 'http://localhost:4000';

module.exports = (pool) => {
  const router = express.Router();

  // Ingestion status (powered by Near You)
  router.get('/status', async (req, res) => {
    try {
      const stats = await pool.query('SELECT COUNT(*) as total_locations FROM locations');
      const hashtags = await pool.query('SELECT COUNT(*) as total_hashtags FROM hashtag_mappings');
      const health = await fetch(`${NEAR_YOU_URL}/health`).then(r => r.json()).catch(() => null);

      res.json({
        source: 'near-you',
        nearYouStatus: health ? health.status : 'unreachable',
        nearYouAtlasUsers: health ? health.atlasUsers : null,
        nearYouUptime: health ? health.uptime : null,
        totalLocations: parseInt(stats.rows[0].total_locations),
        totalHashtags: parseInt(hashtags.rows[0].total_hashtags)
      });
    } catch (error) {
      console.error('Error fetching ingestion status:', error);
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  });

  // Recent activity (powered by Near You city-stats)
  router.get('/recent-activity', async (req, res) => {
    try {
      const [statsResp, locResult] = await Promise.all([
        fetch(`${NEAR_YOU_URL}/api/city-stats`).then(r => r.json()).catch(() => []),
        pool.query(`SELECT id, name, region_name FROM locations`)
      ]);

      const locMap = {};
      for (const loc of locResult.rows) locMap[loc.id] = loc;

      const rows = statsResp
        .filter(s => s.post_count_24h > 0 && locMap[s.location_id])
        .map(s => {
          const loc = locMap[s.location_id];
          return {
            name: loc.name,
            region_name: loc.region_name,
            post_count_1h: s.post_count_1h,
            post_count_6h: s.post_count_6h,
            post_count_24h: s.post_count_24h,
            post_count_7d: s.post_count_7d,
            last_post_at: s.last_post_at,
          };
        })
        .sort((a, b) => b.post_count_24h - a.post_count_24h)
        .slice(0, 50);

      res.json(rows);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  return router;
};
