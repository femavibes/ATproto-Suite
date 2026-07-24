const COLLECTION = 'city.atlas.actor.location';
const RKEY = 'self';

async function syncLocationsToPds(oauthClient, did, pool) {
  let oauthSession;
  try {
    oauthSession = await oauthClient.restore(did);
  } catch {
    console.log(`[pds-location] No OAuth session for ${did}, skipping PDS sync`);
    return;
  }

  const result = await pool.query(`
    SELECT l.key, l.display_key, l.name, l.region_name, l.country_code, l.osm_id, l.osm_type, ul.is_primary, ul.created_at
    FROM user_labels ul
    JOIN locations l ON ul.location_id = l.id
    WHERE ul.did = $1 AND ul.active = true
    ORDER BY ul.is_primary DESC, ul.created_at ASC
  `, [did]);

  const now = new Date().toISOString();

  if (result.rows.length === 0) {
    // No locations — delete the record
    try {
      await oauthSession.fetchHandler('/xrpc/com.atproto.repo.deleteRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: did, collection: COLLECTION, rkey: RKEY })
      });
      console.log(`[pds-location] Deleted record for ${did}`);
    } catch (e) {
      // Record may not exist, that's fine
      if (!e.message?.includes('RecordNotFound')) {
        console.error(`[pds-location] Delete failed for ${did}:`, e.message);
      }
    }
    return;
  }

  const locations = result.rows.map(row => ({
    address: {
      $type: 'community.lexicon.location.address',
      country: row.country_code || 'US',
      ...(row.region_name && { region: row.region_name }),
      ...(row.name && { locality: row.name }),
      name: [row.name, row.region_name].filter(Boolean).join(', ')
    },
    atlasKey: row.display_key || row.key,
    ...(row.osm_id && { osmId: row.osm_id }),
    ...(row.osm_type && { osmType: row.osm_type }),
    isPrimary: row.is_primary,
    addedAt: row.created_at.toISOString()
  }));

  const record = {
    $type: COLLECTION,
    locations,
    updatedAt: now
  };

  try {
    const res = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.putRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: did,
        collection: COLLECTION,
        rkey: RKEY,
        record
      })
    });

    if (res.ok) {
      console.log(`[pds-location] Synced ${locations.length} location(s) for ${did}`);
    } else {
      const errBody = await res.text();
      console.error(`[pds-location] putRecord failed (${res.status}):`, errBody);
    }
  } catch (e) {
    console.error(`[pds-location] Sync failed for ${did}:`, e.message);
  }
}

module.exports = { syncLocationsToPds };
