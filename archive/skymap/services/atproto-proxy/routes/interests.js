const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

const DID = 'did:web:lists.fema.monster';

// Handle interest list requests
async function handleInterestList(req, res, listKey) {
  const { limit = 100, cursor } = req.query;
  const offset = cursor ? parseInt(cursor) : 0;

  try {
    // Get interest by key
    const interestResult = await pool.query(
      'SELECT id, name, key FROM interests WHERE key = $1 AND active = true',
      [listKey]
    );

    if (interestResult.rows.length === 0) {
      return res.status(404).json({ error: 'ListNotFound', message: 'Interest not found' });
    }

    const interest = interestResult.rows[0];

    // Get list members
    const membersResult = await pool.query(
      `SELECT ui.user_did, ui.created_at
       FROM user_interests ui
       WHERE ui.interest_id = $1
       ORDER BY ui.created_at
       LIMIT $2 OFFSET $3`,
      [interest.id, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_interests WHERE interest_id = $1',
      [interest.id]
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const items = membersResult.rows.map((row, index) => ({
      uri: `at://${DID}/app.bsky.graph.listitem/${offset + index}`,
      subject: row.user_did
    }));

    const nextCursor = (offset + items.length < totalCount) ? (offset + items.length).toString() : undefined;

    res.json({
      list: {
        uri: `at://${DID}/app.bsky.graph.list/${interest.key}`,
        cid: 'bafyreib2rxk3rh6kzwq',
        name: interest.name,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: `SkyMap interest list for ${interest.name}`,
        indexedAt: new Date().toISOString(),
        creator: DID
      },
      items,
      cursor: nextCursor
    });
  } catch (error) {
    console.error('Error in handleInterestList:', error);
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
}

module.exports = { handleInterestList };
