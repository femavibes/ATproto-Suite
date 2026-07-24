import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://dev:devpass@localhost:5435/skymap'
});

const LABELER_DID = 'did:plc:l37i5se642dgeb7kmrdwoqv4';

async function addUserLabel(did, locationKey) {
  // Get location
  const locationResult = await pool.query(
    'SELECT * FROM locations WHERE UPPER(key) = UPPER($1)',
    [locationKey]
  );
  
  if (locationResult.rows.length === 0) {
    console.log(`Location ${locationKey} not found`);
    return;
  }
  
  const location = locationResult.rows[0];
  console.log(`Found location: ${location.name} (${location.key})`);
  
  // Add to database
  await pool.query(
    'INSERT INTO user_labels (did, location_id, active) VALUES ($1, $2, true) ON CONFLICT DO NOTHING',
    [did, location.id]
  );
  
  console.log(`✅ Added ${location.key} label to ${did} in database`);
  console.log(`User now available in AT Protocol list: at://did:web:lists.fema.monster/app.bsky.graph.list/${location.key}`);
}

async function getUserLabels(did) {
  const result = await pool.query(
    'SELECT l.key, l.name FROM user_labels ul JOIN locations l ON ul.location_id = l.id WHERE ul.did = $1 AND ul.active = true',
    [did]
  );
  return result.rows;
}

// Test with your DID
const testDid = process.argv[2] || 'did:plc:example';
const locationKey = process.argv[3] || 'US-NY-NewYorkCity';

console.log(`Testing label system for ${testDid}`);
console.log(`Adding location: ${locationKey}\n`);

addUserLabel(testDid, locationKey)
  .then(async () => {
    console.log('\nCurrent labels:');
    const labels = await getUserLabels(testDid);
    labels.forEach(l => console.log(`  - ${l.name} (${l.key})`));
    await pool.end();
  })
  .catch(err => {
    console.error('Error:', err);
    pool.end();
  });
