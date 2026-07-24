import { AtpAgent } from '@atproto/api';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

const blueskyAgent = new AtpAgent({ service: 'https://bsky.social' });
const ozoneAgent = new AtpAgent({ service: 'http://localhost:3000' });
const labelerDid = process.env.LABELER_DID || 'did:plc:l37i5se642dgeb7kmrdwoqv4';
const ozonePassword = '208022ff959105c20d4c76269206eeb6';
const blueskyHandle = process.env.BLUESKY_HANDLE || 'atls.city';
const blueskyPassword = process.env.BLUESKY_PASSWORD;

async function getLabelsFromOzone(did) {
  try {
    const response = await blueskyAgent.com.atproto.label.queryLabels({
      uriPatterns: [did],
      sources: [labelerDid]
    });
    return response.data.labels?.map(l => l.val) || [];
  } catch (error) {
    return [];
  }
}

async function addOzoneLabel(did, label) {
  await ozoneAgent.api.tools.ozone.moderation.emitEvent(
    {
      event: {
        $type: 'tools.ozone.moderation.defs#modEventLabel',
        createLabelVals: [label],
        negateLabelVals: [],
        comment: 'Backfill missing label'
      },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did
      },
      createdBy: labelerDid
    },
    { encoding: 'application/json', headers: { 'atproto-proxy': `${labelerDid}#atproto_labeler` } }
  );
}

async function backfill() {
  console.log('Logging into Bluesky for label queries...');
  await blueskyAgent.login({
    identifier: blueskyHandle,
    password: blueskyPassword
  });
  
  // Copy Bluesky session to Ozone agent so it has a JWT
  ozoneAgent.session = blueskyAgent.session;
  
  console.log('Logged in successfully\n');

  const result = await pool.query(`
    SELECT DISTINCT ul.did, l.key, l.display_key
    FROM user_labels ul
    JOIN locations l ON ul.location_id = l.id
    WHERE ul.active = true
    ORDER BY ul.did
  `);

  console.log(`Found ${result.rows.length} active labels in database\n`);

  const userLabels = new Map();
  for (const row of result.rows) {
    if (!userLabels.has(row.did)) {
      userLabels.set(row.did, []);
    }
    userLabels.get(row.did).push(row.display_key || row.key);
  }

  let processed = 0;
  let added = 0;
  let skipped = 0;

  for (const [did, dbLabels] of userLabels) {
    processed++;
    console.log(`[${processed}/${userLabels.size}] Checking ${did}...`);

    const ozoneLabels = await getLabelsFromOzone(did);
    const ozoneLabelSet = new Set(ozoneLabels.map(l => l.toLowerCase()));

    const missing = dbLabels.filter(label => !ozoneLabelSet.has(label.toLowerCase()));

    if (missing.length === 0) {
      console.log(`  ✓ All ${dbLabels.length} labels present in Ozone`);
      skipped++;
    } else {
      console.log(`  Missing ${missing.length} labels: ${missing.join(', ')}`);
      for (const label of missing) {
        try {
          await addOzoneLabel(did, label.toLowerCase());
          console.log(`  ✓ Added: ${label}`);
          added++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`  ✗ Failed to add ${label}:`, error.message);
        }
      }
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Users processed: ${processed}`);
  console.log(`  Users skipped (all labels present): ${skipped}`);
  console.log(`  Labels added: ${added}`);

  await pool.end();
}

backfill().catch(console.error);
