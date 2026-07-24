#!/usr/bin/env node
// Backfill osm_id and osm_type from Geoapify source data into locations table.
// Usage: node backfill-osm-ids.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap' });
const dataDir = path.join(__dirname, 'data');

async function processCountryFile(countryCode) {
  const sampleDir = path.join(dataDir, 'us_sample', countryCode);
  const filePath = path.join(sampleDir, 'place_city.ndjson');
  
  if (!fs.existsSync(filePath)) return 0;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let updated = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry.osm_id || !entry.name) continue;

      const city = entry.name;
      const state = entry.address?.state;
      const cc = (entry.address?.country_code || '').toUpperCase();

      // Match by name + region + country
      const result = await pool.query(
        `UPDATE locations SET osm_id = $1, osm_type = $2
         WHERE UPPER(name) = UPPER($3) AND UPPER(region_name) = UPPER($4) AND UPPER(country_code) = UPPER($5)
         AND osm_id IS NULL
         RETURNING id`,
        [entry.osm_id, entry.osm_type, city, state, cc]
      );
      if (result.rowCount > 0) updated++;
    } catch (e) {
      // skip malformed lines
    }
  }
  return updated;
}

async function processZipCountry(countryCode) {
  const { execSync } = require('child_process');
  const zipPath = path.join(dataDir, `${countryCode}.zip`);
  if (!fs.existsSync(zipPath)) return 0;

  // Extract to temp, process, clean up
  const tmpDir = `/tmp/osm_backfill_${countryCode}`;
  try {
    execSync(`rm -rf ${tmpDir} && mkdir -p ${tmpDir} && unzip -q -o ${zipPath} -d ${tmpDir}`, { stdio: 'pipe' });
  } catch { return 0; }

  const cityFile = path.join(tmpDir, 'place_city.ndjson');
  if (!fs.existsSync(cityFile)) {
    // Try nested directory
    const nested = path.join(tmpDir, countryCode, 'place_city.ndjson');
    if (!fs.existsSync(nested)) { execSync(`rm -rf ${tmpDir}`); return 0; }
    fs.renameSync(nested, cityFile);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(cityFile), crlfDelay: Infinity });
  let updated = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry.osm_id || !entry.name) continue;

      const city = entry.name;
      const state = entry.address?.state;
      const cc = (entry.address?.country_code || '').toUpperCase();

      const result = await pool.query(
        `UPDATE locations SET osm_id = $1, osm_type = $2
         WHERE UPPER(name) = UPPER($3) AND UPPER(region_name) = UPPER($4) AND UPPER(country_code) = UPPER($5)
         AND osm_id IS NULL
         RETURNING id`,
        [entry.osm_id, entry.osm_type, city, state, cc]
      );
      if (result.rowCount > 0) updated++;
    } catch (e) {
      // skip
    }
  }

  execSync(`rm -rf ${tmpDir}`);
  return updated;
}

async function main() {
  console.log('Backfilling OSM IDs from source data...');

  // First try the us_sample directory
  const sampleUpdated = await processCountryFile('us');
  if (sampleUpdated > 0) console.log(`US sample: ${sampleUpdated} updated`);

  // Then process zip files for all countries
  const zips = fs.readdirSync(dataDir).filter(f => f.endsWith('.zip') && f.length <= 6);
  let total = sampleUpdated;

  for (const zip of zips) {
    const cc = zip.replace('.zip', '');
    const count = await processZipCountry(cc);
    if (count > 0) {
      console.log(`${cc.toUpperCase()}: ${count} updated`);
      total += count;
    }
  }

  // Check how many are still missing
  const missing = await pool.query('SELECT COUNT(*) as cnt FROM locations WHERE osm_id IS NULL AND location_type = \'city\'');
  console.log(`\nDone. Total updated: ${total}. Still missing osm_id: ${missing.rows[0].cnt}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
