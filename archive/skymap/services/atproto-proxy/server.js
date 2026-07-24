const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3010;
const DID = 'did:web:lists.fema.monster';

app.set('trust proxy', true);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: 'TooManyRequests', message: 'Rate limit exceeded' }
});
app.use(limiter);

// DID Document endpoint
app.get('/.well-known/did.json', (req, res) => {
  res.json({
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: DID,
    service: [{
      id: '#atproto_pds',
      type: 'AtprotoPersonalDataServer',
      serviceEndpoint: 'https://lists.fema.monster'
    }]
  });
});

// XRPC: Get list record
app.get('/xrpc/com.atproto.repo.getRecord', async (req, res) => {
  try {
    const { repo, collection, rkey } = req.query;

    if (repo !== DID) {
      return res.status(404).json({ error: 'RepoNotFound', message: 'Repository not found' });
    }

    if (collection !== 'app.bsky.graph.list') {
      return res.status(404).json({ error: 'RecordNotFound', message: 'Collection not supported' });
    }

    // Get location info - check both key and display_key
    const locationResult = await pool.query(
      'SELECT id, name, key, display_key, display_name FROM locations WHERE key = $1 OR display_key = $1',
      [rkey]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'RecordNotFound', message: 'List not found' });
    }

    const location = locationResult.rows[0];
    const listKey = location.display_key || location.key;
    const listName = location.display_name || location.name;

    res.json({
      uri: `at://${DID}/app.bsky.graph.list/${listKey}`,
      cid: 'bafyreib2rxk3rh6kzwq',
      value: {
        $type: 'app.bsky.graph.list',
        name: listName,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: `SkyMap location list for ${listName}`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in getRecord:', error);
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

// XRPC: List records (get list items)
app.get('/xrpc/com.atproto.repo.listRecords', async (req, res) => {
  try {
    const { repo, collection, limit = 100, cursor } = req.query;

    if (repo !== DID) {
      return res.status(404).json({ error: 'RepoNotFound', message: 'Repository not found' });
    }

    if (collection === 'app.bsky.graph.list') {
      // Return all available lists
      const locationsResult = await pool.query(
        'SELECT key, name, display_key, display_name FROM locations WHERE population IS NOT NULL ORDER BY name LIMIT $1',
        [parseInt(limit)]
      );
      
      const records = locationsResult.rows.map(loc => {
        const listKey = loc.display_key || loc.key;
        const listName = loc.display_name || loc.name;
        return {
          uri: `at://${DID}/app.bsky.graph.list/${listKey}`,
          cid: 'bafyreib2rxk3rh6kzwq',
          value: {
            $type: 'app.bsky.graph.list',
            name: listName,
            purpose: 'app.bsky.graph.defs#curatelist',
            description: `SkyMap location list for ${listName}`,
            createdAt: new Date().toISOString()
          }
        };
      });
      
      return res.json({ records, cursor: undefined });
    }

    if (collection === 'app.bsky.graph.listitem') {
      // Return sample listitem to indicate lists have members
      const sampleResult = await pool.query(
        'SELECT ul.did, l.key, l.display_key FROM user_labels ul JOIN locations l ON ul.location_id = l.id WHERE ul.active = true LIMIT 1'
      );
      
      if (sampleResult.rows.length > 0) {
        const sample = sampleResult.rows[0];
        const listKey = sample.display_key || sample.key;
        return res.json({
          records: [{
            uri: `at://${DID}/app.bsky.graph.listitem/sample`,
            cid: 'bafyreib2rxk3rh6kzwq',
            value: {
              $type: 'app.bsky.graph.listitem',
              subject: sample.did,
              list: `at://${DID}/app.bsky.graph.list/${listKey}`,
              createdAt: new Date().toISOString()
            }
          }],
          cursor: undefined
        });
      }
    }

    res.json({ records: [], cursor: undefined });
  } catch (error) {
    console.error('Error in listRecords:', error);
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

// XRPC: Get list members (this is what Graze actually calls)
app.get('/xrpc/app.bsky.graph.getList', async (req, res) => {
  try {
    const { list, limit = 100, cursor } = req.query;
    
    console.log('getList called:', { list, limit, cursor, query: req.query });

    if (!list) {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Missing list parameter' });
    }

    // Parse the list URI: at://did:web:skymap.fema.monster/app.bsky.graph.list/US-OR-Portland
    const match = list.match(/at:\/\/([^\/]+)\/app\.bsky\.graph\.list\/(.+)/);
    
    if (!match || match[1] !== DID) {
      return res.status(404).json({ error: 'ListNotFound', message: 'List not found' });
    }

    const listKey = match[2];
    const offset = cursor ? parseInt(cursor) : 0;

    console.log('Parsed listKey:', listKey, 'includes dash:', listKey.includes('-'));

    // Check if this is an event list (starts with EVT-)
    if (listKey.startsWith('EVT-')) {
      const eventResult = await pool.query(
        'SELECT id, event_id, title, creator_did, show_rsvp_list FROM events WHERE event_id = $1 AND is_active = true',
        [listKey]
      );
      
      if (eventResult.rows.length === 0) {
        return res.status(404).json({ error: 'ListNotFound', message: 'Event not found' });
      }
      
      const event = eventResult.rows[0];
      
      // If RSVP list is private, return empty list
      if (!event.show_rsvp_list) {
        return res.json({
          list: {
            uri: `at://${DID}/app.bsky.graph.list/${event.event_id}`,
            cid: 'bafyreib2rxk3rh6kzwq',
            name: event.title,
            purpose: 'app.bsky.graph.defs#curatelist',
            description: `RSVP list for ${event.title}`,
            indexedAt: new Date().toISOString(),
            creator: DID
          },
          items: [],
          cursor: undefined
        });
      }
      
      // Get RSVP members
      const membersResult = await pool.query(
        `SELECT user_did, created_at FROM event_rsvps 
         WHERE event_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3`,
        [event.event_id, parseInt(limit), offset]
      );
      
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1',
        [event.event_id]
      );
      
      const totalCount = parseInt(countResult.rows[0].count);
      const items = membersResult.rows.map((row, index) => ({
        uri: `at://${DID}/app.bsky.graph.listitem/${offset + index}`,
        subject: row.user_did
      }));
      
      const nextCursor = (offset + items.length < totalCount) ? (offset + items.length).toString() : undefined;
      
      return res.json({
        list: {
          uri: `at://${DID}/app.bsky.graph.list/${event.event_id}`,
          cid: 'bafyreib2rxk3rh6kzwq',
          name: event.title,
          purpose: 'app.bsky.graph.defs#curatelist',
          description: `RSVP list for ${event.title}`,
          indexedAt: new Date().toISOString(),
          creator: DID
        },
        items,
        cursor: nextCursor
      });
    }

    // Check if this is an interest list (no dashes/structure in key)
    if (!listKey.includes('-')) {
      console.log('Handling interest list for:', listKey);
      
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

      return res.json({
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
    }

    // Get location - check both key and display_key
    const locationResult = await pool.query(
      'SELECT id, name, key, display_key, display_name FROM locations WHERE key = $1 OR display_key = $1',
      [listKey]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: 'ListNotFound', message: 'List not found' });
    }

    const location = locationResult.rows[0];
    const locationListKey = location.display_key || location.key;
    const listName = location.display_name || location.name;

    // Get list members
    const membersResult = await pool.query(
      `SELECT ul.did, ul.created_at
       FROM user_labels ul
       WHERE ul.location_id = $1 AND ul.active = true
       ORDER BY ul.created_at
       LIMIT $2 OFFSET $3`,
      [location.id, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_labels WHERE location_id = $1 AND active = true',
      [location.id]
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const items = membersResult.rows.map((row, index) => ({
      uri: `at://${DID}/app.bsky.graph.listitem/${offset + index}`,
      subject: row.did
    }));

    const nextCursor = (offset + items.length < totalCount) ? (offset + items.length).toString() : undefined;

    res.json({
      list: {
        uri: `at://${DID}/app.bsky.graph.list/${locationListKey}`,
        cid: 'bafyreib2rxk3rh6kzwq',
        name: listName,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: `SkyMap location list for ${listName}`,
        indexedAt: new Date().toISOString(),
        creator: DID
      },
      items,
      cursor: nextCursor
    });
  } catch (error) {
    console.error('Error in getList:', error);
    res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', did: DID });
});

// Start server
app.listen(PORT, () => {
  console.log(`AT Protocol proxy running on port ${PORT}`);
  console.log(`DID: ${DID}`);
  console.log(`DID Document: http://localhost:${PORT}/.well-known/did.json`);
});
