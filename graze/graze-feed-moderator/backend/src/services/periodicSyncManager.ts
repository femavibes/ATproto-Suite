import { EnhancedBlueskySync } from './enhancedBlueskySync.js';
import { Database } from './database.js';

export class PeriodicSyncManager {
  private db: Database;
  private enhancedSync: EnhancedBlueskySync;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.db = Database.getInstance();
    this.enhancedSync = new EnhancedBlueskySync();
  }

  /**
   * Start periodic sync for all users
   * @param intervalHours How often to run sync (default: 6 hours)
   */
  start(intervalHours: number = 6): void {
    if (this.syncInterval) {
      this.stop();
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) {
        await this.runPeriodicSync();
      }
    }, intervalMs);

    console.log(`Periodic ban list sync started (every ${intervalHours} hours)`);
    
    // Run initial sync after 5 minutes
    setTimeout(async () => {
      if (!this.isRunning) {
        await this.runPeriodicSync();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop periodic sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Periodic ban list sync stopped');
    }
  }

  /**
   * Run sync for all eligible users
   */
  private async runPeriodicSync(): Promise<void> {
    if (this.isRunning) {
      console.log('Periodic sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting periodic ban list sync...');

    try {
      // Get all users with Bluesky credentials and ban lists
      const result = await this.db.getPool().query(`
        SELECT DISTINCT up.id, up.did, up.handle, up.global_ban_list
        FROM user_profiles up
        LEFT JOIN feeds f ON up.id = f.user_id
        WHERE (
          up.bsky_password IS NOT NULL 
          OR (up.zero_trust_mode = true AND up.zero_trust_proxy_url IS NOT NULL)
        )
        AND (
          up.global_ban_list IS NOT NULL 
          OR f.feed_ban_list IS NOT NULL
        )
      `);

      const users = result.rows;
      console.log(`Found ${users.length} users with ban lists to sync`);

      let totalSynced = 0;
      let totalErrors = 0;

      for (const userData of users) {
        try {
          // Check if user needs sync (hasn't been synced in last 6 hours)
          const needsSync = await this.enhancedSync.isSyncNeeded(userData.id, 'all', 6);
          
          if (needsSync) {
            console.log(`Syncing ban lists for user: ${userData.handle}`);
            
            const syncResult = await this.enhancedSync.syncBanListsEnhanced(userData);
            
            console.log(`Sync completed for ${userData.handle}: ${syncResult.added} added, ${syncResult.removed} removed, ${syncResult.deduplicated} deduplicated`);
            
            if (syncResult.errors.length > 0) {
              console.warn(`Sync errors for ${userData.handle}:`, syncResult.errors);
              totalErrors++;
            } else {
              totalSynced++;
            }
          } else {
            console.log(`Skipping ${userData.handle} - recently synced`);
          }

          // Add delay between users to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.error(`Failed to sync user ${userData.handle}:`, error);
          totalErrors++;
        }
      }

      console.log(`Periodic sync completed: ${totalSynced} users synced successfully, ${totalErrors} errors`);

    } catch (error) {
      console.error('Periodic sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get sync status
   */
  getStatus(): { running: boolean, intervalActive: boolean } {
    return {
      running: this.isRunning,
      intervalActive: this.syncInterval !== null
    };
  }

  /**
   * Force run sync now (for testing/admin purposes)
   */
  async forceSync(): Promise<void> {
    console.log('Force running periodic sync...');
    await this.runPeriodicSync();
  }
}