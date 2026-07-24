const { AtpAgent } = require('@atproto/api');
const { Pool } = require('pg');

class ListManager {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.rateLimitDelay = 45000; // 45 seconds - ultra conservative
  }

  async login() {
    // Use handle directly instead of trying to resolve from DID
    const identifier = process.env.BLUESKY_HANDLE;
    
    if (!identifier) {
      throw new Error('BLUESKY_HANDLE environment variable is required');
    }
    
    await this.agent.login({
      identifier,
      password: process.env.BLUESKY_PASSWORD
    });
  }

  getOverprovisionCount(population) {
    if (!population) return 2;
    if (population < 100000) return 2;
    if (population < 500000) return 4;
    return 6;
  }

  async createList(locationId, bucketNumber = 1) {
    const location = await this.pool.query(
      'SELECT * FROM locations WHERE id = $1',
      [locationId]
    );
    
    if (!location.rows.length) throw new Error('Location not found');
    
    // Check if list already exists for this location and bucket
    const existingList = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND bucket_number = $2 AND active = true',
      [locationId, bucketNumber]
    );
    
    if (existingList.rows.length > 0) {
      console.log(`List already exists for location ${locationId}, bucket ${bucketNumber}`);
      return { 
        listUrl: existingList.rows[0].list_url, 
        rkey: existingList.rows[0].list_rkey,
        skipped: true
      };
    }
    
    const loc = location.rows[0];
    const listName = `${loc.name}${loc.population ? `, ${loc.region_name}` : ''} ${bucketNumber.toString().padStart(3, '0')}`;
    
    console.log(`Creating list for ${loc.name} (ID: ${locationId})`);
    
    const response = await this.agent.com.atproto.repo.createRecord({
      repo: this.agent.session.did,
      collection: 'app.bsky.graph.list',
      record: {
        name: listName,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: `Geographic list for ${loc.name}${loc.population ? `, ${loc.region_name}` : ''} (${loc.key})`,
        createdAt: new Date().toISOString()
      }
    });
    
    // Extract rkey from URI: at://did:plc:xxx/app.bsky.graph.list/RKEY
    const rkey = response.data.uri.split('/').pop();
    
    if (!rkey) {
      throw new Error('Could not extract rkey from URI: ' + response.data.uri);
    }
    
    const listUrl = `https://bsky.app/profile/${this.agent.session.did}/lists/${rkey}`;
    
    console.log(`Inserting into database: locationId=${locationId}, listUrl=${listUrl}, rkey=${rkey}`);
    
    await this.pool.query(
      'INSERT INTO bluesky_lists (location_id, list_url, list_rkey, bucket_number) VALUES ($1, $2, $3, $4) ON CONFLICT (location_id, bucket_number) DO NOTHING',
      [locationId, listUrl, rkey, bucketNumber]
    );
    
    console.log(`Successfully created list for ${loc.name}`);
    
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    return { listUrl, rkey };
  }

  async ensureListsForLocation(locationId) {
    const location = await this.pool.query(
      'SELECT * FROM locations WHERE id = $1',
      [locationId]
    );
    
    if (!location.rows.length) return;
    
    const loc = location.rows[0];
    const overprovisionCount = this.getOverprovisionCount(loc.population);
    
    const existingLists = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND active = true ORDER BY bucket_number',
      [locationId]
    );
    
    const neededLists = Math.max(1, overprovisionCount) - existingLists.rows.length;
    
    for (let i = 0; i < neededLists; i++) {
      // Find the lowest available bucket number
      const existingBuckets = existingLists.rows.map(row => row.bucket_number);
      let bucketNumber = 1;
      while (existingBuckets.includes(bucketNumber)) {
        bucketNumber++;
      }
      await this.createList(locationId, bucketNumber);
      // Add to existing list to avoid duplicates in next iteration
      existingLists.rows.push({ bucket_number: bucketNumber });
    }
  }

  async addUserToList(did, locationId) {
    const availableList = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND member_count < max_members AND active = true ORDER BY bucket_number LIMIT 1',
      [locationId]
    );
    
    if (!availableList.rows.length) {
      const maxBucket = await this.pool.query(
        'SELECT MAX(bucket_number) as max_bucket FROM bluesky_lists WHERE location_id = $1',
        [locationId]
      );
      
      const newBucketNumber = (maxBucket.rows[0]?.max_bucket || 0) + 1;
      await this.createList(locationId, newBucketNumber);
      
      return this.addUserToList(did, locationId);
    }
    
    const list = availableList.rows[0];
    
    await this.agent.com.atproto.repo.createRecord({
      repo: this.agent.session.did,
      collection: 'app.bsky.graph.listitem',
      record: {
        subject: did,
        list: `at://${this.agent.session.did}/app.bsky.graph.list/${list.list_rkey}`,
        createdAt: new Date().toISOString()
      }
    });
    
    await this.pool.query(
      'UPDATE bluesky_lists SET member_count = member_count + 1, updated_at = NOW() WHERE id = $1',
      [list.id]
    );
    
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  async getListsForLocation(locationId) {
    const result = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND active = true ORDER BY bucket_number',
      [locationId]
    );
    return result.rows;
  }
}

module.exports = { ListManager };