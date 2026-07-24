const express = require('express');
const { AtpAgent } = require('@atproto/api');
const { emitOzoneLabel } = require('./shared');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

  // Get all locations (for user management dropdowns)
  router.get('/all-locations', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, key, name, region_name, population, country_code, location_type
        FROM locations
        ORDER BY 
          CASE 
            WHEN location_type = 'country' THEN 1
            WHEN location_type = 'state' THEN 2
            WHEN location_type = 'county' THEN 3
            WHEN location_type = 'city' THEN 4
            ELSE 5
          END,
          name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get user labels
  router.get('/user-labels', requireAuth, async (req, res) => {
    const { handle, did } = req.query;
    
    if (!handle && !did) {
      return res.status(400).json({ error: 'Handle or DID required' });
    }
    
    try {
      let resolvedDid = did;
      let resolvedHandle = handle ? handle.replace('@', '') : null;
      
      if (did && did.startsWith('did:')) {
        resolvedDid = did;
        try {
          const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            resolvedHandle = profileData.handle;
          } else {
            resolvedHandle = did;
          }
        } catch (e) {
          resolvedHandle = did;
        }
      } else if (handle) {
        const agent = new AtpAgent({ service: 'https://bsky.social' });
        const resolveResponse = await agent.com.atproto.identity.resolveHandle({
          handle: handle.replace('@', '')
        });
        resolvedDid = resolveResponse.data.did;
        resolvedHandle = handle.replace('@', '');
      }
      
      const dbResult = await pool.query(`
        SELECT l.key, l.name, l.region_name, ul.is_primary, ul.max_labels_override
        FROM user_labels ul
        JOIN locations l ON ul.location_id = l.id
        WHERE ul.did = $1 AND ul.active = true
        ORDER BY ul.is_primary DESC, ul.created_at ASC
      `, [resolvedDid]);
      
      const maxLabels = dbResult.rows[0]?.max_labels_override || 3;
      
      res.json({
        did: resolvedDid,
        handle: resolvedHandle || resolvedDid,
        databaseLabels: dbResult.rows,
        maxLabels: maxLabels
      });
    } catch (error) {
      console.error('Error fetching user labels:', error);
      if (error.message?.includes('Unable to resolve handle')) {
        res.status(404).json({ error: 'Handle not found' });
      } else {
        res.status(500).json({ error: 'Failed to fetch user labels' });
      }
    }
  });

  // Helper: resolve location by key or display_key
  async function findLocation(locationKey) {
    const result = await pool.query(
      'SELECT * FROM locations WHERE UPPER(key) = UPPER($1) OR UPPER(display_key) = UPPER($1)',
      [locationKey]
    );
    return result.rows[0] || null;
  }

  // Helper: get user label count and max
  async function getUserLabelInfo(did) {
    const result = await pool.query(
      'SELECT COUNT(*) as count, MAX(max_labels_override) as max_override FROM user_labels WHERE did = $1 AND active = true',
      [did]
    );
    return {
      count: parseInt(result.rows[0].count),
      maxLabels: result.rows[0].max_override || 3
    };
  }

  // Add user label
  router.post('/admin/user-labels', requireAuth, async (req, res) => {
    const { did, locationKey, setPrimary } = req.body;
    
    if (!did || !locationKey) {
      return res.status(400).json({ error: 'DID and location key required' });
    }
    
    try {
      const location = await findLocation(locationKey);
      if (!location) return res.status(404).json({ error: 'Location not found' });
      
      const labelKey = location.display_key || location.key;
      
      const existingResult = await pool.query(
        'SELECT * FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
        [did, location.id]
      );
      if (existingResult.rows.length > 0) {
        return res.json({ success: true, message: 'Label already exists' });
      }
      
      const { count: currentCount, maxLabels } = await getUserLabelInfo(did);
      if (currentCount >= maxLabels) {
        return res.status(400).json({ error: `User already has ${maxLabels} labels (maximum)` });
      }
      
      const isFirstLabel = currentCount === 0;
      const shouldBePrimary = setPrimary === true || isFirstLabel;
      
      if (shouldBePrimary) {
        await pool.query(
          'UPDATE user_labels SET is_primary = false WHERE did = $1 AND active = true',
          [did]
        );
      }
      
      await pool.query(
        'INSERT INTO user_labels (did, location_id, active, is_primary, added_by) VALUES ($1, $2, true, $3, $4)',
        [did, location.id, shouldBePrimary, 'admin']
      );
      
      await emitOzoneLabel(did, [labelKey.toLowerCase()], [], 'Label added via admin');
      
      // First label = new ATlas user, emit atlas-user badge
      if (isFirstLabel) {
        await emitOzoneLabel(did, ['atlas-user'], [], 'ATlas user badge (first label)');
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding label:', error);
      res.status(500).json({ error: 'Failed to add label' });
    }
  });

  // Remove user label
  router.delete('/admin/user-labels', requireAuth, async (req, res) => {
    const { did, locationKey } = req.body;
    
    if (!did || !locationKey) {
      return res.status(400).json({ error: 'DID and location key required' });
    }
    
    try {
      const location = await findLocation(locationKey);
      if (!location) return res.status(404).json({ error: 'Location not found' });
      
      const labelKey = location.display_key || location.key;
      
      await pool.query(
        'UPDATE user_labels SET active = false WHERE did = $1 AND location_id = $2',
        [did, location.id]
      );
      
      await emitOzoneLabel(did, [], [labelKey.toLowerCase()], 'Label removed via admin');
      
      // Check if user has any remaining active labels — if not, remove atlas-user badge
      const remaining = await pool.query('SELECT COUNT(*) as cnt FROM user_labels WHERE did = $1 AND active = true', [did]);
      if (parseInt(remaining.rows[0].cnt) === 0) {
        await emitOzoneLabel(did, [], ['atlas-user'], 'ATlas user badge removed (no labels)');
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing label:', error);
      res.status(500).json({ error: 'Failed to remove label' });
    }
  });

  // Set primary location
  router.post('/admin/set-primary-location', requireAuth, async (req, res) => {
    const { did, locationKey } = req.body;
    
    if (!did || !locationKey) {
      return res.status(400).json({ error: 'DID and location key required' });
    }
    
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
        return res.status(404).json({ error: 'User does not have this location label' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting primary location:', error);
      res.status(500).json({ error: 'Failed to set primary location' });
    }
  });

  // Set max labels override
  router.post('/admin/set-max-labels', requireAuth, async (req, res) => {
    const { did, maxLabels } = req.body;
    
    if (!did || !maxLabels) {
      return res.status(400).json({ error: 'DID and maxLabels required' });
    }
    
    const max = parseInt(maxLabels);
    if (isNaN(max) || max < 1 || max > 50) {
      return res.status(400).json({ error: 'maxLabels must be between 1 and 50' });
    }
    
    try {
      await pool.query(
        'UPDATE user_labels SET max_labels_override = $1 WHERE did = $2',
        [max, did]
      );
      
      res.json({ success: true, maxLabels: max });
    } catch (error) {
      console.error('Error setting max labels:', error);
      res.status(500).json({ error: 'Failed to set max labels' });
    }
  });

  // Bulk import labels
  router.post('/admin/bulk-import-labels', requireAuth, async (req, res) => {
    const { csvData } = req.body;
    
    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ error: 'CSV data required' });
    }
    
    const results = { total: 0, success: 0, skipped: 0, failed: 0, errors: [] };
    
    try {
      const lines = csvData.trim().split('\n').filter(line => line.trim());
      results.total = lines.length;
      
      for (const line of lines) {
        const [did, locationKey] = line.split(',').map(s => s.trim());
        
        if (!did || !locationKey) {
          results.failed++;
          results.errors.push({ line, error: 'Invalid format' });
          continue;
        }
        
        try {
          const location = await findLocation(locationKey);
          if (!location) {
            results.failed++;
            results.errors.push({ did, locationKey, error: 'Location not found' });
            continue;
          }
          
          const existingResult = await pool.query(
            'SELECT * FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
            [did, location.id]
          );
          if (existingResult.rows.length > 0) {
            results.skipped++;
            continue;
          }
          
          const { count: currentCount, maxLabels } = await getUserLabelInfo(did);
          if (currentCount >= maxLabels) {
            results.failed++;
            results.errors.push({ did, locationKey, error: `User has ${maxLabels} labels (max)` });
            continue;
          }
          
          await pool.query(
            'INSERT INTO user_labels (did, location_id, active, is_primary, added_by) VALUES ($1, $2, true, $3, $4)',
            [did, location.id, currentCount === 0, 'admin-bulk']
          );
          
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({ did, locationKey, error: error.message });
        }
      }
      
      res.json({
        success: true,
        results,
        message: `Processed ${results.total} labels: ${results.success} added, ${results.skipped} skipped, ${results.failed} failed`
      });
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ error: 'Bulk import failed', details: error.message });
    }
  });

  // Get all users with labels
  router.get('/admin/all-users', requireAuth, async (req, res) => {
    try {
      const { search, limit, offset } = req.query;
      const lim = Math.min(parseInt(limit) || 50, 200);
      const off = parseInt(offset) || 0;
      let where = 'WHERE ul.active = true';
      const params = [];
      if (search) {
        params.push('%' + search + '%');
        where += ` AND (ul.did ILIKE $${params.length} OR l.name ILIKE $${params.length} OR l.region_name ILIKE $${params.length})`;
      }
      const countResult = await pool.query(`SELECT COUNT(DISTINCT ul.did) FROM user_labels ul JOIN locations l ON ul.location_id = l.id ${where}`, params);
      const result = await pool.query(`
        SELECT 
          ul.did,
          MIN(ul.created_at) as first_label_at,
          COUNT(DISTINCT ul.id) as label_count,
          MAX(ul.max_labels_override) as max_labels_override,
          STRING_AGG(DISTINCT l.name || ', ' || l.region_name, '; ' ORDER BY l.name || ', ' || l.region_name) as locations
        FROM user_labels ul
        JOIN locations l ON ul.location_id = l.id
        ${where}
        GROUP BY ul.did
        ORDER BY MIN(ul.created_at) DESC
        LIMIT ${lim} OFFSET ${off}
      `, params);
      res.json({ users: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (error) {
      console.error('Error fetching all users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Get label requests
  router.get('/admin/label-requests', requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM label_requests';
      const params = [];
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC LIMIT 100';
      const result = await pool.query(query, params);
      res.json({ requests: result.rows });
    } catch (error) {
      console.error('Error loading label requests:', error);
      res.status(500).json({ error: 'Failed to load label requests' });
    }
  });

  // Review label request (approve/deny)
  router.post('/admin/label-requests/:id/review', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, notes } = req.body;
      if (!action || !['approve', 'deny'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      const reqResult = await pool.query('SELECT * FROM label_requests WHERE id = $1', [id]);
      if (reqResult.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }
      const lr = reqResult.rows[0];
      const status = action === 'approve' ? 'approved' : 'denied';
      await pool.query(
        'UPDATE label_requests SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3 WHERE id = $4',
        [status, req.session.authenticatedHandle || 'admin', notes || null, id]
      );

      if (action === 'approve') {
        const locResult = await pool.query('SELECT id, key, name FROM locations WHERE key = $1', [lr.location_key]);
        const location = locResult.rows[0];

        if (lr.request_type === 'add' && location) {
          const existing = await pool.query(
            'SELECT id FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
            [lr.target_did, location.id]
          );
          if (existing.rows.length === 0) {
            const countResult = await pool.query(
              'SELECT COUNT(*) as count FROM user_labels WHERE did = $1 AND active = true', [lr.target_did]
            );
            const isFirst = parseInt(countResult.rows[0].count) === 0;
            await pool.query(
              'INSERT INTO user_labels (did, location_id, active, is_primary, added_by) VALUES ($1, $2, true, $3, $4)',
              [lr.target_did, location.id, isFirst, 'admin-request']
            );
          }
          await emitOzoneLabel(lr.target_did, [lr.location_key.toLowerCase()], [], `Label added via approved request #${id}`);
          if (isFirst) {
            await emitOzoneLabel(lr.target_did, ['atlas-user'], [], 'ATlas user badge (first label via request)');
          }
        } else if (lr.request_type === 'remove' && location) {
          await pool.query(
            'UPDATE user_labels SET active = false WHERE did = $1 AND location_id = $2 AND active = true',
            [lr.target_did, location.id]
          );
          await emitOzoneLabel(lr.target_did, [], [lr.location_key.toLowerCase()], `Label removed via approved request #${id}`);
          const remaining = await pool.query('SELECT COUNT(*) as cnt FROM user_labels WHERE did = $1 AND active = true', [lr.target_did]);
          if (parseInt(remaining.rows[0].cnt) === 0) {
            await emitOzoneLabel(lr.target_did, [], ['atlas-user'], 'ATlas user badge removed (no labels via request)');
          }
        }
        res.json({ success: true, message: `Request approved and label ${lr.request_type === 'add' ? 'added' : 'removed'}` });
      } else {
        res.json({ success: true, message: 'Request denied' });
      }
    } catch (error) {
      console.error('Error reviewing label request:', error);
      res.status(500).json({ error: 'Failed to review request' });
    }
  });

  // --- Tier management ---

  router.get('/admin/user-tier', requireAuth, async (req, res) => {
    const handle = (req.query.handle || '').trim().toLowerCase().replace(/^@/, '');
    if (!handle) return res.status(400).json({ error: 'handle required' });
    try {
      const didResult = await pool.query('SELECT did FROM user_labels WHERE handle = $1 LIMIT 1', [handle]);
      let did = didResult.rows[0]?.did;
      if (!did) {
        // Try resolving via Bluesky
        const resp = await fetch('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=' + encodeURIComponent(handle));
        if (resp.ok) { const data = await resp.json(); did = data.did; }
      }
      if (!did) return res.status(404).json({ error: 'User not found' });
      const tierResult = await pool.query('SELECT tier FROM user_permissions WHERE did = $1', [did]);
      const tier = tierResult.rows[0]?.tier || 1;
      res.json({ did, handle, tier });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
  });

  router.post('/admin/user-tier', requireAuth, async (req, res) => {
    const { did, tier } = req.body;
    if (!did || !tier) return res.status(400).json({ error: 'did and tier required' });
    if (![1, 2, 3].includes(tier)) return res.status(400).json({ error: 'tier must be 1, 2, or 3' });
    try {
      await pool.query(
        'INSERT INTO user_permissions (did, tier, granted_by, granted_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (did) DO UPDATE SET tier = $2, granted_by = $3, updated_at = NOW()',
        [did, tier, 'admin']
      );
      res.json({ success: true, did, tier });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
  });

  return router;
};
