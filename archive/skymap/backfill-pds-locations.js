#!/usr/bin/env node
// One-time backfill: sync existing user labels to their PDS.
// Only works for users who have an OAuth session stored.
// Usage: node backfill-pds-locations.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const { NodeOAuthClient } = require('@atproto/oauth-client-node');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const publicUrl = process.env.BASE_URL || 'https://atls.city';

const oauthSessionStore = {
  async get(sub) {
    const r = await pool.query('SELECT value FROM oauth_session WHERE key = $1', [sub]);
    return r.rows[0] ? JSON.parse(r.rows[0].value) : undefined;
  },
  async set(sub, value) {
    const json = JSON.stringify(value);
    await pool.query('INSERT INTO oauth_session (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()', [sub, json]);
  },
  async del(sub) { await pool.query('DELETE FROM oauth_session WHERE key = $1', [sub]); },
};

const oauthStateStore = {
  async get(key) { return undefined; },
  async set() {},
  async del() {},
};

const oauthClient = new NodeOAuthClient({
  clientMetadata: {
    client_id: `${publicUrl}/oauth/oauth-client-metadata.json`,
    client_name: 'ATlas',
    client_uri: publicUrl,
    redirect_uris: [`${publicUrl}/oauth/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto repo:app.bsky.feed.post repo:city.atlas.* blob:*/*',
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  },
  stateStore: oauthStateStore,
  sessionStore: oauthSessionStore,
});

const { syncLocationsToPds } = require('./services/web-directory/routes/pds-location');

async function main() {
  // Get all DIDs that have active labels
  const result = await pool.query(
    'SELECT DISTINCT did FROM user_labels WHERE active = true'
  );

  console.log(`Found ${result.rows.length} users with active labels`);

  let synced = 0, skipped = 0, failed = 0;

  for (const row of result.rows) {
    try {
      await syncLocationsToPds(oauthClient, row.did, pool);
      synced++;
    } catch (e) {
      if (e.message?.includes('No OAuth') || e.message?.includes('restore')) {
        skipped++;
      } else {
        failed++;
        console.error(`Failed for ${row.did}:`, e.message);
      }
    }
  }

  console.log(`Done. Synced: ${synced}, Skipped (no OAuth session): ${skipped}, Failed: ${failed}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
