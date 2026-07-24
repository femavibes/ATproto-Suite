import { BlueskyService } from './bluesky.js';
import { Database } from './database.js';
import { User } from '../types/index.js';

export class EnhancedBlueskySync extends BlueskyService {
  private db: Database;

  constructor() {
    super();
    this.db = Database.getInstance();
  }

  // Make getAgent accessible
  protected async getAgentForUser(user: User): Promise<any> {
    return (this as any).getAgent(user);
  }

  /**
   * Enhanced sync that handles bidirectional synchronization and deduplication
   */
  async syncBanListsEnhanced(user: User, specificListType?: string): Promise<{
    added: number, 
    removed: number, 
    deduplicated: number,
    errors: string[]
  }> {
    console.log(`Starting enhanced sync for user ${user.handle}, listType: ${specificListType || 'all'}`);
    
    let totalAdded = 0, totalRemoved = 0, totalDeduplicated = 0;
    const errors: string[] = [];

    try {
      // Start sync tracking
      await this.startSyncTracking(user.id, specificListType || 'all', 'manual');

      // Get all ban lists or specific list
      let lists = await this.getBanLists(user);
      if (specificListType) {
        lists = lists.filter(l => l.type === specificListType);
      }

      if (lists.length === 0) {
        console.log('No ban lists found for user');
        await this.completeSyncTracking(user.id, specificListType || 'all', 'completed', 0, 0);
        return { added: 0, removed: 0, deduplicated: 0, errors: ['No ban lists configured'] };
      }

      console.log(`Processing ${lists.length} ban lists:`, lists.map(l => l.name));

      for (const list of lists) {
        try {
          console.log(`\n=== Processing list: ${list.name} (${list.type}) ===`);
          
          // Step 1: Deduplicate existing database entries
          const deduplicated = await this.deduplicateBanList(user.id, list.type);
          totalDeduplicated += deduplicated;
          if (deduplicated > 0) {
            console.log(`Deduplicated ${deduplicated} entries for ${list.name}`);
          }

          // Step 2: Get members from both sources
          const blueskyMembers = await this.getListMembersWithRetry(list.uri, user);
          const dbMembers = await this.db.getBannedUsersByList(user.id, list.type);
          
          console.log(`Bluesky has ${blueskyMembers.length} members, DB has ${dbMembers.length} members`);

          // Step 3: Sync from Bluesky to Database (add missing)
          const added = await this.syncBlueskyToDatabase(user, list, blueskyMembers, dbMembers);
          totalAdded += added;

          // Step 4: Sync from Database to Bluesky (remove extra)
          const removed = await this.syncDatabaseToBluesky(user, list, blueskyMembers, dbMembers);
          totalRemoved += removed;

        } catch (error) {
          const errorMsg = `Failed to sync list ${list.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Complete sync tracking
      await this.completeSyncTracking(
        user.id, 
        specificListType || 'all', 
        errors.length > 0 ? 'completed_with_errors' : 'completed',
        totalAdded,
        totalRemoved,
        errors.length > 0 ? errors.join('; ') : null
      );

      console.log(`\n=== Sync Summary ===`);
      console.log(`Added: ${totalAdded}, Removed: ${totalRemoved}, Deduplicated: ${totalDeduplicated}`);
      console.log(`Errors: ${errors.length}`);

      return { 
        added: totalAdded, 
        removed: totalRemoved, 
        deduplicated: totalDeduplicated,
        errors 
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Sync failed:', errorMsg);
      
      await this.completeSyncTracking(
        user.id, 
        specificListType || 'all', 
        'failed',
        totalAdded,
        totalRemoved,
        errorMsg
      );

      return { 
        added: totalAdded, 
        removed: totalRemoved, 
        deduplicated: totalDeduplicated,
        errors: [errorMsg] 
      };
    }
  }

  /**
   * Remove duplicate entries from database ban list
   */
  private async deduplicateBanList(userId: number, listType: string): Promise<number> {
    const result = await this.db.getPool().query(`
      WITH duplicates AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, LOWER(banned_handle), list_type 
            ORDER BY banned_at ASC
          ) as rn
        FROM banned_users
        WHERE user_id = $1 AND list_type = $2
      )
      DELETE FROM banned_users 
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `, [userId, listType]);

    return result.rowCount || 0;
  }

  /**
   * Sync users from Bluesky list to database (add missing)
   */
  private async syncBlueskyToDatabase(
    user: User, 
    list: {type: string, uri: string, name: string}, 
    blueskyMembers: string[], 
    dbMembers: any[]
  ): Promise<number> {
    const dbDids = new Set(dbMembers.map(u => u.banned_did).filter(Boolean));
    let added = 0;

    for (const did of blueskyMembers) {
      if (!dbDids.has(did)) {
        try {
          // Resolve DID to handle
          const agent = await this.getAgentForUser(user);
          const profile = await agent.com.atproto.repo.describeRepo({ repo: did });
          const handle = profile.data.handle;

          console.log(`Adding ${handle} (${did}) to database`);
          await this.db.banUser(user.id, handle, did, list.type, null, 'synced_from_bluesky', user.did);
          
          // Log the sync action
          await this.db.logModerationAction({
            account_did: did,
            action: 'sync_ban',
            feed_id: list.type === 'global' ? undefined : list.type,
            moderator_did: user.did,
            reason: `Added during Bluesky sync from ${list.name}`,
            target_handle: handle
          });

          added++;
        } catch (error) {
          console.error(`Failed to sync user ${did} to database:`, error);
          // Mark as sync failed but continue
          try {
            await this.db.getPool().query(
              'INSERT INTO banned_users (user_id, banned_handle, banned_did, list_type, reason, banned_by_did, sync_failed) VALUES ($1, $2, $3, $4, $5, $6, true) ON CONFLICT (user_id, banned_handle, list_type) DO UPDATE SET sync_failed = true',
              [user.id, 'unknown', did, list.type, 'sync_failed', user.did]
            );
          } catch (insertError) {
            console.error('Failed to mark sync failure:', insertError);
          }
        }
      }
    }

    return added;
  }

  /**
   * Sync users from database to Bluesky (remove extra)
   */
  private async syncDatabaseToBluesky(
    user: User, 
    list: {type: string, uri: string, name: string}, 
    blueskyMembers: string[], 
    dbMembers: any[]
  ): Promise<number> {
    const blueskyDids = new Set(blueskyMembers);
    let removed = 0;

    for (const dbUser of dbMembers) {
      if (dbUser.banned_did && !blueskyDids.has(dbUser.banned_did)) {
        try {
          console.log(`Removing ${dbUser.banned_handle} from database (not in Bluesky list)`);
          
          // Remove from database
          await this.db.unbanUser(user.id, dbUser.banned_handle, dbUser.banned_did, list.type);
          
          // Log the removal
          await this.db.logModerationAction({
            account_did: dbUser.banned_did || undefined,
            action: 'sync_unban',
            feed_id: list.type === 'global' ? undefined : list.type,
            moderator_did: user.did,
            reason: `Removed during Bluesky sync - not found in ${list.name}`,
            target_handle: dbUser.banned_handle
          });

          removed++;
        } catch (error) {
          console.error(`Failed to remove user ${dbUser.banned_handle} from database:`, error);
        }
      }
    }

    return removed;
  }

  /**
   * Get list members with retry logic
   */
  private async getListMembersWithRetry(listUri: string, user: User, maxRetries: number = 3): Promise<string[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getListMembers(listUri, user);
      } catch (error) {
        console.error(`Attempt ${attempt} failed to get list members:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return [];
  }

  /**
   * Start sync tracking
   */
  private async startSyncTracking(userId: number, listType: string, syncType: string): Promise<void> {
    await this.db.getPool().query(`
      INSERT INTO sync_tracking (user_id, list_type, sync_type, status, started_at)
      VALUES ($1, $2, $3, 'running', CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, list_type) 
      DO UPDATE SET 
        sync_type = EXCLUDED.sync_type,
        status = 'running',
        started_at = CURRENT_TIMESTAMP,
        completed_at = NULL,
        error_message = NULL
    `, [userId, listType, syncType]);
  }

  /**
   * Complete sync tracking
   */
  private async completeSyncTracking(
    userId: number, 
    listType: string, 
    status: string,
    addedCount: number,
    removedCount: number,
    errorMessage?: string | null
  ): Promise<void> {
    await this.db.getPool().query(`
      UPDATE sync_tracking 
      SET 
        status = $3,
        completed_at = CURRENT_TIMESTAMP,
        added_count = $4,
        removed_count = $5,
        error_message = $6,
        last_sync_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND list_type = $2
    `, [userId, listType, status, addedCount, removedCount, errorMessage]);
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: number, listType?: string): Promise<any[]> {
    let query = `
      SELECT 
        st.*,
        CASE 
          WHEN st.list_type = 'global' THEN 'Global Ban List'
          ELSE COALESCE(f.feed_name, st.list_type)
        END as list_name
      FROM sync_tracking st
      LEFT JOIN feeds f ON st.list_type = f.feed_id AND f.user_id = $1
      WHERE st.user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (listType) {
      query += ' AND st.list_type = $2';
      params.push(listType);
    }
    
    query += ' ORDER BY st.last_sync_at DESC';
    
    const result = await this.db.getPool().query(query, params);
    return result.rows;
  }

  /**
   * Check if sync is needed (based on last sync time and cooldown)
   */
  async isSyncNeeded(userId: number, listType: string, cooldownHours: number = 24): Promise<boolean> {
    const result = await this.db.getPool().query(`
      SELECT last_sync_at 
      FROM sync_tracking 
      WHERE user_id = $1 AND list_type = $2
    `, [userId, listType]);

    if (result.rows.length === 0) {
      return true; // Never synced
    }

    const lastSync = new Date(result.rows[0].last_sync_at);
    const cooldownEnd = new Date(lastSync.getTime() + (cooldownHours * 60 * 60 * 1000));
    
    return new Date() > cooldownEnd;
  }
}