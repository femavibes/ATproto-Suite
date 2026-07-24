const express = require('express');
const { emitOzoneLabel } = require('./shared');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

router.get('/locations', async (req, res) => {
  try {
    const { search, country, hasImages, limit } = req.query;
    let query = `
      SELECT l.id, l.key, l.name, l.region_name, l.population, l.country_code,
             l.pin_image_url, l.card_image_url, l.pin_image_attribution, l.card_image_attribution, l.display_key, l.display_name,
             COALESCE(array_agg(h.hashtag) FILTER (WHERE h.hashtag IS NOT NULL), '{}') as hashtags,
             (SELECT COUNT(*) FROM user_labels ul WHERE ul.location_id = l.id) as user_count
      FROM locations l
      LEFT JOIN hashtag_mappings h ON l.id = h.location_id
      WHERE l.population IS NOT NULL
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND LOWER(l.name) LIKE LOWER($${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (country) {
      paramCount++;
      query += ` AND l.country_code = $${paramCount}`;
      params.push(country);
    }
    
    if (hasImages === 'true') {
      query += ` AND (l.pin_image_url IS NOT NULL OR l.card_image_url IS NOT NULL)`;
    } else if (hasImages === 'false') {
      query += ` AND l.pin_image_url IS NULL AND l.card_image_url IS NULL`;
    }
    
    query += `
      GROUP BY l.id, l.key, l.name, l.region_name, l.population, l.country_code, l.pin_image_url, l.card_image_url, l.pin_image_attribution, l.card_image_attribution, l.display_key, l.display_name
      ORDER BY l.population DESC NULLS LAST
    `;
    
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    const result = await pool.query(query, params);
    
    const locations = result.rows.map(loc => ({
      ...loc,
      lists: loc.key ? [{
        id: loc.id,
        url: `at://did:web:lists.fema.monster/app.bsky.graph.list/${loc.key}`
      }] : []
    }));
    
    res.json(locations);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get users for a specific location
router.get('/locations/:locationKey/users', async (req, res) => {
  const { locationKey } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT DISTINCT ul.did
      FROM user_labels ul
      JOIN locations l ON ul.location_id = l.id
      WHERE l.key = $1 AND ul.active = true
      ORDER BY ul.did
    `, [locationKey]);
    
    res.json(result.rows.map(row => ({ handle: row.did })));
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Check if a user is in a specific location list
router.get('/locations/:locationKey/check-user', async (req, res) => {
  const { locationKey } = req.params;
  const { handle } = req.query;
  
  if (!handle) {
    return res.status(400).json({ error: 'Handle required' });
  }
  
  try {
    // Resolve handle to DID
    const resolveResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
    
    if (!resolveResponse.ok) {
      return res.status(404).json({ error: 'Handle not found', inList: false });
    }
    
    const { did } = await resolveResponse.json();
    
    // Check if DID is in location
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_labels ul
      JOIN locations l ON ul.location_id = l.id
      WHERE l.key = $1 AND ul.did = $2 AND ul.active = true
    `, [locationKey, did]);
    
    res.json({ inList: result.rows[0].count > 0, did });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove user from location list
router.delete('/locations/:locationKey/users/:handle', async (req, res) => {
  const { locationKey, handle } = req.params;
  
  try {
    const locationResult = await pool.query('SELECT id, key FROM locations WHERE key = $1', [locationKey]);
    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = locationResult.rows[0];
    
    await pool.query(
      'UPDATE user_labels SET active = false WHERE did = $1 AND location_id = $2',
      [handle, location.id]
    );
    
    await emitOzoneLabel(handle, [], [location.key.toLowerCase()], 'Label removed via admin');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// Add hashtag to location
router.post('/hashtags', async (req, res) => {
  const { locationId, hashtag } = req.body;
  const cleanHashtag = hashtag.toLowerCase().replace('#', '');
  
  try {
    // Check if hashtag already exists on another location
    const existing = await pool.query(
      'SELECT l.name, l.region_name FROM hashtag_mappings h JOIN locations l ON h.location_id = l.id WHERE h.hashtag = $1 AND h.location_id != $2',
      [cleanHashtag, locationId]
    );
    
    if (existing.rows.length > 0) {
      const loc = existing.rows[0];
      return res.status(400).json({ 
        error: `Hashtag #${cleanHashtag} is already mapped to ${loc.name}${loc.region_name ? ', ' + loc.region_name : ''}` 
      });
    }
    
    await pool.query(
      'INSERT INTO hashtag_mappings (location_id, hashtag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [locationId, cleanHashtag]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove hashtag from location
router.delete('/hashtags', async (req, res) => {
  const { locationId, hashtag } = req.body;
  
  try {
    await pool.query(
      'DELETE FROM hashtag_mappings WHERE location_id = $1 AND hashtag = $2',
      [locationId, hashtag.toLowerCase().replace('#', '')]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});


// Get current config
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM config');
    const config = {};
    result.rows.forEach(row => {
      config[row.key] = row.value;
    });
    res.json(config);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update config
router.post('/config', async (req, res) => {
  const { key, value } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Run Geoapify parser (unified parser for US and Canada)
router.post('/parse-geoapify', async (req, res) => {
  const { threshold, countries, fetchPolygons, forceRefreshPolygons, regionFilter, citySearch } = req.body;
  
  try {
    const minPop = parseInt(threshold) || 50000;
    const countriesToProcess = Array.isArray(countries) && countries.length > 0 ? countries : ['us', 'ca'];
    const shouldFetchPolygons = fetchPolygons === true;
    const shouldForceRefresh = forceRefreshPolygons === true;
    const region = regionFilter || null;
    const city = citySearch || null;
    
    // Update threshold in config
    await pool.query(
      'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['min_population', minPop.toString()]
    );
    
    const polygonMsg = shouldFetchPolygons 
      ? (shouldForceRefresh ? ' (fetching/refreshing polygons)' : ' (fetching missing polygons)')
      : ' (skipping polygon fetch)';
    
    let filterMsg = '';
    if (region) filterMsg += `, region: ${region}`;
    if (city) filterMsg += `, city: "${city}"`;
    
    res.json({ 
      success: true, 
      message: `Starting Geoapify parser with threshold: ${minPop.toLocaleString()}, countries: ${countriesToProcess.join(', ').toUpperCase()}${filterMsg}${polygonMsg}` 
    });
    
    // Run parser asynchronously
    setTimeout(async () => {
      try {
        // Import and run parser directly (more reliable than spawn)
        // In Docker, data-parser is mounted at /data-parser, otherwise use relative path
        const parserPath = require('fs').existsSync('/data-parser/parse-geoapify.js') 
          ? '/data-parser/parse-geoapify.js'
          : require('path').join(__dirname, '../data-parser/parse-geoapify.js');
        const { insertGeoapifyData } = require(parserPath);
        
        console.log(`Starting Geoapify parser: threshold=${minPop}, countries=${countriesToProcess.join(',')}, fetchPolygons=${shouldFetchPolygons}, forceRefresh=${shouldForceRefresh}, region=${region || 'all'}, city=${city || 'all'}`);
        
        const stats = await insertGeoapifyData(countriesToProcess, minPop, false, false, shouldFetchPolygons, shouldForceRefresh, region, city);
        
        console.log(`[Geoapify Parser] Completed:`);
        console.log(`  Countries processed: ${countriesToProcess.join(', ').toUpperCase()}`);
        if (region) console.log(`  Region filter: ${region}`);
        if (city) console.log(`  City search: "${city}"`);
        console.log(`  Cities matched: ${stats.matched}`);
        console.log(`  Cities updated: ${stats.updated}`);
        console.log(`  Cities inserted: ${stats.inserted}`);
        console.log(`  Regions created: ${stats.regionsCreated}`);
        console.log(`  Errors: ${stats.errors.length}`);
        
      } catch (error) {
        console.error('Geoapify parser error:', error);
        console.error('Stack:', error.stack);
      }
    }, 100);
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DEPRECATED: Use parse-geoapify instead
router.post('/parse-us', async (req, res) => {
  res.json({ success: false, error: 'Deprecated. Use POST /api/parse-geoapify with countries: ["us"] instead.' });
});

router.post('/parse-canada', async (req, res) => {
  res.json({ success: false, error: 'Deprecated. Use POST /api/parse-geoapify with countries: ["ca"] instead.' });
});
router.post('/create-lists', async (req, res) => {
  try {
    // Get all locations
    const locations = await pool.query('SELECT id FROM locations ORDER BY id');
    
    res.json({ 
      message: `Starting list creation for ${locations.rows.length} locations. Check console for progress.`,
      count: locations.rows.length
    });
    
    // Create lists asynchronously to avoid timeout
    setTimeout(async () => {
      const { ListManager } = require('./list-manager');
      const listManager = new ListManager();
      
      try {
        await listManager.login();
        
        for (const location of locations.rows) {
          try {
            console.log(`Creating lists for location ID: ${location.id}`);
            await listManager.ensureListsForLocation(location.id);
          } catch (error) {
            console.error(`Error creating lists for location ${location.id}:`, error);
          }
        }
        
        console.log('Finished creating lists for all locations');
      } catch (error) {
        console.error('Error in list creation process:', error);
      }
    }, 100);
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Clean up inactive lists for a location
router.delete('/locations/:locationId/inactive-lists', async (req, res) => {
  const { locationId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM bluesky_lists WHERE location_id = $1 AND active = false',
      [locationId]
    );
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${result.rowCount} inactive lists`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete list from database
router.delete('/lists/:listId', async (req, res) => {
  const { listId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM bluesky_lists WHERE id = $1 RETURNING location_id',
      [listId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    res.json({ success: true, message: 'List deleted from database' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create list for specific location
router.post('/create-list/:locationId', async (req, res) => {
  const { locationId } = req.params;
  
  try {
    const { ListManager } = require('./list-manager');
    const listManager = new ListManager();
    
    await listManager.login();
    
    // Create just one list for this location
    const result = await listManager.createList(parseInt(locationId), 1);
    
    res.json({ 
      success: true, 
      listUrl: result.listUrl,
      message: result.skipped ? `List already exists for location ${locationId}` : `Created list for location ${locationId}`,
      skipped: result.skipped || false
    });
    
  } catch (error) {
    console.error(`Error creating list for location ${locationId}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API endpoint to get all countries (from database)
router.get('/countries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT country_code,
        CASE 
          WHEN EXISTS (SELECT 1 FROM locations c WHERE c.key = l.country_code AND c.location_type = 'country')
          THEN (SELECT c.name || ' (' || c.key || ')' FROM locations c WHERE c.key = l.country_code AND c.location_type = 'country')
          ELSE country_code
        END as country_name
      FROM locations l
      WHERE country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY country_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get available Geoapify countries (from zip files)
router.get('/geoapify-countries', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    // Data directory is mounted at /app/data in container, or /root/skymap/data when running directly
    const dataDir = fs.existsSync('/app/data') ? '/app/data' : '/root/skymap/data';
    
    const countryNames = {
      'ad': 'Andorra', 'ae': 'United Arab Emirates', 'af': 'Afghanistan', 'ag': 'Antigua and Barbuda',
      'al': 'Albania', 'am': 'Armenia', 'ao': 'Angola', 'ar': 'Argentina', 'at': 'Austria',
      'au': 'Australia', 'az': 'Azerbaijan', 'ba': 'Bosnia and Herzegovina', 'bb': 'Barbados',
      'bd': 'Bangladesh', 'be': 'Belgium', 'bf': 'Burkina Faso', 'bg': 'Bulgaria', 'bh': 'Bahrain',
      'bi': 'Burundi', 'bj': 'Benin', 'bn': 'Brunei', 'bo': 'Bolivia', 'br': 'Brazil',
      'bs': 'Bahamas', 'bt': 'Bhutan', 'bw': 'Botswana', 'by': 'Belarus', 'bz': 'Belize',
      'ca': 'Canada', 'cd': 'DR Congo', 'cf': 'Central African Republic', 'cg': 'Congo',
      'ch': 'Switzerland', 'ci': "Côte d'Ivoire", 'cl': 'Chile', 'cm': 'Cameroon', 'cn': 'China',
      'co': 'Colombia', 'cr': 'Costa Rica', 'cu': 'Cuba', 'cv': 'Cape Verde', 'cy': 'Cyprus',
      'cz': 'Czech Republic', 'de': 'Germany', 'dj': 'Djibouti', 'dk': 'Denmark', 'dm': 'Dominica',
      'do': 'Dominican Republic', 'dz': 'Algeria', 'ec': 'Ecuador', 'ee': 'Estonia', 'eg': 'Egypt',
      'er': 'Eritrea', 'es': 'Spain', 'et': 'Ethiopia', 'fi': 'Finland', 'fj': 'Fiji',
      'fr': 'France', 'ga': 'Gabon', 'gb': 'United Kingdom', 'gd': 'Grenada', 'ge': 'Georgia',
      'gh': 'Ghana', 'gm': 'Gambia', 'gn': 'Guinea', 'gq': 'Equatorial Guinea', 'gr': 'Greece',
      'gt': 'Guatemala', 'gw': 'Guinea-Bissau', 'gy': 'Guyana', 'hn': 'Honduras', 'hr': 'Croatia',
      'ht': 'Haiti', 'hu': 'Hungary', 'id': 'Indonesia', 'ie': 'Ireland', 'il': 'Israel',
      'in': 'India', 'iq': 'Iraq', 'ir': 'Iran', 'is': 'Iceland', 'it': 'Italy',
      'jm': 'Jamaica', 'jo': 'Jordan', 'jp': 'Japan', 'ke': 'Kenya', 'kg': 'Kyrgyzstan',
      'kh': 'Cambodia', 'km': 'Comoros', 'kn': 'Saint Kitts and Nevis', 'kp': 'North Korea',
      'kr': 'South Korea', 'kw': 'Kuwait', 'kz': 'Kazakhstan', 'la': 'Laos', 'lb': 'Lebanon',
      'lc': 'Saint Lucia', 'li': 'Liechtenstein', 'lk': 'Sri Lanka', 'lr': 'Liberia',
      'ls': 'Lesotho', 'lt': 'Lithuania', 'lu': 'Luxembourg', 'lv': 'Latvia', 'ly': 'Libya',
      'ma': 'Morocco', 'mc': 'Monaco', 'md': 'Moldova', 'me': 'Montenegro', 'mg': 'Madagascar',
      'mk': 'North Macedonia', 'ml': 'Mali', 'mm': 'Myanmar', 'mn': 'Mongolia', 'mr': 'Mauritania',
      'mt': 'Malta', 'mu': 'Mauritius', 'mv': 'Maldives', 'mw': 'Malawi', 'mx': 'Mexico',
      'my': 'Malaysia', 'mz': 'Mozambique', 'na': 'Namibia', 'ne': 'Niger', 'ng': 'Nigeria',
      'ni': 'Nicaragua', 'nl': 'Netherlands', 'no': 'Norway', 'np': 'Nepal', 'nz': 'New Zealand',
      'om': 'Oman', 'pa': 'Panama', 'pe': 'Peru', 'pg': 'Papua New Guinea', 'ph': 'Philippines',
      'pk': 'Pakistan', 'pl': 'Poland', 'pt': 'Portugal', 'py': 'Paraguay', 'qa': 'Qatar',
      'ro': 'Romania', 'rs': 'Serbia', 'ru': 'Russia', 'rw': 'Rwanda', 'sa': 'Saudi Arabia',
      'sb': 'Solomon Islands', 'sc': 'Seychelles', 'sd': 'Sudan', 'se': 'Sweden', 'sg': 'Singapore',
      'si': 'Slovenia', 'sk': 'Slovakia', 'sl': 'Sierra Leone', 'sm': 'San Marino', 'sn': 'Senegal',
      'so': 'Somalia', 'sr': 'Suriname', 'ss': 'South Sudan', 'sv': 'El Salvador', 'sy': 'Syria',
      'sz': 'Eswatini', 'td': 'Chad', 'tg': 'Togo', 'th': 'Thailand', 'tj': 'Tajikistan',
      'tl': 'Timor-Leste', 'tm': 'Turkmenistan', 'tn': 'Tunisia', 'to': 'Tonga', 'tr': 'Turkey',
      'tt': 'Trinidad and Tobago', 'tw': 'Taiwan', 'tz': 'Tanzania', 'ua': 'Ukraine', 'ug': 'Uganda',
      'us': 'United States', 'uy': 'Uruguay', 'uz': 'Uzbekistan', 'vc': 'Saint Vincent and the Grenadines',
      've': 'Venezuela', 'vn': 'Vietnam', 'vu': 'Vanuatu', 'ws': 'Samoa', 'ye': 'Yemen',
      'za': 'South Africa', 'zm': 'Zambia', 'zw': 'Zimbabwe',
      'ai': 'Anguilla', 'bm': 'Bermuda', 'ck': 'Cook Islands', 'eh': 'Western Sahara',
      'fk': 'Falkland Islands', 'fm': 'Micronesia', 'fo': 'Faroe Islands', 'gg': 'Guernsey',
      'gi': 'Gibraltar', 'gl': 'Greenland', 'gs': 'South Georgia', 'im': 'Isle of Man',
      'io': 'British Indian Ocean Territory', 'je': 'Jersey', 'ki': 'Kiribati',
      'ky': 'Cayman Islands', 'mh': 'Marshall Islands', 'ms': 'Montserrat', 'no': 'Norway',
      'nr': 'Nauru', 'nu': 'Niue', 'pn': 'Pitcairn Islands', 'ps': 'Palestine',
      'pw': 'Palau', 'sh': 'Saint Helena', 'st': 'São Tomé and Príncipe',
      'tc': 'Turks and Caicos', 'tk': 'Tokelau', 'tv': 'Tuvalu',
      'vg': 'British Virgin Islands', 'xk': 'Kosovo'
    };
    
    const countries = [];
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      files.forEach(file => {
        if (file.endsWith('.zip')) {
          const code = file.replace('.zip', '').toLowerCase();
          if (code === 'no-country') return;
          const name = countryNames[code] || code.toUpperCase();
          countries.push({ code, name });
        }
      });
    }
    
    // Sort by name
    countries.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(countries);
  } catch (error) {
    console.error('Error reading countries:', error);
    res.status(500).json({ error: 'Error reading countries' });
  }
});

// API endpoint to get regions by country
router.get('/regions-by-country', async (req, res) => {
  const { country } = req.query;
  
  try {
    let query = `
      SELECT region_code, region_name, graze_component_ids
      FROM locations 
      WHERE population IS NULL AND region_code IS NOT NULL AND location_type = 'state'
    `;
    const params = [];
    
    if (country) {
      query += ` AND country_code = $${params.length + 1}`;
      params.push(country);
    }
    
    query += ` ORDER BY region_name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to get cities for search autocomplete
router.get('/cities-for-search', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, region_name, region_code, country_code
      FROM locations
      WHERE location_type = 'city' AND population IS NOT NULL
      ORDER BY population DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/regions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT region_code, region_name
      FROM locations 
      WHERE population IS NULL AND region_code IS NOT NULL
      ORDER BY region_name
    `);
    
    const regions = result.rows.map(region => ({
      name: region.region_name,
      code: region.region_code
    }));
    
    res.json(regions);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get cities in a specific region without lists
router.get('/regions/:regionCode/cities-without-lists', async (req, res) => {
  const { regionCode } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT l.id, l.name, l.population
      FROM locations l
      LEFT JOIN bluesky_lists bl ON l.id = bl.location_id AND bl.active = true
      WHERE l.region_code = $1
      GROUP BY l.id, l.name, l.population
      HAVING COUNT(bl.id) = 0
      ORDER BY l.population DESC NULLS LAST
    `, [regionCode]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get cities in a specific region
router.get('/regions/:regionCode/cities', async (req, res) => {
  const { regionCode } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT l.id, l.name, l.population,
             COALESCE(array_agg(bl.list_url ORDER BY bl.bucket_number) FILTER (WHERE bl.list_url IS NOT NULL), '{}') as list_urls
      FROM locations l
      LEFT JOIN bluesky_lists bl ON l.id = bl.location_id AND bl.active = true
      WHERE l.region_code = $1 AND l.population IS NOT NULL
      GROUP BY l.id, l.name, l.population
      ORDER BY l.population DESC
    `, [regionCode]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE location_type = 'city') as cities,
        COUNT(*) FILTER (WHERE location_type = 'county') as counties,
        COUNT(*) FILTER (WHERE location_type = 'state') as states,
        COUNT(*) FILTER (WHERE location_type = 'country') as countries,
        MIN(population) FILTER (WHERE location_type = 'city' AND population IS NOT NULL AND population > 0) as min_pop,
        MAX(population) FILTER (WHERE location_type = 'city' AND population IS NOT NULL) as max_pop
      FROM locations
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

  return router;
};
