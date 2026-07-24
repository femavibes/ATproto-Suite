const express = require('express');
const multer = require('multer');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB max
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
      }
    }
  });

  // Update location images
  router.post('/admin/location-images', requireAuth, async (req, res) => {
    const { locationKey, pinImageUrl, cardImageUrl, pinImageAttribution, cardImageAttribution } = req.body;
    
    if (!locationKey) {
      return res.status(400).json({ error: 'Location key required' });
    }
    
    try {
      await pool.query(
        'UPDATE locations SET pin_image_url = $1, card_image_url = $2, pin_image_attribution = $3, card_image_attribution = $4 WHERE key = $5',
        [pinImageUrl || null, cardImageUrl || null, pinImageAttribution || null, cardImageAttribution || null, locationKey]
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating location images:', error);
      res.status(500).json({ error: 'Failed to update images' });
    }
  });

  // Update user profile image
  router.post('/admin/user-profile-image', requireAuth, async (req, res) => {
    const { did, profileCardImageUrl } = req.body;
    
    if (!did) {
      return res.status(400).json({ error: 'DID required' });
    }
    
    try {
      await pool.query(
        'UPDATE user_labels SET profile_card_image_url = $1 WHERE did = $2',
        [profileCardImageUrl || null, did]
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating user profile image:', error);
      res.status(500).json({ error: 'Failed to update image' });
    }
  });

  // List all image requests
  router.get('/image-requests', requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM image_requests';
      const params = [];
      
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await pool.query(query, params);
      res.json({ requests: result.rows });
    } catch (error) {
      console.error('Error fetching image requests:', error);
      res.status(500).json({ error: 'Failed to fetch requests' });
    }
  });

  // Approve image request
  router.post('/image-requests/:id/approve', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminHandle = req.session.authenticatedHandle;
    
    try {
      const requestResult = await pool.query(
        'SELECT * FROM image_requests WHERE id = $1',
        [id]
      );
      
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const request = requestResult.rows[0];
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Request is not pending' });
      }
      
      await pool.query(`
        UPDATE image_requests 
        SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2, updated_at = NOW()
        WHERE id = $3
      `, [adminHandle, adminNotes || null, id]);
      
      await pool.query(`
        INSERT INTO user_permissions (did, tier, granted_by, granted_at)
        VALUES ($1, 2, $2, NOW())
        ON CONFLICT (did) 
        DO UPDATE SET tier = 2, granted_by = $2, granted_at = NOW(), updated_at = NOW()
      `, [request.did, adminHandle]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving image request:', error);
      res.status(500).json({ error: 'Failed to approve request' });
    }
  });

  // Deny image request
  router.post('/image-requests/:id/deny', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { adminNotes } = req.body;
    const adminHandle = req.session.authenticatedHandle;
    
    try {
      const requestResult = await pool.query(
        'SELECT * FROM image_requests WHERE id = $1',
        [id]
      );
      
      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const request = requestResult.rows[0];
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Request is not pending' });
      }
      
      await pool.query(`
        UPDATE image_requests 
        SET status = 'denied', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2, updated_at = NOW()
        WHERE id = $3
      `, [adminHandle, adminNotes || null, id]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error denying image request:', error);
      res.status(500).json({ error: 'Failed to deny request' });
    }
  });

  // Upload image to ImgBB
  router.post('/admin/upload-image', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 5MB)' });
    }

    if (!process.env.IMGBB_API_KEY) {
      console.error('ImgBB API key not configured');
      return res.status(500).json({ error: 'Image upload service not configured. Please set IMGBB_API_KEY environment variable.' });
    }

    try {
      const base64Image = req.file.buffer.toString('base64');
      const formData = new URLSearchParams();
      formData.append('key', process.env.IMGBB_API_KEY);
      formData.append('image', base64Image);

      console.log('Admin uploading image to ImgBB, size:', req.file.size, 'bytes');

      const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!imgbbResponse.ok) {
        const errorText = await imgbbResponse.text();
        console.error('ImgBB API error:', imgbbResponse.status, errorText);
        return res.status(500).json({ error: `Image hosting service error: ${imgbbResponse.status}` });
      }

      const imgbbData = await imgbbResponse.json();

      if (!imgbbData.success || !imgbbData.data || !imgbbData.data.url) {
        console.error('ImgBB upload failed:', JSON.stringify(imgbbData, null, 2));
        const errorMsg = imgbbData.error?.message || 'Failed to upload image to image hosting service';
        return res.status(500).json({ error: errorMsg });
      }

      console.log('Image uploaded successfully:', imgbbData.data.url);

      res.json({
        imageUrl: imgbbData.data.url,
        deleteUrl: imgbbData.data.delete_url || null
      });
    } catch (error) {
      console.error('Error uploading image to ImgBB:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: `Failed to upload image: ${error.message}` });
    }
  });

  // Get reported images
  router.get('/admin/reported-images', requireAuth, async (req, res) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM reported_images';
      const params = [];
      
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC LIMIT 100';
      
      const result = await pool.query(query, params);
      
      res.json({ reports: result.rows });
    } catch (error) {
      console.error('Error loading reported images:', error);
      res.status(500).json({ error: 'Failed to load reports' });
    }
  });

  // Review reported image (approve/deny)
  router.post('/admin/reported-images/:id/review', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, notes } = req.body;
      
      if (!action || !['approve', 'deny'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Must be "approve" or "deny"' });
      }
      
      const reportResult = await pool.query('SELECT * FROM reported_images WHERE id = $1', [id]);
      if (reportResult.rows.length === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      const report = reportResult.rows[0];
      
      const status = action === 'approve' ? 'approved' : 'denied';
      await pool.query(
        'UPDATE reported_images SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3 WHERE id = $4',
        [status, req.session.authenticatedHandle || 'admin', notes || null, id]
      );
      
      if (action === 'approve') {
        if (report.image_type === 'profile') {
          await pool.query(
            'UPDATE user_labels SET profile_card_image_url = NULL WHERE profile_card_image_url = $1',
            [report.image_url]
          );
        } else if (report.image_type === 'event') {
          await pool.query(
            'UPDATE events SET image_url = NULL WHERE image_url = $1',
            [report.image_url]
          );
          await pool.query(
            'UPDATE events SET pin_image_url = NULL WHERE pin_image_url = $1',
            [report.image_url]
          );
        } else if (report.image_type === 'pin') {
          await pool.query(
            'UPDATE events SET pin_image_url = NULL WHERE pin_image_url = $1',
            [report.image_url]
          );
          await pool.query(
            'UPDATE locations SET pin_image_url = NULL WHERE pin_image_url = $1',
            [report.image_url]
          );
        } else if (report.image_type === 'card') {
          await pool.query(
            'UPDATE locations SET card_image_url = NULL WHERE card_image_url = $1',
            [report.image_url]
          );
        }
        // avatar type: tracked for moderation but can't remove from Bluesky
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error reviewing report:', error);
      res.status(500).json({ error: 'Failed to review report' });
    }
  });

  return router;
};
