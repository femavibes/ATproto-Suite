import { AtpAgent } from '@atproto/api';
import pg from 'pg';
const { Pool } = pg;

class ListManager {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.rateLimitDelay = 2000;
  }

  async login() {
    await this.agent.login({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_PASSWORD
    });
  }

  async createList(locationId, bucketNumber = 1) {
    const location = await this.pool.query(
      'SELECT * FROM locations WHERE id = $1',
      [locationId]
    );
    
    if (!location.rows.length) throw new Error('Location not found');
    
    const loc = location.rows[0];
    const listName = `${loc.name}${loc.population ? `, ${loc.region_name}` : ''} ${bucketNumber.toString().padStart(3, '0')}`;
    
    const response = await this.agent.api.app.bsky.graph.list.create(
      { repo: this.agent.session.did },
      {
        name: listName,
        purpose: 'app.bsky.graph.defs#curatelist',
        description: `Geographic list for ${loc.name} (${loc.key})`,
        createdAt: new Date().toISOString()
      }
    );
    
    const rkey = response.uri.split('/').pop();
    const listUrl = `https://bsky.app/profile/${this.agent.session.did}/lists/${rkey}`;
    
    await this.pool.query(
      'INSERT INTO bluesky_lists (location_id, list_url, list_rkey, bucket_number) VALUES ($1, $2, $3, $4)',
      [locationId, listUrl, rkey, bucketNumber]
    );
    
    console.log(`Created list: ${listName} (${listUrl})`);
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    return { listUrl, rkey };
  }

  async addUserToList(did, locationId) {
    // Check for available list (under 3000 members) that belongs to current account
    let availableList = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND member_count < max_members AND active = true ORDER BY bucket_number LIMIT 1',
      [locationId]
    );
    
    // Filter out lists that don't belong to current account
    if (availableList.rows.length > 0) {
      const list = availableList.rows[0];
      // Check if list URL contains current account's DID
      if (!list.list_url.includes(this.agent.session.did)) {
        console.log(`List ${list.list_url} belongs to different account, creating new list`);
        availableList.rows = []; // Clear to trigger new list creation
      }
    }
    
    // If no available list, create one
    if (!availableList.rows.length) {
      const maxBucket = await this.pool.query(
        'SELECT MAX(bucket_number) as max_bucket FROM bluesky_lists WHERE location_id = $1',
        [locationId]
      );
      
      const newBucketNumber = (maxBucket.rows[0]?.max_bucket || 0) + 1;
      await this.createList(locationId, newBucketNumber);
      
      availableList = await this.pool.query(
        'SELECT * FROM bluesky_lists WHERE location_id = $1 AND bucket_number = $2',
        [locationId, newBucketNumber]
      );
    }
    
    const list = availableList.rows[0];
    
    await this.agent.api.app.bsky.graph.listitem.create(
      { repo: this.agent.session.did },
      {
        subject: did,
        list: `at://${this.agent.session.did}/app.bsky.graph.list/${list.list_rkey}`,
        createdAt: new Date().toISOString()
      }
    );
    
    await this.pool.query(
      'UPDATE bluesky_lists SET member_count = member_count + 1, updated_at = NOW() WHERE id = $1',
      [list.id]
    );
    
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  async removeUserFromList(did, locationId) {
    const lists = await this.pool.query(
      'SELECT * FROM bluesky_lists WHERE location_id = $1 AND active = true',
      [locationId]
    );
    
    for (const list of lists.rows) {
      try {
        const listItems = await this.agent.api.app.bsky.graph.listitem.list({
          repo: this.agent.session.did,
          limit: 100
        });
        
        const itemToDelete = listItems.records.find(item => 
          item.value.subject === did && 
          item.value.list === `at://${this.agent.session.did}/app.bsky.graph.list/${list.list_rkey}`
        );
        
        if (itemToDelete) {
          const rkey = itemToDelete.uri.split('/').pop();
          await this.agent.api.app.bsky.graph.listitem.delete({
            repo: this.agent.session.did,
            rkey
          });
          
          await this.pool.query(
            'UPDATE bluesky_lists SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW() WHERE id = $1',
            [list.id]
          );
          
          await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
          break;
        }
      } catch (error) {
        console.error('Error removing user from list:', error);
      }
    }
  }
}

export { ListManager };