const express = require('express');
const cache = require('./cache');

const NEAR_YOU_URL = process.env.NEAR_YOU_URL || 'http://localhost:4000';

module.exports = (pool, agent) => {
  const router = express.Router();

// API endpoint to search locations
router.get('/locations', async (req, res) => {
  const { search, country, region, location_type } = req.query;
  
  try {
    let query = `
      SELECT l.key, l.name, l.region_name, l.population, l.location_type,
             COUNT(ul.id) as user_count
      FROM locations l
      LEFT JOIN user_labels ul ON l.id = ul.location_id AND ul.active = true
      WHERE l.location_type IN ('city', 'county', 'state', 'country')
    `;
    const params = [];
    
    if (search) {
      query += ` AND LOWER(l.name) LIKE LOWER($${params.length + 1})`;
      params.push(`%${search}%`);
    }
    
    if (country) {
      query += ` AND l.country_code = $${params.length + 1}`;
      params.push(country);
    }
    
    if (region) {
      query += ` AND l.region_code = $${params.length + 1}`;
      params.push(region.toUpperCase());
    }
    
    if (location_type) {
      query += ` AND l.location_type = $${params.length + 1}`;
      params.push(location_type);
    }
    
    query += ` GROUP BY l.id, l.key, l.name, l.region_name, l.population, l.location_type
               ORDER BY 
                 CASE l.location_type 
                   WHEN 'city' THEN 1
                   WHEN 'county' THEN 2
                   WHEN 'state' THEN 3
                   WHEN 'country' THEN 4
                 END,
                 COALESCE(l.population, 0) DESC LIMIT 500`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Public lookup API for other apps to resolve ATlas location keys
router.get('/locations/lookup', async (req, res) => {
  const { q, country, region } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query (q) must be at least 2 characters' });
  }
  
  try {
    let query = `
      SELECT 
        COALESCE(display_key, key) as atlas_key,
        name as locality,
        region_name as region,
        country_code as country,
        CONCAT(name, ', ', region_name) as display_name,
        population,
        location_type,
        osm_id,
        osm_type
      FROM locations 
      WHERE location_type = 'city'
        AND LOWER(name) LIKE LOWER($1)
    `;
    const params = [`%${q}%`];
    
    if (country) {
      query += ` AND UPPER(country_code) = UPPER($${params.length + 1})`;
      params.push(country);
    }
    
    if (region) {
      query += ` AND UPPER(region_name) = UPPER($${params.length + 1})`;
      params.push(region);
    }
    
    query += ` ORDER BY COALESCE(population, 0) DESC LIMIT 20`;
    
    const result = await pool.query(query, params);
    
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
      results: result.rows,
      usage: 'Include atlas_key in the atlasKey field when writing city.atlas.actor.location records for exact matching.'
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// API endpoint for autocomplete
router.get('/autocomplete', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  try {
    const result = await pool.query(`
      SELECT key, name, region_name, population, location_type
      FROM locations 
      WHERE location_type IN ('city', 'county', 'state', 'country')
        AND LOWER(name) LIKE LOWER($1)
      ORDER BY 
        CASE location_type 
          WHEN 'city' THEN 1
          WHEN 'county' THEN 2
          WHEN 'state' THEN 3
          WHEN 'country' THEN 4
        END,
        COALESCE(population, 0) DESC
      LIMIT 10
    `, [`%${q}%`]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to check user labels
router.get('/user-labels', async (req, res) => {
  const { handle } = req.query;
  
  if (!handle) {
    return res.status(400).json({ error: 'Handle required' });
  }
  
  try {
    // Resolve handle to DID
    const resolveResponse = await agent.com.atproto.identity.resolveHandle({
      handle: handle.replace('@', '')
    });
    const did = resolveResponse.data.did;
    
    // Query database labels
    let databaseLabels = [];
    try {
      const dbResult = await pool.query(`
        SELECT l.key, l.name, l.region_name, ul.created_at, ul.is_primary
        FROM user_labels ul 
        JOIN locations l ON ul.location_id = l.id 
        WHERE ul.did = $1 AND ul.active = true
      `, [did]);
      
      databaseLabels = dbResult.rows.map(row => ({
        key: row.key,
        name: row.name,
        region_name: row.region_name,
        created: row.created_at,
        is_primary: row.is_primary
      }));
    } catch (dbError) {
      console.log('Database query error:', dbError.message);
    }
    
    // Query labels from Bluesky API
    let blueskyLabels = [];
    if (agent.session) {
      try {
        const labelsResponse = await agent.com.atproto.label.queryLabels({
          uriPatterns: [did],
          sources: [process.env.LABELER_DID]
        });
        
        if (labelsResponse.data.labels) {
          blueskyLabels = labelsResponse.data.labels.map(label => ({
            value: label.val,
            created: label.cts
          }));
        }
      } catch (labelError) {
        console.log('Bluesky API error:', labelError.message);
      }
    }
    
    res.json({ did, handle, databaseLabels, blueskyLabels });
  } catch (error) {
    console.error('Error fetching user labels:', error);
    if (error.message?.includes('Unable to resolve handle')) {
      res.status(404).json({ error: 'Handle not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch user labels' });
    }
  }
});

// API endpoint to get total user count
// Get bot handle for RSVP commands
router.get('/bot-handle', (req, res) => {
  const handle = process.env.BLUESKY_HANDLE || 'ATlas.city';
  res.json({ handle });
});

router.get('/user-count', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT COUNT(DISTINCT did) as total_users
      FROM user_labels
      WHERE active = true
    `);
    res.json({ totalUsers: parseInt(result.rows[0].total_users) });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get user growth over time
router.get('/user-growth', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT did) as new_users
      FROM user_labels
      WHERE active = true
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json({ growth: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get all countries
router.get('/countries', async (req, res) => {
  try {
    const cached = cache.get('countries');
    if (cached) { res.set('Cache-Control', 'public, max-age=600'); return res.json(cached); }
    
    const result = await pool.query(`
      SELECT country_code, name as country_name
      FROM locations 
      WHERE location_type = 'country' AND country_code IS NOT NULL
      ORDER BY name
    `);
    cache.set('countries', result.rows, 10 * 60 * 1000);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get regions by country
router.get('/regions', async (req, res) => {
  const { country } = req.query;
  
  try {
    const cacheKey = 'regions_' + (country || 'all');
    const cached = cache.get(cacheKey);
    if (cached) { res.set('Cache-Control', 'public, max-age=600'); return res.json(cached); }
    
    let query = `
      SELECT DISTINCT region_code, region_name 
      FROM locations 
      WHERE region_code IS NOT NULL
    `;
    const params = [];
    
    if (country) {
      query += ` AND country_code = $1`;
      params.push(country);
    }
    
    query += ` ORDER BY region_name`;
    
    const result = await pool.query(query, params);
    cache.set(cacheKey, result.rows, 10 * 60 * 1000);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get map data
router.get('/map-locations', async (req, res) => {
  try {
    const cached = cache.get('map-locations');
    if (cached) { res.set('Cache-Control', 'public, max-age=300'); return res.json(cached); }
    
    // Fetch locations and city stats in parallel
    const [locResult, statsResp] = await Promise.all([
      pool.query(`
        SELECT l.id, l.key, l.name, l.region_name, l.region_code, l.country_code, 
               l.population, l.latitude, l.longitude, l.location_type,
               l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east,
               l.pin_image_url, l.card_image_url, l.pin_image_attribution, l.card_image_attribution,
               COUNT(DISTINCT ul.id) FILTER (WHERE ul.is_primary = true) as user_count
        FROM locations l
        LEFT JOIN user_labels ul ON l.id = ul.location_id AND ul.active = true
        WHERE l.location_type IN ('city', 'county', 'state', 'country')
        GROUP BY l.id, l.key, l.name, l.region_name, l.region_code, l.country_code, l.population, l.latitude, l.longitude, l.location_type, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east, l.pin_image_url, l.card_image_url, l.pin_image_attribution, l.card_image_attribution
        ORDER BY 
          CASE l.location_type 
            WHEN 'country' THEN 1
            WHEN 'state' THEN 2
            WHEN 'county' THEN 3
            WHEN 'city' THEN 4
          END,
          COALESCE(l.population, 0) DESC
      `),
      fetch(`${NEAR_YOU_URL}/api/city-stats`).then(r => r.json()).catch(() => [])
    ]);

    // Build stats lookup by location_id
    const statsMap = {};
    for (const s of statsResp) {
      statsMap[s.location_id] = s;
    }

    const rows = locResult.rows.map(loc => {
      const s = statsMap[loc.id];
      return {
        ...loc,
        posts_1h: s ? s.post_count_1h : 0,
        posts_6h: s ? s.post_count_6h : 0,
        posts_24h: s ? s.post_count_24h : 0,
        posts_7d: s ? s.post_count_7d : 0,
      };
    });

    cache.set('map-locations', rows, 5 * 60 * 1000);
    res.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Endpoint to fetch geometry data for locations (lazy loading for boundaries)
router.get('/map-locations/geometry', async (req, res) => {
  try {
    const locationIds = req.query.ids ? req.query.ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
    const north = req.query.north ? parseFloat(req.query.north) : null;
    const south = req.query.south ? parseFloat(req.query.south) : null;
    const east = req.query.east ? parseFloat(req.query.east) : null;
    const west = req.query.west ? parseFloat(req.query.west) : null;
    const zoom = req.query.zoom ? parseInt(req.query.zoom) : null;
    
    if (locationIds.length === 0) {
      return res.json([]);
    }
    
    let query = `
      SELECT l.id, l.geometry
      FROM locations l
      WHERE l.id = ANY($1::int[]) AND l.geometry IS NOT NULL
    `;
    const params = [locationIds];
    
    // Apply viewport filtering if bounds provided
    if (north !== null && south !== null && east !== null && west !== null) {
      query += ` AND l.latitude BETWEEN $2 AND $3 AND l.longitude BETWEEN $4 AND $5`;
      params.push(south, north, west, east);
    }
    
    // Apply population-based visibility filtering if zoom provided
    if (zoom !== null) {
      query += ` AND (
        COALESCE(l.population, 0) >= 500000
        OR (COALESCE(l.population, 0) >= 250000 AND $${params.length + 1} >= 6)
        OR (COALESCE(l.population, 0) >= 100000 AND $${params.length + 1} >= 7)
        OR (COALESCE(l.population, 0) >= 50000 AND $${params.length + 1} >= 8)
        OR (COALESCE(l.population, 0) >= 25000 AND $${params.length + 1} >= 9)
        OR $${params.length + 1} >= 10
      )`;
      params.push(zoom);
    }
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Database error fetching geometry:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to geocode a location
router.get('/geocode', async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'Key required' });
  
  try {
    const location = await pool.query(
      'SELECT id, name, region_name, country_code FROM locations WHERE key = $1',
      [key]
    );
    
    if (location.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const loc = location.rows[0];
    const countryResult = await pool.query(
      "SELECT name FROM locations WHERE key = $1 AND location_type = 'country'",
      [loc.country_code]
    );
    const countryName = countryResult.rows[0]?.name || loc.country_code;
    const query = `${loc.name}, ${loc.region_name}, ${countryName}`;
    
    // Use Nominatim (OpenStreetMap) for geocoding with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { 
        headers: { 'User-Agent': 'SkyMap/1.0' },
        signal: controller.signal
      }
    );
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.length > 0) {
      const { lat, lon } = data[0];
      await pool.query(
        'UPDATE locations SET latitude = $1, longitude = $2 WHERE id = $3',
        [parseFloat(lat), parseFloat(lon), loc.id]
      );
      res.json({ latitude: parseFloat(lat), longitude: parseFloat(lon) });
    } else {
      res.status(404).json({ error: 'Coordinates not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// API endpoint to get location lists and feed info
router.get('/location-lists', async (req, res) => {
  const { search, country, region, location_type } = req.query;
  
  try {
    let query = `
      SELECT l.key, l.name, l.region_name, l.region_code, l.country_code, l.population, l.location_type,
             COALESCE(l.display_key, l.key) as display_key,
             COUNT(DISTINCT ul.id) as user_count,
             COUNT(DISTINCT bl.id) as list_count,
             SUM(bl.member_count) as total_members,
             r.graze_component_ids as region_graze_ids
      FROM locations l
      LEFT JOIN user_labels ul ON l.id = ul.location_id AND ul.active = true
      LEFT JOIN bluesky_lists bl ON l.id = bl.location_id AND bl.active = true
      LEFT JOIN locations r ON l.region_code = r.region_code AND l.country_code = r.country_code AND r.location_type = 'state' AND r.population IS NULL
      WHERE l.location_type IN ('city', 'county', 'state', 'country')
    `;
    const params = [];
    
    if (search) {
      query += ` AND (LOWER(l.name) LIKE LOWER($${params.length + 1}) 
                   OR LOWER(l.region_name) LIKE LOWER($${params.length + 1})
                   OR LOWER(l.key) LIKE LOWER($${params.length + 1}))`;
      params.push(`%${search}%`);
    }
    
    if (country) {
      query += ` AND l.country_code = $${params.length + 1}`;
      params.push(country);
    }
    
    if (region) {
      query += ` AND l.region_code = $${params.length + 1}`;
      params.push(region.toUpperCase());
    }
    
    if (location_type) {
      // Map 'region' to 'state' for database query
      const dbLocationType = location_type === 'region' ? 'state' : location_type;
      query += ` AND l.location_type = $${params.length + 1}`;
      params.push(dbLocationType);
    }
    
    query += ` GROUP BY l.id, l.key, l.name, l.region_name, l.region_code, l.country_code, l.population, l.location_type, l.display_key, r.graze_component_ids
               ORDER BY 
                 CASE l.location_type 
                   WHEN 'city' THEN 1
                   WHEN 'county' THEN 2
                   WHEN 'state' THEN 3
                   WHEN 'country' THEN 4
                 END,
                 COALESCE(l.population, 0) DESC LIMIT 1500`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint for heatmap data (powered by Near You city-stats)
router.get('/heatmap-data', async (req, res) => {
  const { window = '24h' } = req.query;
  const field = { '1h': 'post_count_1h', '6h': 'post_count_6h', '24h': 'post_count_24h', '7d': 'post_count_7d' }[window] || 'post_count_24h';
  
  try {
    const [statsResp, locResult] = await Promise.all([
      fetch(`${NEAR_YOU_URL}/api/city-stats`).then(r => r.json()).catch(() => []),
      pool.query(`SELECT id, CAST(latitude AS FLOAT) as latitude, CAST(longitude AS FLOAT) as longitude, name, region_name FROM locations WHERE latitude IS NOT NULL AND longitude IS NOT NULL`)
    ]);

    const locMap = {};
    for (const loc of locResult.rows) locMap[loc.id] = loc;

    const data = statsResp
      .filter(s => s[field] > 0 && locMap[s.location_id])
      .map(s => {
        const loc = locMap[s.location_id];
        return { latitude: loc.latitude, longitude: loc.longitude, intensity: s[field], name: loc.name, region_name: loc.region_name };
      })
      .sort((a, b) => b.intensity - a.intensity);

    res.json(data);
  } catch (error) {
    console.error('Database error in heatmap-data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get lists for a specific location
router.get('/location/:key/lists', async (req, res) => {
  const { key } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT bl.list_url, bl.bucket_number, bl.member_count
      FROM bluesky_lists bl
      JOIN locations l ON bl.location_id = l.id
      WHERE l.key = $1 AND bl.active = true
      ORDER BY bl.bucket_number
    `, [key]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

  return router;
};
