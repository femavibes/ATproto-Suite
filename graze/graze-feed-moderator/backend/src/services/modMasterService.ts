// ModMaster Service - Handles ModMaster labeler reports with user-specific actions
import { AtpAgent } from '@atproto/api';
import type { ModEventView } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs';
import { Database } from './database.js';
import { GrazeService } from './graze.js';
import { ModMasterCommandParser, ParsedCommand } from './modMasterCommandParser.js';

export class ModMasterService {
  private db: Database;
  private grazeService: GrazeService;
  private commandParser: ModMasterCommandParser;
  private modMasterAgent: AtpAgent;
  private customLabelerAgents: Map<string, AtpAgent> = new Map();

  constructor(db: Database, grazeService: GrazeService) {
    this.db = db;
    this.grazeService = grazeService;
    this.commandParser = new ModMasterCommandParser();
    
    // ModMaster labeler agent
    this.modMasterAgent = new AtpAgent({
      service: 'https://bsky.social',
      persistSession: (evt, session) => {
        console.log(`ModMaster agent session event: ${evt}`);
      }
    });
  }

  async initialize() {
    const labelerDid = process.env.LABELER_DID;
    const labelerPassword = process.env.LABELER_PASSWORD;
    
    if (!labelerDid || !labelerPassword || labelerDid.includes('your-labeler-did')) {
      console.log('ModMaster service skipped (no credentials configured)');
      return;
    }

    await this.modMasterAgent.login({
      identifier: labelerDid,
      password: labelerPassword,
    });
    console.log('ModMaster service authenticated');
  }

  /**
   * Start monitoring ModMaster labeler for reports
   */
  async startMonitoring() {
    const labelerDid = process.env.LABELER_DID;
    if (!labelerDid || labelerDid.includes('your-labeler-did')) {
      console.log('ModMaster monitoring skipped (no credentials configured)');
      return;
    }

    console.log('Starting ModMaster report monitoring...');
    let lastProcessedId = 0;
    let isFirstRun = true;

    while (true) {
      try {
        const response = await this.modMasterAgent.api.tools.ozone.moderation.queryEvents(
          {},
          {
            headers: {
              'atproto-proxy': `${labelerDid}#atproto_labeler`,
            },
          }
        );

        const events = response.data.events;

        for (const event of events) {
          if (event.event.$type !== 'tools.ozone.moderation.defs#modEventReport') {
            continue;
          }

          // On first run, establish baseline
          if (isFirstRun) {
            if (event.id > lastProcessedId) {
              lastProcessedId = event.id;
            }
            continue;
          }

          // Process new events
          if (event.id > lastProcessedId) {
            await this.processReport(event, labelerDid, false);
            lastProcessedId = event.id;
          }
        }

        if (isFirstRun) {
          isFirstRun = false;
          console.log(`ModMaster baseline established at event ID: ${lastProcessedId}`);
        }
      } catch (error) {
        console.error('Error polling ModMaster reports:', error);
        await this.handleAuthError(error);
      }

      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second polling
    }
  }

  private async handleAuthError(error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('ExpiredToken') || errorMsg.includes('Unauthorized')) {
      console.log('ModMaster agent token expired, re-authenticating...');
      try {
        await this.modMasterAgent.login({
          identifier: process.env.LABELER_DID!,
          password: process.env.LABELER_PASSWORD!,
        });
        console.log('ModMaster agent re-authenticated successfully');
      } catch (loginError) {
        console.error('Failed to re-authenticate ModMaster agent:', loginError);
      }
    }
  }

  /**
   * Process a report from ModMaster or custom labeler
   */
  async processReport(event: ModEventView, labelerDid: string, isCustomLabeler: boolean = false) {
    const reporterDid = event.createdBy;
    const comment = (event.event as any).comment || '';
    const reportType = this.parseReportType((event.event as any).reportType);
    
    // Get or create user profile
    const reporterHandle = await this.getHandleFromDid(reporterDid);
    const user = await this.db.getOrCreateUserProfile(reporterDid, reporterHandle);
    
    // Determine if user is an app user (paid/premium tier)
    const isAppUser = await this.db.isAppUser(reporterDid);
    
    // Calculate report weight
    const weight = isAppUser ? 1.0 : (await this.db.getNonUserWeights(user.id)).postWeight;
    
    // Track report for communal intelligence
    const isPostReport = (event.subject as any).$type === 'com.atproto.repo.strongRef';
    const isAccountReport = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef';
    
    if (isPostReport) {
      const postUri = (event.subject as any).uri;
      await this.db.addPostReport(postUri, reportType, reporterDid, 'ozone', labelerDid, weight);
      
      // Extract author DID for user report tracking
      const match = postUri.match(/^at:\/\/([^/]+)/);
      if (match) {
        const authorDid = match[1];
        await this.db.addUserReport(authorDid, reportType, reporterDid, postUri, 'ozone', labelerDid, weight);
      }
    } else if (isAccountReport) {
      const accountDid = (event.subject as any).did;
      await this.db.addUserReport(accountDid, reportType, reporterDid, undefined, 'ozone', labelerDid, weight);
    }
    
    // If app user, execute actions immediately
    if (isAppUser) {
      console.log(`App user report from ${reporterHandle} - executing actions`);
      await this.executeUserActions(user, event, reportType, comment, isCustomLabeler);
    } else {
      console.log(`Non-app user report from ${reporterHandle} (weight: ${weight}) - stored for communal thresholds`);
    }
    
    // Check communal thresholds (weighted)
    if (isPostReport) {
      await this.checkCommunalThresholds((event.subject as any).uri, reportType);
    } else if (isAccountReport) {
      await this.checkUserBanThresholds((event.subject as any).did, reportType);
    }
  }

  /**
   * Execute actions for app users based on report type
   */
  private async executeUserActions(user: any, event: ModEventView, reportType: string, comment: string, isCustomLabeler: boolean) {
    const isPostReport = (event.subject as any).$type === 'com.atproto.repo.strongRef';
    const isAccountReport = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef';
    
    // Get user's feeds
    const userFeeds = await this.db.getUserFeeds(user.id);
    if (userFeeds.length === 0) {
      console.log(`User ${user.handle} has no feeds configured`);
      return;
    }
    
    // Get user's configured actions for this report type
    const targetType = isPostReport ? 'posts' : 'users';
    const settings = isCustomLabeler 
      ? await this.db.getCustomLabelerReportSettings(user.id)
      : await this.db.getModmasterReportSettings(user.id);
    
    // Set appropriate defaults based on target type
    let defaultAction: string;
    if (reportType.endsWith('-other') || reportType === 'other') {
      defaultAction = 'command_only';
    } else if (targetType === 'posts') {
      defaultAction = 'remove_all_configured';
    } else { // users
      defaultAction = 'ban_global_only';
    }
    
    const action = settings[targetType][reportType] || defaultAction;
    
    if (!settings[targetType][reportType]) {
      console.log(`No ${targetType} setting found for ${reportType}, using default: ${defaultAction}`);
    }
    
    // Execute based on configured action
    if (action === 'command_only') {
      const commands = comment ? this.commandParser.parseCommands(comment) : [];
      if (commands.length > 0) {
        await this.executeCommands(commands, user, event, isCustomLabeler);
      } else {
        console.log(`Command-only action for ${reportType} with no commands - no action taken`);
        
        // Log that no action was taken
        const isPostReport = (event.subject as any).$type === 'com.atproto.repo.strongRef';
        const postUri = isPostReport ? (event.subject as any).uri : undefined;
        const accountDid = !isPostReport ? (event.subject as any).did : undefined;
        const handle = accountDid ? await this.getHandleFromDid(accountDid) : undefined;
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: isCustomLabeler ? 'custom' : 'modmaster',
          reportType,
          targetType: isPostReport ? 'post' : 'user',
          postUri,
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: 'No action taken (command-only with no commands)',
          status: 'success'
        });
      }
    } else if (action === 'log_only') {
      console.log(`Log-only action for ${reportType} - no moderation action taken`);
      
      // Log that no action was taken
      const isPostReport = (event.subject as any).$type === 'com.atproto.repo.strongRef';
      const postUri = isPostReport ? (event.subject as any).uri : undefined;
      const accountDid = !isPostReport ? (event.subject as any).did : undefined;
      const handle = accountDid ? await this.getHandleFromDid(accountDid) : undefined;
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: isCustomLabeler ? 'custom' : 'modmaster',
        reportType,
        targetType: isPostReport ? 'post' : 'user',
        postUri,
        targetHandle: handle,
        targetDid: accountDid,
        actionTaken: 'No action taken (log only)',
        status: 'success'
      });
    } else {
      // Execute the configured action
      if (isPostReport) {
        const postUri = (event.subject as any).uri;
        await this.executePostAction(postUri, user, userFeeds, action, reportType, isCustomLabeler);
      } else if (isAccountReport) {
        const accountDid = (event.subject as any).did;
        await this.executeUserAction(accountDid, user, userFeeds, action, reportType);
      }
    }
  }

  /**
   * Execute parsed commands
   */
  private async executeCommands(commands: ParsedCommand[], user: any, event: ModEventView, isCustomLabeler: boolean) {
    const userFeeds = await this.db.getUserFeeds(user.id);
    const feedNames = userFeeds.map(f => f.feed_name);
    
    console.log(`Executing ${commands.length} commands for user ${user.handle}`);
    console.log(`User has ${userFeeds.length} feeds:`, feedNames);
    
    for (const command of commands) {
      console.log(`Processing command:`, JSON.stringify(command));
      
      // Validate command
      const validation = this.commandParser.validateCommand(command, feedNames, isCustomLabeler, false);
      if (!validation.valid) {
        console.error(`Invalid command: ${validation.error}`);
        continue;
      }
      
      console.log(`Command validation passed`);
      
      // Execute command
      try {
        if (command.type === 'remove') {
          console.log(`Executing remove command`);
          await this.executeRemoveCommand(command, user, event, userFeeds);
        } else if (command.type === 'ban') {
          await this.executeBanCommand(command, user, event, userFeeds);
        } else if (command.type === 'restore') {
          await this.executeRestoreCommand(command, user, event, userFeeds);
        } else if (command.type === 'unban') {
          await this.executeUnbanCommand(command, user, event, userFeeds);
        } else if (command.type === 'bulk_remove') {
          await this.executeBulkRemoveCommand(command, user, event, userFeeds);
        } else if (command.type === 'bulk_restore') {
          await this.executeBulkRestoreCommand(command, user, event, userFeeds);
        } else if (command.type === 'label' && isCustomLabeler) {
          await this.executeLabelCommand(command, event);
        } else if (command.type === 'unlabel' && isCustomLabeler) {
          await this.executeUnlabelCommand(command, event);
        }
      } catch (error) {
        console.error(`Failed to execute ${command.type} command:`, error);
      }
    }
  }

  private async executeRemoveCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    if ((event.subject as any).$type !== 'com.atproto.repo.strongRef') {
      console.error('Remove command requires post report');
      return;
    }
    
    const postUri = (event.subject as any).uri;
    
    if (command.scope === 'all') {
      // "remove all" - single API call with no algo_id to remove from ALL user's feeds
      console.log('Executing remove all - single API call with no algo_id');
      await this.grazeService.removePost(postUri, 'all', user);  // 'all' = no algo_id
      
      await this.db.logModerationAction({
        post_uri: postUri,
        action: 'remove_post_all',
        feed_id: undefined,
        moderator_did: user.did,
        reason: 'modmaster_command_all'
      });
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'post',
        postUri,
        actionTaken: 'Removed from ALL user feeds via remove all command',
        status: 'success'
      });
      
      console.log('Removed post from ALL user feeds');
    } else {
      let targetFeeds: any[] = [];
      
      if (command.targets.length === 0) {
        // Empty targets with 'specific' scope = all configured feeds
        targetFeeds = userFeeds;
      } else {
        // Resolve each target (could be feed name or group:name)
        for (const target of command.targets) {
          if (target.startsWith('group:')) {
            // Group target - resolve to feeds in group
            const groupName = target.substring(6); // Remove 'group:' prefix
            const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
            targetFeeds.push(...groupFeeds);
            console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds`);
          } else {
            // Individual feed target
            const feedMatches = userFeeds.filter(f => 
              f.feed_name.toLowerCase() === target.toLowerCase()
            );
            targetFeeds.push(...feedMatches);
          }
        }
      }
      
      // Remove duplicates
      targetFeeds = targetFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.feed_id === feed.feed_id)
      );
      
      console.log(`Executing remove for ${targetFeeds.length} specific feeds`);
      
      for (const feed of targetFeeds) {
        await this.grazeService.removePost(postUri, feed.feed_id, user);
        await this.db.logModerationAction({
          post_uri: postUri,
          action: 'remove_post',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: 'modmaster_command'
        });
        
        // Log to labeler processing logs
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'post',
          postUri,
          actionTaken: `Removed from feed via command: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
        
        console.log(`Removed post from ${feed.feed_name}`);
      }
    }
  }

  private async executeRestoreCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    if ((event.subject as any).$type !== 'com.atproto.repo.strongRef') {
      console.error('Restore command requires post report');
      return;
    }
    
    const postUri = (event.subject as any).uri;
    
    if (command.scope === 'all') {
      // "restore all" - single API call to restore from ALL user's feeds
      console.log('Executing restore all - single API call');
      await this.grazeService.restorePost(postUri, 'all', user);
      
      await this.db.logModerationAction({
        post_uri: postUri,
        action: 'restore_post_all',
        feed_id: undefined,
        moderator_did: user.did,
        reason: 'modmaster_command_all'
      });
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'post',
        postUri,
        actionTaken: 'Restored to ALL user feeds via restore all command',
        status: 'success'
      });
      
      console.log('Restored post to ALL user feeds');
    } else {
      let targetFeeds: any[] = [];
      
      if (command.targets.length === 0) {
        targetFeeds = userFeeds;
      } else {
        for (const target of command.targets) {
          if (target.startsWith('group:')) {
            const groupName = target.substring(6);
            const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
            targetFeeds.push(...groupFeeds);
            console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds for restore`);
          } else {
            const feedMatches = userFeeds.filter(f => 
              f.feed_name.toLowerCase() === target.toLowerCase()
            );
            targetFeeds.push(...feedMatches);
          }
        }
      }
      
      targetFeeds = targetFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.feed_id === feed.feed_id)
      );
      
      console.log(`Executing restore for ${targetFeeds.length} specific feeds`);
      
      for (const feed of targetFeeds) {
        await this.grazeService.restorePost(postUri, feed.feed_id, user);
        await this.db.logModerationAction({
          post_uri: postUri,
          action: 'restore_post',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: 'modmaster_command'
        });
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'post',
          postUri,
          actionTaken: `Restored to feed via command: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
        
        console.log(`Restored post to ${feed.feed_name}`);
      }
    }
  }

  private async executeBulkRemoveCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    const accountDid = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef'
      ? (event.subject as any).did
      : (event.subject as any).uri?.match(/^at:\/\/([^/]+)/)?.[1];
    
    if (!accountDid) {
      console.error('Could not extract account DID for bulk remove');
      return;
    }
    
    const count = command.count || 10;
    
    // Get the user's handle from DID
    const targetHandle = await this.getHandleFromDid(accountDid);
    
    // Get recent posts from Bluesky
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    const recentPosts = await blueskyService.getUserRecentPosts(targetHandle, count, user);
    
    if (recentPosts.length === 0) {
      console.log(`No recent posts found for ${targetHandle}`);
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'user',
        targetDid: accountDid,
        actionTaken: `Bulk remove failed: No recent posts found for ${targetHandle}`,
        status: 'error'
      });
      return;
    }
    
    console.log(`Found ${recentPosts.length} recent posts for ${targetHandle}`);
    
    if (command.scope === 'all') {
      // "bulk remove all 50" - remove from ALL account feeds using single API call
      for (const postUri of recentPosts) {
        await this.grazeService.removePostFromAllFeeds(postUri, user);
        await this.db.logPostRemoval(postUri, ['all'], user.id, 'bulk_remove_all_command');
      }
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'user',
        targetDid: accountDid,
        actionTaken: `Bulk removed ${recentPosts.length} posts from ALL account feeds`,
        status: 'success'
      });
      console.log(`Bulk removed ${recentPosts.length} posts from ALL account feeds`);
    } else if (command.targets.length === 0) {
      // "bulk remove" or "bulk remove 50" - configured feeds only
      for (const feed of userFeeds) {
        for (const postUri of recentPosts) {
          await this.grazeService.removePost(postUri, feed.feed_id, user);
          await this.db.logPostRemoval(postUri, [feed.feed_id], user.id, 'bulk_remove_command');
        }
      }
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'user',
        targetDid: accountDid,
        actionTaken: `Bulk removed ${recentPosts.length} posts from all configured feeds`,
        status: 'success'
      });
      console.log(`Bulk removed ${recentPosts.length} posts from ${userFeeds.length} configured feeds`);
    } else {
      // "bulk remove feed1,feed2 50" or "bulk remove g mygroup 30"
      let targetFeeds: any[] = [];
      
      for (const target of command.targets) {
        if (target.startsWith('group:')) {
          const groupName = target.substring(6);
          const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
          targetFeeds.push(...groupFeeds);
          console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds for bulk remove`);
        } else {
          const feedMatches = userFeeds.filter(f => 
            f.feed_name.toLowerCase() === target.toLowerCase()
          );
          targetFeeds.push(...feedMatches);
        }
      }
      
      targetFeeds = targetFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.feed_id === feed.feed_id)
      );
      
      for (const feed of targetFeeds) {
        for (const postUri of recentPosts) {
          await this.grazeService.removePost(postUri, feed.feed_id, user);
          await this.db.logPostRemoval(postUri, [feed.feed_id], user.id, 'bulk_remove_command');
        }
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetDid: accountDid,
          actionTaken: `Bulk removed ${recentPosts.length} posts from feed: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
        console.log(`Bulk removed ${recentPosts.length} posts from ${feed.feed_name}`);
      }
    }
  }

  private async executeBulkRestoreCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    const accountDid = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef'
      ? (event.subject as any).did
      : (event.subject as any).uri?.match(/^at:\/\/([^/]+)/)?.[1];
    
    if (!accountDid) {
      console.error('Could not extract account DID for bulk restore');
      return;
    }
    
    const count = command.count || 10;
    
    if (command.scope === 'all') {
      // "bulk restore all 25" - restore to ALL account feeds using single API call
      const recentPosts = await this.db.getRecentlyRemovedPosts(accountDid, count, user.id);
      for (const postUri of recentPosts) {
        await this.grazeService.restorePost(postUri, 'all', user);
        await this.db.logPostRestoration(postUri, ['all'], user.id, 'bulk_restore_all_command');
      }
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'user',
        targetDid: accountDid,
        actionTaken: `Bulk restored ${recentPosts.length} posts to ALL account feeds`,
        status: 'success'
      });
      console.log(`Bulk restored ${recentPosts.length} posts to ALL account feeds`);
    } else if (command.targets.length === 0) {
      // "bulk restore" or "bulk restore 25" - configured feeds only
      const recentPosts = await this.db.getRecentlyRemovedPosts(accountDid, count, user.id);
      for (const feed of userFeeds) {
        for (const postUri of recentPosts) {
          await this.grazeService.restorePost(postUri, feed.feed_id, user);
        }
      }
      
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: 'modmaster',
        reportType: 'command',
        targetType: 'user',
        targetDid: accountDid,
        actionTaken: `Bulk restored ${count} posts to all configured feeds`,
        status: 'success'
      });
      console.log(`Bulk restored ${count} posts to ${userFeeds.length} configured feeds`);
    } else {
      // "bulk restore feed1,feed2 25" or "bulk restore g mygroup 15"
      let targetFeeds: any[] = [];
      
      for (const target of command.targets) {
        if (target.startsWith('group:')) {
          const groupName = target.substring(6);
          const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
          targetFeeds.push(...groupFeeds);
          console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds for bulk restore`);
        } else {
          const feedMatches = userFeeds.filter(f => 
            f.feed_name.toLowerCase() === target.toLowerCase()
          );
          targetFeeds.push(...feedMatches);
        }
      }
      
      targetFeeds = targetFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.feed_id === feed.feed_id)
      );
      
      const recentPosts = await this.db.getRecentlyRemovedPosts(accountDid, count, user.id);
      for (const feed of targetFeeds) {
        for (const postUri of recentPosts) {
          await this.grazeService.restorePost(postUri, feed.feed_id, user);
        }
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetDid: accountDid,
          actionTaken: `Bulk restored ${count} posts to feed: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
        console.log(`Bulk restored ${count} posts to ${feed.feed_name}`);
      }
    }
  }

  private async executeUnbanCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    const accountDid = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef'
      ? (event.subject as any).did
      : (event.subject as any).uri?.match(/^at:\/\/([^/]+)/)?.[1];
    
    if (!accountDid) {
      console.error('Could not extract account DID');
      return;
    }
    
    const handle = await this.getHandleFromDid(accountDid);
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    
    if (command.scope === 'all') {
      // "unban all" - unban from global + all feeds
      try {
        await this.db.unbanUser(user.id, handle, accountDid, 'global');
        await blueskyService.unbanUser(handle, 'global', user);
        
        for (const feed of userFeeds) {
          await this.db.unbanUser(user.id, handle, accountDid, feed.feed_id);
          await blueskyService.unbanUser(handle, feed.feed_id, user);
        }
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: 'Unbanned from global + all feeds via unban all command (database + Bluesky)',
          status: 'success'
        });
        console.log(`Unbanned ${handle} from global + all feeds (database + Bluesky)`);
      } catch (error) {
        console.error(`Failed to unban ${handle} from all lists:`, error);
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Failed to unban from all lists: ${error}`,
          status: 'error'
        });
      }
    } else if (command.targets.includes('global')) {
      // "unban" or "unban global" - global only
      try {
        await this.db.unbanUser(user.id, handle, accountDid, 'global');
        await blueskyService.unbanUser(handle, 'global', user);
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: 'Unbanned from global ban list via command (database + Bluesky)',
          status: 'success'
        });
        console.log(`Unbanned ${handle} from global ban list (database + Bluesky)`);
      } catch (error) {
        console.error(`Failed to unban ${handle} from global list:`, error);
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Failed to unban from global list: ${error}`,
          status: 'error'
        });
      }
    } else {
      // "unban feed1,feed2" or "unban g mygroup" - specific targets
      let targetFeeds: any[] = [];
      
      for (const target of command.targets) {
        if (target.startsWith('group:')) {
          const groupName = target.substring(6);
          const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
          targetFeeds.push(...groupFeeds);
          console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds for unban`);
        } else {
          const feedMatches = userFeeds.filter(f => 
            f.feed_name.toLowerCase() === target.toLowerCase()
          );
          targetFeeds.push(...feedMatches);
        }
      }
      
      targetFeeds = targetFeeds.filter((feed, index, self) => 
        index === self.findIndex(f => f.feed_id === feed.feed_id)
      );
      
      for (const feed of targetFeeds) {
        try {
          await this.db.unbanUser(user.id, handle, accountDid, feed.feed_id);
          await blueskyService.unbanUser(handle, feed.feed_id, user);
          
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType: 'command',
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Unbanned from feed via command: ${feed.feed_name} (database + Bluesky)`,
            feedId: feed.feed_id,
            status: 'success'
          });
          console.log(`Unbanned ${handle} from ${feed.feed_name} (database + Bluesky)`);
        } catch (error) {
          console.error(`Failed to unban ${handle} from ${feed.feed_name}:`, error);
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType: 'command',
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Failed to unban from feed ${feed.feed_name}: ${error}`,
            feedId: feed.feed_id,
            status: 'error'
          });
        }
      }
    }
  }

  private async executeBanCommand(command: ParsedCommand, user: any, event: ModEventView, userFeeds: any[]) {
    const accountDid = (event.subject as any).$type === 'com.atproto.admin.defs#repoRef'
      ? (event.subject as any).did
      : (event.subject as any).uri?.match(/^at:\/\/([^/]+)/)?.[1];
    
    if (!accountDid) {
      console.error('Could not extract account DID');
      return;
    }
    
    const handle = await this.getHandleFromDid(accountDid);
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    let targetFeeds: any[] = [];
    
    if (command.scope === 'all') {
      targetFeeds = userFeeds;
    } else {
      // Resolve each target (could be feed name or group:name)
      for (const target of command.targets) {
        if (target === 'global') {
          // Handle global ban - database + Bluesky API
          try {
            await this.db.banUser(user.id, handle, accountDid, 'global', null, 'ModMaster ban command', user.did);
            
            // Get global ban list URI and call Bluesky API
            const banLists = await blueskyService.getBanLists(user);
            const globalList = banLists.find(list => list.type === 'global');
            if (globalList) {
              await blueskyService.banUser(handle, globalList.uri, user);
            }
            
            await this.db.logModerationAction({
              post_uri: undefined,
              action: 'modmaster_ban',
              feed_id: undefined,
              moderator_did: user.did,
              reason: 'modmaster_command',
              target_handle: handle
            });
            
            await this.db.addLabelerProcessingLog({
              userId: user.id,
              labelerType: 'modmaster',
              reportType: 'command',
              targetType: 'user',
              targetHandle: handle,
              targetDid: accountDid,
              actionTaken: 'Banned from global ban list via command (database + Bluesky)',
              status: 'success'
            });
            
            console.log(`Banned ${handle} from global ban list (database + Bluesky)`);
          } catch (error) {
            console.error(`Failed to ban ${handle} from global list:`, error);
            await this.db.addLabelerProcessingLog({
              userId: user.id,
              labelerType: 'modmaster',
              reportType: 'command',
              targetType: 'user',
              targetHandle: handle,
              targetDid: accountDid,
              actionTaken: `Failed to ban from global list: ${error}`,
              status: 'error'
            });
          }
        } else if (target.startsWith('group:')) {
          // Group target - resolve to feeds in group
          const groupName = target.substring(6);
          const groupFeeds = await this.db.getFeedsByGroupOrFeedName(user.id, groupName, user.did);
          targetFeeds.push(...groupFeeds);
          console.log(`Resolved group:${groupName} to ${groupFeeds.length} feeds for ban`);
        } else {
          // Individual feed target
          const feedMatches = userFeeds.filter(f => 
            f.feed_name.toLowerCase() === target.toLowerCase()
          );
          targetFeeds.push(...feedMatches);
        }
      }
    }
    
    // Remove duplicates
    targetFeeds = targetFeeds.filter((feed, index, self) => 
      index === self.findIndex(f => f.feed_id === feed.feed_id)
    );
    
    for (const feed of targetFeeds) {
      try {
        await this.db.banUser(user.id, handle, accountDid, feed.feed_id, null, 'ModMaster ban command', user.did);
        
        // Get feed ban list URI and call Bluesky API
        const banLists = await blueskyService.getBanLists(user);
        const feedList = banLists.find(list => list.type === feed.feed_id);
        if (feedList) {
          await blueskyService.banUser(handle, feedList.uri, user);
        }
        
        await this.db.logModerationAction({
          post_uri: undefined,
          action: 'modmaster_ban',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: 'modmaster_command',
          target_handle: handle
        });
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Banned from feed via command: ${feed.feed_name} (database + Bluesky)`,
          feedId: feed.feed_id,
          status: 'success'
        });
        
        console.log(`Banned ${handle} from ${feed.feed_name} (database + Bluesky)`);
      } catch (error) {
        console.error(`Failed to ban ${handle} from ${feed.feed_name}:`, error);
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType: 'command',
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Failed to ban from feed ${feed.feed_name}: ${error}`,
          feedId: feed.feed_id,
          status: 'error'
        });
      }
    }
  }

  private async executeLabelCommand(command: ParsedCommand, event: ModEventView) {
    const uri = (event.subject as any).uri || (event.subject as any).did;
    if (!uri) return;
    
    for (const label of command.targets) {
      await this.applyLabel(uri, label);
    }
  }

  private async executeUnlabelCommand(command: ParsedCommand, event: ModEventView) {
    const uri = (event.subject as any).uri || (event.subject as any).did;
    if (!uri) return;
    
    for (const label of command.targets) {
      await this.removeLabel(uri, label);
    }
  }

  private async executePostAction(postUri: string, user: any, feeds: any[], action: string, reportType: string, isCustomLabeler: boolean = false) {
    if (action === 'remove_all_account') {
      // Remove from ALL user's feeds everywhere (no feed IDs = all feeds)
      await this.grazeService.removePostFromAllFeeds(postUri, user);
      await this.db.logModerationAction({
        post_uri: postUri,
        action: 'remove_post_all_account',
        feed_id: undefined,
        moderator_did: user.did,
        reason: `modmaster_all_account_${reportType}`
      });
      
      // Log to labeler processing logs
      await this.db.addLabelerProcessingLog({
        userId: user.id,
        labelerType: isCustomLabeler ? 'custom' : 'modmaster',
        reportType,
        targetType: 'post',
        postUri,
        actionTaken: 'Removed from ALL account feeds',
        status: 'success'
      });
      
      console.log(`Removed post from ALL account feeds`);
    } else if (action === 'remove_all_configured') {
      for (const feed of feeds) {
        await this.grazeService.removePost(postUri, feed.feed_id, user);
        await this.db.logModerationAction({
          post_uri: postUri,
          action: 'remove_post',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: `modmaster_${reportType}`
        });
        
        // Log to labeler processing logs
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: isCustomLabeler ? 'custom' : 'modmaster',
          reportType,
          targetType: 'post',
          postUri,
          actionTaken: `Removed from feed: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
      }
      console.log(`Removed post from ${feeds.length} configured feeds`);
    } else if (action === 'remove_selected') {
      // Get selected feeds from database
      const settings = isCustomLabeler 
        ? await this.db.getCustomLabelerReportSettings(user.id)
        : await this.db.getModmasterReportSettings(user.id);
      
      const selectedFeedIds = settings.selectedFeeds?.posts?.[reportType] || [];
      
      if (selectedFeedIds.length === 0) {
        console.log(`No selected feeds configured for ${reportType}, falling back to all configured feeds`);
        await this.executePostAction(postUri, user, feeds, 'remove_all_configured', reportType, isCustomLabeler);
        return;
      }
      
      // Filter feeds to only selected ones
      const selectedFeeds = feeds.filter(feed => selectedFeedIds.includes(feed.feed_id));
      
      for (const feed of selectedFeeds) {
        await this.grazeService.removePost(postUri, feed.feed_id, user);
        await this.db.logModerationAction({
          post_uri: postUri,
          action: 'remove_post',
          feed_id: feed.feed_id,
          moderator_did: user.did,
          reason: `modmaster_selected_${reportType}`
        });
        
        // Log to labeler processing logs
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: isCustomLabeler ? 'custom' : 'modmaster',
          reportType,
          targetType: 'post',
          postUri,
          actionTaken: `Removed from selected feed: ${feed.feed_name}`,
          feedId: feed.feed_id,
          status: 'success'
        });
      }
      console.log(`Removed post from ${selectedFeeds.length} selected feeds`);
    }
  }

  private async executeUserAction(accountDid: string, user: any, feeds: any[], action: string, reportType: string) {
    const handle = await this.getHandleFromDid(accountDid);
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    
    // Get or create user profile for the banned user (same as manual ban)
    try {
      const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${accountDid}`);
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        
        let bannedUserProfile = await this.db.getUserProfileByDid(accountDid);
        if (!bannedUserProfile) {
          bannedUserProfile = await this.db.createUserProfile(accountDid, handle, 'none');
        }
        
        // Update with profile data
        await this.db.getPool().query(
          'UPDATE user_profiles SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [profile.displayName || null, profile.avatar || null, bannedUserProfile.id]
        );
      }
    } catch (error) {
      console.error(`Failed to resolve profile for ${accountDid}:`, error);
      // Continue with ban even if profile resolution fails
    }
    
    if (action === 'ban_global_only') {
      try {
        await this.db.banUser(user.id, handle, accountDid, 'global', null, `ModMaster: ${reportType}`, user.did);
        
        // Get global ban list URI and call Bluesky API
        const banLists = await blueskyService.getBanLists(user);
        const globalList = banLists.find(list => list.type === 'global');
        if (globalList) {
          await blueskyService.banUser(handle, globalList.uri, user);
        }
        
        await this.db.logModerationAction({
          post_uri: undefined,
          action: 'modmaster_ban',
          feed_id: undefined,
          moderator_did: user.did,
          reason: `modmaster_global_${reportType}`,
          target_handle: handle
        });
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType,
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: 'Added to global ban list (database + Bluesky)',
          status: 'success'
        });
        
        console.log(`Banned ${handle} from global ban list (database + Bluesky)`);
      } catch (error) {
        console.error(`Failed to ban ${handle} globally:`, error);
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType,
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Failed to ban globally: ${error}`,
          status: 'error'
        });
      }
    } else if (action === 'ban_all_feeds') {
      for (const feed of feeds) {
        try {
          await this.db.banUser(user.id, handle, accountDid, feed.feed_id, null, `ModMaster: ${reportType}`, user.did);
          
          // Get feed ban list URI and call Bluesky API
          const banLists = await blueskyService.getBanLists(user);
          const feedList = banLists.find(list => list.type === feed.feed_id);
          if (feedList) {
            await blueskyService.banUser(handle, feedList.uri, user);
          }
          
          await this.db.logModerationAction({
            post_uri: undefined,
            action: 'modmaster_ban',
            feed_id: feed.feed_id,
            moderator_did: user.did,
            reason: `modmaster_${reportType}`,
            target_handle: handle
          });
          
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType,
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Added to feed ban list: ${feed.feed_name} (database + Bluesky)`,
            feedId: feed.feed_id,
            status: 'success'
          });
        } catch (error) {
          console.error(`Failed to ban ${handle} from ${feed.feed_name}:`, error);
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType,
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Failed to ban from feed ${feed.feed_name}: ${error}`,
            feedId: feed.feed_id,
            status: 'error'
          });
        }
      }
      console.log(`Banned ${handle} from ${feeds.length} feeds (database + Bluesky)`);
    } else if (action === 'ban_global_and_feeds') {
      // Ban from global list
      try {
        await this.db.banUser(user.id, handle, accountDid, 'global', null, `ModMaster: ${reportType}`, user.did);
        
        // Get global ban list URI and call Bluesky API
        const banLists = await blueskyService.getBanLists(user);
        const globalList = banLists.find(list => list.type === 'global');
        if (globalList) {
          await blueskyService.banUser(handle, globalList.uri, user);
        }
        
        await this.db.logModerationAction({
          post_uri: undefined,
          action: 'modmaster_ban',
          feed_id: undefined,
          moderator_did: user.did,
          reason: `modmaster_global_${reportType}`,
          target_handle: handle
        });
        
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType,
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: 'Added to global ban list (database + Bluesky)',
          status: 'success'
        });
      } catch (error) {
        console.error(`Failed to ban ${handle} globally:`, error);
        await this.db.addLabelerProcessingLog({
          userId: user.id,
          labelerType: 'modmaster',
          reportType,
          targetType: 'user',
          targetHandle: handle,
          targetDid: accountDid,
          actionTaken: `Failed to ban globally: ${error}`,
          status: 'error'
        });
      }
      
      // Ban from all feeds
      for (const feed of feeds) {
        try {
          await this.db.banUser(user.id, handle, accountDid, feed.feed_id, null, `ModMaster: ${reportType}`, user.did);
          
          // Get feed ban list URI and call Bluesky API
          const banLists = await blueskyService.getBanLists(user);
          const feedList = banLists.find(list => list.type === feed.feed_id);
          if (feedList) {
            await blueskyService.banUser(handle, feedList.uri, user);
          }
          
          await this.db.logModerationAction({
            post_uri: undefined,
            action: 'modmaster_ban',
            feed_id: feed.feed_id,
            moderator_did: user.did,
            reason: `modmaster_${reportType}`,
            target_handle: handle
          });
          
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType,
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Added to feed ban list: ${feed.feed_name} (database + Bluesky)`,
            feedId: feed.feed_id,
            status: 'success'
          });
        } catch (error) {
          console.error(`Failed to ban ${handle} from ${feed.feed_name}:`, error);
          await this.db.addLabelerProcessingLog({
            userId: user.id,
            labelerType: 'modmaster',
            reportType,
            targetType: 'user',
            targetHandle: handle,
            targetDid: accountDid,
            actionTaken: `Failed to ban from feed ${feed.feed_name}: ${error}`,
            feedId: feed.feed_id,
            status: 'error'
          });
        }
      }
      console.log(`Banned ${handle} from global list and ${feeds.length} feeds (database + Bluesky)`);
    } else if (action === 'ban_selected') {
      // For now, treat as ban_all_feeds since we don't have feed selection UI in reports
      await this.executeUserAction(accountDid, user, feeds, 'ban_all_feeds', reportType);
    }
  }



  private async checkCommunalThresholds(postUri: string, triggerReportType: string) {
    // Get all report types for this post with weights
    const allReports = await this.getWeightedReportCounts(postUri);
    const participatingFeeds = await this.db.getFeedsByOptIn(triggerReportType);
    
    for (const feed of participatingFeeds) {
      const feedSettings = await this.db.getFeedSettings(feed.feed_id);
      const crossTypePercentage = feedSettings?.cross_type_percentage || 20;
      const sameCategoryCrossPercentage = feedSettings?.same_category_cross_percentage || 50;
      
      for (const [reportType, count] of Object.entries(allReports)) {
        const threshold = await this.db.getThresholdForReportType(feed.feed_id, reportType);
        const mainCategory = reportType.split('-')[0];
        
        const sameCategoryCount = Object.entries(allReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] === mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const globalCrossCount = Object.entries(allReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] !== mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const sameCategoryCrossContribution = Math.floor(sameCategoryCount * (sameCategoryCrossPercentage / 100));
        const globalCrossContribution = Math.floor(globalCrossCount * (crossTypePercentage / 100));
        const totalEffectiveCount = count + sameCategoryCrossContribution + globalCrossContribution;
        
        if (totalEffectiveCount >= threshold) {
          const feedOwner = await this.db.getUserById(feed.user_id);
          if (feedOwner) {
            await this.grazeService.removePost(postUri, feed.feed_id, feedOwner);
            await this.db.logModerationAction({
              post_uri: postUri,
              action: 'remove_post',
              feed_id: feed.feed_id,
              moderator_did: 'system',
              reason: `threshold_${reportType}_${totalEffectiveCount.toFixed(1)}`
            });
          }
        }
      }
    }
  }

  private async checkUserBanThresholds(userDid: string, triggerReportType: string) {
    const allUserReports = await this.getWeightedUserReportCounts(userDid);
    const participatingFeeds = await this.db.getFeedsByOptIn(triggerReportType);
    
    for (const feed of participatingFeeds) {
      const feedSettings = await this.db.getFeedSettings(feed.feed_id);
      const crossTypePercentage = feedSettings?.user_ban_cross_type_percentage || feedSettings?.cross_type_percentage || 20;
      const sameCategoryCrossPercentage = feedSettings?.user_ban_same_category_cross_percentage || feedSettings?.same_category_cross_percentage || 50;
      
      for (const [reportType, count] of Object.entries(allUserReports)) {
        const threshold = await this.db.getUserBanThresholdForReportType(feed.feed_id, reportType);
        const mainCategory = reportType.split('-')[0];
        
        const sameCategoryCount = Object.entries(allUserReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] === mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const globalCrossCount = Object.entries(allUserReports)
          .filter(([type]) => type !== reportType && type.split('-')[0] !== mainCategory)
          .reduce((sum, [, cnt]) => sum + cnt, 0);
        
        const sameCategoryCrossContribution = Math.floor(sameCategoryCount * (sameCategoryCrossPercentage / 100));
        const globalCrossContribution = Math.floor(globalCrossCount * (crossTypePercentage / 100));
        const totalEffectiveCount = count + sameCategoryCrossContribution + globalCrossContribution;
        
        if (totalEffectiveCount >= threshold) {
          const feedOwner = await this.db.getUserById(feed.user_id);
          if (feedOwner) {
            const handle = await this.getHandleFromDid(userDid);
            
            // Get or create user profile for the banned user (same as manual ban)
            try {
              const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${userDid}`);
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                
                let bannedUserProfile = await this.db.getUserProfileByDid(userDid);
                if (!bannedUserProfile) {
                  bannedUserProfile = await this.db.createUserProfile(userDid, handle, 'none');
                }
                
                // Update with profile data
                await this.db.getPool().query(
                  'UPDATE user_profiles SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                  [profile.displayName || null, profile.avatar || null, bannedUserProfile.id]
                );
              }
            } catch (error) {
              console.error(`Failed to resolve profile for ${userDid}:`, error);
              // Continue with ban even if profile resolution fails
            }
            
            // Check if user is already banned from this feed to avoid constraint violations
            const isAlreadyBanned = await this.db.isUserBanned(feed.user_id, handle, feed.feed_id, null);
            if (isAlreadyBanned) {
              console.log(`User ${handle} is already banned from ${feed.feed_name}, skipping auto-ban`);
              continue;
            }
            
            try {
              await this.db.banUser(feed.user_id, handle, userDid, feed.feed_id, null, 
                `ModMaster auto-ban: ${reportType} threshold reached`, 'system');
              
              // Call Bluesky API for automatic threshold ban
              const { BlueskyService } = await import('./bluesky.js');
              const blueskyService = new BlueskyService();
              const banLists = await blueskyService.getBanLists(feedOwner);
              const feedList = banLists.find(list => list.type === feed.feed_id);
              if (feedList) {
                await blueskyService.banUser(handle, feedList.uri, feedOwner);
              }
              
              await this.db.logModerationAction({
                post_uri: undefined,
                action: 'modmaster_auto_ban',
                feed_id: feed.feed_id,
                moderator_did: 'system',
                reason: `user_ban_threshold_${reportType}_${totalEffectiveCount.toFixed(1)}`,
                target_handle: handle
              });
            } catch (error) {
              console.error(`Failed to auto-ban ${handle} from ${feed.feed_name}:`, error);
            }
          }
        }
      }
    }
  }

  private async getWeightedReportCounts(postUri: string): Promise<Record<string, number>> {
    const result = await this.db.pool.query(
      'SELECT report_type, SUM(report_weight) as weighted_count FROM post_reports WHERE post_uri = $1 AND source IN (\'app\', \'ozone\', \'communal\') GROUP BY report_type',
      [postUri]
    );
    
    const reportCounts: Record<string, number> = {};
    for (const row of result.rows) {
      reportCounts[row.report_type] = parseFloat(row.weighted_count);
    }
    return reportCounts;
  }

  private async getWeightedUserReportCounts(userDid: string): Promise<Record<string, number>> {
    const result = await this.db.pool.query(
      'SELECT report_type, SUM(report_weight) as weighted_count FROM user_reports WHERE reported_user_did = $1 AND source IN (\'app\', \'ozone\', \'communal\') GROUP BY report_type',
      [userDid]
    );
    
    const reportCounts: Record<string, number> = {};
    for (const row of result.rows) {
      reportCounts[row.report_type] = parseFloat(row.weighted_count);
    }
    return reportCounts;
  }

  private async applyLabel(uri: string, label: string) {
    try {
      await this.modMasterAgent.api.tools.ozone.moderation.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [label],
            negateLabelVals: [],
          },
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: uri,
            cid: '',
          },
          createdBy: process.env.LABELER_DID!,
        },
        {
          headers: {
            'atproto-proxy': `${process.env.LABELER_DID}#atproto_labeler`,
          },
          encoding: 'application/json'
        }
      );
      console.log(`Applied label "${label}" to ${uri}`);
    } catch (error) {
      console.error(`Failed to apply label "${label}":`, error);
    }
  }

  private async removeLabel(uri: string, label: string) {
    try {
      await this.modMasterAgent.api.tools.ozone.moderation.emitEvent(
        {
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [],
            negateLabelVals: [label],
          },
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: uri,
            cid: '',
          },
          createdBy: process.env.LABELER_DID!,
        },
        {
          headers: {
            'atproto-proxy': `${process.env.LABELER_DID}#atproto_labeler`,
          },
          encoding: 'application/json'
        }
      );
      console.log(`Removed label "${label}" from ${uri}`);
    } catch (error) {
      console.error(`Failed to remove label "${label}":`, error);
    }
  }

  private parseReportType(reportTypeReason: string): string {
    if (reportTypeReason.startsWith('tools.ozone.report.defs#reason')) {
      const reasonPart = reportTypeReason.substring('tools.ozone.report.defs#reason'.length);
      let converted = reasonPart.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
      converted = converted.replace('-e-d', '-ed').replace('-n-c-i-i', '-ncii');
      return converted;
    }
    
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



  private async getHandleFromDid(did: string): Promise<string> {
    try {
      const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`);
      const profile = await response.json();
      return profile.handle || did;
    } catch (error) {
      console.error(`Failed to get handle for ${did}:`, error);
      return did;
    }
  }
}
