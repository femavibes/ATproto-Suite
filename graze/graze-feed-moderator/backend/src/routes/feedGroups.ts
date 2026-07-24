import express from 'express';
import { Database } from '../services/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const db = Database.getInstance();

// Get user's feed groups and memberships
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const groups = await db.getUserFeedGroups(req.user.userId);
    
    // Get memberships for each group
    const memberships: Record<number, string[]> = {};
    for (const group of groups) {
      const feeds = await db.getFeedsInGroup(group.id);
      memberships[group.id] = feeds.map(f => f.feed_id);
    }
    
    res.json({ groups, memberships });
  } catch (error) {
    console.error('Error fetching feed groups:', error);
    res.status(500).json({ error: 'Failed to fetch feed groups' });
  }
});

// Create new feed group
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { groupName } = req.body;
    
    if (!groupName || !groupName.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    
    const group = await db.createFeedGroup(req.user.userId, groupName.trim());
    res.json(group);
  } catch (error: any) {
    console.error('Error creating feed group:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Group name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create feed group' });
    }
  }
});

// Delete feed group
router.delete('/:groupId', authenticateToken, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Delete group (cascade will remove memberships)
    await db.getPool().query('DELETE FROM feed_groups WHERE id = $1', [groupId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feed group:', error);
    res.status(500).json({ error: 'Failed to delete feed group' });
  }
});

// Add feed to group
router.post('/:groupId/feeds', authenticateToken, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { feedId } = req.body;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Verify user owns the feed
    const feed = await db.getPool().query(
      'SELECT * FROM feeds WHERE feed_id = $1 AND user_id = $2',
      [feedId, req.user.userId]
    );
    
    if (feed.rows.length === 0) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    await db.addFeedToGroup(feedId, parseInt(groupId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding feed to group:', error);
    res.status(500).json({ error: 'Failed to add feed to group' });
  }
});

// Remove feed from group
router.delete('/:groupId/feeds/:feedId', authenticateToken, async (req: any, res) => {
  try {
    const { groupId, feedId } = req.params;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    await db.removeFeedFromGroup(feedId, parseInt(groupId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing feed from group:', error);
    res.status(500).json({ error: 'Failed to remove feed from group' });
  }
});

// Get group moderators
router.get('/:groupId/moderators', authenticateToken, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const moderators = await db.getGroupModerators(parseInt(groupId));
    res.json(moderators);
  } catch (error) {
    console.error('Error fetching group moderators:', error);
    res.status(500).json({ error: 'Failed to fetch moderators' });
  }
});

// Add group moderator
router.post('/:groupId/moderators', authenticateToken, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { moderatorHandle, permissions = ['remove', 'ban'] } = req.body;
    
    if (!moderatorHandle) {
      return res.status(400).json({ error: 'Moderator handle is required' });
    }
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Resolve handle to DID
    const { AtpAgent } = await import('@atproto/api');
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    
    try {
      const response = await agent.resolveHandle({ handle: moderatorHandle });
      const moderatorDid = response.data.did;
      
      const user = await db.getUserProfileById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      await db.addGroupModerator(parseInt(groupId), moderatorDid, moderatorHandle, user.did, permissions);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Invalid handle or handle not found' });
    }
  } catch (error) {
    console.error('Error adding group moderator:', error);
    res.status(500).json({ error: 'Failed to add moderator' });
  }
});

// Remove group moderator
router.delete('/:groupId/moderators/:moderatorDid', authenticateToken, async (req: any, res) => {
  try {
    const { groupId, moderatorDid } = req.params;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    await db.removeGroupModerator(parseInt(groupId), moderatorDid);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing group moderator:', error);
    res.status(500).json({ error: 'Failed to remove moderator' });
  }
});

// Update group settings
router.put('/:groupId', authenticateToken, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { group_ban_list, use_group_list_only } = req.body;
    
    // Verify user owns the group
    const group = await db.getPool().query(
      'SELECT * FROM feed_groups WHERE id = $1 AND owner_user_id = $2',
      [groupId, req.user.userId]
    );
    
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (group_ban_list !== undefined) {
      updates.push(`group_ban_list = $${paramIndex++}`);
      values.push(group_ban_list || null);
    }
    
    if (use_group_list_only !== undefined) {
      updates.push(`use_group_list_only = $${paramIndex++}`);
      values.push(use_group_list_only);
    }
    
    if (updates.length > 0) {
      values.push(groupId);
      await db.getPool().query(
        `UPDATE feed_groups SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Get groups user can moderate
router.get('/moderated', authenticateToken, async (req: any, res) => {
  try {
    const user = await db.getUserProfileById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const groups = await db.getModeratedGroupsWithFeeds(user.did);
    
    // Get feed details for each group
    const groupsWithFeeds = await Promise.all(groups.map(async (group) => {
      const feeds = await db.getFeedsInGroup(group.id);
      return {
        ...group,
        feeds: feeds.map(f => ({
          feed_id: f.feed_id,
          feed_name: f.feed_name,
          feed_display_name: f.feed_display_name
        }))
      };
    }));
    
    res.json(groupsWithFeeds);
  } catch (error) {
    console.error('Error fetching moderated groups:', error);
    res.status(500).json({ error: 'Failed to fetch moderated groups' });
  }
});

export default router;