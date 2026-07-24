const express = require('express');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

  // List all links (custom first, then auto)
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { type } = req.query;
      let query = 'SELECT * FROM short_urls';
      const params = [];
      
      if (type && type !== 'all') {
        query += ' WHERE link_type = $1';
        params.push(type);
      }
      
      query += ' ORDER BY link_type DESC, click_count DESC, created_at DESC';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching links:', error);
      res.status(500).json({ error: 'Failed to fetch links' });
    }
  });

  // Create custom or setting link
  router.post('/', requireAuth, async (req, res) => {
    const { slug, url, description, linkType } = req.body;
    
    if (!slug || !url) {
      return res.status(400).json({ error: 'Slug and URL required' });
    }
    
    const type = linkType === 'setting' ? 'setting' : 'custom';
    
    // Validate slug format: lowercase alphanumeric + hyphens, 2-100 chars
    if (!/^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(slug) && slug.length > 1) {
      return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens (2-100 chars)' });
    }
    if (slug.length === 1 && !/^[a-z0-9]$/.test(slug)) {
      return res.status(400).json({ error: 'Single character slug must be alphanumeric' });
    }
    
    // Reserved slugs
    const reserved = ['api', 'admin', 'login', 'logout', 'go', 'e'];
    if (reserved.includes(slug)) {
      return res.status(400).json({ error: 'This slug is reserved' });
    }
    
    try {
      // Check if slug already exists
      const existing = await pool.query(
        'SELECT id FROM short_urls WHERE custom_slug = $1',
        [slug]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Slug already in use' });
      }
      
      // Generate a short_code too (for backward compat)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let shortCode = '';
      for (let i = 0; i < 6; i++) shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
      
      const result = await pool.query(
        `INSERT INTO short_urls (short_code, full_url, custom_slug, link_type, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [shortCode, url, slug, type, description || null]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating custom link:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Slug already in use' });
      }
      res.status(500).json({ error: 'Failed to create link' });
    }
  });

  // Update custom link
  router.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { slug, url, description } = req.body;
    
    try {
      const existing = await pool.query('SELECT * FROM short_urls WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (url !== undefined) {
        updates.push(`full_url = $${paramCount++}`);
        values.push(url);
      }
      if (slug !== undefined) {
        if (!/^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(slug) && slug.length > 1) {
          return res.status(400).json({ error: 'Invalid slug format' });
        }
        // Check slug not taken by another link
        const slugCheck = await pool.query(
          'SELECT id FROM short_urls WHERE custom_slug = $1 AND id != $2',
          [slug, id]
        );
        if (slugCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Slug already in use' });
        }
        updates.push(`custom_slug = $${paramCount++}`);
        values.push(slug);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description || null);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = NOW()');
      values.push(id);
      
      const result = await pool.query(
        `UPDATE short_urls SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating link:', error);
      res.status(500).json({ error: 'Failed to update link' });
    }
  });

  // Delete link
  router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query('DELETE FROM short_urls WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting link:', error);
      res.status(500).json({ error: 'Failed to delete link' });
    }
  });

  // Reset click count
  router.post('/:id/reset-clicks', requireAuth, async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'UPDATE short_urls SET click_count = 0, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error resetting clicks:', error);
      res.status(500).json({ error: 'Failed to reset clicks' });
    }
  });

  return router;
};
