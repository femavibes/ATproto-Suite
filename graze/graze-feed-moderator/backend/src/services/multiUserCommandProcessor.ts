import { Database } from './database.js';
import { GrazeService } from './graze.js';
import { ModMasterCommandParser, ParsedCommand } from './modMasterCommandParser.js';
import { User, CommandCandidate, ValidatedCommand } from '../types/index.js';
import type { ModEventView } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs';

export class MultiUserCommandProcessor {
  private db: Database;
  private grazeService: GrazeService;
  private commandParser: ModMasterCommandParser;

  constructor(db: Database, grazeService: GrazeService) {
    this.db = db;
    this.grazeService = grazeService;
    this.commandParser = new ModMasterCommandParser();
  }

  async processCommands(event: ModEventView, comment: string, user: User): Promise<void> {
    try {
      // 1. Parse commands using the new parser
      const parsedCommands = this.commandParser.parseCommands(comment);
      
      if (parsedCommands.length === 0) {
        return; // No commands found
      }
      
      // 2. Get user feeds for validation
      const userFeeds = await this.db.getUserFeeds(user.id);
      const userFeedNames = userFeeds.map(f => f.feed_name || f.feed_id);
      const isAdmin = user.is_admin || false;
      const isCustomLabeler = await this.hasCustomLabeler(user.id);
      
      // 3. Process each command
      for (const command of parsedCommands) {
        // Enhanced validation that includes group permissions
        const validation = await this.validateCommandWithGroups(command, userFeedNames, isCustomLabeler, isAdmin, user, userFeeds);
        if (!validation.valid) {
          console.log(`Invalid command: ${validation.error}`);
          continue;
        }
        
        // Execute command
        await this.executeNewCommand(command, user, event);
      }
      
    } catch (error) {
      console.error('Command processing error:', error);
      // Log failed processing
      await this.db.logCommandExecution({
        reporter_did: user.did,
        post_uri: (event.subject as any).uri || 'unknown',
        command_type: 'command_processing',
        command_text: comment,
        affected_feeds: [],
        execution_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateCommandWithGroups(
    command: ParsedCommand, 
    userFeedNames: string[], 
    isCustomLabeler: boolean, 
    isAdmin: boolean, 
    user: User,
    userFeeds: any[]
  ): Promise<{valid: boolean; error?: string}> {
    // First run basic validation
    const basicValidation = this.commandParser.validateCommand(command, userFeedNames, isCustomLabeler, isAdmin);
    if (!basicValidation.valid) {
      return basicValidation;
    }
    
    // Additional validation for group targets and delegated moderator restrictions
    const moderatedGroups = await this.db.getModeratedGroups(user.did);
    const isDelegatedModerator = moderatedGroups.length > 0;
    
    for (const target of command.targets) {
      if (target.startsWith('group:')) {
        const groupName = target.substring(6);
        
        // Check if user owns the group
        const group = await this.db.findGlobalFeedGroup(groupName);
        if (!group) {
          return {
            valid: false,
            error: `Group '${groupName}' not found`
          };
        }
        
        if (group.owner_user_id === user.id) {
          continue; // User owns the group, allowed
        }
        
        // Check if user has moderator permission
        const hasPermission = await this.db.hasGroupPermission(groupName, user.did, 'remove');
        if (!hasPermission) {
          return {
            valid: false,
            error: `You don't have permission to moderate group '${groupName}'`
          };
        }
      } else if (target !== 'global' && target !== 'all') {
        // For individual feed names, check if user is a delegated moderator
        if (isDelegatedModerator) {
          // Check if this is a feed they don't own but have group access to
          const ownsFeed = userFeeds.some(f => f.feed_name === target || f.feed_id === target);
          if (!ownsFeed) {
            return {
              valid: false,
              error: `Delegated moderators can only use group commands (e.g., 'g groupname'). Individual feed commands are restricted to feed owners.`
            };
          }
        }
      }
    }
    
    return { valid: true };
  }

  private async executeNewCommand(command: ParsedCommand, user: User, event: ModEventView): Promise<void> {
    const isPostReport = (event.subject as any).$type === 'com.atproto.repo.strongRef';
    const isAccountReport = (event.subject as any).$type === 'com.atproto.repo.repoRef';
    const postUri = isPostReport ? (event.subject as any).uri : null;
    const accountDid = isAccountReport ? (event.subject as any).did : null;
    
    // Extract user DID for commands that need it
    const targetUserDid = isPostReport ? this.extractAuthorFromPostUri(postUri!) : accountDid;
    
    switch (command.type) {
      case 'remove':
        // Only works on post reports - ignore account reports
        if (isPostReport && postUri) {
          await this.handleRemoveCommand(command, postUri, user);
        }
        break;
        
      case 'restore':
        // Only works on post reports - ignore account reports
        if (isPostReport && postUri) {
          await this.handleRestoreCommand(command, postUri, user);
        }
        break;
        
      case 'ban':
        if (targetUserDid) {
          await this.handleBanCommand(command, targetUserDid, user);
          // Also remove content when banning
          if (isPostReport && postUri) {
            await this.handleRemoveCommand(command, postUri, user);
          } else if (isAccountReport && targetUserDid) {
            await this.handleBulkRemoveFromAccount(targetUserDid, command.targets, user, 10);
          }
        }
        break;
        
      case 'unban':
        if (targetUserDid) {
          await this.handleUnbanCommand(command, targetUserDid, user);
        }
        break;
        
      case 'bulk_remove':
        // Works on both post and account reports - extract user DID
        if (targetUserDid) {
          await this.handleBulkRemoveFromAccount(targetUserDid, command.targets, user, command.count || 10);
        }
        break;
        
      case 'bulk_restore':
        // Works on both post and account reports - extract user DID
        if (targetUserDid) {
          await this.handleBulkRestoreFromAccount(targetUserDid, command.targets, user, command.count || 10);
        }
        break;
        
      case 'label':
      case 'unlabel':
        // TODO: Implement label commands for custom labelers and admins
        console.log(`Label command ${command.type} not yet implemented`);
        break;
    }
    
    // Log successful execution with resolved feed IDs
    const resolvedFeeds = await this.resolveFeedTargets(command, user);
    await this.db.logCommandExecution({
      reporter_did: user.did,
      post_uri: postUri || accountDid || 'unknown',
      command_type: command.type,
      command_text: `${command.type} ${command.targets.join(',')}`,
      affected_feeds: resolvedFeeds,
      execution_status: 'success'
    });
  }

  private async handleRemoveCommand(command: ParsedCommand, postUri: string, user: User): Promise<void> {
    const feedIds = await this.resolveFeedTargets(command, user);
    
    if (command.scope === 'all' || feedIds.includes('all')) {
      // Use graze "all" endpoint
      await this.grazeService.removePost(postUri, 'all', user);
    } else {
      // Remove from specific feeds
      for (const feedId of feedIds) {
        await this.grazeService.removePost(postUri, feedId, user);
      }
    }
    
    // Log to database for restoration tracking
    await this.db.logPostRemoval(postUri, feedIds, user.id, 'command_remove');
  }
  
  private async handleRestoreCommand(command: ParsedCommand, postUri: string, user: User): Promise<void> {
    const feedIds = await this.resolveFeedTargets(command, user);
    
    if (command.scope === 'all' || feedIds.includes('all')) {
      // Use graze "restore all" endpoint
      await this.grazeService.restorePost(postUri, 'all', user);
    } else {
      // Restore to specific feeds
      for (const feedId of feedIds) {
        await this.grazeService.restorePost(postUri, feedId, user);
      }
    }
    
    // Log restoration
    await this.db.logPostRestoration(postUri, feedIds, user.id, 'command_restore');
  }
  
  private async handleBanCommand(command: ParsedCommand, userDid: string, moderator: User): Promise<void> {
    const feedIds = await this.resolveFeedTargets(command, moderator);
    
    // Get user handle
    const userHandle = await this.getUserHandle(userDid);
    
    // Ban from resolved feed IDs (handles both individual feeds and group expansions)
    for (const feedId of feedIds) {
      if (feedId === 'global') {
        await this.db.banUser(moderator.id, userHandle, userDid, 'global', null, 'command_ban', moderator.did);
      } else {
        // Ban from specific feed
        await this.db.banUser(moderator.id, userHandle, userDid, feedId, null, 'command_ban', moderator.did);
      }
    }
  }
  
  private async handleUnbanCommand(command: ParsedCommand, userDid: string, moderator: User): Promise<void> {
    const feedIds = await this.resolveFeedTargets(command, moderator);
    const userHandle = await this.getUserHandle(userDid);
    
    // Unban from resolved feed IDs (handles both individual feeds and group expansions)
    for (const feedId of feedIds) {
      if (feedId === 'global') {
        await this.db.unbanUser(moderator.id, userHandle, userDid, 'global');
      } else {
        await this.db.unbanUser(moderator.id, userHandle, userDid, feedId);
      }
    }
  }
  
  private async handleBulkRemoveFromAccount(accountDid: string, targets: string[], user: User, count: number): Promise<void> {
    const userHandle = await this.getUserHandle(accountDid);
    
    // Get recent posts
    const { BlueskyService } = await import('./bluesky.js');
    const blueskyService = new BlueskyService();
    const recentPosts = await blueskyService.getUserRecentPosts(userHandle, count, user);
    
    // Remove each post using the same target resolution logic
    for (const postUri of recentPosts) {
      const command: ParsedCommand = {
        type: 'remove',
        targets,
        scope: targets.length === 0 ? 'all' : 'specific'
      };
      await this.handleRemoveCommand(command, postUri, user);
    }
  }
  
  private async handleBulkRestoreFromAccount(accountDid: string, targets: string[], user: User, count: number): Promise<void> {
    // Get recently removed posts for this account
    const recentlyRemoved = await this.db.getRecentlyRemovedPosts(accountDid, count, user.id);
    
    // Restore each post using the same target resolution logic
    for (const postUri of recentlyRemoved) {
      const command: ParsedCommand = {
        type: 'restore',
        targets,
        scope: targets.length === 0 ? 'all' : 'specific'
      };
      await this.handleRestoreCommand(command, postUri, user);
    }
  }
  
  private async resolveFeedTargets(command: ParsedCommand, user: User): Promise<string[]> {
    const userFeeds = await this.db.getUserFeeds(user.id);
    
    if (command.scope === 'all') {
      // "remove all" / "restore all" = single API call to ALL feeds
      return ['all'];
    }
    
    if (command.scope === 'specific' && command.targets.length === 0) {
      // "remove" / "restore" with no targets = all configured feeds (multiple API calls)
      return userFeeds.map(f => f.feed_id);
    }
    
    const feedIds: string[] = [];
    
    for (const target of command.targets) {
      if (target === 'global') {
        feedIds.push('global');
      } else if (target === 'all') {
        feedIds.push('all');
      } else if (target.startsWith('group:')) {
        // Handle group targets with permission checking
        const groupName = target.substring(6); // Remove 'group:' prefix
        const groupFeeds = await this.resolveGroupTarget(groupName, user);
        feedIds.push(...groupFeeds);
      } else {
        // Find matching feed by name or ID (only from user's own feeds)
        const matchingFeeds = userFeeds.filter(f => 
          f.feed_name === target || f.feed_id === target
        );
        // Add all matching feeds (handles duplicate names within user's feeds)
        for (const feed of matchingFeeds) {
          feedIds.push(feed.feed_id);
        }
      }
    }
    
    return feedIds;
  }

  private async resolveGroupTarget(groupName: string, user: User): Promise<string[]> {
    try {
      // Check if user owns the group OR has moderator permission
      const group = await this.db.findGlobalFeedGroup(groupName);
      if (!group) {
        console.log(`Group '${groupName}' not found`);
        return [];
      }
      
      // Check if user owns the group
      if (group.owner_user_id === user.id) {
        const feeds = await this.db.getFeedsInGroup(group.id);
        return feeds.map(f => f.feed_id);
      }
      
      // Check if user has moderator permission
      const hasPermission = await this.db.hasGroupPermission(groupName, user.did, 'remove');
      if (hasPermission) {
        const feeds = await this.db.getFeedsInGroup(group.id);
        return feeds.map(f => f.feed_id);
      }
      
      console.log(`User ${user.handle} does not have permission to moderate group '${groupName}'`);
      return [];
    } catch (error) {
      console.error(`Error resolving group target '${groupName}':`, error);
      return [];
    }
  }
  
  private async getUserHandle(userDid: string): Promise<string> {
    try {
      const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${userDid}`);
      const profile = await response.json();
      return profile.handle || userDid;
    } catch {
      return userDid;
    }
  }
  
  private async hasCustomLabeler(userId: number): Promise<boolean> {
    // Check if user has configured a custom labeler
    try {
      const customLabeler = await this.db.getCustomLabeler(userId);
      return customLabeler !== null;
    } catch {
      return false;
    }
  }

  // Legacy method - keeping for backward compatibility
  private async executeCommand(command: ValidatedCommand, user: User, event: ModEventView): Promise<void> {
    // This method is now deprecated in favor of executeNewCommand
    console.log('Using legacy executeCommand - consider updating to new command system');
  }
  
  private async executeRemovePost(postUri: string, feedIds: string[], user: User, reason: string): Promise<void> {
    if (feedIds.includes('all') || feedIds.length > 1) {
      // Use graze hidepost all endpoint for multiple feeds
      await this.grazeService.removePost(postUri, 'all', user);
    } else {
      // Remove from specific feed
      for (const feedId of feedIds) {
        await this.grazeService.removePost(postUri, feedId, user);
      }
    }
    
    // Log moderation actions
    for (const feedId of feedIds) {
      await this.db.logModerationAction({
        post_uri: postUri,
        action: 'remove_post',
        feed_id: feedId === 'all' ? undefined : feedId,
        moderator_did: user.did,
        reason: reason
      });
    }
  }
  
  private async executeRemoveAccountPosts(accountDid: string, feedIds: string[], user: User, reason: string): Promise<void> {
    try {
      // Get user handle from DID
      let userHandle = accountDid;
      try {
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${accountDid}`);
        const userProfile = await profileResponse.json();
        userHandle = userProfile.handle || accountDid;
      } catch {
        // Use DID if handle resolution fails
      }
      
      // Get recent posts using backfill logic (default 10 posts)
      const { BlueskyService } = await import('./bluesky.js');
      const blueskyService = new BlueskyService();
      const recentPosts = await blueskyService.getUserRecentPosts(userHandle, 10, user);
      
      console.log(`Removing ${recentPosts.length} recent posts from account ${userHandle} for feeds:`, feedIds);
      
      // Remove each post from specified feeds
      for (const postUri of recentPosts) {
        if (feedIds.includes('all') || feedIds.length > 1) {
          // Use graze hidepost all endpoint for multiple feeds
          await this.grazeService.removePost(postUri, 'all', user);
        } else {
          // Remove from specific feeds
          for (const feedId of feedIds) {
            try {
              await this.grazeService.removePost(postUri, feedId, user);
            } catch (error) {
              // Continue on error (post might not exist in feed)
              console.log(`Post ${postUri} not found in feed ${feedId}`);
            }
          }
        }
        
        // Log moderation actions
        for (const feedId of feedIds) {
          await this.db.logModerationAction({
            post_uri: postUri,
            action: 'account_post_removal',
            feed_id: feedId === 'all' ? undefined : feedId,
            moderator_did: user.did,
            reason: `${reason}_account_${userHandle}`
          });
        }
      }
    } catch (error) {
      console.error(`Failed to remove account posts for ${accountDid}:`, error);
    }
  }
  
  private async executeBanUser(userDid: string, feedIds: string[], moderator: User, reason: string): Promise<void> {
    try {
      // Get handle for display (optional, fallback to DID)
      let userHandle = userDid;
      try {
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${userDid}`);
        const userProfile = await profileResponse.json();
        userHandle = userProfile.handle || userDid;
      } catch {
        // Use DID if handle resolution fails
      }
      
      // Add to ban lists for specified feeds/groups
      for (const feedId of feedIds) {
        if (feedId === 'all') {
          // Global ban - use user's global ban list
          await this.db.banUser(
            moderator.id,
            userHandle,
            userDid,
            'global',
            null,
            reason,
            moderator.did
          );
        } else {
          // Check if this feedId corresponds to a group or individual feed
          const group = await this.db.findGlobalFeedGroup(feedId);
          if (group && group.group_ban_list) {
            // Use group ban list
            await this.db.banUser(
              moderator.id,
              userHandle,
              userDid,
              'group',
              group.id.toString(),
              reason,
              moderator.did
            );
          } else {
            // Check individual feed ban list
            const feed = await this.db.getFeedById(feedId);
            if (feed && feed.feed_ban_list) {
              // Use feed ban list
              await this.db.banUser(
                moderator.id,
                userHandle,
                userDid,
                feedId,
                null,
                reason,
                moderator.did
              );
            } else {
              // Fallback to global ban list
              await this.db.banUser(
                moderator.id,
                userHandle,
                userDid,
                'global',
                null,
                reason,
                moderator.did
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to ban user ${userDid}:`, error);
    }
  }
  
  private extractAuthorFromPostUri(postUri: string): string | null {
    // Extract author DID from AT URI: at://did:plc:abc123/app.bsky.feed.post/xyz
    const match = postUri.match(/^at:\/\/([^/]+)/);
    return match ? match[1] : null;
  }

  async validateUserFeedAccess(userId: number, feedIds: string[]): Promise<string[]> {
    // Validate user owns the target feeds
    const userFeeds = await this.db.getUserFeeds(userId);
    const userFeedIds = userFeeds.map(f => f.feed_id);
    
    // Return only feeds the user actually owns
    return feedIds.filter(id => userFeedIds.includes(id));
  }

  async canExecuteCommands(userDid: string): Promise<boolean> {
    // Commands only execute if reporter is registered user
    const user = await this.db.getUserByDid(userDid);
    return user !== null;
  }
}