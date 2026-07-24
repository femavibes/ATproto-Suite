import express from 'express';
import { Database } from '../services/database.js';
import { GrazeService } from '../services/graze.js';

const router = express.Router();
const db = Database.getInstance();
const grazeService = new GrazeService();

// Test post removal
router.post('/removal', async (req, res) => {
  try {
    const { postUri, feedId, userDid } = req.body;
    
    // Get user
    const user = await db.getUserByDid(userDid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Try to remove post
    await grazeService.removePost(postUri, feedId, user);
    
    // Log the action
    await db.logModerationAction({
      post_uri: postUri,
      action: 'test_removal',
      feed_id: feedId,
      moderator_did: userDid,
      reason: 'manual_test'
    });
    
    res.json({ success: true, message: 'Post removed successfully' });
    
  } catch (error) {
    console.error('Test removal error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;