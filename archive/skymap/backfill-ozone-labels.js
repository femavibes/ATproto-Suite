import pg from 'pg';
import { Secp256k1Keypair } from '@atproto/crypto';
import * as ui8 from 'uint8arrays';
const { Pool } = pg;

const atlasPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

const ozonePool = new Pool({
  connectionString: 'postgresql://postgres:08b5407640c8bf0275895a3707809e8d@localhost:5432/ozone'
});

const labelerDid = process.env.LABELER_DID || 'did:plc:l37i5se642dgeb7kmrdwoqv4';
const signingKeyHex = '5ec7697f5e191907367671b0e03d807c897713c807d5f5a3611f66e8092e1bc2';

const keypair = await Secp256k1Keypair.import(ui8.fromString(signingKeyHex, 'hex'));

function formatLabel(did, val, neg, cts) {
  return {
    ver: 1,
    src: labelerDid,
    uri: did,
    val,
    neg: neg || false,
    cts: cts || new Date().toISOString()
  };
}

async function signLabel(label) {
  const bytes = ui8.fromString(JSON.stringify(label), 'utf8');
  const sig = await keypair.sign(bytes);
  return sig;
}

async function backfillLabels() {
  console.log('Starting Ozone label backfill...');
  
  // Get all active labels from Atlas DB
  const result = await atlasPool.query(`
    SELECT ul.did, l.key, l.display_key
    FROM user_labels ul
    JOIN locations l ON ul.location_id = l.id
    WHERE ul.active = true
    ORDER BY ul.created_at
  `);
  
  console.log(`Found ${result.rows.length} labels to backfill`);
  
  let success = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const row of result.rows) {
    const labelKey = (row.display_key || row.key).toLowerCase();
    
    try {
      // Check if label already exists in Ozone
      const existing = await ozonePool.query(
        'SELECT id FROM label WHERE uri = $1 AND val = $2 AND src = $3',
        [row.did, labelKey, labelerDid]
      );
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      // Create and sign label
      const label = formatLabel(row.did, labelKey, false, new Date().toISOString());
      const sig = await signLabel(label);
      
      // Insert label with signature into Ozone DB
      await ozonePool.query(
        `INSERT INTO label (src, uri, cid, val, neg, cts, sig) 
         VALUES ($1, $2, '', $3, false, $4, $5)`,
        [labelerDid, row.did, labelKey, label.cts, sig]
      );
      
      success++;
      console.log(`✓ ${success}/${result.rows.length} - ${labelKey} → ${row.did}`);
      
    } catch (error) {
      errors++;
      console.error(`✗ Error for ${labelKey} → ${row.did}:`, error.message);
    }
  }
  
  console.log(`\nBackfill complete: ${success} added, ${skipped} skipped, ${errors} errors`);
  await atlasPool.end();
  await ozonePool.end();
}

backfillLabels().catch(console.error);
