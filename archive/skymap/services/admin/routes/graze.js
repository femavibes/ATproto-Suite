const express = require('express');
const GrazeClient = require('../graze-client');
const FeedGenerator = require('../feed-generator');
const { generateOptimizedCustomNode, splitCitiesIntoNodes } = require('../generate-optimized-node');

let grazeSession = {
  cookie: null,
  username: null,
  expiresAt: null
};

function initGrazeRoutes(pool) {
  const router = express.Router();

// Generate Graze custom nodes JSON
router.get('/graze-nodes/:regionCode', async (req, res) => {
  const { regionCode } = req.params;
  
  try {
    const regionResult = await pool.query(
      'SELECT * FROM locations WHERE region_code = $1 AND population IS NULL LIMIT 1',
      [regionCode]
    );
    
    if (!regionResult.rows.length) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const region = regionResult.rows[0];
    
    const citiesResult = await pool.query(`
      SELECT l.*, 
             COALESCE(array_agg(h.hashtag) FILTER (WHERE h.hashtag IS NOT NULL), '{}') as hashtags
      FROM locations l
      LEFT JOIN hashtag_mappings h ON l.id = h.location_id
      WHERE l.region_code = $1 AND l.population IS NOT NULL
      GROUP BY l.id
      ORDER BY l.population DESC
    `, [regionCode]);
    
    const regionHashtagsResult = await pool.query(
      'SELECT hashtag FROM hashtag_mappings WHERE location_id = $1',
      [region.id]
    );
    
    const regionHashtags = regionHashtagsResult.rows.map(row => row.hashtag);
    
    const cityChunks = splitCitiesIntoNodes(citiesResult.rows);
    const nodes = cityChunks.map((chunk, idx) => ({
      cities: chunk,
      partNum: cityChunks.length > 1 ? idx + 1 : null,
      totalParts: cityChunks.length > 1 ? cityChunks.length : null,
      node: generateOptimizedCustomNode(region, chunk, regionHashtags, idx + 1, cityChunks.length)
    }));
    
    res.json({ nodes, totalNodes: nodes.length });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create or update Graze feed
router.post('/graze-feed', async (req, res) => {
  const { sessionCookie, feedId, displayName, description, stickyType, listUrls, publish, useHashtagManifest } = req.body;
  
  console.log('=== Graze Feed Request ===');
  console.log('Feed ID:', feedId);
  console.log('Display Name:', displayName);
  console.log('Description:', description);
  console.log('Sticky Type:', stickyType);
  console.log('List URLs:', listUrls);
  console.log('Publish:', publish);
  console.log('Use Hashtag Manifest:', useHashtagManifest);
  console.log('Has Session Cookie:', !!sessionCookie);
  
  if (!sessionCookie || !displayName) {
    console.error('Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // For hashtag manifest, we don't need listUrls
  if (!useHashtagManifest && (!listUrls || !listUrls.length)) {
    console.error('Missing list URLs for non-hashtag feed');
    return res.status(400).json({ error: 'List URLs required for non-hashtag feeds' });
  }
  
  try {
    const grazeClient = new GrazeClient(sessionCookie);
    
    // Generate custom manifest if requested
    let customManifest = null;
    if (useHashtagManifest) {
      const feedGenerator = new FeedGenerator(pool);
      const manifestData = await feedGenerator.generateAllHashtagsManifest();
      customManifest = manifestData.manifest;
      console.log('Generated hashtag manifest');
    }
    
    // Get user ID (needed for both create and update)
    let userId = null;
    try {
      console.log('Fetching user ID...');
      userId = await grazeClient.getUserId();
      console.log('User ID:', userId);
    } catch (error) {
      console.error('Error getting user ID:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get user ID: ' + error.message 
      });
    }
    
    console.log('Calling createOrUpdateFeed...');
    const result = await grazeClient.createOrUpdateFeed(
      displayName,
      description || '',
      stickyType || 'new',
      listUrls || [],
      feedId || null,
      userId,
      publish || false,
      customManifest
    );
    
    console.log('Feed result:', JSON.stringify(result, null, 2));
    
    const createdFeedId = result.algorithm?.id || feedId;
    
    // Publish if requested - call GET /app/publish_algo/{feedId}
    if (publish && createdFeedId) {
      console.log('Publishing feed:', createdFeedId);
      try {
        await grazeClient.publishFeed(createdFeedId);
        console.log('Feed published successfully');
      } catch (error) {
        console.error('Error publishing feed:', error.message);
      }
    }
    
    // Save to database
    if (createdFeedId) {
      try {
        await pool.query(`
          INSERT INTO graze_feeds (
            graze_feed_id, display_name, description, algorithm_uri, 
            sticky_type, algorithm_manifest, is_hashtag_feed, published, active, public, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (graze_feed_id) DO UPDATE SET
            display_name = $2,
            description = $3,
            algorithm_uri = $4,
            sticky_type = $5,
            algorithm_manifest = $6,
            is_hashtag_feed = $7,
            published = $8,
            active = $9,
            public = $10,
            updated_at = NOW()
        `, [
          createdFeedId,
          displayName,
          description || '',
          result.algorithm?.algorithm_uri || '',
          stickyType || 'new',
          customManifest ? JSON.stringify(customManifest) : null,
          useHashtagManifest || false,
          publish || false,
          publish || false,
          publish || false
        ]);
        console.log('Saved feed to database');
      } catch (dbError) {
        console.error('Error saving to database:', dbError.message);
      }
    }
    
    res.json({
      success: true,
      feedId: createdFeedId,
      algorithmUri: result.algorithm?.algorithm_uri,
      published: publish,
      message: feedId ? `Updated feed ${feedId}` : `Created feed ${createdFeedId}`
    });
  } catch (error) {
    console.error('Error creating/updating feed:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});



// Login to Graze (auto-login on server start)
router.post('/graze-login', async (req, res) => {
  try {
    const username = process.env.BLUESKY_HANDLE || process.env.LABELER_DID;
    const password = process.env.BLUESKY_PASSWORD;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Graze credentials not configured' });
    }
    
    const grazeClient = new GrazeClient();
    const result = await grazeClient.login(username, password);
    
    if (result.success) {
      // Store session server-side
      grazeSession = {
        cookie: result.sessionCookie,
        username: username,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      res.json({ 
        success: true, 
        sessionCookie: result.sessionCookie,
        username: username
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get current Graze session
router.get('/graze-session', (req, res) => {
  console.log('Graze session check:', {
    hasCookie: !!grazeSession.cookie,
    hasExpiresAt: !!grazeSession.expiresAt,
    expiresAt: grazeSession.expiresAt,
    now: Date.now(),
    expired: grazeSession.expiresAt ? grazeSession.expiresAt <= Date.now() : 'N/A',
    username: grazeSession.username
  });
  
  if (grazeSession.cookie && grazeSession.expiresAt > Date.now()) {
    res.json({
      success: true,
      sessionCookie: grazeSession.cookie,
      username: grazeSession.username
    });
  } else {
    console.log('Graze session not available or expired, returning success: false');
    res.json({ success: false });
  }
});

// Generate hashtag feed manifest
router.get('/generate-hashtag-feed', async (req, res) => {
  try {
    const feedGenerator = new FeedGenerator(pool);
    const manifest = await feedGenerator.generateAllHashtagsManifest();
    res.json(manifest);
  } catch (error) {
    console.error('Error generating feed:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all custom feeds
router.get('/graze-feeds', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM graze_feeds ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete feed from database
router.delete('/graze-feeds/:feedId', async (req, res) => {
  const { feedId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM graze_feeds WHERE graze_feed_id = $1',
      [feedId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }
    
    res.json({ success: true, message: 'Feed deleted from database' });
  } catch (error) {
    console.error('Error deleting feed:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Push custom node to Graze
router.post('/push-to-graze/:regionCode', async (req, res) => {
  const { regionCode } = req.params;
  const { sessionCookie } = req.body;
  
  if (!sessionCookie) {
    return res.status(400).json({ error: 'Session cookie required' });
  }
  
  try {
    // Get region info
    const regionResult = await pool.query(
      'SELECT id, key, region_name, region_code, graze_component_ids FROM locations WHERE region_code = $1 AND location_type = $2 AND population IS NULL LIMIT 1',
      [regionCode, 'state']
    );
    
    if (!regionResult.rows.length) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const region = regionResult.rows[0];
    
    // Get all cities in region with hashtags
    const citiesResult = await pool.query(`
      SELECT l.*, 
             COALESCE(array_agg(h.hashtag) FILTER (WHERE h.hashtag IS NOT NULL), '{}') as hashtags
      FROM locations l
      LEFT JOIN hashtag_mappings h ON l.id = h.location_id
      WHERE l.region_code = $1 AND l.population IS NOT NULL
      GROUP BY l.id
      ORDER BY l.population DESC
    `, [regionCode]);
    
    // Get region hashtags
    const regionHashtagsResult = await pool.query(
      'SELECT hashtag FROM hashtag_mappings WHERE location_id = $1',
      [region.id]
    );
    
    const regionHashtags = regionHashtagsResult.rows.map(row => row.hashtag);
    const regionName = region.region_name;
    const cityChunks = splitCitiesIntoNodes(citiesResult.rows);
    const grazeClient = new GrazeClient(sessionCookie);
    const componentIds = [];
    
    console.log(`[Push] Region: ${regionName}, graze_component_ids from DB:`, region.graze_component_ids);
    
    for (let i = 0; i < cityChunks.length; i++) {
      const chunk = cityChunks[i];
      const partNum = cityChunks.length > 1 ? i + 1 : null;
      const startCity = i * 50 + 1;
      const endCity = i * 50 + chunk.length;
      const nodeTitle = partNum ? `ATlas ${regionName} (${startCity}-${endCity})` : `ATlas ${regionName}`;
      const nodeDescription = partNum ? `${regionName} cities ${startCity}-${endCity} by population` : `Custom node for ${regionName}`;
      const customNode = generateOptimizedCustomNode(region, chunk, regionHashtags, partNum, cityChunks.length);
      
      const existingIds = region.graze_component_ids || [];
      const existingId = existingIds[i];
      
      console.log(`[Push] Node ${i + 1}: existingIds =`, existingIds, `existingId[${i}] =`, existingId);
      
      let result;
      if (existingId) {
        try {
          result = await grazeClient.updateCustomNode(existingId, nodeTitle, nodeDescription, customNode);
          componentIds.push(existingId);
        } catch (e) {
          result = await grazeClient.createCustomNode(nodeTitle, nodeDescription, customNode);
          componentIds.push(result.id);
        }
      } else {
        result = await grazeClient.createCustomNode(nodeTitle, nodeDescription, customNode);
        componentIds.push(result.id);
      }
    }
    
    await pool.query('UPDATE locations SET graze_component_ids = $1 WHERE id = $2', [JSON.stringify(componentIds), region.id]);
    
    res.json({ 
      success: true, 
      message: `Pushed ${cityChunks.length} node(s) for ${regionName}`,
      componentIds,
      nodes: cityChunks.map((chunk, i) => ({
        part: i + 1,
        cities: chunk.length,
        componentId: componentIds[i],
        url: `https://www.graze.social/custom-nodes/${componentIds[i]}`
      }))
    });
    
  } catch (error) {
    console.error('Error pushing to Graze:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data
    });
  }
});

// Update individual node ID in graze_component_ids array
router.post('/set-node-id', async (req, res) => {
  const { region_code, node_index, component_id } = req.body;
  
  if (!region_code || node_index === undefined || !component_id) {
    return res.status(400).json({ error: 'region_code, node_index, and component_id required' });
  }
  
  try {
    const regionResult = await pool.query(
      'SELECT id, region_name, graze_component_ids FROM locations WHERE region_code = $1 AND location_type = $2 AND population IS NULL LIMIT 1',
      [region_code, 'state']
    );
    
    if (!regionResult.rows.length) {
      return res.status(404).json({ error: 'Region not found' });
    }
    
    const region = regionResult.rows[0];
    let componentIds = region.graze_component_ids || [];
    
    // Ensure array is large enough
    while (componentIds.length <= node_index) {
      componentIds.push(null);
    }
    
    componentIds[node_index] = component_id;
    
    await pool.query(
      'UPDATE locations SET graze_component_ids = $1::jsonb WHERE id = $2',
      [JSON.stringify(componentIds), region.id]
    );
    
    res.json({ 
      success: true, 
      message: `Updated Node ${node_index + 1} ID to ${component_id} for ${region.region_name}`,
      componentIds
    });
  } catch (error) {
    console.error('Error setting node ID:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// DEPRECATED: Use set-node-id instead
router.post('/set-graze-component-id', async (req, res) => {
  res.json({ success: false, error: 'Deprecated. Use POST /api/set-node-id instead.' });
});

// Push all regions to Graze
router.post('/push-all-to-graze', async (req, res) => {
  const { sessionCookie } = req.body;
  
  if (!sessionCookie) {
    return res.status(400).json({ error: 'Session cookie required' });
  }
  
  try {
    // Get all regions
    const regionsResult = await pool.query(
      'SELECT region_code, region_name FROM locations WHERE population IS NULL AND region_code IS NOT NULL ORDER BY region_name'
    );
    
    const results = [];
    const grazeClient = new GrazeClient(sessionCookie);
    
    for (const region of regionsResult.rows) {
      try {
        // Get the generated JSON for this region
        const response = await fetch(`http://localhost:3009/api/graze-nodes/${region.region_code}`);
        const customNodeJson = await response.json();
        
        const nodeTitle = `SkyMap ${region.region_name}`;
        const nodeDescription = `Custom node for ${region.region_name} locations with city toggles`;
        
        // Check if component already exists
        const existingResult = await pool.query(
          'SELECT id, graze_component_id FROM locations WHERE region_code = $1 AND population IS NULL',
          [region.region_code]
        );
        
        let result;
        if (existingResult.rows[0]?.graze_component_id) {
          // Update existing
          result = await grazeClient.updateCustomNode(
            existingResult.rows[0].graze_component_id, 
            nodeTitle, 
            nodeDescription, 
            customNodeJson
          );
          results.push({
            region: region.region_name,
            action: 'updated',
            componentId: existingResult.rows[0].graze_component_id
          });
        } else {
          // Create new
          result = await grazeClient.createCustomNode(nodeTitle, nodeDescription, customNodeJson);
          
          // Store component ID
          await pool.query(
            'UPDATE locations SET graze_component_id = $1 WHERE id = $2',
            [result.id, existingResult.rows[0].id]
          );
          
          results.push({
            region: region.region_name,
            action: 'created',
            componentId: result.id
          });
        }
        
        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing ${region.region_name}:`, error.message);
        results.push({
          region: region.region_name,
          action: 'error',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${regionsResult.rows.length} regions`,
      results: results
    });
    
  } catch (error) {
    console.error('Error pushing all to Graze:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Generate heatmap custom node JSON
router.get('/graze-heatmap-node', async (req, res) => {
  try {
    // Get all hashtags grouped by region
    const result = await pool.query(`
      SELECT l.region_code, l.region_name, array_agg(DISTINCT h.hashtag) as hashtags
      FROM hashtag_mappings h
      JOIN locations l ON h.location_id = l.id
      WHERE l.region_code IS NOT NULL
      GROUP BY l.region_code, l.region_name
      ORDER BY l.region_name
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hashtags found' });
    }
    
    // Build entity_matches array - one per region
    const entityMatches = result.rows.map(region => ({
      entity_matches: [
        "hashtags",
        region.hashtags
      ],
      metadata: {
        title: region.region_name
      }
    }));
    
    const customNode = {
      order: "new",
      manifest: {
        filter: {
          or: entityMatches,
          metadata: {
            color: "purple",
            customNodeParameters: []
          }
        }
      }
    };
    
    res.json(customNode);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Push heatmap custom node to Graze
// Create Graze feed
// Update existing Graze feed
router.post('/update-feed', async (req, res) => {
  const { sessionCookie, feedId, listUrls } = req.body;
  
  if (!sessionCookie || !feedId || !listUrls || !listUrls.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const grazeClient = new GrazeClient(sessionCookie);
    
    // Get existing feed
    const existingFeed = await grazeClient.getFeed(feedId);
    
    // Build manifest with list_member filters
    const manifest = {
      filter: {
        or: listUrls.map(url => ({
          list_member: [url, "in"]
        }))
      }
    };
    
    // Update the feed manifest
    const updatedFeed = await grazeClient.updateFeed(feedId, existingFeed, manifest);
    
    res.json({
      success: true,
      feedId: feedId,
      message: `Updated feed ${feedId}`
    });
  } catch (error) {
    console.error('Error updating feed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/create-feed', async (req, res) => {
  const { sessionCookie, displayName, recordName, listUrls } = req.body;
  
  if (!sessionCookie || !displayName || !recordName || !listUrls || !listUrls.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const grazeClient = new GrazeClient(sessionCookie);
    
    // Build manifest with list_member filters
    const manifest = {
      filter: {
        or: listUrls.map(url => ({
          list_member: [url, "in"]
        }))
      }
    };
    
    const feed = await grazeClient.createFeed(displayName, recordName, manifest);
    
    res.json({
      success: true,
      feedId: feed.id,
      algorithmUri: feed.algorithm_uri,
      message: `Created feed: ${displayName}`
    });
  } catch (error) {
    console.error('Error creating feed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/push-heatmap-to-graze', async (req, res) => {
  const { sessionCookie } = req.body;
  
  if (!sessionCookie) {
    return res.status(400).json({ error: 'Session cookie required' });
  }
  
  try {
    // Generate heatmap node JSON directly instead of fetching
    const result = await pool.query(`
      SELECT l.region_code, l.region_name, array_agg(DISTINCT h.hashtag) as hashtags
      FROM hashtag_mappings h
      JOIN locations l ON h.location_id = l.id
      WHERE l.region_code IS NOT NULL
      GROUP BY l.region_code, l.region_name
      ORDER BY l.region_name
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hashtags found' });
    }
    
    // Build entity_matches array - one per region
    const entityMatches = result.rows.map(region => ({
      entity_matches: [
        "hashtags",
        region.hashtags
      ],
      metadata: {
        title: region.region_name
      }
    }));
    
    const customNodeJson = {
      order: "new",
      manifest: {
        filter: {
          or: entityMatches,
          metadata: {
            color: "purple",
            customNodeParameters: []
          }
        }
      }
    };
    
    const nodeTitle = 'SkyMap Heatmap Tracker';
    const nodeDescription = 'Tracks all location hashtags for activity heatmap';
    
    const grazeClient = new GrazeClient(sessionCookie);
    
    // Check if heatmap component ID exists in config
    const configResult = await pool.query(
      "SELECT value FROM config WHERE key = 'heatmap_component_id'"
    );
    
    let pushResult;
    if (configResult.rows.length > 0 && configResult.rows[0].value) {
      // Update existing
      const componentId = parseInt(configResult.rows[0].value);
      pushResult = await grazeClient.updateCustomNode(componentId, nodeTitle, nodeDescription, customNodeJson);
      
      res.json({
        success: true,
        message: `Updated heatmap custom node ${componentId}`,
        componentId: componentId,
        action: 'updated',
        result: pushResult
      });
    } else {
      // Create new
      pushResult = await grazeClient.createCustomNode(nodeTitle, nodeDescription, customNodeJson);
      
      // Store component ID in config
      await pool.query(
        "INSERT INTO config (key, value) VALUES ('heatmap_component_id', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [pushResult.id.toString()]
      );
      
      res.json({
        success: true,
        message: `Created heatmap custom node ${pushResult.id}`,
        componentId: pushResult.id,
        action: 'created',
        result: pushResult
      });
    }
  } catch (error) {
    console.error('Error pushing heatmap to Graze:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});


  return router;
}

async function autoLoginToGraze() {
  try {
    const username = process.env.BLUESKY_HANDLE || process.env.LABELER_DID;
    const password = process.env.BLUESKY_PASSWORD;
    
    if (!username || !password) {
      console.log('Graze credentials not configured, skipping auto-login');
      return;
    }
    
    console.log('Auto-logging in to Graze...');
    const grazeClient = new GrazeClient();
    const result = await grazeClient.login(username, password);
    
    if (result.success) {
      grazeSession = {
        cookie: result.sessionCookie,
        username: username,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      };
      console.log('Graze auto-login successful');
    } else {
      console.error('Graze auto-login failed:', result.error);
    }
  } catch (error) {
    console.error('Graze auto-login error:', error.message);
  }
}

module.exports = initGrazeRoutes;
module.exports.autoLoginToGraze = autoLoginToGraze;
