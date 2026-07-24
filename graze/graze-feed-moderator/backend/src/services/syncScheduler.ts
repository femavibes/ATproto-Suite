import { Database } from './database.js';

export class SyncScheduler {
  private db: Database;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.db = Database.getInstance();
  }

  start(intervalMinutes: number = 1440): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.syncAllUsers();
    }, intervalMinutes * 60 * 1000);

    console.log(`Ban list sync scheduler started (${intervalMinutes} minute intervals)`);
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Ban list sync scheduler stopped');
    }
  }

  private async syncAllUsers(): Promise<void> {
    try {
      // Get all users with Bluesky credentials
      const result = await this.db.getPool().query(
        'SELECT id FROM user_profiles WHERE bsky_password IS NOT NULL'
      );

      let totalAdded = 0;
      let totalRemoved = 0;

      for (const row of result.rows) {
        try {
          const syncResult = await this.db.syncBanLists(row.id);
          totalAdded += syncResult.added;
          totalRemoved += syncResult.removed;
        } catch (error) {
          console.error(`Failed to sync user ${row.id}:`, error);
        }
      }

      if (totalAdded > 0 || totalRemoved > 0) {
        console.log(`Ban list sync completed: ${totalAdded} added, ${totalRemoved} removed`);
      }
    } catch (error) {
      console.error('Ban list sync error:', error);
    }
  }
}