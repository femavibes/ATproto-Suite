import express from 'express';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';
import { Database } from '../services/database.js';
import { ModMasterCommandParser } from '../services/modMasterCommandParser.js';
import { GrazeService } from '../services/graze.js';

const router = express.Router();
const db = Database.getInstance();

// Helper function to normalize feed names from browser extension
function normalizeFeedName(feedName: string): string {
  // Remove number prefix like "(1) " from "(1) Urbanism+"
  return feedName.replace(/^\(\d+\)\s+/, '');
}

// Get user profile and feeds
router.get('/user/profile', authenticateApiKey, async (req: any, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    const feeds = await db.getUserFeeds(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        did: user.did,
        handle: user.handle,
        subscription_tier: user.subscription_tier,
        is_admin: user.is_admin
      },
      feeds: feeds.map(feed => ({
        id: feed.feed_id,
        name: feed.feed_name,
        display_name: feed.feed_display_name,
        feed_slug: feed.feed_slug,
        bluesky_feed_name: feed.bluesky_feed_name
      }))
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Ban user
router.post('/moderation/ban', authenticateApiKey, async (req: any, res) => {
  try {
    const { handle, targets = ['global'] } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFeeds = await db.getUserFeeds(req.user.userId);
    const feedSlugs = userFeeds.map(f => f.feed_slug).filter((slug): slug is string => Boolean(slug));
    const blueskyFeedNames = userFeeds.map(f => f.bluesky_feed_name).filter((name): name is string => Boolean(name));

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const commands = parser.parseCommands(`ban ${targets.join(',')}`);
    const command = commands[0]; // Take first command
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid ban command' });
    }
    
    // Validate against slugs and bluesky names only
    const allValidFeeds = [...feedSlugs, ...blueskyFeedNames];
    const validation = parser.validateCommand(command, allValidFeeds, false, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute ban - simplified approach
    try {
      const { BlueskyService } = await import('../services/bluesky.js');
      const blueskyService = new BlueskyService();
      
      if (command.targets.includes('global') || command.scope === 'all') {
        // Ban from global list
        await db.banUser(req.user.userId, handle, null, 'global', null, 'Browser extension ban', user.did);
        
        // Also ban from Bluesky if possible
        try {
          const banLists = await blueskyService.getBanLists(user);
          const globalList = banLists.find(list => list.type === 'global');
          if (globalList) {
            await blueskyService.banUser(handle, globalList.uri, user);
          }
        } catch (bskyError) {
          console.error('Bluesky ban failed:', bskyError);
        }
      }
      
      // Ban from specific feeds if targets specified
      const userFeeds = await db.getUserFeeds(req.user.userId);
      const targetFeeds = command.targets.filter(t => t !== 'global');
      
      for (const target of targetFeeds) {
        const normalizedTarget = normalizeFeedName(target);
        const feed = userFeeds.find(f => 
          (f.feed_slug && f.feed_slug.toLowerCase() === normalizedTarget.toLowerCase()) ||
          (f.bluesky_feed_name && f.bluesky_feed_name.toLowerCase() === normalizedTarget.toLowerCase())
        );
        if (feed) {
          await db.banUser(req.user.userId, handle, null, feed.feed_id, null, 'Browser extension ban', user.did);
          
          try {
            const banLists = await blueskyService.getBanLists(user);
            const feedList = banLists.find(list => list.type === feed.feed_id);
            if (feedList) {
              await blueskyService.banUser(handle, feedList.uri, user);
            }
          } catch (bskyError) {
            console.error(`Bluesky ban failed for ${feed.feed_name}:`, bskyError);
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `User ${handle} banned successfully`,
        targets: command.targets
      });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user
router.post('/moderation/unban', authenticateApiKey, async (req: any, res) => {
  try {
    const { handle, targets = ['global'] } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFeeds = await db.getUserFeeds(req.user.userId);
    const feedSlugs = userFeeds.map(f => f.feed_slug).filter((slug): slug is string => Boolean(slug));
    const blueskyFeedNames = userFeeds.map(f => f.bluesky_feed_name).filter((name): name is string => Boolean(name));

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const commands = parser.parseCommands(`unban ${targets.join(',')}`);
    const command = commands[0];
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid unban command' });
    }
    
    // Validate against slugs and bluesky names only
    const allValidFeeds = [...feedSlugs, ...blueskyFeedNames];
    const validation = parser.validateCommand(command, allValidFeeds, false, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute unban - simplified approach
    try {
      const { BlueskyService } = await import('../services/bluesky.js');
      const blueskyService = new BlueskyService();
      
      if (command.targets.includes('global') || command.scope === 'all') {
        // Unban from global list
        await db.unbanUser(req.user.userId, handle, null, 'global');
        
        try {
          await blueskyService.unbanUser(handle, 'global', user);
        } catch (bskyError) {
          console.error('Bluesky unban failed:', bskyError);
        }
      }
      
      // Unban from specific feeds if targets specified
      const userFeeds = await db.getUserFeeds(req.user.userId);
      const targetFeeds = command.targets.filter(t => t !== 'global');
      
      for (const target of targetFeeds) {
        const normalizedTarget = normalizeFeedName(target);
        const feed = userFeeds.find(f => 
          (f.feed_slug && f.feed_slug.toLowerCase() === normalizedTarget.toLowerCase()) ||
          (f.bluesky_feed_name && f.bluesky_feed_name.toLowerCase() === normalizedTarget.toLowerCase())
        );
        if (feed) {
          await db.unbanUser(req.user.userId, handle, null, feed.feed_id);
          
          try {
            await blueskyService.unbanUser(handle, feed.feed_id, user);
          } catch (bskyError) {
            console.error(`Bluesky unban failed for ${feed.feed_name}:`, bskyError);
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `User ${handle} unbanned successfully`,
        targets: command.targets
      });
    } catch (error) {
      console.error('Unban user error:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Remove post
router.post('/moderation/remove', authenticateApiKey, async (req: any, res) => {
  try {
    const { postUri, targets = [] } = req.body;
    
    if (!postUri) {
      return res.status(400).json({ error: 'Post URI is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFeeds = await db.getUserFeeds(req.user.userId);
    const feedSlugs = userFeeds.map(f => f.feed_slug).filter((slug): slug is string => Boolean(slug));
    const blueskyFeedNames = userFeeds.map(f => f.bluesky_feed_name).filter((name): name is string => Boolean(name));

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const targetString = targets.length > 0 ? targets.join(',') : '';
    const commands = parser.parseCommands(`remove ${targetString}`);
    const command = commands[0];
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid remove command' });
    }
    
    // Validate against slugs and bluesky names only
    const allValidFeeds = [...feedSlugs, ...blueskyFeedNames];
    const validation = parser.validateCommand(command, allValidFeeds, false, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute remove - simplified approach
    try {
      const grazeService = new GrazeService();
      const userFeeds = await db.getUserFeeds(req.user.userId);
      
      if (command.scope === 'all' || command.targets.includes('all')) {
        // Remove from all feeds
        await grazeService.removePost(postUri, 'all', user);
        await db.logModerationAction({
          post_uri: postUri,
          action: 'remove_post_all',
          feed_id: undefined,
          moderator_did: user.did,
          reason: 'modmaster_browser'
        });
      } else if (command.targets.length === 0) {
        // Remove from all configured feeds
        for (const feed of userFeeds) {
          await grazeService.removePost(postUri, feed.feed_id, user);
          await db.logModerationAction({
            post_uri: postUri,
            action: 'remove_post',
            feed_id: feed.feed_id,
            moderator_did: user.did,
            reason: 'modmaster_browser'
          });
        }
      } else {
        // Remove from specific feeds (match by name, slug, or bluesky name)
        for (const target of command.targets) {
          const normalizedTarget = normalizeFeedName(target);
          const feed = userFeeds.find(f => 
            (f.feed_slug && f.feed_slug.toLowerCase() === normalizedTarget.toLowerCase()) ||
            (f.bluesky_feed_name && f.bluesky_feed_name.toLowerCase() === normalizedTarget.toLowerCase())
          );
          if (feed) {
            await grazeService.removePost(postUri, feed.feed_id, user);
            await db.logModerationAction({
              post_uri: postUri,
              action: 'remove_post',
              feed_id: feed.feed_id,
              moderator_did: user.did,
              reason: 'modmaster_browser'
            });
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Post removed successfully',
        targets: command.targets.length > 0 ? command.targets : ['configured feeds']
      });
    } catch (error) {
      console.error('Remove post error:', error);
      res.status(500).json({ error: 'Failed to remove post' });
    }
  } catch (error) {
    console.error('Remove post error:', error);
    res.status(500).json({ error: 'Failed to remove post' });
  }
});

// Restore post
router.post('/moderation/restore', authenticateApiKey, async (req: any, res) => {
  try {
    const { postUri, targets = [] } = req.body;
    
    if (!postUri) {
      return res.status(400).json({ error: 'Post URI is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFeeds = await db.getUserFeeds(req.user.userId);
    const feedSlugs = userFeeds.map(f => f.feed_slug).filter((slug): slug is string => Boolean(slug));
    const blueskyFeedNames = userFeeds.map(f => f.bluesky_feed_name).filter((name): name is string => Boolean(name));

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const targetString = targets.length > 0 ? targets.join(',') : '';
    const commands = parser.parseCommands(`restore ${targetString}`);
    const command = commands[0];
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid restore command' });
    }
    
    // Validate against slugs and bluesky names only
    const allValidFeeds = [...feedSlugs, ...blueskyFeedNames];
    const validation = parser.validateCommand(command, allValidFeeds, false, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute restore - simplified approach
    try {
      const grazeService = new GrazeService();
      const userFeeds = await db.getUserFeeds(req.user.userId);
      
      if (command.scope === 'all' || command.targets.includes('all')) {
        // Restore to all feeds
        await grazeService.restorePost(postUri, 'all', user);
        await db.logModerationAction({
          post_uri: postUri,
          action: 'restore_post_all',
          feed_id: undefined,
          moderator_did: user.did,
          reason: 'modmaster_browser'
        });
      } else if (command.targets.length === 0) {
        // Restore to all configured feeds
        for (const feed of userFeeds) {
          await grazeService.restorePost(postUri, feed.feed_id, user);
          await db.logModerationAction({
            post_uri: postUri,
            action: 'restore_post',
            feed_id: feed.feed_id,
            moderator_did: user.did,
            reason: 'modmaster_browser'
          });
        }
      } else {
        // Restore to specific feeds (match by name, slug, or bluesky name)
        for (const target of command.targets) {
          const normalizedTarget = normalizeFeedName(target);
          const feed = userFeeds.find(f => 
            (f.feed_slug && f.feed_slug.toLowerCase() === normalizedTarget.toLowerCase()) ||
            (f.bluesky_feed_name && f.bluesky_feed_name.toLowerCase() === normalizedTarget.toLowerCase())
          );
          if (feed) {
            await grazeService.restorePost(postUri, feed.feed_id, user);
            await db.logModerationAction({
              post_uri: postUri,
              action: 'restore_post',
              feed_id: feed.feed_id,
              moderator_did: user.did,
              reason: 'modmaster_browser'
            });
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Post restored successfully',
        targets: command.targets.length > 0 ? command.targets : ['configured feeds']
      });
    } catch (error) {
      console.error('Restore post error:', error);
      res.status(500).json({ error: 'Failed to restore post' });
    }
  } catch (error) {
    console.error('Restore post error:', error);
    res.status(500).json({ error: 'Failed to restore post' });
  }
});

// Apply labels (for custom labelers)
router.post('/moderation/label', authenticateApiKey, async (req: any, res) => {
  try {
    const { postUri, labels } = req.body;
    
    if (!postUri || !labels || !Array.isArray(labels)) {
      return res.status(400).json({ error: 'Post URI and labels array are required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has custom labeler configured
    const customLabeler = await db.getCustomLabeler(req.user.userId);
    if (!customLabeler) {
      return res.status(403).json({ error: 'Custom labeler not configured' });
    }

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const commands = parser.parseCommands(`label ${labels.join(',')}`);
    const command = commands[0];
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid label command' });
    }
    
    const validation = parser.validateCommand(command, [], true, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute label - simplified approach (placeholder)
    try {
      // For now, just return success - actual labeling would need custom labeler setup
      res.json({ 
        success: true, 
        message: 'Labels applied successfully (placeholder)',
        labels: command.targets
      });
    } catch (error) {
      console.error('Apply labels error:', error);
      res.status(500).json({ error: 'Failed to apply labels' });
    }
  } catch (error) {
    console.error('Apply labels error:', error);
    res.status(500).json({ error: 'Failed to apply labels' });
  }
});

// Remove labels (for custom labelers)
router.post('/moderation/unlabel', authenticateApiKey, async (req: any, res) => {
  try {
    const { postUri, labels } = req.body;
    
    if (!postUri || !labels || !Array.isArray(labels)) {
      return res.status(400).json({ error: 'Post URI and labels array are required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has custom labeler configured
    const customLabeler = await db.getCustomLabeler(req.user.userId);
    if (!customLabeler) {
      return res.status(403).json({ error: 'Custom labeler not configured' });
    }

    // Parse and validate command
    const parser = new ModMasterCommandParser();
    const commands = parser.parseCommands(`unlabel ${labels.join(',')}`);
    const command = commands[0];
    
    if (!command) {
      return res.status(400).json({ error: 'Invalid unlabel command' });
    }
    
    const validation = parser.validateCommand(command, [], true, user.is_admin);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Execute unlabel - simplified approach (placeholder)
    try {
      // For now, just return success - actual unlabeling would need custom labeler setup
      res.json({ 
        success: true, 
        message: 'Labels removed successfully (placeholder)',
        labels: command.targets
      });
    } catch (error) {
      console.error('Remove labels error:', error);
      res.status(500).json({ error: 'Failed to remove labels' });
    }
  } catch (error) {
    console.error('Remove labels error:', error);
    res.status(500).json({ error: 'Failed to remove labels' });
  }
});

// Get feed groups
router.get('/feed/groups', authenticateApiKey, async (req: any, res) => {
  try {
    const { feed } = req.query;
    
    if (!feed) {
      return res.status(400).json({ error: 'Feed parameter is required' });
    }

    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFeeds = await db.getUserFeeds(req.user.userId);
    const normalizedFeedName = normalizeFeedName(feed as string);
    
    // Find the feed by slug or bluesky name
    const targetFeed = userFeeds.find(f => 
      (f.feed_slug && f.feed_slug.toLowerCase() === normalizedFeedName.toLowerCase()) ||
      (f.bluesky_feed_name && f.bluesky_feed_name.toLowerCase() === normalizedFeedName.toLowerCase())
    );
    
    if (!targetFeed) {
      return res.json({ groups: [] });
    }

    // Get all groups for this user
    const allGroups = await db.getUserFeedGroups(req.user.userId);
    
    // Filter to groups that contain this specific feed
    const feedGroups = allGroups.filter((group: any) => {
      // Check if this group contains the target feed
      return group.feeds && group.feeds.some((feedInGroup: any) => 
        feedInGroup.feed_id === targetFeed.feed_id
      );
    });
    
    res.json({ 
      groups: feedGroups.map((group: any) => ({
        id: group.id,
        name: group.group_name
      }))
    });
  } catch (error) {
    console.error('Get feed groups error:', error);
    res.status(500).json({ error: 'Failed to get feed groups' });
  }
});

export default router;