const { Pool } = require('pg');
const { processGeoapifyCountry, findMatchingLocation } = require('./parse-geoapify.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

async function listUnmatched() {
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
    
    console.log('='.repeat(80));
    console.log('GEOAPIFY CITIES THAT WOULD BE INSERTED (New/Unmatched)');
    console.log('='.repeat(80));
    console.log(`Total: ${geoapifyCities.length} cities from Geoapify\n`);
    
    const geoapifyUnmatched = [];
    const geoapifyMatched = [];
    
    for (const geoCity of geoapifyCities) {
      const { match } = await findMatchingLocation(client, geoCity);
      if (!match) {
        geoapifyUnmatched.push(geoCity);
      } else {
        geoapifyMatched.push({ geo: geoCity, db: match });
      }
    }
    
    console.log(`Matched: ${geoapifyMatched.length}`);
    console.log(`Would Insert: ${geoapifyUnmatched.length}\n`);
    
    // Group by state
    const byState = {};
    for (const city of geoapifyUnmatched) {
      if (!byState[city.regionCode]) {
        byState[city.regionCode] = [];
      }
      byState[city.regionCode].push(city);
    }
    
    console.log('\n=== GEOAPIFY CITIES TO BE INSERTED (Grouped by State) ===\n');
    for (const [state, cities] of Object.entries(byState).sort()) {
      console.log(`\n${state} (${cities.length} cities):`);
      for (const city of cities.sort((a, b) => a.name.localeCompare(b.name))) {
        console.log(`  ${city.key.padEnd(40)} | ${city.name.padEnd(35)} | Pop: ${city.population.toLocaleString()}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('OUR DATABASE CITIES THAT ARE NOT MATCHED');
    console.log('='.repeat(80));
    console.log(`Total in our DB: ${ourCities.rows.length} cities\n`);
    
    const ourUnmatched = [];
    const ourMatched = [];
    
    for (const ourCity of ourCities.rows) {
      // Check if any Geoapify city matches this
      let found = false;
      for (const geoCity of geoapifyCities) {
        const { match } = await findMatchingLocation(client, geoCity);
        if (match && match.id === ourCity.id) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        ourUnmatched.push(ourCity);
      } else {
        ourMatched.push(ourCity);
      }
    }
    
    console.log(`Matched: ${ourMatched.length}`);
    console.log(`Unmatched: ${ourUnmatched.length}\n`);
    
    // Group by state
    const ourByState = {};
    for (const city of ourUnmatched) {
      if (!ourByState[city.region_code]) {
        ourByState[city.region_code] = [];
      }
      ourByState[city.region_code].push(city);
    }
    
    console.log('\n=== OUR DATABASE CITIES NOT FOUND IN GEOAPIFY (Grouped by State) ===\n');
    for (const [state, cities] of Object.entries(ourByState).sort()) {
      console.log(`\n${state} (${cities.length} cities):`);
      for (const city of cities.sort((a, b) => a.name.localeCompare(b.name))) {
        console.log(`  ${city.key.padEnd(40)} | ${city.name.padEnd(35)} | Pop: ${city.population ? city.population.toLocaleString() : 'N/A'}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Geoapify cities matched: ${geoapifyMatched.length} / ${geoapifyCities.length} (${(geoapifyMatched.length/geoapifyCities.length*100).toFixed(1)}%)`);
    console.log(`Geoapify cities to insert: ${geoapifyUnmatched.length}`);
    console.log(`Our DB cities matched: ${ourMatched.length} / ${ourCities.rows.length} (${(ourMatched.length/ourCities.rows.length*100).toFixed(1)}%)`);
    console.log(`Our DB cities unmatched: ${ourUnmatched.length}`);
    
  } finally {
    client.release();
  }
}

listUnmatched()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
