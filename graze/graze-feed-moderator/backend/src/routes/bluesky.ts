import express from 'express';
import { authenticateToken } from './auth.js';
import { Database } from '../services/database.js';

const router = express.Router();
const db = Database.getInstance();

// Get Bluesky credentials
router.get('/credentials', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await db.pool.query(
      'SELECT bsky_handle, bsky_password FROM user_profiles WHERE id = $1',
      [userId]
    );
    
    if (!user.rows[0] || !user.rows[0].bsky_handle) {
      return res.json({ hasCredentials: false });
    }
    
    res.json({
      hasCredentials: true,
      handle: user.rows[0].bsky_handle,
      password: user.rows[0].bsky_password
    });
  } catch (error) {
    console.error('Error getting Bluesky credentials:', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// Save Bluesky credentials
router.post('/credentials', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { handle, password } = req.body;
    
    await db.pool.query(
      'UPDATE user_profiles SET bsky_handle = $1, bsky_password = $2 WHERE id = $3',
      [handle, password, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving Bluesky credentials:', error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// Helper function to extract slug from URL or return as-is
function extractSlugFromInput(input: string): string {
  // If it's a full URL, extract the slug
  const urlMatch = input.match(/\/feed\/([^/?]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  // Otherwise assume it's already a slug
  return input;
}

// Fetch feed name from Bluesky API
router.post('/fetch-feed-name', authenticateToken, async (req: any, res) => {
  try {
    console.log('Fetch feed name request:', req.body);
    const { feedSlug, creatorDid } = req.body;
    
    if (!feedSlug) {
      return res.status(400).json({ error: 'Feed slug is required' });
    }

    const slug = extractSlugFromInput(feedSlug);
    console.log('Extracted slug:', slug);
    
    // If creatorDid is provided, use it; otherwise try to extract from URL
    let did = creatorDid;
    if (!did && feedSlug.includes('/profile/')) {
      const didMatch = feedSlug.match(/\/profile\/([^/]+)/);
      if (didMatch) {
        did = didMatch[1];
      }
    }
    console.log('Initial DID:', did);

    // If we still don't have a DID, try to search for the feed
    if (!did) {
      try {
        console.log('Searching for feed in popular feeds...');
        // Try searching for feeds with this slug
        const searchResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.unspecced.getPopularFeedGenerators?limit=100`);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log('Search returned', searchData.feeds?.length, 'feeds');
          const matchingFeed = searchData.feeds?.find((feed: any) => 
            feed.uri?.includes(slug) || feed.displayName?.toLowerCase().includes(slug.toLowerCase())
          );
          console.log('Matching feed:', matchingFeed);
          
          if (matchingFeed) {
            const uriMatch = matchingFeed.uri.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.generator\/(.+)/);
            if (uriMatch) {
              did = uriMatch[1];
              console.log('Extracted DID from URI:', did);
            }
          }
        } else {
          console.error('Search response not ok:', searchResponse.status);
        }
      } catch (searchError) {
        console.error('Search failed:', searchError);
      }
    }

    if (!did) {
      console.log('No DID found, returning error');
      return res.status(400).json({ 
        error: 'Could not determine feed creator. Please provide the full Bluesky URL (e.g. https://bsky.app/profile/did:plc:.../feed/your-slug) instead of just the slug.' 
      });
    }

    console.log('Fetching feed info for DID:', did, 'slug:', slug);
    // Fetch feed info from Bluesky API
    const feedUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeedGenerator?feed=at://${did}/app.bsky.feed.generator/${slug}`;
    console.log('Feed URL:', feedUrl);
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      return res.status(404).json({ error: 'Feed not found' });
    }

    const data = await response.json();
    console.log('Feed data:', JSON.stringify(data, null, 2));
    const feedName = data.view?.displayName || data.view?.uri?.split('/').pop() || slug;
    console.log('Extracted feed name:', feedName);
    
    // Save the bluesky feed name to database
    const { Database } = await import('../services/database.js');
    const db = Database.getInstance();
    
    // Find the user's feed with this slug
    const userFeeds = await db.getUserFeeds(req.user.userId);
    console.log('User feeds:', userFeeds.map(f => ({ id: f.feed_id, slug: f.feed_slug })));
    const matchingFeed = userFeeds.find(f => f.feed_slug === slug);
    console.log('Matching user feed:', matchingFeed);
    
    if (matchingFeed) {
      console.log('Updating feed', matchingFeed.feed_id, 'with name:', feedName);
      await db.updateFeedBlueskyName(matchingFeed.feed_id, feedName);
      console.log(`Updated feed ${matchingFeed.feed_id} with bluesky name: ${feedName}`);
    } else {
      console.log(`No matching feed found for slug: ${slug}`);
    }
    
    res.json({
      success: true,
      feedName,
      description: data.view?.description || null
    });
  } catch (error) {
    console.error('Fetch feed name error:', error);
    res.status(500).json({ error: 'Failed to fetch feed name' });
  }
});

// Test endpoint without auth
router.get('/test', (req, res) => {
  res.json({ message: 'Bluesky API is working!' });
});

export default router;