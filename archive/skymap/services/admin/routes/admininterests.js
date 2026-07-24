const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Get all interests with stats
  router.get('/interests', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, ic.name as category_name, ic.key as category_key
        FROM interests i
        LEFT JOIN interest_categories ic ON i.category_id = ic.id
        ORDER BY ic.sort_order, i.sort_order
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching interests:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all categories
  router.get('/interests/categories', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM interest_categories ORDER BY sort_order');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create category
  router.post('/interests/categories', async (req, res) => {
    try {
      const { key, name, sort_order } = req.body;
      const result = await pool.query(
        'INSERT INTO interest_categories (key, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
        [key, name, sort_order || 999]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update category
  router.put('/interests/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sort_order, active } = req.body;
      const result = await pool.query(
        'UPDATE interest_categories SET name = $1, sort_order = $2, active = $3 WHERE id = $4 RETURNING *',
        [name, sort_order, active, id]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create interest
  router.post('/interests', async (req, res) => {
    try {
      const { key, name, description, aliases, category_id, sort_order, is_nsfw } = req.body;
      console.log('Creating interest:', { key, name, description, aliases, category_id, sort_order, is_nsfw });
      const result = await pool.query(
        'INSERT INTO interests (key, name, description, aliases, category_id, sort_order, is_nsfw) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [key, name, description || null, aliases || [], category_id || null, sort_order || 999, is_nsfw === true]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update interest
  router.put('/interests/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, aliases, category_id, sort_order, is_nsfw, active } = req.body;
      const result = await pool.query(
        'UPDATE interests SET name = $1, description = $2, aliases = $3, category_id = $4, sort_order = $5, is_nsfw = $6, active = $7 WHERE id = $8 RETURNING *',
        [name, description, aliases, category_id, sort_order, is_nsfw, active, id]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Deactivate interest
  router.delete('/interests/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'UPDATE interests SET active = false WHERE id = $1 RETURNING *',
        [id]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error deactivating interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Hard delete interest
  router.delete('/interests/:id/hard', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM interests WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error hard deleting interest:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get custom tags from events
  router.get('/interests/custom-tags', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT custom_tag, COUNT(*) as usage_count
        FROM event_tags
        WHERE custom_tag IS NOT NULL
        GROUP BY custom_tag
        ORDER BY usage_count DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching custom tags:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Promote custom tag to interest
  router.post('/interests/promote-tag', async (req, res) => {
    try {
      const { custom_tag, name, description, category_id } = req.body;
      
      // Create interest
      const interestResult = await pool.query(
        'INSERT INTO interests (key, name, description, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [custom_tag, name, description, category_id]
      );
      
      const interest = interestResult.rows[0];
      
      // Migrate event tags
      await pool.query(
        'UPDATE event_tags SET interest_id = $1, custom_tag = NULL WHERE custom_tag = $2',
        [interest.id, custom_tag]
      );
      
      res.json({ success: true, interest });
    } catch (error) {
      console.error('Error promoting tag:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update interest counts
  router.post('/interests/update-counts', async (req, res) => {
    try {
      await pool.query(`
        UPDATE interests i
        SET 
          user_count = (SELECT COUNT(*) FROM user_interests WHERE interest_id = i.id),
          event_count = (SELECT COUNT(DISTINCT event_id) FROM event_tags WHERE interest_id = i.id)
      `);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating counts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
