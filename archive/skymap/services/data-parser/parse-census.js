const fs = require('fs');
const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5435/skymap'
});

const stateMap = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

async function parseCensusData() {
  const minPop = parseInt(process.env.MIN_POPULATION) || 50000;
  const xlsxPath = '/root/skymap/data/SUB-IP-EST2024-POP.xlsx';
  
  if (!fs.existsSync(xlsxPath)) {
    console.log('Excel file not found.');
    return;
  }

  const workbook = XLSX.readFile(xlsxPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const states = new Map();
  const cities = [];

  // Skip header rows and process data
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) continue;
    
    const locationName = row[0];
    const pop2024 = parseInt(row[5]) || 0;
    
    if (!locationName || pop2024 < minPop) continue;
    
    // Parse "City name, State" format
    const parts = locationName.split(', ');
    if (parts.length !== 2) continue;
    
    const cityName = parts[0].replace(' city', '').replace(' town', '');
    const stateName = parts[1];
    const stateCode = stateMap[stateName];
    
    // Special case for New York City
    const finalCityName = (cityName === 'New York' && stateName === 'New York') ? 'New York City' : cityName;
    
    if (stateCode) {
      states.set(stateName, stateCode);
      cities.push({
        name: finalCityName,
        region: stateName,
        regionCode: stateCode,
        population: pop2024
      });
    }
  }

  console.log(`Found ${cities.length} cities over ${minPop} population`);
  await insertData(states, cities);
}

async function insertData(states, cities) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert states first
    for (const [stateName, stateCode] of states) {
      await client.query(
        'INSERT INTO locations (key, name, region_code, region_name) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING',
        [`US-${stateCode}`, stateName, stateCode, stateName]
      );
    }
    
    // Insert cities with parent relationships
    for (const city of cities) {
      const cityKey = `US-${city.regionCode}-${city.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      const stateResult = await client.query('SELECT id FROM locations WHERE key = $1', [`US-${city.regionCode}`]);
      
      if (stateResult.rows.length > 0) {
        await client.query(
          'INSERT INTO locations (key, name, region_code, region_name, population, parent_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (key) DO UPDATE SET name = $2, population = $5',
          [cityKey, city.name, city.regionCode, city.region, city.population, stateResult.rows[0].id]
        );
      }
    }
    
    await client.query('COMMIT');
    console.log('Data inserted successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inserting data:', err);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  parseCensusData();
}

module.exports = { parseCensusData };