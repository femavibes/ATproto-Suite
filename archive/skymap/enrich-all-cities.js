const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

const DELAY_MS = 1100;

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
      east: parseFloat(data[0].boundingbox[3])
    };
  }
  
  return null;
}

async function enrichAllCities() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT id, name, region_name, country_code
      FROM locations
      WHERE population IS NOT NULL
      ORDER BY population DESC
    `);
    
    console.log(`\n🗺️  Enriching ${result.rows.length} cities with bounding boxes\n`);
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < result.rows.length; i++) {
      const city = result.rows[i];
      const countryName = city.country_code === 'US' ? 'USA' : city.country_code === 'CA' ? 'Canada' : city.country_code;
      
      process.stdout.write(`[${i + 1}/${result.rows.length}] ${city.name}, ${city.region_name}... `);
      
      const bbox = await fetchBbox(city.name, city.region_name, countryName);
      
      if (bbox) {
        await client.query(`
          UPDATE locations
          SET bbox_south = $1, bbox_west = $2, bbox_north = $3, bbox_east = $4
          WHERE id = $5
        `, [bbox.south, bbox.west, bbox.north, bbox.east, city.id]);
        
        console.log('✓');
        success++;
      } else {
        console.log('✗');
        failed++;
      }
      
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ Success: ${success}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`${'='.repeat(60)}\n`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

enrichAllCities();
