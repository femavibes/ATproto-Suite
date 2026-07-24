const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

const DELAY_MS = 1100; // Nominatim rate limit: 1 request per second
const BATCH_SIZE = 10; // Process in batches for progress tracking

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBoundingBox(lat, lng, cityName, regionName, countryCode) {
  try {
    // Use search API with city name for better results
    const query = `${cityName}, ${regionName}, ${countryCode === 'US' ? 'United States' : countryCode === 'CA' ? 'Canada' : countryCode}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SkyMap/1.0 (bounding box enrichment)' }
    });
    
    if (!response.ok) {
      console.error(`  ✗ HTTP ${response.status} for ${cityName}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.length > 0 && data[0].boundingbox && data[0].boundingbox.length === 4) {
      // Nominatim returns: [south, north, west, east]
      return {
        south: parseFloat(data[0].boundingbox[0]),
        north: parseFloat(data[0].boundingbox[1]),
        west: parseFloat(data[0].boundingbox[2]),
        east: parseFloat(data[0].boundingbox[3])
      };
    }
    
    console.error(`  ✗ No bounding box in response for ${cityName}`);
    return null;
  } catch (error) {
    console.error(`  ✗ Error fetching bbox for ${cityName}:`, error.message);
    return null;
  }
}

async function calculateFallbackBbox(population, lat, lng) {
  // Calculate approximate bounding box based on population
  // Larger population = larger city = larger bbox
  let radiusDegrees;
  
  if (population < 100000) {
    radiusDegrees = 0.05; // ~5km
  } else if (population < 500000) {
    radiusDegrees = 0.1; // ~10km
  } else if (population < 1000000) {
    radiusDegrees = 0.15; // ~15km
  } else {
    radiusDegrees = 0.2; // ~20km
  }
  
  return {
    south: lat - radiusDegrees,
    north: lat + radiusDegrees,
    west: lng - radiusDegrees,
    east: lng + radiusDegrees
  };
}

async function enrichBoundingBoxes() {
  const client = await pool.connect();
  
  try {
    // Get all cities that have coordinates but no bounding box
    const result = await client.query(`
      SELECT id, key, name, region_name, country_code, population, latitude, longitude
      FROM locations
      WHERE population IS NOT NULL 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND bbox_south IS NULL
      ORDER BY population DESC
    `);
    
    const cities = result.rows;
    console.log(`\n📍 Found ${cities.length} cities needing bounding boxes\n`);
    
    if (cities.length === 0) {
      console.log('✓ All cities already have bounding boxes!');
      return;
    }
    
    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;
    
    // Process in batches for progress tracking
    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      const batch = cities.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cities.length / BATCH_SIZE)} (cities ${i + 1}-${Math.min(i + BATCH_SIZE, cities.length)} of ${cities.length})`);
      
      for (const city of batch) {
        const displayName = `${city.name}, ${city.region_name}`;
        process.stdout.write(`  ${displayName}... `);
        
        // Try to fetch from Nominatim
        let bbox = await fetchBoundingBox(city.latitude, city.longitude, city.name, city.region_name, city.country_code);
        let usedFallback = false;
        
        // If Nominatim fails, calculate fallback
        if (!bbox) {
          bbox = await calculateFallbackBbox(city.population, city.latitude, city.longitude);
          usedFallback = true;
          fallbackCount++;
          console.log(`⚠ Using calculated bbox (pop: ${city.population.toLocaleString()})`);
        } else {
          successCount++;
          console.log(`✓ Fetched from Nominatim`);
        }
        
        // Update database
        try {
          await client.query(`
            UPDATE locations 
            SET bbox_south = $1, bbox_west = $2, bbox_north = $3, bbox_east = $4
            WHERE id = $5
          `, [bbox.south, bbox.west, bbox.north, bbox.east, city.id]);
        } catch (dbError) {
          console.error(`  ✗ Database error for ${displayName}:`, dbError.message);
          failCount++;
        }
        
        // Rate limit: wait between requests
        await sleep(DELAY_MS);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ Successfully fetched from Nominatim: ${successCount}`);
    console.log(`⚠ Used calculated fallback: ${fallbackCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (fallbackCount > 0) {
      console.log(`Note: ${fallbackCount} cities used calculated bounding boxes based on population.`);
      console.log(`These are approximate but sufficient for visual purposes.\n`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  console.log('🗺️  SkyMap Bounding Box Enrichment\n');
  enrichBoundingBoxes()
    .then(() => {
      console.log('✓ Complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { enrichBoundingBoxes };
