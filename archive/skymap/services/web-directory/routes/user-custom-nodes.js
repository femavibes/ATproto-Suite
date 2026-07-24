const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Get user's custom nodes with their feeds
router.get('/', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const showHidden = req.query.showHidden === 'true';
  
  try {
    const whereClause = showHidden 
      ? 'WHERE n.user_did = $1'
      : 'WHERE n.user_did = $1 AND n.is_active = true';
    
    const result = await pool.query(`
      SELECT 
        n.*,
        json_agg(
          json_build_object(
            'id', f.id,
            'feed_name', f.feed_name,
            'graze_feed_id', f.graze_feed_id,
            'feed_uri', f.feed_uri,
            'expires_at', f.expires_at,
            'created_at', f.created_at
          )
        ) FILTER (WHERE f.id IS NOT NULL) as feeds
      FROM user_custom_nodes n
      LEFT JOIN user_feeds f ON f.custom_node_id = n.id AND f.is_active = true
      ${whereClause}
      GROUP BY n.id
      ORDER BY n.is_active DESC, n.created_at DESC
    `, [userDid]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching custom nodes:', error);
    res.status(500).json({ error: 'Failed to fetch custom nodes' });
  }
});

// Get node count and limit
router.get('/count', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const limit = 3; // Default free tier limit
  
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM user_custom_nodes WHERE user_did = $1 AND is_active = true',
      [userDid]
    );
    
    const count = parseInt(result.rows[0].count);
    res.json({ count, limit, remaining: limit - count });
  } catch (error) {
    console.error('Error counting nodes:', error);
    res.status(500).json({ error: 'Failed to count nodes' });
  }
});

// Push custom node to Graze
router.post('/push', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const { nodeName, nodeDescription, manifest, expiresAt } = req.body;
  const limit = 3;
  
  if (!nodeName || !manifest) {
    return res.status(400).json({ error: 'Node name and manifest required' });
  }
  
  try {
    // Check limit
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_custom_nodes WHERE user_did = $1 AND is_active = true',
      [userDid]
    );
    
    if (parseInt(countResult.rows[0].count) >= limit) {
      return res.status(403).json({ error: `You've reached your limit of ${limit} nodes. Delete a node to create a new one.` });
    }
    
    // Push to Graze API using user's session cookie
    if (!req.session.grazeSessionCookie) {
      return res.status(400).json({ error: 'Graze connection required. Use the "Connect to Graze" option to link your account.' });
    }
    
    console.log('Pushing to Graze for user:', userDid);
    console.log('Node name:', nodeName);
    
    const payload = {
      name: nodeName,
      title: nodeName,
      description: nodeDescription || '',
      public: true,
      color: 'purple',
      component: manifest.manifest.filter,
      component_metadata: {
        snapshot: {
          document: {
            store: {},
            schema: { schemaVersion: 2 }
          }
        }
      },
      version_message: ''
    };
    
    const grazeResponse = await fetch('https://api.graze.social/app/api/v1/algorithm-components/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${req.session.grazeSessionCookie}`,
        'Origin': 'https://www.graze.social',
        'Referer': 'https://www.graze.social/'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Graze response status:', grazeResponse.status);
    
    if (!grazeResponse.ok) {
      const errorText = await grazeResponse.text();
      console.error('Graze API error:', grazeResponse.status, errorText);
      return res.status(500).json({ error: `Failed to create node on Graze: ${grazeResponse.status}` });
    }
    
    const grazeData = await grazeResponse.json();
    console.log('Graze response data:', grazeData);
    const componentId = grazeData.id || grazeData.componentId;
    
    if (!componentId) {
      console.error('No component ID in Graze response:', grazeData);
      return res.status(500).json({ error: 'Graze did not return a component ID' });
    }
    
    // Store in database
    const insertResult = await pool.query(`
      INSERT INTO user_custom_nodes 
      (user_did, graze_component_id, node_name, node_description, manifest, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [userDid, componentId, nodeName, nodeDescription, JSON.stringify(manifest), expiresAt || null]);
    
    res.json({
      success: true,
      id: insertResult.rows[0].id,
      grazeComponentId: componentId,
      grazeUrl: `https://www.graze.social/custom-nodes/${componentId}`
    });
  } catch (error) {
    console.error('Error pushing custom node:', error);
    res.status(500).json({ error: 'Failed to push custom node: ' + error.message });
  }
});

// Get single node details
router.get('/:id', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const nodeId = req.params.id;
  
  try {
    const result = await pool.query(
      'SELECT * FROM user_custom_nodes WHERE id = $1 AND user_did = $2',
      [nodeId, userDid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({ error: 'Failed to fetch node' });
  }
});

// Soft delete node
router.delete('/:id', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const nodeId = req.params.id;
  
  try {
    const result = await pool.query(
      'UPDATE user_custom_nodes SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_did = $2 RETURNING graze_component_id',
      [nodeId, userDid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json({ success: true, message: 'Node hidden from list' });
  } catch (error) {
    console.error('Error soft deleting node:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

// Unhide node
router.post('/:id/unhide', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const nodeId = req.params.id;
  
  try {
    const result = await pool.query(
      'UPDATE user_custom_nodes SET is_active = true, updated_at = NOW() WHERE id = $1 AND user_did = $2 RETURNING *',
      [nodeId, userDid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    res.json({ success: true, message: 'Node unhidden' });
  } catch (error) {
    console.error('Error unhiding node:', error);
    res.status(500).json({ error: 'Failed to unhide node' });
  }
});

// Update node on Graze
router.put('/:id', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const nodeId = req.params.id;
  const { nodeName, nodeDescription, manifest } = req.body;
  
  try {
    // Get existing node
    const nodeResult = await pool.query(
      'SELECT * FROM user_custom_nodes WHERE id = $1 AND user_did = $2',
      [nodeId, userDid]
    );
    
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    const node = nodeResult.rows[0];
    
    if (!req.session.grazeSessionCookie) {
      return res.status(400).json({ error: 'Graze connection required. Use the "Connect to Graze" option to link your account.' });
    }
    
    // Update on Graze
    const payload = {
      id: node.graze_component_id,
      name: nodeName || node.node_name,
      title: nodeName || node.node_name,
      description: nodeDescription !== undefined ? nodeDescription : node.node_description,
      public: true,
      color: 'purple',
      component: manifest ? manifest.manifest.filter : JSON.parse(node.manifest).manifest.filter,
      component_metadata: {
        snapshot: {
          document: {
            store: {},
            schema: { schemaVersion: 2 }
          }
        }
      },
      version_message: ''
    };
    
    const grazeResponse = await fetch(`https://api.graze.social/app/api/v1/algorithm-components/components/${node.graze_component_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${req.session.grazeSessionCookie}`,
        'Origin': 'https://www.graze.social',
        'Referer': 'https://www.graze.social/'
      },
      body: JSON.stringify(payload)
    });
    
    if (!grazeResponse.ok) {
      const errorText = await grazeResponse.text();
      console.error('Graze API error:', grazeResponse.status, errorText);
      return res.status(500).json({ error: `Failed to update node on Graze: ${grazeResponse.status}` });
    }
    
    // Update in database
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (nodeName) {
      updates.push(`node_name = $${paramCount++}`);
      values.push(nodeName);
    }
    
    if (nodeDescription !== undefined) {
      updates.push(`node_description = $${paramCount++}`);
      values.push(nodeDescription);
    }
    
    if (manifest) {
      updates.push(`manifest = $${paramCount++}`);
      values.push(JSON.stringify(manifest));
    }
    
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(nodeId, userDid);
      
      await pool.query(
        `UPDATE user_custom_nodes SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_did = $${paramCount + 1}`,
        values
      );
    }
    
    res.json({ success: true, message: 'Node updated' });
  } catch (error) {
    console.error('Error updating node:', error);
    res.status(500).json({ error: 'Failed to update node: ' + error.message });
  }
});

// Hard delete node (remove from Graze + DB)
router.delete('/:id/hard', requireAuth, async (req, res) => {
  const { pool } = req.app.locals;
  const userDid = req.session.authenticatedDid;
  const nodeId = req.params.id;
  
  try {
    // Get node details
    const nodeResult = await pool.query(
      'SELECT graze_component_id FROM user_custom_nodes WHERE id = $1 AND user_did = $2',
      [nodeId, userDid]
    );
    
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    const componentId = nodeResult.rows[0].graze_component_id;
    
    // Delete from Graze
    const grazeSession = req.session.grazeSession;
    if (grazeSession) {
      try {
        await fetch(`https://www.graze.social/api/custom-nodes/${componentId}`, {
          method: 'DELETE',
          headers: {
            'Cookie': `connect.sid=${grazeSession}`
          }
        });
      } catch (grazeError) {
        console.error('Error deleting from Graze:', grazeError);
        // Continue with DB deletion even if Graze fails
      }
    }
    
    // Delete from database
    await pool.query('DELETE FROM user_custom_nodes WHERE id = $1', [nodeId]);
    
    res.json({ success: true, message: 'Node permanently deleted' });
  } catch (error) {
    console.error('Error hard deleting node:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

module.exports = router;
