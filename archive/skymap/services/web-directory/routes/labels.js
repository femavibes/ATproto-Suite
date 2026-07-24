const express = require('express');
const { emitOzoneLabel } = require('./shared');
const { syncLocationsToPds } = require('./pds-location');

module.exports = (pool, oauthClient) => {
  const router = express.Router();

  async function findLocation(locationKey) {
    const result = await pool.query(
      'SELECT * FROM locations WHERE UPPER(key) = UPPER($1) OR UPPER(display_key) = UPPER($1)',
      [locationKey]
    );
    return result.rows[0] || null;
  }

  // Add label to authenticated user
  router.post('/labels/add', async (req, res) => {
    if (!req.session.authenticatedDid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { locationKey } = req.body;
    const did = req.session.authenticatedDid;
    
    try {
      const location = await findLocation(locationKey);
      if (!location) return res.status(404).json({ error: 'Location not found' });
      
      const labelKey = location.display_key || location.key;
      const labelName = location.display_name || location.name;
      
      const existingResult = await pool.query(
        'SELECT * FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
        [did, location.id]
      );
      if (existingResult.rows.length > 0) {
        return res.json({ success: true, location: { key: labelKey, name: labelName } });
      }
      
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_labels WHERE did = $1 AND active = true',
        [did]
      );
      if (parseInt(countResult.rows[0].count) >= 3) {
        return res.status(400).json({ error: 'Maximum 3 locations allowed' });
      }
      
      const isFirstLabel = parseInt(countResult.rows[0].count) === 0;
      
      await pool.query(
        'INSERT INTO user_labels (did, location_id, active, is_primary, added_by) VALUES ($1, $2, true, $3, $4)',
        [did, location.id, isFirstLabel, 'user']
      );
      
      await emitOzoneLabel(did, [labelKey.toLowerCase()], [], 'Label added via web directory');
      
      // First label = new ATlas user, emit atlas-user badge
      if (isFirstLabel) {
        await emitOzoneLabel(did, ['atlas-user'], [], 'ATlas user badge (first label)');
        const { notifyNewUser } = require('./discord');
        notifyNewUser(req.session.authenticatedHandle || did, did, labelName);
      }
      
      // Sync to user's PDS (best-effort, don't block response)
      syncLocationsToPds(oauthClient, did, pool).catch(e => console.error('[pds-location] async sync error:', e.message));
      
      res.json({ success: true, location: { key: labelKey, name: labelName } });
    } catch (error) {
      console.error('Error adding label:', error);
      res.status(500).json({ error: 'Failed to add label' });
    }
  });

  // Set primary location for authenticated user
  router.post('/labels/set-primary', async (req, res) => {
    if (!req.session.authenticatedDid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { locationKey } = req.body;
    const did = req.session.authenticatedDid;
    
    try {
      const location = await findLocation(locationKey);
      if (!location) return res.status(404).json({ error: 'Location not found' });
      
      await pool.query(
        'UPDATE user_labels SET is_primary = false WHERE did = $1 AND active = true',
        [did]
      );
      
      const result = await pool.query(
        'UPDATE user_labels SET is_primary = true WHERE did = $1 AND location_id = $2 AND active = true RETURNING *',
        [did, location.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'You do not have this location label' });
      }
      
      syncLocationsToPds(oauthClient, did, pool).catch(e => console.error('[pds-location] async sync error:', e.message));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting primary location:', error);
      res.status(500).json({ error: 'Failed to set primary location' });
    }
  });

  // Remove label from authenticated user
  router.post('/labels/remove', async (req, res) => {
    if (!req.session.authenticatedDid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { locationKey } = req.body;
    const did = req.session.authenticatedDid;
    
    try {
      const location = await findLocation(locationKey);
      if (!location) return res.status(404).json({ error: 'Location not found' });
      
      const labelKey = location.display_key || location.key;
      
      const wasPrimary = await pool.query(
        'SELECT is_primary FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
        [did, location.id]
      );
      
      await pool.query(
        'UPDATE user_labels SET active = false, is_primary = false WHERE did = $1 AND location_id = $2',
        [did, location.id]
      );
      
      if (wasPrimary.rows[0]?.is_primary) {
        await pool.query(
          `UPDATE user_labels SET is_primary = true
           WHERE id = (SELECT id FROM user_labels WHERE did = $1 AND active = true ORDER BY created_at ASC LIMIT 1)`,
          [did]
        );
      }
      
      await emitOzoneLabel(did, [], [labelKey.toLowerCase()], 'Label removed via web directory');
      
      // Check if user has any remaining active labels — if not, remove atlas-user badge
      const remaining = await pool.query('SELECT COUNT(*) as cnt FROM user_labels WHERE did = $1 AND active = true', [did]);
      if (parseInt(remaining.rows[0].cnt) === 0) {
        await emitOzoneLabel(did, [], ['atlas-user'], 'ATlas user badge removed (no labels)');
      }
      
      syncLocationsToPds(oauthClient, did, pool).catch(e => console.error('[pds-location] async sync error:', e.message));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing label:', error);
      res.status(500).json({ error: 'Failed to remove label' });
    }
  });

  // Get authenticated user's labels
  router.get('/labels/my-labels', async (req, res) => {
    if (!req.session.authenticatedDid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const result = await pool.query(`
        SELECT l.key, l.name, l.region_name, ul.is_primary
        FROM user_labels ul
        JOIN locations l ON ul.location_id = l.id
        WHERE ul.did = $1 AND ul.active = true
        ORDER BY ul.is_primary DESC, ul.created_at ASC
      `, [req.session.authenticatedDid]);
      
      res.json({ labels: result.rows });
    } catch (error) {
      console.error('Error fetching labels:', error);
      res.status(500).json({ error: 'Failed to fetch labels' });
    }
  });

  return router;
};
