const { Pool } = require('pg');
const { processGeoapifyCountry } = require('./parse-geoapify.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

async function diagnoseMatching() {
  const client = await pool.connect();
  
  try {
    // Get all our US cities
    const ourCities = await client.query(
      `SELECT id, key, name, region_code, country_code, population 
       FROM locations 
       WHERE country_code = 'US' AND parent_id IS NOT NULL
       ORDER BY name`
    );
    
    console.log(`We have ${ourCities.rows.length} US cities in database\n`);
    
    // Get Geoapify cities
    const { cities: geoapifyCities } = await processGeoapifyCountry('us', 50000);
    console.log(`Geoapify has ${geoapifyCities.length} US cities\n`);
    
    // Create lookup maps
    const geoapifyByKey = new Map();
    const geoapifyByNameRegion = new Map();
    
    for (const city of geoapifyCities) {
      geoapifyByKey.set(city.key, city);
      
      // Normalize name for matching
      const normalized = city.name.toLowerCase()
        .replace(/\s+(city|town|township|municipality|village|hamlet|borough)$/, '')
        .trim();
      const key = `${city.countryCode}-${city.regionCode}-${normalized}`;
      geoapifyByNameRegion.set(key, city);
    }
    
    // Check matches
    let matched = 0;
    let unmatched = [];
    
    for (const ourCity of ourCities.rows) {
      // Try exact key match
      if (geoapifyByKey.has(ourCity.key)) {
        matched++;
        continue;
      }
      
      // Try normalized name match
      const normalized = ourCity.name.toLowerCase()
        .replace(/\s+(city|town|township|municipality|village|hamlet|borough)$/, '')
        .trim();
      const lookupKey = `${ourCity.country_code}-${ourCity.region_code}-${normalized}`;
      
      if (geoapifyByNameRegion.has(lookupKey)) {
        matched++;
        continue;
      }
      
      // Try name without spaces
      const nameNoSpaces = ourCity.name.replace(/\s+/g, '').toLowerCase();
      let found = false;
      for (const [key, geoCity] of geoapifyByNameRegion) {
        const geoNameNoSpaces = geoCity.name.replace(/\s+/g, '').toLowerCase();
        if (geoNameNoSpaces === nameNoSpaces && 
            geoCity.regionCode === ourCity.region_code &&
            geoCity.countryCode === ourCity.country_code) {
          matched++;
          found = true;
          break;
        }
      }
      
      if (!found) {
        unmatched.push({
          key: ourCity.key,
          name: ourCity.name,
          region: ourCity.region_code,
          population: ourCity.population
        });
      }
    }
    
    console.log(`\n=== Results ===`);
    console.log(`Matched: ${matched} / ${ourCities.rows.length}`);
    console.log(`Unmatched: ${unmatched.length}\n`);
    
    if (unmatched.length > 0) {
      console.log(`\n=== First 50 Unmatched Cities ===`);
      unmatched.slice(0, 50).forEach(city => {
        console.log(`${city.key.padEnd(40)} | ${city.name.padEnd(30)} | ${city.region} | Pop: ${city.population || 'N/A'}`);
      });
      
      // Check if they exist in Geoapify with different names
      console.log(`\n=== Checking if unmatched cities exist in Geoapify ===`);
      for (const city of unmatched.slice(0, 20)) {
        const found = geoapifyCities.filter(g => 
          g.regionCode === city.region &&
          (g.name.toLowerCase().includes(city.name.toLowerCase().split(' ')[0]) ||
           city.name.toLowerCase().includes(g.name.toLowerCase().split(' ')[0]))
        );
        if (found.length > 0) {
          console.log(`\n${city.key} (${city.name}) might match:`);
          found.forEach(f => console.log(`  - ${f.key} (${f.name})`));
        }
      }
    }
    
  } finally {
    client.release();
  }
}

diagnoseMatching()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
