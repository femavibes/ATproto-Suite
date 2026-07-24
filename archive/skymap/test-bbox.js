const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

async function fetchBbox(city, state, country) {
  const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SkyMap/1.0' }
  });
  
  const data = await response.json();
  
  if (data[0]?.boundingbox && data[0].boundingbox.length === 4) {
    return {
      south: parseFloat(data[0].boundingbox[0]),
      north: parseFloat(data[0].boundingbox[1]),
      west: parseFloat(data[0].boundingbox[2]),
      east: parseFloat(data[0].boundingbox[3]),
      type: data[0].type
    };
  }
  
  return null;
}

async function testFewCities() {
  const client = await pool.connect();
  
  try {
    // Get 5 test cities
    const result = await client.query(`
      SELECT id, name, region_name, country_code
      FROM locations
      WHERE population IS NOT NULL
      ORDER BY population DESC
      LIMIT 5
    `);
    
    console.log(`Testing ${result.rows.length} cities:\n`);
    
    for (const city of result.rows) {
      const countryName = city.country_code === 'US' ? 'USA' : city.country_code === 'CA' ? 'Canada' : city.country_code;
      
      console.log(`${city.name}, ${city.region_name}...`);
      
      const bbox = await fetchBbox(city.name, city.region_name, countryName);
      
      if (bbox) {
        const height = (bbox.north - bbox.south).toFixed(3);
        const width = (bbox.east - bbox.west).toFixed(3);
        console.log(`  ✓ Got bbox: ${height}° x ${width}° (${bbox.type})`);
        console.log(`    South: ${bbox.south}, North: ${bbox.north}`);
        console.log(`    West: ${bbox.west}, East: ${bbox.east}\n`);
        
        // Update database
        await client.query(`
          UPDATE locations
          SET bbox_south = $1, bbox_west = $2, bbox_north = $3, bbox_east = $4
          WHERE id = $5
        `, [bbox.south, bbox.west, bbox.north, bbox.east, city.id]);
        
      } else {
        console.log(`  ✗ No bbox found\n`);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
    
    console.log('Done! Check results in database.');
    
  } finally {
    client.release();
    await pool.end();
  }
}

testFewCities();
