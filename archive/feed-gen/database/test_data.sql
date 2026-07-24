-- Test data for feed API endpoint testing

-- Create a test feed
INSERT INTO feeds (id, name, description, owner_did, assignment_rules)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Test Feed',
    'A test feed for API endpoint testing',
    'did:plc:test123',
    '{"logic": "OR", "groups": []}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create some test posts
INSERT INTO posts (cid, uri, text, author_did, has_images, has_video, has_link, created_at)
VALUES
    ('test-cid-001', 'at://did:plc:user1/app.bsky.feed.post/abc123', 'This is a test post about urbanism!', 'did:plc:user1', false, false, false, NOW() - INTERVAL '1 hour'),
    ('test-cid-002', 'at://did:plc:user2/app.bsky.feed.post/def456', 'Another test post with some content.', 'did:plc:user2', true, false, false, NOW() - INTERVAL '2 hours'),
    ('test-cid-003', 'at://did:plc:user3/app.bsky.feed.post/ghi789', 'Third test post for the feed.', 'did:plc:user3', false, true, false, NOW() - INTERVAL '3 hours')
ON CONFLICT (cid) DO NOTHING;

-- Assign posts to the test feed with different scores
INSERT INTO feed_posts (feed_id, post_cid, base_score, assigned_at)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'test-cid-001', 100, NOW() - INTERVAL '1 hour'),
    ('550e8400-e29b-41d4-a716-446655440000', 'test-cid-002', 50, NOW() - INTERVAL '2 hours'),
    ('550e8400-e29b-41d4-a716-446655440000', 'test-cid-003', 75, NOW() - INTERVAL '3 hours')
ON CONFLICT (feed_id, post_cid) DO NOTHING;
