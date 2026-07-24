#!/usr/bin/env node
const { Pool } = require('pg');
const { AtpAgent } = require('@atproto/api');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const agent = new AtpAgent({ service: 'https://bsky.social' });

async function syncLabels() {
  console.log('Authenticating...');
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_PASSWORD
  });

  console.log('Fetching active labels from database...');
  const result = await pool.query(`
    SELECT ul.did, l.key, l.display_key
    FROM user_labels ul
    JOIN locations l ON ul.location_id = l.id
    WHERE ul.active = true
  `);

  console.log(`Found ${result.rows.length} labels to sync`);

  for (const row of result.rows) {
    const labelKey = (row.display_key || row.key).toLowerCase();
    try {
      await agent.api.tools.ozone.moderation.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [labelKey],
            negateLabelVals: [],
            comment: 'Label synced from database'
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: row.did
          },
          createdBy: process.env.LABELER_DID
        },
        { encoding: 'application/json', headers: { 'atproto-proxy': `${process.env.LABELER_DID}#atproto_labeler` } }
      );
      console.log(`✓ ${row.did} -> ${labelKey}`);
    } catch (error) {
      console.error(`✗ ${row.did} -> ${labelKey}: ${error.message}`);
    }
  }

  await pool.end();
  console.log('Done!');
}

syncLabels().catch(console.error);
