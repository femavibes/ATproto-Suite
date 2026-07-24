import { Database } from './database.js';
import { CommunalModerationService } from './communalModeration.js';
import { GrazeService } from './graze.js';

export class CommunalWorker {
  private db: Database;
  private communalService: CommunalModerationService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private static instance: CommunalWorker;

  constructor() {
    this.db = Database.getInstance();
    this.communalService = new CommunalModerationService(this.db, new GrazeService());
  }

  static getInstance(): CommunalWorker {
    if (!CommunalWorker.instance) {
      CommunalWorker.instance = new CommunalWorker();
    }
    return CommunalWorker.instance;
  }

  start(intervalMs = 30000) { // 30 seconds default
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting communal moderation worker...');
    
    this.intervalId = setInterval(async () => {
      try {
        await this.processNewReports();
      } catch (error) {
        console.error('Communal worker error:', error);
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Communal moderation worker stopped');
  }

  private async processNewReports() {
    // Get unprocessed reports from the last 5 minutes (exclude all *-other subcategories and main "other")
    const result = await this.db.getPool().query(`
      SELECT DISTINCT post_uri, report_type, reporter_did, reported_at
      FROM post_reports 
      WHERE reported_at > NOW() - INTERVAL '5 minutes'
      AND report_type NOT IN ('misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other')
      AND NOT EXISTS (
        SELECT 1 FROM communal_processing_log cpl 
        WHERE cpl.post_uri = post_reports.post_uri 
        AND cpl.processed_at > NOW() - INTERVAL '5 minutes'
      )
      ORDER BY reported_at DESC
      LIMIT 50
    `);

    for (const report of result.rows) {
      try {
        await this.communalService.processReport(
          report.post_uri, 
          report.report_type, 
          report.reporter_did
        );
        
        // Mark as processed
        await this.db.getPool().query(`
          INSERT INTO communal_processing_log (post_uri, processed_at) 
          VALUES ($1, NOW()) 
          ON CONFLICT (post_uri) DO UPDATE SET processed_at = NOW()
        `, [report.post_uri]);
        
      } catch (error) {
        console.error(`Failed to process report for ${report.post_uri}:`, error);
      }
    }
  }

  async runBackfill(userId?: number) {
    console.log('Starting communal moderation backfill...');
    
    let query: string;
    let params: any[] = [];
    
    if (userId) {
      // Backfill for specific user's recent removals - retry Graze API calls
      query = `
        SELECT DISTINCT ml.post_uri, 'spam' as report_type, 'system' as reporter_did, ml.created_at as reported_at
        FROM moderation_log ml
        INNER JOIN feeds f ON ml.feed_id = f.feed_id
        WHERE f.user_id = $1
        AND ml.action IN ('manual_removal', 'backfill_removal', 'communal_removal')
        AND ml.created_at > NOW() - INTERVAL '24 hours'
        AND ml.post_uri IS NOT NULL
        ORDER BY ml.created_at DESC
        LIMIT 50
      `;
      params = [userId];
    } else {
      // General backfill
      query = `
        SELECT DISTINCT pr.post_uri, pr.report_type, pr.reporter_did, pr.reported_at
        FROM post_reports pr
        WHERE pr.report_type IN ('spam', 'sexual', 'harassment', 'illegal')
        AND NOT EXISTS (
          SELECT 1 FROM communal_processing_log cpl 
          WHERE cpl.post_uri = pr.post_uri
        )
        ORDER BY pr.reported_at DESC
        LIMIT 50
      `;
    }

    console.log('Backfill query:', query);
    console.log('Backfill params:', params);
    const result = await this.db.getPool().query(query, params);
    console.log(`Found ${result.rows.length} posts for backfill processing`);
    console.log('First few results:', result.rows.slice(0, 3));

    let processed = 0;
    for (const report of result.rows) {
      try {
        if (userId) {
          // For user-specific backfill, directly retry the removal
          console.log(`Processing user backfill for post: ${report.post_uri}`);
          const feeds = await this.db.getAllFeedsWithUsers();
          const userFeeds = feeds.filter(f => f.user_id === userId);
          console.log(`Found ${userFeeds.length} feeds for user ${userId}`);
          
          for (const feed of userFeeds) {
            try {
              const { GrazeService } = await import('./graze.js');
              const grazeService = new GrazeService();
              await grazeService.removePost(report.post_uri, feed.feed_id, feed);
              console.log(`Retry removal: ${report.post_uri} from feed ${feed.feed_name}`);
            } catch (error) {
              console.error(`Retry failed for ${report.post_uri} on feed ${feed.feed_name}:`, error);
            }
          }
        } else {
          // General backfill - process through communal moderation
          await this.communalService.processReport(
            report.post_uri, 
            report.report_type, 
            report.reporter_did
          );
        }
        
        // Mark as processed
        await this.db.getPool().query(`
          INSERT INTO communal_processing_log (post_uri, processed_at) 
          VALUES ($1, NOW()) 
          ON CONFLICT (post_uri) DO UPDATE SET processed_at = NOW()
        `, [report.post_uri]);
        
        processed++;
      } catch (error) {
        console.error(`Failed to backfill process report for ${report.post_uri}:`, error);
      }
    }
    
    console.log(`Communal moderation backfill completed: ${processed}/${result.rows.length} processed`);
    return { total: result.rows.length, processed };
  }
}