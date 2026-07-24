import WebSocket from 'ws';
import { Database } from './database.js';
import { OzoneService } from './ozone.js';
import { GrazeService } from './graze.js';

interface LabelEvent {
  labels: Array<{
    uri: string;
    val: string;
    neg?: boolean;
  }>;
}

export class LabelWatcher {
  private ws: WebSocket | null = null;
  private db: Database;
  private ozoneService: OzoneService;
  private grazeService: GrazeService;
  private socketUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(db: Database, ozoneService: OzoneService) {
    this.db = db;
    this.ozoneService = ozoneService;
    this.grazeService = new GrazeService();
    this.socketUrl = process.env.LABELER_SOCKET_URL!;
  }

  start() {
    // Skip WebSocket if URL is placeholder
    if (this.socketUrl.includes('your-labeler.example.com')) {
      console.log('Label watcher skipped (placeholder URL)');
      return;
    }
    this.connect();
  }

  private connect() {
    console.log('Connecting to label WebSocket...');
    
    this.ws = new WebSocket(this.socketUrl);
    
    this.ws.on('open', () => {
      console.log('Label WebSocket connected');
      this.reconnectAttempts = 0;
    });
    
    this.ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString()) as LabelEvent;
        await this.processLabelEvent(event);
      } catch (error) {
        console.error('Error processing label event:', error);
      }
    });
    
    this.ws.on('close', () => {
      console.log('Label WebSocket disconnected');
      this.scheduleReconnect();
    });
    
    this.ws.on('error', (error) => {
      console.error('Label WebSocket error:', error);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private async processLabelEvent(event: LabelEvent) {
    for (const label of event.labels) {
      // Skip negative labels (removals)
      if (label.neg) continue;
      
      // Process feed moderator labels
      if (label.val.startsWith('feedmod-')) {
        await this.processFeedModLabel(label.uri, label.val);
      }
    }
  }

  private async processFeedModLabel(postUri: string, labelVal: string) {
    console.log(`Processing label "${labelVal}" for post: ${postUri}`);
    
    // Parse label type
    if (labelVal.startsWith('feedmod-remove-')) {
      // Feed-specific removal: feedmod-remove-{feedid}
      const feedId = labelVal.replace('feedmod-remove-', '');
      await this.removeFromSpecificFeed(postUri, feedId);
      
    } else if (labelVal.startsWith('feedmod-threshold-')) {
      // Threshold-based communal removal: feedmod-threshold-spam
      const reportType = labelVal.replace('feedmod-threshold-', '');
      await this.removeFromCommunalFeeds(postUri, reportType);
      
    } else if (labelVal.startsWith('feedmod-')) {
      // Standard communal label: feedmod-spam, feedmod-misleading, etc.
      const reportType = labelVal.replace('feedmod-', '');
      // These are handled by the threshold system, no immediate action needed
      console.log(`Communal label "${reportType}" applied, waiting for threshold`);
    }
  }

  private async removeFromSpecificFeed(postUri: string, feedId: string) {
    try {
      // Find feed owner
      const feed = await this.db.getFeedById(feedId);
      if (!feed) {
        console.warn(`Feed ${feedId} not found`);
        return;
      }
      
      const user = await this.db.getUserById(feed.user_id);
      if (!user) {
        console.warn(`User for feed ${feedId} not found`);
        return;
      }
      
      // Remove post from feed
      await this.grazeService.removePost(postUri, feedId, user);
      
      // Log action
      await this.db.logModerationAction({
        post_uri: postUri,
        action: 'remove_post',
        feed_id: feedId,
        moderator_did: 'system',
        reason: 'label_applied'
      });
      
      console.log(`Removed post from feed ${feedId} via label`);
      
    } catch (error) {
      console.error(`Failed to remove post from feed ${feedId}:`, error);
    }
  }

  private async removeFromCommunalFeeds(postUri: string, reportType: string) {
    try {
      // Get all feeds that opt into this report type
      const participatingFeeds = await this.db.getFeedsByOptIn(reportType);
      
      for (const feed of participatingFeeds) {
        const user = await this.db.getUserById(feed.user_id);
        if (!user) continue;
        
        try {
          await this.grazeService.removePost(postUri, feed.feed_id, user);
          
          await this.db.logModerationAction({
            post_uri: postUri,
            action: 'remove_post',
            feed_id: feed.feed_id,
            moderator_did: 'system',
            reason: `communal_${reportType}`
          });
          
          console.log(`Removed post from feed ${feed.feed_id} via communal moderation`);
          
        } catch (error) {
          console.error(`Failed to remove post from feed ${feed.feed_id}:`, error);
        }
      }
      
    } catch (error) {
      console.error(`Failed to process communal removal for ${reportType}:`, error);
    }
  }
}