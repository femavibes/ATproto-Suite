import express from 'express';
import { AtpAgent } from '@atproto/api';
import { Database } from '../services/database.js';
import { WhitelistService } from '../services/whitelist.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const db = Database.getInstance();
const whitelistService = new WhitelistService(db);

// Get user's global whitelist
router.get('/user', authenticateToken, async (req: any, res) => {
  try {
    const whitelist = await whitelistService.getUserWhitelist(req.user.userId);
    res.json(whitelist);
  } catch (error) {
    console.error('Error fetching user whitelist:', error);
    res.status(500).json({ error: 'Failed to fetch whitelist' });
  }
});

// Add to user's global whitelist
router.post('/user', authenticateToken, async (req: any, res) => {
  try {
    const { handle } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle required' });
    }
    
    // Resolve handle to DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const response = await agent.resolveHandle({ handle });
    const did = response.data.did;
    
    await whitelistService.addToUserWhitelist(req.user.userId, did, handle);
    
    res.json({ success: true, did, handle });
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ error: 'Failed to add to whitelist' });
  }
});

// Remove from user's global whitelist
router.delete('/user/:did', authenticateToken, async (req: any, res) => {
  try {
    const { did } = req.params;
    await whitelistService.removeFromUserWhitelist(req.user.userId, did);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    res.status(500).json({ error: 'Failed to remove from whitelist' });
  }
});

// Get feed whitelist (paid+ only)
router.get('/feed/:feedId', authenticateToken, async (req: any, res) => {
  try {
    const { feedId } = req.params;
    
    // Check paid+ subscription
    const user = await db.getUserById(req.user.userId);
    if (user?.subscription_tier !== 'paid' && user?.subscription_tier !== 'premium') {
      return res.status(403).json({ error: 'Paid subscription required' });
    }
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    const whitelist = await whitelistService.getFeedWhitelist(feedId);
    res.json(whitelist);
  } catch (error) {
    console.error('Error fetching feed whitelist:', error);
    res.status(500).json({ error: 'Failed to fetch feed whitelist' });
  }
});

// Add to feed whitelist (paid+ only)
router.post('/feed/:feedId', authenticateToken, async (req: any, res) => {
  try {
    const { feedId } = req.params;
    const { handle, isBlacklist = false } = req.body;
    
    // Check paid+ subscription
    const user = await db.getUserById(req.user.userId);
    if (user?.subscription_tier !== 'paid' && user?.subscription_tier !== 'premium') {
      return res.status(403).json({ error: 'Paid subscription required' });
    }
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    // Resolve handle to DID
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const response = await agent.resolveHandle({ handle });
    const did = response.data.did;
    
    await whitelistService.addToFeedWhitelist(feedId, did, handle, isBlacklist);
    
    res.json({ success: true, did, handle, isBlacklist });
  } catch (error) {
    console.error('Error adding to feed whitelist:', error);
    res.status(500).json({ error: 'Failed to add to feed whitelist' });
  }
});

// Remove from feed whitelist (paid+ only)
router.delete('/feed/:feedId/:did', authenticateToken, async (req: any, res) => {
  try {
    const { feedId, did } = req.params;
    
    // Check paid+ subscription
    const user = await db.getUserById(req.user.userId);
    if (user?.subscription_tier !== 'paid' && user?.subscription_tier !== 'premium') {
      return res.status(403).json({ error: 'Paid subscription required' });
    }
    
    // Verify feed ownership
    const feed = await db.getFeedById(feedId);
    if (!feed || feed.user_id !== req.user.userId) {
      return res.status(404).json({ error: 'Feed not found' });
    }
    
    await whitelistService.removeFromFeedWhitelist(feedId, did);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from feed whitelist:', error);
    res.status(500).json({ error: 'Failed to remove from feed whitelist' });
  }
});

export default router;