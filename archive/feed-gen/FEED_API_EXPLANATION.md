# Feed API Endpoint Explanation

## What is a Feed API Endpoint?

A **Feed API Endpoint** is the HTTP endpoint that Bluesky clients call to get posts for a custom feed. It's how users actually consume the feeds we create.

## How Bluesky Feeds Work

When a user subscribes to a custom feed on Bluesky (like `at://did:plc:abc123/app.bsky.feed.generator/feed-xyz`), the Bluesky app makes an HTTP request to our server asking for posts.

## AT Proto Feed API Specification

Bluesky uses the AT Protocol (AT Proto) for feeds. The endpoint we need to implement is:

```
GET /xrpc/app.bsky.feed.getFeedSkeleton
```

### Request Parameters

- `feed` (required): The feed URI (e.g., `at://did:plc:abc123/app.bsky.feed.generator/feed-xyz`)
- `limit` (optional): Number of posts to return (default: 50, max: 100)
- `cursor` (optional): Pagination cursor for next page

### Response Format

```json
{
  "feed": [
    {
      "post": "at://did:plc:user123/app.bsky.feed.post/abc123"
    },
    {
      "post": "at://did:plc:user456/app.bsky.feed.post/def456"
    }
  ],
  "cursor": "optional-pagination-cursor"
}
```

## What Our Endpoint Does

1. **Receives request**: User's Bluesky app requests feed posts
2. **Identifies feed**: Extract feed ID from the URI
3. **Fetches posts**: Query `feed_posts` table for that feed
4. **Applies sorting**: Order by score, recency, etc.
5. **Adds pinned posts**: Insert pinned posts at top
6. **Applies modules**: Run scoring, injection modules
7. **Returns skeleton**: Return list of post URIs (not full post data)

## Why "Skeleton"?

The endpoint returns **post URIs only**, not full post content. The Bluesky app then fetches the actual post data from Bluesky's servers using those URIs. This is more efficient and keeps our API lightweight.

## Example Flow

```
User opens Bluesky app
  ↓
User views custom feed
  ↓
Bluesky app calls: GET /xrpc/app.bsky.feed.getFeedSkeleton?feed=at://...
  ↓
Our feed-api service:
  1. Looks up feed in database
  2. Queries feed_posts table
  3. Applies sorting/scoring
  4. Returns post URIs
  ↓
Bluesky app fetches post content from Bluesky servers
  ↓
User sees posts in their feed
```

## Implementation Steps

1. **Basic endpoint**: Return hardcoded test posts
2. **Database lookup**: Query feed by ID
3. **Post fetching**: Get posts from feed_posts table
4. **Sorting**: Order by score/recency
5. **Pagination**: Implement cursor-based pagination
6. **Module integration**: Add scoring/injection modules later

## Why Build This First?

- **Quick win**: Can test without ingestion running
- **Foundation**: Other services depend on this
- **Validation**: Proves our database schema works
- **Testing**: Can manually insert test data to verify
