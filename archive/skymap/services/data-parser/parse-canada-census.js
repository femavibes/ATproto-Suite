const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5435/skymap'
});

const provinceMap = {
  'Alberta': 'AB',
  'British Columbia': 'BC', 
  'Manitoba': 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT',
  'Nova Scotia': 'NS',
  'Nunavut': 'NU',
  'Ontario': 'ON',
  'Prince Edward Island': 'PE',
  'Quebec': 'QC',
  'Saskatchewan': 'SK',
  'Yukon': 'YT'
};

async function parseCanadaCensusData() {
  const minPop = parseInt(process.env.MIN_POPULATION) || 50000;
  const csvPath = '/root/skymap/data/canada-census-2021.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.log('Canadian census CSV file not found.');
    console.log('Download from: https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/hlt-fst/pd-pl/Tables/File.cfm?T=703&SR=1&RPP=9999&PR=0&CMA=0&S=22&O=A&Lang=Eng&OFT=CSV');
    return;
  }

  const provinces = new Map();
  const cities = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Field names match our CSV structure
        const geoName = row['Geographic name'];
        const province = row['Province'];
        const population = parseInt(row['Population 2021']) || 0;
        const geoType = row['Geographic type'];
        
        // Filter for cities with sufficient population
        if (population >= minPop && geoType === 'City') {
          
          const provinceCode = provinceMap[province];
          if (provinceCode) {
            provinces.set(province, provinceCode);
            cities.push({
              name: geoName,
              region: province,
              regionCode: provinceCode,
              population: population
            });
          }
        }
      })
      .on('end', async () => {
        console.log(`Found ${cities.length} Canadian cities over ${minPop} population`);
        await insertCanadaData(provinces, cities);
        resolve();
      })
      .on('error', reject);
  });
}

async function insertCanadaData(provinces, cities) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert provinces first
    for (const [provinceName, provinceCode] of provinces) {
      await client.query(
        'INSERT INTO locations (key, name, region_code, region_name) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING',
        [`CA-${provinceCode}`, provinceName, provinceCode, provinceName]
      );
    }
    
    // Insert cities with parent relationships
    for (const city of cities) {
      const cityKey = `CA-${city.regionCode}-${city.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      const provinceResult = await client.query('SELECT id FROM locations WHERE key = $1', [`CA-${city.regionCode}`]);
      
      if (provinceResult.rows.length > 0) {
        await client.query(
          'INSERT INTO locations (key, name, region_code, region_name, population, parent_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (key) DO UPDATE SET name = $2, population = $5',
          [cityKey, city.name, city.regionCode, city.region, city.population, provinceResult.rows[0].id]
        );
      }
    }
    
    await client.query('COMMIT');
    console.log('Canadian data inserted successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inserting Canadian data:', err);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  parseCanadaCensusData();
}

module.exports = { parseCanadaCensusData };