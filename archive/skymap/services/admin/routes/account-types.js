const express = require('express');

module.exports = function initAccountTypeRoutes(pool) {
  const router = express.Router();

  // GET /account-types — list all types
  router.get('/account-types', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT at.*,
          (SELECT COUNT(*) FROM account_type_assignments ata WHERE ata.account_type_id = at.id) as assignment_count
        FROM account_types at ORDER BY at.name
      `);
      // Resolve interest names
      const interestIds = [...new Set(result.rows.flatMap(r => r.interest_ids || []))];
      let interestNames = {};
      if (interestIds.length > 0) {
        const iResult = await pool.query('SELECT id, name FROM interests WHERE id = ANY($1)', [interestIds]);
        for (const r of iResult.rows) interestNames[r.id] = r.name;
      }
      res.json({ types: result.rows, interestNames });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /account-types — create type
  router.post('/account-types', async (req, res) => {
    try {
      const { key, name, interest_ids } = req.body;
      if (!key || !name) return res.status(400).json({ error: 'key and name required' });
      const result = await pool.query(
        'INSERT INTO account_types (key, name, interest_ids) VALUES ($1, $2, $3) RETURNING *',
        [key.toLowerCase().replace(/\s+/g, '_'), name, interest_ids || []]
      );
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Key already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /account-types/:id — update type
  router.put('/account-types/:id', async (req, res) => {
    try {
      const { name, interest_ids, active } = req.body;
      const fields = [];
      const values = [];
      let idx = 1;
      if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
      if (interest_ids !== undefined) { fields.push(`interest_ids = $${idx++}`); values.push(interest_ids); }
      if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
      if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
      values.push(req.params.id);
      const result = await pool.query(
        `UPDATE account_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /account-type-assignments — list assignments with optional filters
  router.get('/account-type-assignments', async (req, res) => {
    try {
      const { type_id, did, limit, offset } = req.query;
      let where = [];
      let values = [];
      let idx = 1;
      if (type_id) { where.push(`ata.account_type_id = $${idx++}`); values.push(type_id); }
      if (did) { where.push(`ata.did = $${idx++}`); values.push(did); }
      const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
      const lim = Math.min(parseInt(limit) || 50, 200);
      const off = parseInt(offset) || 0;

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM account_type_assignments ata ${whereClause}`, values
      );

      const result = await pool.query(`
        SELECT ata.*, at.key as type_key, at.name as type_name
        FROM account_type_assignments ata
        JOIN account_types at ON at.id = ata.account_type_id
        ${whereClause}
        ORDER BY ata.added_at DESC
        LIMIT ${lim} OFFSET ${off}
      `, values);

      res.json({ assignments: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /account-type-assignments — assign type to account
  router.post('/account-type-assignments', async (req, res) => {
    try {
      let { did, handle, account_type_id, notes, added_by } = req.body;
      if (!account_type_id) return res.status(400).json({ error: 'account_type_id required' });

      // Resolve handle to DID if needed
      if (!did && handle) {
        const cleanHandle = handle.replace(/^@/, '').replace(/^https?:\/\/bsky\.app\/profile\//, '');
        try {
          const resp = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`);
          if (resp.ok) {
            const data = await resp.json();
            did = data.did;
          }
        } catch (e) {}
        if (!did) return res.status(400).json({ error: 'Could not resolve handle' });
      }
      if (!did) return res.status(400).json({ error: 'did or handle required' });

      // Insert assignment
      await pool.query(
        'INSERT INTO account_type_assignments (did, account_type_id, added_by, notes) VALUES ($1, $2, $3, $4) ON CONFLICT (did, account_type_id) DO UPDATE SET notes = COALESCE($4, account_type_assignments.notes)',
        [did, account_type_id, added_by || null, notes || null]
      );

      // Auto-set interests from type mapping
      const typeResult = await pool.query('SELECT interest_ids FROM account_types WHERE id = $1', [account_type_id]);
      const interestIds = typeResult.rows[0]?.interest_ids || [];
      for (const interestId of interestIds) {
        await pool.query(
          'INSERT INTO user_interests (user_did, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [did, interestId]
        );
      }

      res.json({ did, account_type_id, interests_added: interestIds.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /account-type-assignments — remove type from account
  router.delete('/account-type-assignments', async (req, res) => {
    try {
      const { did, account_type_id } = req.body;
      if (!did || !account_type_id) return res.status(400).json({ error: 'did and account_type_id required' });
      await pool.query(
        'DELETE FROM account_type_assignments WHERE did = $1 AND account_type_id = $2',
        [did, account_type_id]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /account-types/for-did/:did — get all types for a specific account
  router.get('/account-types/for-did/:did', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT at.id, at.key, at.name, ata.added_at, ata.added_by, ata.notes
        FROM account_type_assignments ata
        JOIN account_types at ON at.id = ata.account_type_id
        WHERE ata.did = $1 AND at.active = true
        ORDER BY at.name
      `, [req.params.did]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /interests/all — list all active interests (for the interest picker)
  router.get('/interests/all', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, name FROM interests WHERE active = true ORDER BY name');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
