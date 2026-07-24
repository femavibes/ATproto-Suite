const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

// GET /api/user/permission - Get user's permission tier
// Tier 1: Default (basic only)
// Tier 2: Can upload images (includes Tier 1)
// Tier 3: Highest tier (includes Tier 2 + future features)
router.get('/user/permission', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.json({ tier: 1, hasImagePermission: false });
  }
  
  try {
    const result = await pool.query(
      'SELECT tier FROM user_permissions WHERE did = $1',
      [req.session.authenticatedDid]
    );
    
    const tier = result.rows.length > 0 ? result.rows[0].tier : 1;
    // Tier 2+ includes image permissions (higher tiers inherit lower tier permissions)
    res.json({ tier, hasImagePermission: tier >= 2 });
  } catch (error) {
    console.error('Error fetching user permission:', error);
    res.json({ tier: 1, hasImagePermission: false });
  }
});

// POST /api/image-requests - Request image permission (tier 2)
router.post('/image-requests', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { requestMessage } = req.body;
  
  try {
    // Check if user already has tier 2+
    const permResult = await pool.query(
      'SELECT tier FROM user_permissions WHERE did = $1',
      [req.session.authenticatedDid]
    );
    
    const currentTier = permResult.rows.length > 0 ? permResult.rows[0].tier : 1;
    if (currentTier >= 2) {
      return res.status(400).json({ error: 'You already have image permissions' });
    }
    
    // Check if there's already a pending request
    const pendingResult = await pool.query(
      'SELECT id FROM image_requests WHERE did = $1 AND status = $2',
      [req.session.authenticatedDid, 'pending']
    );
    
    if (pendingResult.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending request' });
    }
    
    // Create request
    const result = await pool.query(`
      INSERT INTO image_requests (did, handle, request_type, request_message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      req.session.authenticatedDid,
      req.session.authenticatedHandle,
      'tier2',
      requestMessage || null
    ]);
    
    res.json({ success: true, request: result.rows[0] });
    const { notifyAlert } = require('./discord');
    notifyAlert('image_request', { handle: req.session.authenticatedHandle, message: requestMessage });
  } catch (error) {
    console.error('Error creating image request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// GET /api/image-requests/my-request - Get user's own image request status
router.get('/image-requests/my-request', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM image_requests WHERE did = $1 ORDER BY created_at DESC LIMIT 1',
      [req.session.authenticatedDid]
    );
    
    if (result.rows.length === 0) {
      return res.json({ request: null });
    }
    
    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error('Error fetching image request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// GET /api/user/settings - Get user's content preferences
router.get('/user/settings', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.json({ show_media: false, nsfw_preference: 'hide' });
  }
  
  try {
    const result = await pool.query(
      'SELECT show_media, nsfw_preference FROM user_settings WHERE user_did = $1',
      [req.session.authenticatedDid]
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ show_media: false, nsfw_preference: 'hide' });
    }
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.json({ show_media: false, nsfw_preference: 'hide' });
  }
});

// POST /api/user/settings - Update user's content preferences
router.post('/user/settings', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { show_media, nsfw_preference } = req.body;
  
  // Validate nsfw_preference
  if (nsfw_preference && !['hide', 'blur', 'show'].includes(nsfw_preference)) {
    return res.status(400).json({ error: 'Invalid nsfw_preference value' });
  }
  
  try {
    await pool.query(`
      INSERT INTO user_settings (user_did, show_media, nsfw_preference)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_did) DO UPDATE
      SET show_media = $2, nsfw_preference = $3, updated_at = NOW()
    `, [
      req.session.authenticatedDid,
      show_media !== undefined ? show_media : false,
      nsfw_preference || 'hide'
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================================================
// NEAR YOU FEED SETTINGS
// ============================================================================

// GET /api/user/feed-settings - Get user's Near You feed preferences
router.get('/user/feed-settings', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.json({});
  }

  try {
    const result = await pool.query(
      'SELECT * FROM user_feed_settings WHERE user_did = $1',
      [req.session.authenticatedDid]
    );

    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching feed settings:', error);
    res.status(500).json({ error: 'Failed to fetch feed settings' });
  }
});

// POST /api/user/feed-settings - Update user's Near You feed preferences
router.post('/user/feed-settings', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { city_mode, cutoff_radius_km, self_post_visibility, media_filter, media_types, alt_text_penalty, freshness_halflife, freshness_exponent, min_engagement, mutual_boost_multiplier, following_boost_multiplier, interest_boost_multiplier, affinity_boost_max, like_weight, repost_weight, reply_weight, max_hashtag_count, hashtag_city_group_limit, city_scope, include_nearby, hidden_interests, inferred_interests_enabled, source_atlas_users, source_hashtag_authors, source_follow_graph, source_hashtag_posts, source_community_surfaced } = req.body;

  // Validate
  if (city_scope && !['primary', 'all'].includes(city_scope)) {
    return res.status(400).json({ error: 'Invalid city_scope' });
  }
  if (include_nearby && !['yes', 'no'].includes(include_nearby)) {
    return res.status(400).json({ error: 'Invalid include_nearby' });
  }
  if (self_post_visibility && !['show', 'hide'].includes(self_post_visibility)) {
    return res.status(400).json({ error: 'Invalid self_post_visibility' });
  }
  if (media_filter && !['all', 'media_only', 'text_only'].includes(media_filter)) {
    return res.status(400).json({ error: 'Invalid media_filter' });
  }
  if (media_types !== undefined && media_types !== null) {
    const valid = String(media_types).split(',').every(v => ['0','1','2','3','4','5'].includes(v.trim()));
    if (!valid) return res.status(400).json({ error: 'Invalid media_types' });
  }
  if (freshness_halflife && !['default', 'fresh', 'today', 'catchup'].includes(freshness_halflife)) {
    return res.status(400).json({ error: 'Invalid freshness_halflife' });
  }
  if (min_engagement !== undefined && min_engagement !== null && min_engagement !== '') {
    const num = parseInt(min_engagement);
    if (!['all', 'some', 'popular'].includes(min_engagement) && (isNaN(num) || num < 0 || num > 100)) {
      return res.status(400).json({ error: 'Invalid min_engagement' });
    }
  }

  try {
    // Snapshot custom_media_types whenever user saves media_types from settings page
    const customMediaTypes = media_types ?? null;

    await pool.query(`
      INSERT INTO user_feed_settings (user_did, city_mode, cutoff_radius_km, self_post_visibility, media_filter, media_types, alt_text_penalty, freshness_halflife, freshness_exponent, min_engagement, mutual_boost_multiplier, following_boost_multiplier, interest_boost_multiplier, affinity_boost_max, like_weight, repost_weight, reply_weight, max_hashtag_count, hashtag_city_group_limit, city_scope, include_nearby, custom_media_types, hidden_interests, inferred_interests_enabled, source_atlas_users, source_hashtag_authors, source_follow_graph, source_hashtag_posts, source_community_surfaced, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW())
      ON CONFLICT (user_did) DO UPDATE SET
        city_mode = $2, cutoff_radius_km = $3, self_post_visibility = $4,
        media_filter = $5, media_types = $6, alt_text_penalty = $7, freshness_halflife = $8, freshness_exponent = $9,
        min_engagement = $10, mutual_boost_multiplier = $11, following_boost_multiplier = $12,
        interest_boost_multiplier = $13, affinity_boost_max = $14, like_weight = $15, repost_weight = $16, reply_weight = $17,
        max_hashtag_count = $18, hashtag_city_group_limit = $19,
        city_scope = $20, include_nearby = $21, custom_media_types = COALESCE($22, user_feed_settings.custom_media_types),
        hidden_interests = $23, inferred_interests_enabled = $24,
        source_atlas_users = $25, source_hashtag_authors = $26, source_follow_graph = $27,
        source_hashtag_posts = $28, source_community_surfaced = $29, updated_at = NOW()
    `, [
      req.session.authenticatedDid,
      city_mode || 'main',
      cutoff_radius_km ?? null,
      self_post_visibility || 'show',
      media_filter || 'all',
      media_types ?? null,
      alt_text_penalty ?? null,
      freshness_halflife || 'default',
      freshness_exponent ?? null,
      min_engagement != null && min_engagement !== '' ? min_engagement : 'all',
      mutual_boost_multiplier ?? null,
      following_boost_multiplier ?? null,
      interest_boost_multiplier ?? null,
      affinity_boost_max ?? null,
      like_weight ?? null,
      repost_weight ?? null,
      reply_weight ?? null,
      max_hashtag_count ?? null,
      hashtag_city_group_limit ?? null,
      city_scope ?? null,
      include_nearby ?? null,
      customMediaTypes,
      hidden_interests ?? null,
      inferred_interests_enabled ?? null,
      source_atlas_users ?? null,
      source_hashtag_authors ?? null,
      source_follow_graph ?? null,
      source_hashtag_posts ?? null,
      source_community_surfaced ?? null,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating feed settings:', error);
    res.status(500).json({ error: 'Failed to update feed settings' });
  }
});

// GET /api/user/feed-settings/overrides - Get per-feed overrides for a user
router.get('/user/feed-settings/overrides', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const result = await pool.query(
      'SELECT feed_name, setting_key, setting_value FROM user_feed_setting_overrides WHERE user_did = $1 ORDER BY feed_name, setting_key',
      [req.session.authenticatedDid]
    );
    // Group by feed_name
    const overrides = {};
    for (const row of result.rows) {
      if (!overrides[row.feed_name]) overrides[row.feed_name] = {};
      overrides[row.feed_name][row.setting_key] = row.setting_value;
    }
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching feed setting overrides:', error);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

// POST /api/user/feed-settings/overrides - Set per-feed overrides
router.post('/user/feed-settings/overrides', express.json(), async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { feed_name, settings } = req.body;
  if (!feed_name || !settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'feed_name and settings object required' });
  }
  const validFeeds = ['near-you', 'near-you-live', 'near-you-video'];
  if (!validFeeds.includes(feed_name)) {
    return res.status(400).json({ error: 'Invalid feed_name' });
  }
  try {
    // Delete existing overrides for this user+feed, then insert new ones
    await pool.query(
      'DELETE FROM user_feed_setting_overrides WHERE user_did = $1 AND feed_name = $2',
      [req.session.authenticatedDid, feed_name]
    );
    const entries = Object.entries(settings).filter(([, v]) => v !== null && v !== undefined && v !== '');
    for (const [key, value] of entries) {
      await pool.query(
        'INSERT INTO user_feed_setting_overrides (user_did, feed_name, setting_key, setting_value) VALUES ($1, $2, $3, $4)',
        [req.session.authenticatedDid, feed_name, key, String(value)]
      );
    }
    res.json({ success: true, overrides_count: entries.length });
  } catch (error) {
    console.error('Error saving feed setting overrides:', error);
    res.status(500).json({ error: 'Failed to save overrides' });
  }
});

  return router;
};
