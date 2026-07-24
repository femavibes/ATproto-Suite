const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeCity(location) {
  const query = `${location.name}, ${location.region_name}, ${location.country_code === 'US' ? 'United States' : location.country_code}`;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SkyMap/1.0' } }
    );
    
    const data = await response.json();
    
    if (data.length > 0) {
      const { lat, lon } = data[0];
      await pool.query(
        'UPDATE locations SET latitude = $1, longitude = $2 WHERE id = $3',
        [parseFloat(lat), parseFloat(lon), location.id]
      );
      console.log(`✓ Geocoded: ${location.name}, ${location.region_name} (${lat}, ${lon})`);
      return true;
    } else {
      console.log(`✗ Not found: ${location.name}, ${location.region_name}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error geocoding ${location.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting batch geocoding...\n');
  
  const result = await pool.query(`
    SELECT id, name, region_name, country_code 
    FROM locations 
    WHERE population IS NOT NULL AND latitude IS NULL
    ORDER BY population DESC
  `);
  
  const cities = result.rows;
  console.log(`Found ${cities.length} cities to geocode\n`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    console.log(`[${i + 1}/${cities.length}] Geocoding ${city.name}, ${city.region_name}...`);
    
    const result = await geocodeCity(city);
    if (result) {
      success++;
    } else {
      failed++;
    }
    
    // Respect Nominatim rate limit: 1 request per second
    if (i < cities.length - 1) {
      await sleep(1100);
    }
  }
  
  console.log(`\n✓ Complete! Success: ${success}, Failed: ${failed}`);
  await pool.end();
}

main().catch(console.error);
