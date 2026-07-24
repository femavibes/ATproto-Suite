import { AtpAgent } from '@atproto/api';
import type { ModEventView } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs';
import { Database } from './database.js';
import { GrazeService } from './graze.js';
import { MultiUserCommandProcessor } from './multiUserCommandProcessor.js';

export class OzoneService {
  private agent: AtpAgent;
  private labelerDid: string;
  private labelerPassword: string;
  private ozoneUrl: string;
  private lastProcessedId = 0;
  private isFirstRun = true;
  private db: Database;
  private grazeService: GrazeService;
  private commandProcessor: MultiUserCommandProcessor;

  constructor(db: Database, grazeService: GrazeService) {
    this.labelerDid = process.env.LABELER_DID!;
    this.labelerPassword = process.env.LABELER_PASSWORD!;
    this.ozoneUrl = process.env.OZONE_URL!;
    this.db = db;
    this.grazeService = grazeService;
    this.commandProcessor = new MultiUserCommandProcessor(db, grazeService);
    
    this.agent = new AtpAgent({
      service: 'https://bsky.social',
      persistSession: (evt, session) => {
        console.log(`Ozone agent session event: ${evt}`);
      }
    });
  }

  async initialize() {
    // Skip Ozone initialization if credentials are placeholders
    if (this.labelerDid.includes('your-labeler-did')) {
      console.log('Ozone service skipped (placeholder credentials)');
      return;
    }
    
    await this.agent.login({
      identifier: this.labelerDid,
      password: this.labelerPassword,
    });
    console.log('Ozone service authenticated');
  }

  async startMonitoring() {
    // Skip monitoring if credentials are placeholders
    if (this.labelerDid.includes('your-labeler-did')) {
      console.log('Ozone monitoring skipped (placeholder credentials)');
      return;
    }
    
    console.log('Starting Ozone report monitoring...');
    
    while (true) {
      try {
        await this.pollReports();
      } catch (error) {
        console.error('Error polling reports:', error);
        await this.handleAuthError(error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second polling
    }
  }

  private async pollReports() {
    const response = await this.agent.api.tools.ozone.moderation.queryEvents(
      {},
      {
        headers: {
          'atproto-proxy': `${this.labelerDid}#atproto_labeler`,
        },
      }
    );

    const events = response.data.events;
    
    for (const event of events) {
      if (event.event.$type !== 'tools.ozone.moderation.defs#modEventReport') {
        continue;
      }
      
      // On first run, establish baseline
      if (this.isFirstRun) {
        if (event.id > this.lastProcessedId) {
          this.lastProcessedId = event.id;
        }
        continue;
      }
      
      // Process new events
      if (event.id > this.lastProcessedId) {
        await this.processReport(event);
        this.lastProcessedId = event.id;
      }
    }
    
    if (this.isFirstRun) {
      this.isFirstRun = false;
      console.log(`Established baseline at event ID: ${this.lastProcessedId}`);
    }
  }

  private async processReport(event: ModEventView) {
    const reporterDid = event.createdBy;
    const comment = (event.event as any).comment || '';
    const reportType = this.parseReportType((event.event as any).reportType);
    
    // Check if reporter is registered user
    const user = await this.db.getUserByDid(reporterDid);
    
    // Track report for communal intelligence
    if ((event.subject as any).$type === 'com.atproto.repo.strongRef') {
      await this.db.addPostReport((event.subject as any).uri, reportType, reporterDid);
    }

    // Process hierarchical report types (communal moderation)
    if (reportType !== 'other') {
      await this.processHierarchicalReport(event, reportType, user);
    }

    // Process commands for command-enabled types (registered users only)
    if (user && this.isCommandEnabledType(reportType) && comment) {
      await this.processMultiUserCommands(event, comment, user);
    }
  }

  private isCommandEnabledType(reportType: string): boolean {
    const commandEnabledTypes = [
      'misleading-other', 'harassment-other', 'violence-other',
      'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ];
    return commandEnabledTypes.includes(reportType);
  }

  private async processHierarchicalReport(event: ModEventView, reportType: string, user: any) {
    if ((event.subject as any).$type !== 'com.atproto.repo.strongRef') return;
    
    const postUri = (event.subject as any).uri;
    
    // Apply communal label
    await this.applyLabel(postUri, `feedmod-${reportType}`);
    
    // If registered user, also remove from their feeds
    if (user) {
      const userFeeds = await this.db.getUserFeeds(user.id);
      for (const feed of userFeeds) {
        await this.grazeService.removePost(postUri, feed.feed_id, user);
        await this.db.logModerationAction({
          post_uri: postUri,
          action: 'remove_post',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: reportType
        });
      }
    }

    // Check thresholds with cross-type logic
    await this.checkCrossTypeThresholds(postUri, reportType);
    
    // Check user ban thresholds with cross-type logic
    const match = postUri.match(/^at:\/\/([^/]+)/);
    if (match) {
      const authorDid = match[1];
      await this.checkUserBanThresholds(authorDid, reportType);
    }
  }

  private async checkCrossTypeThresholds(postUri: string, triggerReportType: string) {
    // Get all report types for this post
    const allReports = await this.db.getAllReportTypesForPost(postUri);
    const participatingFeeds = await this.db.getFeedsByOptIn(triggerReportType);
    
    for (const feed of participatingFeeds) {
      const feedSettings = await this.db.getFeedSettings(feed.feed_id);
      const crossTypePercentage = feedSettings?.cross_type_percentage || 20;
      const sameCategoryCrossPercentage = feedSettings?.same_category_cross_percentage || 50;
      
      // Check each report type's threshold
      for (const [reportType, count] of Object.entries(allReports)) {
        const threshold = await this.db.getThresholdForReportType(feed.feed_id, reportType);
        const mainCategory = reportType.split('-')[0];
        
        // Calculate same-category cross-type contribution
        const sameCategoryCount = Object.entries(allReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] === mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        // Calculate global cross-type contribution (excluding same category)
        const globalCrossCount = Object.entries(allReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] !== mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const sameCategoryCrossContribution = Math.floor(sameCategoryCount * (sameCategoryCrossPercentage / 100));
        const globalCrossContribution = Math.floor(globalCrossCount * (crossTypePercentage / 100));
        const totalEffectiveCount = count + sameCategoryCrossContribution + globalCrossContribution;
        
        if (totalEffectiveCount >= threshold) {
          await this.applyLabel(postUri, `feedmod-threshold-${reportType}`);
          
          const feedOwner = await this.db.getUserById(feed.user_id);
          if (feedOwner) {
            await this.grazeService.removePost(postUri, feed.feed_id, feedOwner);
            await this.db.logModerationAction({
              post_uri: postUri,
              action: 'remove_post',
              feed_id: feed.feed_id,
              moderator_did: 'system',
              reason: `threshold_${reportType}_${totalEffectiveCount}(${count}+${sameCategoryCrossContribution}same+${globalCrossContribution}global)`
            });
          }
        }
      }
    }
  }

  private async checkUserBanThresholds(userDid: string, triggerReportType: string) {
    // Get all report types for this user
    const allUserReports = await this.db.getAllReportTypesForUser(userDid);
    const participatingFeeds = await this.db.getFeedsByOptIn(triggerReportType);
    
    for (const feed of participatingFeeds) {
      const feedSettings = await this.db.getFeedSettings(feed.feed_id);
      const crossTypePercentage = feedSettings?.user_ban_cross_type_percentage || feedSettings?.cross_type_percentage || 20;
      const sameCategoryCrossPercentage = feedSettings?.user_ban_same_category_cross_percentage || feedSettings?.same_category_cross_percentage || 50;
      
      // Check each report type's user ban threshold
      for (const [reportType, count] of Object.entries(allUserReports)) {
        const threshold = await this.db.getUserBanThresholdForReportType(feed.feed_id, reportType);
        const mainCategory = reportType.split('-')[0];
        
        // Calculate same-category cross-type contribution
        const sameCategoryCount = Object.entries(allUserReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] === mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        // Calculate global cross-type contribution (excluding same category)
        const globalCrossCount = Object.entries(allUserReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] !== mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const sameCategoryCrossContribution = Math.floor(sameCategoryCount * (sameCategoryCrossPercentage / 100));
        const globalCrossContribution = Math.floor(globalCrossCount * (crossTypePercentage / 100));
        const totalEffectiveCount = count + sameCategoryCrossContribution + globalCrossContribution;
        
        if (totalEffectiveCount >= threshold) {
          const feedOwner = await this.db.getUserById(feed.user_id);
          if (feedOwner) {
            // Auto-ban user from this feed
            try {
              // Get user handle from DID
              const agent = new (await import('@atproto/api')).AtpAgent({ service: 'https://bsky.social' });
              const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${userDid}`);
              const userProfile = await profileResponse.json();
              
              // First add to Bluesky ban list
              const feedData = await this.db.getFeedById(feed.feed_id);
              if (feedData?.feed_ban_list) {
                try {
                  const { BlueskyService } = await import('./bluesky.js');
                  const blueskyService = new BlueskyService();
                  await blueskyService.banUser(userProfile.handle, feedData.feed_ban_list, feedOwner);
                  console.log(`Auto-banned ${userProfile.handle} from Bluesky list: ${feedData.feed_ban_list}`);
                } catch (blueskyError) {
                  console.error(`Failed to add ${userProfile.handle} to Bluesky ban list:`, blueskyError);
                  // Continue with local ban even if Bluesky fails
                }
              }
              
              // Then add to local database
              await this.db.banUser(feed.user_id, userProfile.handle, userDid, feed.feed_id, null, 
                `Auto-ban: ${reportType} threshold reached`, 'system');
              
              await this.db.logModerationAction({
                post_uri: undefined,
                action: 'auto_ban',
                feed_id: feed.feed_id,
                moderator_did: 'system',
                reason: `user_ban_threshold_${reportType}_${totalEffectiveCount}(${count}+${sameCategoryCrossContribution}same+${globalCrossContribution}global)`,
                target_handle: userProfile.handle
              });
            } catch (error) {
              console.error(`Failed to auto-ban user ${userDid}:`, error);
            }
          }
        }
      }
    }
  }

  private async processMultiUserCommands(event: ModEventView, comment: string, user: any) {
    await this.commandProcessor.processCommands(event, comment, user);
  }

  private async applyLabel(uri: string, label: string) {
    try {
      await this.agent.api.tools.ozone.moderation.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [label],
            negateLabelVals: [],
          },
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: uri,
            cid: '', // Will be filled by Ozone
          },
          createdBy: this.labelerDid,
        },
        {
          headers: {
            'atproto-proxy': `${this.labelerDid}#atproto_labeler`,
          },
          encoding: 'application/json'
        }
      );
      console.log(`Applied label "${label}" to ${uri}`);
    } catch (error) {
      console.error(`Failed to apply label "${label}" to ${uri}:`, error);
    }
  }

  private parseReportType(reportTypeReason: string): string {
    // Handle new AT Protocol URI format: tools.ozone.report.defs#reasonMisleadingSpam
    if (reportTypeReason.startsWith('tools.ozone.report.defs#reason')) {
      const reasonPart = reportTypeReason.substring('tools.ozone.report.defs#reason'.length);
      // Convert CamelCase to kebab-case: MisleadingSpam -> misleading-spam
      // Special cases: ED -> ed, NCII -> ncii
      let converted = reasonPart.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
      converted = converted.replace('-e-d', '-ed').replace('-n-c-i-i', '-ncii');
      return converted;
    }
    
    // Legacy compatibility during transition
    const legacyMappings: Record<string, string> = {
      'com.atproto.moderation.defs#reasonSpam': 'misleading-spam',
      'com.atproto.moderation.defs#reasonMisleading': 'misleading-other',
      'com.atproto.moderation.defs#reasonSexual': 'sexual-other',
      'com.atproto.moderation.defs#reasonRude': 'harassment-other',
      'com.atproto.moderation.defs#reasonViolation': 'rule-other',
      'com.atproto.moderation.defs#reasonOther': 'other'
    };
    
    return legacyMappings[reportTypeReason] || 'other';
  }

  private async handleAuthError(error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('ExpiredToken') || errorMsg.includes('Unauthorized')) {
      console.log('Ozone agent token expired, re-authenticating...');
      try {
        await this.agent.login({
          identifier: this.labelerDid,
          password: this.labelerPassword,
        });
        console.log('Ozone agent re-authenticated successfully');
      } catch (loginError) {
        console.error('Failed to re-authenticate Ozone agent:', loginError);
      }
    }
  }
}