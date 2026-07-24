const { Pool } = require('pg');
const { processGeoapifyCountry, findMatchingLocation } = require('./parse-geoapify.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

async function findMissingCities() {
  const client = await pool.connect();
  
  try {
    // Get all our US cities
    const ourCities = await client.query(
      `SELECT id, key, name, region_code, country_code, population 
       FROM locations 
       WHERE country_code = 'US' AND parent_id IS NOT NULL
       ORDER BY name`
    );
    
    // Get Geoapify cities (including all types)
    const { cities: geoapifyCities } = await processGeoapifyCountry('us', 50000);
    
    console.log(`Our cities: ${ourCities.rows.length}`);
    console.log(`Geoapify cities: ${geoapifyCities.length}\n`);
    
    // Create a map of Geoapify cities by normalized name+region
    const geoapifyMap = new Map();
    for (const geoCity of geoapifyCities) {
      const normalized = geoCity.name.toLowerCase()
        .replace(/\s+(city|town|township|municipality|village|hamlet|borough)$/, '')
        .trim();
      const key = `${normalized}|${geoCity.regionCode}`;
      if (!geoapifyMap.has(key)) {
        geoapifyMap.set(key, []);
      }
      geoapifyMap.get(key).push(geoCity);
    }
    
    const unmatched = [];
    
    // Check each of our cities
    for (const ourCity of ourCities.rows) {
      const { match } = await findMatchingLocation(client, {
        name: ourCity.name,
        regionCode: ourCity.region_code,
        countryCode: ourCity.country_code,
        normalizedName: ourCity.name.toLowerCase()
          .replace(/\s+(city|town|township|municipality|village|hamlet|borough)$/, '')
          .trim(),
        key: ourCity.key
      });
      
      if (!match) {
        // Check if similar exists in Geoapify map
        const normalized = ourCity.name.toLowerCase()
          .replace(/\s+(city|town|township|municipality|village|hamlet|borough)$/, '')
          .trim();
        const lookupKey = `${normalized}|${ourCity.region_code}`;
        const similar = geoapifyMap.get(lookupKey) || [];
        
        unmatched.push({
          city: ourCity,
          similar: similar
        });
      }
    }
    
    console.log(`\n=== Unmatched Cities (${unmatched.length}) ===\n`);
    
    // Group by whether they might exist in Geoapify
    const mightExist = [];
    const probablyNotExist = [];
    
    for (const item of unmatched) {
      if (item.similar.length > 0) {
        mightExist.push(item);
      } else {
        probablyNotExist.push(item);
      }
    }
    
    if (mightExist.length > 0) {
      console.log(`\n=== Cities that MIGHT exist in Geoapify (${mightExist.length}) ===`);
      console.log('(Need better matching logic)\n');
      for (const item of mightExist.slice(0, 20)) {
        console.log(`${item.city.key.padEnd(40)} | ${item.city.name.padEnd(30)} | ${item.city.region_code}`);
        for (const sim of item.similar) {
          console.log(`  → Similar: ${sim.key} - ${sim.name} (${sim.regionCode})`);
        }
      }
    }
    
    if (probablyNotExist.length > 0) {
      console.log(`\n=== Cities that probably DON'T exist in Geoapify (${probablyNotExist.length}) ===`);
      console.log('(These should be deleted if we want 100% Geoapify coverage)\n');
      for (const item of probablyNotExist) {
        console.log(`${item.city.key.padEnd(40)} | ${item.city.name.padEnd(30)} | ${item.city.region_code} | Pop: ${item.city.population || 'N/A'}`);
      }
    }
    
  } finally {
    client.release();
  }
}

findMissingCities()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
