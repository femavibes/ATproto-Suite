const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Get active interests grouped by category (public)
  router.get('/public', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, ic.name as category_name, ic.key as category_key, ic.sort_order as category_sort
        FROM interests i
        LEFT JOIN interest_categories ic ON i.category_id = ic.id
        WHERE i.active = true AND (ic.active = true OR ic.active IS NULL)
        ORDER BY ic.sort_order, i.user_count DESC, i.name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching public interests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get interest categories
  router.get('/categories', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM interest_categories WHERE active = true ORDER BY sort_order');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get logged-in user's interests
  router.get('/my', async (req, res) => {
    try {
      const did = req.session?.authenticatedDid;
      if (!did) {
        return res.status(401).json({ error: 'Not logged in' });
      }

      const result = await pool.query(`
        SELECT i.*, ic.name as category_name
        FROM user_interests ui
        JOIN interests i ON ui.interest_id = i.id
        LEFT JOIN interest_categories ic ON i.category_id = ic.id
        WHERE ui.user_did = $1
        ORDER BY ui.created_at
      `, [did]);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching my interests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add interests for logged-in user (multiple at once)
  router.post('/add', async (req, res) => {
    try {
      const did = req.session?.authenticatedDid;
      if (!did) {
        return res.status(401).json({ error: 'Not logged in' });
      }

      const { interestKeys } = req.body;
      if (!Array.isArray(interestKeys) || interestKeys.length === 0) {
        return res.status(400).json({ error: 'interestKeys array required' });
      }

      // Check max limit
      const configResult = await pool.query("SELECT value FROM config WHERE key = 'max_interests_per_user'");
      const maxInterests = parseInt(configResult.rows[0]?.value || '15');
      
      const countResult = await pool.query('SELECT COUNT(*) FROM user_interests WHERE user_did = $1', [did]);
      const currentCount = parseInt(countResult.rows[0].count);
      
      if (currentCount + interestKeys.length > maxInterests) {
        return res.status(400).json({ error: `Maximum ${maxInterests} interests allowed. You have ${currentCount}.` });
      }

      const added = [];
      for (const key of interestKeys) {
        const interestResult = await pool.query('SELECT * FROM interests WHERE key = $1 AND active = true', [key]);
        if (interestResult.rows.length === 0) continue;

        const interest = interestResult.rows[0];
        const insertResult = await pool.query(
          'INSERT INTO user_interests (user_did, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_did',
          [did, interest.id]
        );

        if (insertResult.rows.length > 0) {
          await pool.query('UPDATE interests SET user_count = user_count + 1 WHERE id = $1', [interest.id]);
          added.push(interest.name);
        }
      }

      res.json({ success: true, added });
    } catch (error) {
      console.error('Error adding interests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove interest for logged-in user
  router.post('/remove', async (req, res) => {
    try {
      const did = req.session?.authenticatedDid;
      if (!did) {
        return res.status(401).json({ error: 'Not logged in' });
      }

      const { interestKey } = req.body;
      const interestResult = await pool.query('SELECT id FROM interests WHERE key = $1', [interestKey]);
      if (interestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Interest not found' });
      }

      await pool.query('DELETE FROM user_interests WHERE user_did = $1 AND interest_id = $2', [did, interestResult.rows[0].id]);
      await pool.query('UPDATE interests SET user_count = GREATEST(user_count - 1, 0) WHERE id = $1', [interestResult.rows[0].id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's interests (requires DID)
  router.get('/user/:did', async (req, res) => {
    try {
      const { did } = req.params;
      const result = await pool.query(`
        SELECT i.*, ic.name as category_name
        FROM user_interests ui
        JOIN interests i ON ui.interest_id = i.id
        LEFT JOIN interest_categories ic ON i.category_id = ic.id
        WHERE ui.user_did = $1
        ORDER BY ui.created_at
      `, [did]);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching user interests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add interest for user
  router.post('/user/:did/add', async (req, res) => {
    try {
      const { did } = req.params;
      const { interest_key } = req.body;

      // Get interest
      const interestResult = await pool.query('SELECT * FROM interests WHERE key = $1 AND active = true', [interest_key]);
      if (interestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Interest not found' });
      }

      // Check max limit
      const configResult = await pool.query("SELECT value FROM config WHERE key = 'max_interests_per_user'");
      const maxInterests = parseInt(configResult.rows[0]?.value || '15');
      
      const countResult = await pool.query('SELECT COUNT(*) FROM user_interests WHERE user_did = $1', [did]);
      if (parseInt(countResult.rows[0].count) >= maxInterests) {
        return res.status(400).json({ error: `Maximum ${maxInterests} interests allowed` });
      }

      // Add interest
      await pool.query(
        'INSERT INTO user_interests (user_did, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [did, interestResult.rows[0].id]
      );

      // Update count
      await pool.query('UPDATE interests SET user_count = user_count + 1 WHERE id = $1', [interestResult.rows[0].id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error adding interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove interest from user
  router.post('/user/:did/remove', async (req, res) => {
    try {
      const { did } = req.params;
      const { interest_key } = req.body;

      const interestResult = await pool.query('SELECT id FROM interests WHERE key = $1', [interest_key]);
      if (interestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Interest not found' });
      }

      await pool.query('DELETE FROM user_interests WHERE user_did = $1 AND interest_id = $2', [did, interestResult.rows[0].id]);
      await pool.query('UPDATE interests SET user_count = GREATEST(user_count - 1, 0) WHERE id = $1', [interestResult.rows[0].id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
