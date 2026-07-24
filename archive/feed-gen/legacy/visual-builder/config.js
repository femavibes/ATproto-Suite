// Node type definitions and configurations
const NODE_TYPES = {
    start: { category: 'start', name: '⚡ START', title: 'Incoming Posts', config: '<div style="font-size: 10px; color: #666;">All posts enter here</div>' },
    end: { category: 'end', name: '🎯 END', title: 'Feed Output', config: '<div style="font-size: 9px; color: #888;">TOP: Injection nodes</div><div style="font-size: 9px; color: #888;">BOTTOM: Sorting nodes</div>' },
    group: { category: 'group', name: '📦 GROUP', title: 'Block Group', config: '<input type="text" placeholder="Group name..." onclick="event.stopPropagation()" onchange="updateGroupName(this, event)" style="width: 100%; margin-top: 8px; background: #1a1a1a; border: 1px solid #444; color: white; padding: 4px 8px; border-radius: 4px;"><div style="font-size: 10px; color: #888; margin-top: 6px;">Visual container for organizing blocks. Select nodes then click "Add Selected"</div>' },
    
    or: { category: 'logic', name: 'OR Logic', title: 'Match ANY child', config: '<select onchange="changeLogicType(this, event)" style="width: 100%; font-size: 11px;"><option value="or">OR Logic</option><option value="and">AND Logic</option></select>' },
    and: { category: 'logic', name: 'AND Logic', title: 'Match ALL children', config: '<select onchange="changeLogicType(this, event)" style="width: 100%; font-size: 11px;"><option value="and">AND Logic</option><option value="or">OR Logic</option></select>' },
    nof: { category: 'logic', name: 'N-OF Logic', title: 'Match N of M children', config: '<div style="font-size: 11px; margin-bottom: 6px;">At least <input type="number" value="2" min="1" style="width: 50px;"> must pass</div><div style="font-size: 10px; color: #888;">Connect conditions below</div>' },
    
    text: { category: 'condition', name: 'Text Condition', title: 'Text Contains', config: '<select style="width: 100%; margin-bottom: 6px; font-size: 10px;"><option>All text fields</option><option>Post text only</option><option>Alt text only</option><option>Link cards only</option><option>Custom...</option></select><textarea placeholder="Keywords (one per line or comma-separated)..." rows="2" style="width: 100%; resize: vertical;">urbanism, transit</textarea>' },
    language: { category: 'condition', name: 'Language', title: 'Language', config: '<select><option>en</option><option>es</option><option>fr</option><option>de</option><option>ja</option><option>pt</option></select>' },
    posttype: { category: 'condition', name: 'Post Type', title: 'Post Type', config: '<select><option>post</option><option>reply</option><option>quote</option></select>' },
    likes: { category: 'condition', name: 'Like Count', title: 'Like Count', config: '<select><option>>=</option><option><=</option><option>==</option></select> <input type="number" value="100" style="width: 60px;">' },
    score: { category: 'condition', name: 'Score Threshold', title: 'Score Threshold', config: '<select><option>>=</option><option><=</option></select> <input type="number" value="50" style="width: 60px;"> points<div style="font-size: 10px; color: #888; margin-top: 4px;">Dynamic: posts can pass later as score changes</div>' },
    age: { category: 'condition', name: 'Post Age', title: 'Post Age', config: '<select><option>>=</option><option><=</option></select> <input type="number" value="10" style="width: 50px;"> hours' },
    author: { category: 'condition', name: 'Author List', title: 'Author in List', config: '<select><option>VIP Users</option><option>My Follows</option></select>' },
    followers: { category: 'condition', name: 'Follower Count', title: 'Follower Count', config: '<select><option>>=</option><option><=</option></select> <input type="number" value="1000" style="width: 70px;">' },
    media: { category: 'condition', name: 'Media Type', title: 'Has Media', config: '<select><option>Images</option><option>Videos</option><option>Any</option></select>' },
    
    sentiment: { category: 'module', name: 'Sentiment 🔌💰', title: 'Sentiment', config: '<select><option>positive</option><option>negative</option><option>neutral</option></select>' },
    toxicity: { category: 'module', name: 'Toxicity 🔌💰', title: 'Toxicity', config: '<select><option><=</option><option>>=</option></select> <input type="number" value="0.5" step="0.1" style="width: 60px;">' },
    topic: { category: 'module', name: 'Topic 🔌', title: 'Topic', config: '<select><option>Urbanism</option><option>Transit</option><option>Housing</option></select>' },
    imageanalysis: { category: 'module', name: 'Image Analysis 🔌💰', title: 'Image Content', config: '<select><option>Contains text</option><option>Contains faces</option><option>Landscape</option><option>Architecture</option></select>' },
    
    pinnedposts: { category: 'feed-config', name: '📌 Pinned Posts', title: 'Pinned Posts', config: '<div style="font-size: 11px; color: #888;">Always at top of feed</div><div style="font-size: 10px; color: #666; margin-top: 4px;">Add posts manually in feed settings</div>' },
    rotatingposts: { category: 'feed-config', name: '🔄 Rotating Posts', title: 'Rotating Posts', config: '<div style="font-size: 11px; color: #888;">Carousel of featured content</div><div style="font-size: 10px; color: #666; margin-top: 4px;">Cycles through selected posts</div>' },
    
    rssfeed: { category: 'source', name: 'RSS Feed 🔌', title: 'RSS Feed', config: '<input type="text" placeholder="Feed URL..." value="https://example.com/feed.xml" style="margin-bottom: 6px;"><div style="font-size: 10px; color: #666;">Imports posts from RSS</div>' },
    manualpost: { category: 'source', name: 'Manual Posts 🔌', title: 'Manual Posts', config: '<div style="font-size: 11px; color: #888;">Hand-picked posts you add manually</div>' },
    
    personalization: { category: 'scoring', name: 'Personalization 🔌', title: 'Personalization', config: '<div style="font-size: 11px; margin-bottom: 6px;">Boost based on:</div><label style="font-size: 10px; display: block;"><input type="checkbox" checked> User follows</label><label style="font-size: 10px; display: block;"><input type="checkbox" checked> Past likes</label><label style="font-size: 10px; display: block;"><input type="checkbox"> Similar topics</label>' },
    engagement: { category: 'scoring', name: 'Engagement Boost 🔌', title: 'Engagement Boost', config: '<div style="font-size: 11px; margin-bottom: 6px;">Predict viral posts</div><div style="font-size: 10px; color: #666;">Uses ML to boost posts likely to get engagement</div>' },
    recency: { category: 'scoring', name: 'Recency Boost 🔌', title: 'Recency Boost', config: '<div style="font-size: 11px; color: #888;">Boost newer posts</div><select style="margin-top: 6px;"><option>Linear decay</option><option>Exponential decay</option><option>Step function</option></select>' },
    authorquality: { category: 'scoring', name: 'Author Quality 🔌', title: 'Author Quality', config: '<div style="font-size: 11px; color: #888;">Boost high-quality authors</div><div style="font-size: 10px; color: #666;">Based on follower count, engagement rate</div>' },
    topicrelevance: { category: 'scoring', name: 'Topic Relevance 🔌💰', title: 'Topic Relevance', config: '<div style="font-size: 11px; color: #888;">Boost posts matching user interests</div><div style="font-size: 10px; color: #666;">ML-based topic matching</div>' },
    viralityscore: { category: 'scoring', name: 'Virality Score 🔌💰', title: 'Virality Score', config: '<div style="font-size: 11px; color: #888;">Predict viral potential</div><div style="font-size: 10px; color: #666;">Early engagement velocity</div>' },
    customscoring: { category: 'scoring', name: 'Custom Scoring 🔌💰', title: 'Custom Scoring', config: '<input type="text" placeholder="Module URL..." style="width: 100%; margin-bottom: 6px;"><div style="font-size: 10px; color: #666;">External scoring algorithm</div>' },
    
    ads: { category: 'injection', name: 'Ad Network 🔌', title: 'Ad Network', config: '<div style="font-size: 11px; margin-bottom: 6px;">Frequency:</div><select><option>Every 5 posts</option><option>Every 10 posts</option><option>Every 20 posts</option></select><div style="font-size: 10px; color: #666; margin-top: 6px;">Max 3 ads/day per user</div>' },
    sponsored: { category: 'injection', name: 'Sponsored Posts 🔌', title: 'Sponsored Posts', config: '<div style="font-size: 11px; color: #888;">Paid promotional content at fixed positions</div>' },
    recommendfollows: { category: 'injection', name: 'Recommended Follows 🔌', title: 'Recommended Follows', config: '<div style="font-size: 11px; color: #888;">Suggest accounts to follow</div><select style="margin-top: 6px;"><option>Every 20 posts</option><option>Every 50 posts</option></select>' },
    trendingtopics: { category: 'injection', name: 'Trending Topics 🔌', title: 'Trending Topics', config: '<div style="font-size: 11px; color: #888;">Insert trending topic cards</div>' },
    custominjection: { category: 'injection', name: 'Custom Injection 🔌💰', title: 'Custom Injection', config: '<input type="text" placeholder="Module URL..." style="width: 100%; margin-bottom: 6px;"><div style="font-size: 10px; color: #666;">External content injection</div>' },
    carouselposts: { category: 'injection', name: 'Carousel Posts 🔌', title: 'Carousel Posts', config: '<div style="font-size: 11px; color: #888;">Rotating featured content</div>' },
    communityhighlights: { category: 'injection', name: 'Community Highlights 🔌', title: 'Community Highlights', config: '<div style="font-size: 11px; color: #888;">Curated posts from moderators</div>' },
    pollinjection: { category: 'injection', name: 'Poll Cards 🔌', title: 'Poll Cards', config: '<div style="font-size: 11px; color: #888;">Insert interactive polls</div>' },
    breakingnews: { category: 'injection', name: 'Breaking News 🔌', title: 'Breaking News', config: '<div style="font-size: 11px; color: #888;">Urgent news alerts</div>' },
    usersuggestions: { category: 'injection', name: 'User Suggestions 🔌', title: 'User Suggestions', config: '<div style="font-size: 11px; color: #888;">Personalized account recommendations</div>' },
    
    chronological: { category: 'sorting', name: '⏰ Chronological', title: 'Sort by Time', config: '<select><option>Newest first</option><option>Oldest first</option></select>' },
    byscore: { category: 'sorting', name: '⭐ By Score', title: 'Sort by Score', config: '<div style="font-size: 10px; color: #888;">Sort by accumulated scoring module points</div>' },
    mostlikes: { category: 'sorting', name: '❤️ Most Likes', title: 'Sort by Likes', config: '<div style="font-size: 10px; color: #888;">Posts with most likes appear first</div>' },
    mostengagement: { category: 'sorting', name: '🔥 Most Engagement', title: 'Sort by Engagement', config: '<div style="font-size: 10px; color: #888;">Likes + reposts + replies</div>' },
    weightedrandom: { category: 'sorting', name: '🎲 Weighted Random', title: 'Weighted Random', config: '<div style="font-size: 10px; color: #888;">Random but weighted by engagement/score</div>' },
    clustered: { category: 'sorting', name: '📊 Clustered', title: 'Clustered Sort', config: '<div style="font-size: 10px; color: #888;">Group similar posts together</div>' },
    diversity: { category: 'sorting', name: '🌈 Diversity Sort', title: 'Diversity Sort', config: '<div style="font-size: 10px; color: #888;">Maximize author/topic diversity</div>' },
    customsort: { category: 'sorting', name: 'Custom Sort 🔌💰', title: 'Custom Sort', config: '<input type="text" placeholder="Module URL..." style="width: 100%; margin-bottom: 6px;"><div style="font-size: 10px; color: #666;">External sorting algorithm</div>' },
    random: { category: 'sorting', name: '🎲 Random', title: 'Random Order', config: '<div style="font-size: 10px; color: #888;">Shuffle posts randomly</div>' }
};

const MODULE_COSTS = {
    sentiment: { cost: 'high', costPerK: 0.50 },
    toxicity: { cost: 'high', costPerK: 0.30 },
    topic: { cost: 'medium', costPerK: 0.10 },
    imageanalysis: { cost: 'high', costPerK: 0.80 }
};

function updateGroupName(input, event) {
    event.stopPropagation();
    const nodeEl = input.closest('.canvas-node');
    const nodeId = parseInt(nodeEl.id.split('-')[1]);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        if (!node.config) node.config = {};
        node.config.name = input.value;
        saveToLocalStorage();
    }
}
