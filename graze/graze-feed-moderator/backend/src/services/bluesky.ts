import { AtpAgent } from '@atproto/api';
import { User } from '../types/index.js';
import { ZeroTrustProxyClient } from './zeroTrustProxy.js';

export class BlueskyService {
  private static agentCache = new Map<number, AtpAgent>();
  private agents = BlueskyService.agentCache;
  
  static clearUserAgent(userId: number): void {
    BlueskyService.agentCache.delete(userId);
  }

  async banUser(userHandle: string, listUri: string, user: User): Promise<string> {
    const agent = await this.getAgent(user);
    
    // Resolve the target user's DID
    const targetUser = await agent.resolveHandle({ handle: userHandle });
    const targetDid = targetUser.data.did;
    
    // Convert Bluesky URL to AT-URI if needed
    const atUri = this.convertListUrlToAtUri(listUri);
    
    // Add user to the specified list
    await agent.com.atproto.repo.createRecord({
      repo: user.did,
      collection: 'app.bsky.graph.listitem',
      record: {
        subject: targetDid,
        list: atUri,
        createdAt: new Date().toISOString()
      }
    });
    
    console.log(`Added ${userHandle} to ban list: ${atUri}`);
    return atUri;
  }

  async getUserRecentPosts(userHandle: string, limit: number, user: User): Promise<string[]> {
    try {
      // Resolve handle to DID first
      const resolveResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${userHandle}`);
      const resolveData = await resolveResponse.json();
      const targetDid = resolveData.did;
      
      // Get the user's PDS from their DID document
      const repoResponse = await fetch(`https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${targetDid}`);
      const repoData = await repoResponse.json();
      
      // Extract PDS endpoint from DID document
      let pdsEndpoint = 'https://bsky.social';
      if (repoData.didDoc?.service) {
        const pdsService = repoData.didDoc.service.find((s: any) => s.type === 'AtprotoPersonalDataServer');
        if (pdsService?.serviceEndpoint) {
          pdsEndpoint = pdsService.serviceEndpoint;
        }
      }
      
      console.log(`Using PDS ${pdsEndpoint} for user ${userHandle}`);
      
      // Get recent posts from the correct PDS
      const postsResponse = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${targetDid}&collection=app.bsky.feed.post&limit=${limit}`);
      const postsData = await postsResponse.json();
      
      if (postsData.records) {
        return postsData.records.map((record: any) => record.uri);
      } else {
        console.warn(`No records found for ${userHandle} on ${pdsEndpoint}`);
        return [];
      }
    } catch (error) {
      console.error(`Failed to get recent posts for ${userHandle}:`, error);
      return [];
    }
  }

  async unbanUser(userHandle: string, listType: 'global' | string, user: User): Promise<void> {
    const agent = await this.getAgent(user);
    
    // Resolve the target user's DID
    const targetUser = await agent.resolveHandle({ handle: userHandle });
    const targetDid = targetUser.data.did;
    
    // Get the ban list URI
    const listUri = await this.getBanListUri(user, listType);
    if (!listUri) {
      throw new Error('Ban list not found');
    }
    
    // Convert to AT-URI if needed
    const atUri = this.convertListUrlToAtUri(listUri);
    
    // Find and delete the list item
    const listItems = await agent.com.atproto.repo.listRecords({
      repo: user.did,
      collection: 'app.bsky.graph.listitem'
    });
    
    const itemToDelete = listItems.data.records.find(record => 
      (record.value as any).subject === targetDid && (record.value as any).list === atUri
    );
    
    if (itemToDelete) {
      await agent.com.atproto.repo.deleteRecord({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        rkey: itemToDelete.uri.split('/').pop()!
      });
    }
  }

  async getListMembers(listUri: string, user: User): Promise<string[]> {
    const agent = await this.getAgent(user);
    
    // Convert to AT-URI if needed
    const atUri = this.convertListUrlToAtUri(listUri);
    
    const listItems = await agent.com.atproto.repo.listRecords({
      repo: user.did,
      collection: 'app.bsky.graph.listitem'
    });
    
    return listItems.data.records
      .filter(record => (record.value as any).list === atUri)
      .map(record => (record.value as any).subject);
  }

  async syncBanLists(user: User, specificListType?: string): Promise<{added: number, removed: number}> {
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    
    let added = 0, removed = 0;
    
    // Get all ban lists or specific list
    let lists = await this.getBanLists(user);
    if (specificListType) {
      lists = lists.filter(l => l.type === specificListType);
    }
    console.log('Syncing lists:', lists);
    
    for (const list of lists) {
      console.log(`Processing list: ${list.name} (${list.type})`);
      
      // Get members from Bluesky list
      const blueskyMembers = await this.getListMembers(list.uri, user);
      console.log(`Bluesky members for ${list.name}:`, blueskyMembers);
      
      // Get members from database
      const dbMembers = await db.getBannedUsersByList(user.id, list.type);
      console.log(`DB members for ${list.type}:`, dbMembers.map(u => u.banned_did));
      const dbDids = new Set(dbMembers.map(u => u.banned_did).filter(Boolean));
      
      // Add missing users to database
      for (const did of blueskyMembers) {
        if (!dbDids.has(did)) {
          try {
            // Resolve DID to handle
            const agent = await this.getAgent(user);
            const profile = await agent.com.atproto.repo.describeRepo({ repo: did });
            const handle = profile.data.handle;
            
            console.log(`Adding ${handle} (${did}) to database`);
            await db.banUser(user.id, handle, did, list.type, null, 'synced_from_bluesky', user.did);
            added++;
          } catch (error) {
            console.error(`Failed to sync user ${did}:`, error);
          }
        }
      }
      
      // Remove users from database that aren't in Bluesky list
      const blueskyDids = new Set(blueskyMembers);
      for (const dbUser of dbMembers) {
        if (dbUser.banned_did && !blueskyDids.has(dbUser.banned_did)) {
          console.log(`Removing ${dbUser.banned_handle} from database`);
          await db.getPool().query(
            'DELETE FROM banned_users WHERE user_id = $1 AND banned_did = $2 AND list_type = $3',
            [user.id, dbUser.banned_did, list.type]
          );
          removed++;
        }
      }
    }
    
    console.log(`Sync complete: ${added} added, ${removed} removed`);
    return { added, removed };
  }

  async getPostDetails(postUri: string): Promise<any> {
    console.log(`Getting post details for: ${postUri}`);
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    
    // Check cache first with JOIN
    const cached = await db.getPool().query(`
      SELECT p.*, up.did, up.handle, up.display_name, up.avatar_url
      FROM posts p
      JOIN user_profiles up ON p.author_id = up.id
      WHERE p.post_uri = $1
    `, [postUri]);
    
    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      
      // If profile data is missing or old, update it
      if (!row.handle || !row.display_name || new Date(row.updated_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        await this.updateUserProfile(row.did);
        
        // Re-fetch after update
        const updated = await db.getPool().query(`
          SELECT p.*, up.did, up.handle, up.display_name, up.avatar_url
          FROM posts p
          JOIN user_profiles up ON p.author_id = up.id
          WHERE p.post_uri = $1
        `, [postUri]);
        
        if (updated.rows.length > 0) {
          const updatedRow = updated.rows[0];
          return {
            text: updatedRow.text_content,
            author: {
              did: updatedRow.did,
              handle: updatedRow.handle,
              displayName: updatedRow.display_name,
              avatar: updatedRow.avatar_url
            },
            createdAt: updatedRow.created_at,
            images: updatedRow.images || [],
            videos: updatedRow.videos || [],
            embeds: updatedRow.embeds || [],
            replyTo: updatedRow.reply_to,
            quotePost: updatedRow.quote_post
          };
        }
      }
      
      return {
        text: row.text_content,
        author: {
          did: row.did,
          handle: row.handle,
          displayName: row.display_name,
          avatar: row.avatar_url
        },
        createdAt: row.created_at,
        images: row.images || [],
        videos: row.videos || [],
        embeds: row.embeds || [],
        replyTo: row.reply_to,
        quotePost: row.quote_post
      };
    }
    
    // Fetch from Bluesky
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    
    try {
      const response = await agent.com.atproto.repo.getRecord({
        repo: postUri.split('/')[2],
        collection: 'app.bsky.feed.post',
        rkey: postUri.split('/').pop()!
      });
      
      const post = response.data.value as any;
      const authorDid = postUri.split('/')[2];
      
      // Get or create user profile
      const authorId = await this.getOrCreateUserProfile(authorDid);
      
      // Extract media and embeds
      let images: any[] = [];
      let videos: any[] = [];
      let embeds: any[] = [];
      
      if (post.embed) {
        console.log('Post embed data:', JSON.stringify(post.embed, null, 2));
        if (post.embed.$type === 'app.bsky.embed.images') {
          images = post.embed.images.map((img: any) => ({
            thumb: img.image?.ref?.$link ? `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${img.image.ref.$link}` : img.thumb,
            fullsize: img.image?.ref?.$link ? `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${img.image.ref.$link}` : img.fullsize,
            alt: img.alt || ''
          }));
        } else if (post.embed.$type === 'app.bsky.embed.video') {
          videos = [post.embed];
        } else if (post.embed.$type === 'app.bsky.embed.external') {
          const external = post.embed.external;
          embeds = [{ 
            type: 'external',
            uri: external.uri,
            title: external.title,
            description: external.description,
            thumb: external.thumb?.ref?.$link ? `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${external.thumb.ref.$link}` : external.thumb
          }];
        } else {
          embeds = [{ type: post.embed.$type, ...post.embed }];
        }
      }
      
      // Cache the post with media
      await db.getPool().query(`
        INSERT INTO posts (post_uri, author_id, text_content, created_at, images, videos, embeds, reply_to, quote_post)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (post_uri) DO UPDATE SET
          text_content = EXCLUDED.text_content,
          images = EXCLUDED.images,
          videos = EXCLUDED.videos,
          embeds = EXCLUDED.embeds,
          reply_to = EXCLUDED.reply_to,
          quote_post = EXCLUDED.quote_post,
          cached_at = CURRENT_TIMESTAMP
      `, [
        postUri, 
        authorId, 
        post.text || '', 
        post.createdAt,
        JSON.stringify(images),
        JSON.stringify(videos),
        JSON.stringify(embeds),
        post.reply?.parent?.uri || null,
        post.embed?.record?.uri || null
      ]);
      
      // Get the author profile for return
      const authorProfile = await db.getPool().query(
        'SELECT * FROM user_profiles WHERE id = $1',
        [authorId]
      );
      const author = authorProfile.rows[0];
      
      return {
        text: post.text || '',
        author: {
          did: author.did,
          handle: author.handle,
          displayName: author.display_name,
          avatar: author.avatar_url
        },
        createdAt: post.createdAt
      };
    } catch (error) {
      console.error('Failed to get post details:', error);
      return null;
    }
  }

  async getOrCreateUserProfile(authorDid: string): Promise<number> {
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    
    // Check if user exists
    const existing = await db.getPool().query(
      'SELECT id FROM user_profiles WHERE did = $1',
      [authorDid]
    );
    
    if (existing.rows.length > 0) {
      // Update if older than 1 day
      const needsUpdate = await db.getPool().query(
        'SELECT id FROM user_profiles WHERE did = $1 AND updated_at < NOW() - INTERVAL \'1 day\'',
        [authorDid]
      );
      
      if (needsUpdate.rows.length > 0) {
        await this.updateUserProfile(authorDid);
      }
      
      return existing.rows[0].id;
    }
    
    // Create new user profile
    try {
      const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${authorDid}`);
      const profile = await profileResponse.json();
      
      const result = await db.getPool().query(`
        INSERT INTO user_profiles (did, handle, display_name, avatar_url, subscription_tier)
        VALUES ($1, $2, $3, $4, 'none')
        RETURNING id
      `, [authorDid, profile.handle, profile.displayName, profile.avatar || profile.avatarUrl]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      
      // Create minimal profile
      const result = await db.getPool().query(`
        INSERT INTO user_profiles (did, handle, subscription_tier)
        VALUES ($1, $2, 'none')
        RETURNING id
      `, [authorDid, 'unknown']);
      
      return result.rows[0].id;
    }
  }

  async updateUserProfile(authorDid: string): Promise<void> {
    console.log(`Updating user profile for: ${authorDid}`);
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    
    try {
      const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${authorDid}`);
      const profile = await profileResponse.json();
      
      await db.getPool().query(`
        UPDATE user_profiles 
        SET handle = $2, display_name = $3, avatar_url = $4, updated_at = CURRENT_TIMESTAMP
        WHERE did = $1
      `, [authorDid, profile.handle, profile.displayName, profile.avatar || profile.avatarUrl]);
    } catch (error) {
      console.error('Failed to update user profile:', error);
    }
  }

  async getBanLists(user: User): Promise<Array<{type: string, uri: string, name: string}>> {
    const { Database } = await import('./database.js');
    const db = Database.getInstance();
    
    const banLists = [];
    
    // Get global ban list from user settings
    const userRecord = await db.getUserProfileById(user.id);
    if (userRecord?.global_ban_list) {
      banLists.push({
        type: 'global',
        uri: userRecord.global_ban_list,
        name: 'Global Ban List'
      });
    }
    
    // Get per-feed ban lists
    const feeds = await db.getUserFeeds(user.id);
    for (const feed of feeds) {
      if (feed.feed_ban_list) {
        banLists.push({
          type: feed.feed_id,
          uri: feed.feed_ban_list,
          name: `${feed.feed_name} Ban List`
        });
      }
    }
    
    console.log('Found ban lists:', banLists);
    return banLists;
  }

  private async getOrCreateBanList(agent: AtpAgent, user: User, listType: 'global' | string): Promise<string> {
    const listName = listType === 'global' ? 'Banned Users' : `Banned Users - ${listType}`;
    
    // Check if list already exists
    const existingLists = await this.getBanLists(user);
    const existingList = existingLists.find(list => list.name === listName);
    
    if (existingList) {
      return existingList.uri;
    }
    
    // Create new list
    const response = await agent.com.atproto.repo.createRecord({
      repo: user.did,
      collection: 'app.bsky.graph.list',
      record: {
        name: listName,
        description: `Users banned from ${listType === 'global' ? 'all feeds' : listType}`,
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString()
      }
    });
    
    return response.data.uri;
  }

  private async getBanListUri(user: User, listType: 'global' | string): Promise<string | null> {
    const lists = await this.getBanLists(user);
    const list = lists.find(l => l.type === listType);
    return list?.uri || null;
  }

  private convertListUrlToAtUri(listUri: string): string {
    // If already an AT-URI, return as is
    if (listUri.startsWith('at://')) {
      return listUri;
    }
    
    // Convert Bluesky URL to AT-URI
    // https://bsky.app/profile/did:plc:xxx/lists/listid -> at://did:plc:xxx/app.bsky.graph.list/listid
    const match = listUri.match(/https:\/\/bsky\.app\/profile\/(did:[^/]+)\/lists\/([^/?]+)/);
    if (match) {
      const [, did, listId] = match;
      return `at://${did}/app.bsky.graph.list/${listId}`;
    }
    
    // If it doesn't match expected format, return as is and let the API handle the error
    return listUri;
  }

  private async getAgent(user: User): Promise<AtpAgent> {
    // Zero-trust mode: get tokens from user's proxy
    if (user.zero_trust_mode && user.zero_trust_proxy_url && user.zero_trust_api_key) {
      return this.getZeroTrustAgent(user);
    }

    // Check if user has basic password without zero trust - this won't work
    if (user.password_type === 'basic' && !user.zero_trust_mode) {
      throw new Error(`Cannot authenticate: You have a basic password but zero trust is disabled. Please set a Bluesky app password or enable zero trust mode.`);
    }

    // Check cached agent
    const cached = this.agents.get(user.id);
    if (cached) {
      return cached;
    }

    if (!user.bsky_password) {
      throw new Error(`No Bluesky credentials stored for user ${user.handle}`);
    }

    // Decrypt password
    const { GrazeService } = await import('./graze.js');
    const decryptedPassword = await GrazeService.decryptPassword(user.bsky_password);
    
    // Create and authenticate agent
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: user.handle,
      password: decryptedPassword
    });
    
    // Cache agent
    this.agents.set(user.id, agent);
    
    console.log(`Authenticated Bluesky agent for user ${user.handle}`);
    return agent;
  }

  private async getZeroTrustAgent(user: User): Promise<AtpAgent> {
    try {
      const client = new ZeroTrustProxyClient(user.zero_trust_proxy_url!, user.zero_trust_api_key!, user.handle!);
      const auth = await client.getBlueskyToken('LIST_MANAGEMENT');
      
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      agent.session = {
        did: user.did,
        handle: user.handle!,
        accessJwt: auth.accessToken!,
        refreshJwt: auth.refreshToken!,
        active: true
      };
      
      this.agents.set(user.id, agent);
      return agent;
    } catch (error) {
      throw new Error('Zero-trust proxy offline');
    }
  }
}