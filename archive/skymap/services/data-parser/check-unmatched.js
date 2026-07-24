const { Pool } = require('pg');
const { processGeoapifyCountry, findMatchingLocation } = require('./parse-geoapify.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

async function checkUnmatched() {
  const client = await pool.connect();
  
  try {
    // Get all our US cities
    const ourCities = await client.query(
      `SELECT id, key, name, region_code, country_code, population 
       FROM locations 
       WHERE country_code = 'US' AND parent_id IS NOT NULL
       ORDER BY name`
    );
    
    // Get Geoapify cities
    const { cities: geoapifyCities } = await processGeoapifyCountry('us', 50000);
    
    console.log(`Our cities: ${ourCities.rows.length}`);
    console.log(`Geoapify cities: ${geoapifyCities.length}\n`);
    
    // Check which Geoapify cities would be "inserted" (not matched)
    const wouldInsert = [];
    
    for (const geoCity of geoapifyCities) {
      const { match } = await findMatchingLocation(client, geoCity);
      if (!match) {
        // Check if a similar city exists in our DB
        const similar = await client.query(
          `SELECT id, key, name, region_code, population 
           FROM locations 
           WHERE country_code = $1 
             AND region_code = $2
             AND (
               LOWER(name) LIKE '%' || LOWER($3) || '%'
               OR LOWER($3) LIKE '%' || LOWER(name) || '%'
               OR SOUNDEX(name) = SOUNDEX($3)
             )
           LIMIT 5`,
          [geoCity.countryCode, geoCity.regionCode, geoCity.name]
        );
        
        wouldInsert.push({
          geoapify: geoCity,
          similar: similar.rows
        });
      }
    }
    
    console.log(`\n=== Cities that would be inserted (${wouldInsert.length}) ===\n`);
    
    // Show ones with similar matches
    const withSimilar = wouldInsert.filter(item => item.similar.length > 0);
    console.log(`Found ${withSimilar.length} with potential matches:\n`);
    
    for (const item of withSimilar.slice(0, 30)) {
      console.log(`Geoapify: ${item.geoapify.key} - ${item.geoapify.name} (${item.geoapify.regionCode})`);
      for (const sim of item.similar) {
        console.log(`  → Similar: ${sim.key} - ${sim.name} (${sim.region_code})`);
      }
      console.log('');
    }
    
    // Show ones with no similar matches
    const noSimilar = wouldInsert.filter(item => item.similar.length === 0);
    console.log(`\n=== No similar matches found (${noSimilar.length}) ===\n`);
    for (const item of noSimilar.slice(0, 20)) {
      console.log(`${item.geoapify.key.padEnd(40)} | ${item.geoapify.name.padEnd(30)} | ${item.geoapify.regionCode} | Pop: ${item.geoapify.population}`);
    }
    
  } finally {
    client.release();
  }
}

checkUnmatched()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
