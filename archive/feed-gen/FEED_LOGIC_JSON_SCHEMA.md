# Feed Logic JSON Schema

This document defines the JSON format for representing feed logic from the visual editor. This format is used by the feed assignment engine (Stage 2) and feed serving engine (Stage 3).

## Overview

The feed logic JSON represents a complete feed configuration including:
- **Source Nodes** (Stage 2): Posts that go through assignment logic and ARE affected by sorting
- **Assignment Rules** (Stage 2): Filtering logic that determines which posts belong to the feed
- **Scoring Modules** (Stage 3): Score modification for ranking
- **Fixed Position Modules** (Stage 3): Posts with guaranteed positions BEFORE sorting (dynamic pinned, featured content)
- **Sorting Modules** (Stage 3): Post ordering (affects source posts only)
- **Injection Modules** (Stage 3): Post injection AFTER sorting (ads, rotating posts, etc.) - NOT affected by sorting
- **Pinned Posts** (Stage 3): Fixed position posts BEFORE sorting (special native feature)

## Complete Schema

```json
{
  "version": "1.0",
  "feed_id": "uuid",
  "name": "Feed Name",
  "description": "Feed description",
  
  "assignment": {
    "nodes": [...],
    "edges": [...],
    "logic": "OR"  // Overall logic: OR (any path passes) or AND (all paths must pass)
  },
  
  "scoring": {
    "modules": [...]
  },
  
  "fixed_position": {
    "modules": [...]
  },
  
  "sorting": {
    "modules": [...]
  },
  
  "injection": {
    "modules": [...]
  },
  
  "pinned_posts": [...],
  "rotating_posts": [...]
}
```

## Source Nodes (Stage 2)

Source nodes provide posts that go through assignment logic and ARE affected by sorting.

### Manual Posts (Source)

Manual posts as a SOURCE node go through assignment logic and are affected by sorting.

```json
{
  "id": "manualposts-1",
  "type": "manualposts",
  "position": { "x": 0, "y": 100 },
  "data": {
    "postUrls": [
      "https://bsky.app/profile/did:plc:abc123/post/rkey1",
      "https://bsky.app/profile/did:plc:def456/post/rkey2"
    ]
  }
}
```

**Note:** Manual posts can also be configured as an INJECTION module (see below) if you want them to bypass assignment and not be affected by sorting.

## Assignment Rules (Stage 2)

### Node Types

#### START Node
```json
{
  "id": "start-1",
  "type": "start",
  "position": { "x": 0, "y": 0 },
  "data": {}
}
```

#### END Node
```json
{
  "id": "end-1",
  "type": "end",
  "position": { "x": 1000, "y": 0 },
  "data": {}
}
```

#### Logic Nodes (AND, OR, N-of)
```json
{
  "id": "and-1",
  "type": "and",  // or "or", "nof"
  "position": { "x": 500, "y": 0 },
  "data": {
    "n": 2  // Only for "nof" type
  }
}
```

#### Condition Nodes

**Text Contains:**
```json
{
  "id": "text-1",
  "type": "text",
  "position": { "x": 200, "y": 0 },
  "data": {
    "keywords": ["urbanism", "city planning"],
    "fields": ["text", "embed.images[*].alt"],
    "exclude": false,
    "scoreModifier": 10  // Optional: score boost if condition passes
  }
}
```

**Regex Contains:**
```json
{
  "id": "regex-1",
  "type": "regex",
  "position": { "x": 200, "y": 100 },
  "data": {
    "pattern": "\\b(urban|city)\\w+",
    "fields": ["text"],
    "exclude": false,
    "flags": "i",
    "scoreModifier": 5
  }
}
```

**Language:**
```json
{
  "id": "language-1",
  "type": "language",
  "position": { "x": 200, "y": 200 },
  "data": {
    "languages": ["en", "es"],
    "scoreModifier": 0
  }
}
```

**Post Type:**
```json
{
  "id": "posttype-1",
  "type": "posttype",
  "position": { "x": 200, "y": 300 },
  "data": {
    "types": ["post", "reply", "quote"],  // Array of selected types
    "replyDepthEnabled": true,
    "replyDepthOperator": "equals",  // "equals", "less_than", "greater_than"
    "replyDepth": 1,
    "postTypeScores": {  // Separate score modifiers per type
      "post": 0,
      "reply": -5,
      "quote": 10
    }
  }
}
```

**Author:**
```json
{
  "id": "author-1",
  "type": "author",
  "position": { "x": 200, "y": 400 },
  "data": {
    "authors": ["did:plc:abc123", "did:plc:def456"],
    "listUris": ["at://did:plc:list123/app.bsky.graph.list/xyz"],
    "scoreModifier": 20
  }
}
```

**Post Date:**
```json
{
  "id": "dateage-1",
  "type": "dateage",
  "position": { "x": 200, "y": 500 },
  "data": {
    "mode": "newer_than",  // "newer_than", "older_than"
    "value": {
      "amount": 24,
      "unit": "hours"  // "hours", "days", "weeks"
    },
    "scoreModifier": 0
  }
}
```

**Mentions:**
```json
{
  "id": "mentions-1",
  "type": "mentions",
  "position": { "x": 200, "y": 600 },
  "data": {
    "mentions": ["did:plc:user1", "did:plc:user2"],
    "listUris": ["at://did:plc:list123/app.bsky.graph.list/xyz"],
    "scoreModifier": 5
  }
}
```

**Links/URLs:**
```json
{
  "id": "links-1",
  "type": "links",
  "position": { "x": 200, "y": 700 },
  "data": {
    "urls": ["https://example.com", "https://example.org"],
    "scoreModifier": 0
  }
}
```

**Hashtag:**
```json
{
  "id": "hashtag-1",
  "type": "hashtag",
  "position": { "x": 200, "y": 800 },
  "data": {
    "tags": ["urbanism", "cityplanning"],
    "scoreModifier": 10
  }
}
```

**Labels:**
```json
{
  "id": "labels-1",
  "type": "labels",
  "position": { "x": 200, "y": 900 },
  "data": {
    "labels": ["nsfw", "spam"],
    "exclude": true,  // Exclude posts with these labels
    "scoreModifier": -50
  }
}
```

**Engagement:**
```json
{
  "id": "engagement-1",
  "type": "engagement",
  "position": { "x": 200, "y": 1000 },
  "data": {
    "metricType": "likes",  // "likes", "reposts", "replies", "quotes", "bookmarks"
    "operator": "greater_than",  // "greater_than", "less_than", "equals"
    "threshold": 100,
    "scoreModifier": 15
  }
}
```

**Image:**
```json
{
  "id": "image-1",
  "type": "image",
  "position": { "x": 200, "y": 1100 },
  "data": {
    "imageCount": 1,  // null for any count
    "minWidth": 800,
    "maxWidth": null,
    "minHeight": 600,
    "maxHeight": null,
    "aspectRatio": "16:9",  // null for any ratio
    "scoreModifier": 5
  }
}
```

**Video:**
```json
{
  "id": "video-1",
  "type": "video",
  "position": { "x": 200, "y": 1200 },
  "data": {
    "minFileSize": null,
    "maxFileSize": 10000000,  // bytes
    "presentation": "gif",  // null for any, "gif" for GIFs only
    "scoreModifier": 10
  }
}
```

**Media Type:**
```json
{
  "id": "media-1",
  "type": "media",
  "position": { "x": 200, "y": 1300 },
  "data": {
    "types": ["images", "video", "external"],  // Array of selected types
    "mediaTypeScores": {
      "images": 5,
      "video": 10,
      "external": 0
    }
  }
}
```

### Edges

Edges represent connections between nodes. Handle positions determine connection type:

**Flow Connections (Green):**
- Logic nodes → Logic nodes
- Logic nodes → END
- START → Logic nodes

```json
{
  "id": "edge-1",
  "source": "start-1",
  "target": "and-1",
  "sourceHandle": "output-right",
  "targetHandle": "input-left",
  "style": { "stroke": "#51cf66" }  // Green
}
```

**Condition-to-Condition (Orange/Blue):**
- Orange (left/right handles): OR logic chain
- Blue (top/bottom handles): AND logic chain

```json
{
  "id": "edge-2",
  "source": "text-1",
  "target": "language-1",
  "sourceHandle": "output-right",  // Orange connection
  "targetHandle": "input-left",
  "style": { "stroke": "#ff9500" }  // Orange
}
```

**Condition-to-Logic:**
- Orange handles → OR logic node
- Blue handles → AND logic node
- Either → N-of node (purple)

```json
{
  "id": "edge-3",
  "source": "text-1",
  "target": "or-1",
  "sourceHandle": "output-left",  // Orange
  "targetHandle": "input-top",
  "style": { "stroke": "#ff9500" }
}
```

## Scoring Modules (Stage 3)

Scoring modules modify post scores. They always pass posts through.

```json
{
  "scoring": {
    "modules": [
      {
        "id": "recency-1",
        "type": "recency",
        "data": {
          "halfLifeHours": 24,
          "maxBoost": 100
        }
      },
      {
        "id": "engagementscore-1",
        "type": "engagementscore",
        "data": {
          "weights": {
            "likes": 1.0,
            "reposts": 2.0,
            "replies": 1.5,
            "quotes": 2.5,
            "bookmarks": 1.0
          }
        }
      },
      {
        "id": "customscore-1",
        "type": "customscore",
        "data": {
          "score": 50
        }
      }
    ]
  }
}
```

## Fixed Position Modules (Stage 3)

Fixed position modules add posts with **guaranteed positions BEFORE sorting**. They connect to END's right input (port 3).

**Key Characteristics:**
- Execute BEFORE sorting (Stage 3, query time)
- Guaranteed positions (0, 1, 2, etc.)
- NOT affected by sorting modules
- Chain together (linear pipeline)
- Position conflicts auto-resolve (shift to next available)
- Examples: Dynamic pinned posts, personalized featured content, breaking news

```json
{
  "fixed_position": {
    "modules": [
      {
        "id": "dynamicpinned-1",
        "type": "dynamicpinned",  // External module
        "data": {
          "position": 2,  // Guaranteed position
          "api_endpoint": "https://module.com/get-featured-post"
        }
      },
      {
        "id": "breakingnews-1",
        "type": "breakingnews",  // External module
        "data": {
          "position": 3,
          "api_endpoint": "https://module.com/get-breaking-news"
        }
      }
    ]
  }
}
```

**Position Conflict Resolution:**
- Modules execute in chain order
- If position is taken, module shifts to next available position
- Example: Module A (pos 2) → Module B (pos 2, conflicts) → Module B shifts to pos 3

## Sorting Modules (Stage 3)

Sorting modules chain together. They connect to END's bottom input (port 2).

```json
{
  "sorting": {
    "modules": [
      {
        "id": "chronological-1",
        "type": "chronological",
        "data": {
          "order": "newest"  // "newest" or "oldest"
        }
      },
      {
        "id": "byscore-1",
        "type": "byscore",
        "data": {}
      }
    ]
  }
}
```

**Available Sorting Types:**
- `chronological`: Sort by post creation date
- `byscore`: Sort by accumulated score
- `mostlikes`: Sort by like count
- `mostengagement`: Sort by total engagement
- `random`: Random shuffle

## Injection Modules (Stage 3)

Injection modules add posts at query time **AFTER sorting**. They are **NOT affected by sorting** and connect to END's top input.

**Key Characteristics:**
- Execute AFTER sorting (Stage 3, query time)
- NOT affected by sorting modules
- Inserted at intervals throughout the sorted feed
- Examples: Ads (every X posts), rotating posts, sponsored content

```json
{
  "injection": {
    "modules": [
      {
        "id": "rotatingposts-1",
        "type": "rotatingposts",
        "data": {
          "postUrls": [
            "https://bsky.app/profile/did:plc:abc123/post/rkey1",
            "https://bsky.app/profile/did:plc:def456/post/rkey2"
          ],
          "strategy": "round-robin"  // "round-robin", "random", "weighted"
        }
      },
      {
        "id": "ads-1",
        "type": "ads",  // External module
        "data": {
          "frequency": 5,  // Every 5 posts
          "max_per_day": 3
        }
      },
      {
        "id": "manualposts-injection-1",
        "type": "manualposts",  // Manual posts as INJECTION (bypasses assignment)
        "data": {
          "postUrls": [
            "https://bsky.app/profile/did:plc:abc123/post/rkey1"
          ],
          "frequency": 10  // Inject every 10 posts
        }
      }
    ]
  }
}
```

**Manual Posts as Injection:**
- When configured as injection, manual posts bypass assignment logic
- They are injected at specified intervals
- They are NOT affected by sorting
- Use this when you want curated posts that always appear regardless of sorting

## Special Features

### Pinned Posts (Native)

Pinned posts are a special native feature with **fixed positions BEFORE sorting**. They are NOT injection modules.

**Key Characteristics:**
- Execute BEFORE sorting (Stage 3, query time)
- Fixed positions (0, 1, 2, etc.)
- NOT affected by sorting modules
- Always appear at top of feed
- Native feature (no external modules)

```json
{
  "pinned_posts": [
    {
      "post_uri": "at://did:plc:abc123/app.bsky.feed.post/rkey1",
      "position": 0  // 0 = top
    },
    {
      "post_uri": "at://did:plc:def456/app.bsky.feed.post/rkey2",
      "position": 1
    }
  ]
}
```

### Rotating Posts (Native)

Rotating posts cycle through a set at a fixed position, BEFORE sorting.

```json
{
  "rotating_posts": [
    {
      "post_uri": "at://did:plc:abc123/app.bsky.feed.post/rkey1",
      "position": 2,  // Fixed position
      "rotation_group": "default",
      "weight": 1,
      "rotate_every_minutes": 30  // Optional: time-based rotation
    }
  ]
}
```

## Execution Order Summary

### Stage 2: Feed Assignment
1. **Source Nodes** (START, Manual Posts as source) → Assignment logic → END
2. Posts that pass are added to `feed_posts` table

### Stage 3: Feed Serving (Query Time)
1. **Pinned Posts** - Fixed positions 0, 1, 2... (BEFORE sorting)
2. **Rotating Posts** - Fixed positions (BEFORE sorting)
3. **Sorting Modules** - Reorder posts from `feed_posts` (affects source posts only)
4. **Injection Modules** - Insert at intervals AFTER sorting (NOT affected by sorting)

**Key Distinctions:**
- **Source nodes** → Go through assignment → Affected by sorting
- **Pinned/Rotating** → Fixed positions → NOT affected by sorting
- **Injection modules** → Inserted after sorting → NOT affected by sorting

## Complete Example

```json
{
  "version": "1.0",
  "feed_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Urbanism Feed",
  "description": "Posts about urban planning and city design",
  
  "assignment": {
    "nodes": [
      {
        "id": "start-1",
        "type": "start",
        "position": { "x": 0, "y": 0 },
        "data": {}
      },
      {
        "id": "text-1",
        "type": "text",
        "position": { "x": 200, "y": 0 },
        "data": {
          "keywords": ["urbanism", "city planning"],
          "fields": ["text"],
          "exclude": false,
          "scoreModifier": 10
        }
      },
      {
        "id": "or-1",
        "type": "or",
        "position": { "x": 500, "y": 0 },
        "data": {}
      },
      {
        "id": "end-1",
        "type": "end",
        "position": { "x": 800, "y": 0 },
        "data": {}
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": "start-1",
        "target": "text-1",
        "sourceHandle": "output-right",
        "targetHandle": "input-left"
      },
      {
        "id": "e2",
        "source": "text-1",
        "target": "or-1",
        "sourceHandle": "output-left",
        "targetHandle": "input-top"
      },
      {
        "id": "e3",
        "source": "or-1",
        "target": "end-1",
        "sourceHandle": "output-right",
        "targetHandle": "input-left"
      }
    ],
    "logic": "OR"
  },
  
  "scoring": {
    "modules": [
      {
        "id": "recency-1",
        "type": "recency",
        "data": {
          "halfLifeHours": 24,
          "maxBoost": 100
        }
      }
    ]
  },
  
  "fixed_position": {
    "modules": []
  },
  
  "sorting": {
    "modules": [
      {
        "id": "chronological-1",
        "type": "chronological",
        "data": {
          "order": "newest"
        }
      }
    ]
  },
  
  "injection": {
    "modules": []
  },
  
  "pinned_posts": [],
  "rotating_posts": []
}
```

## Evaluation Order

### Stage 2: Feed Assignment
1. **Source Nodes** provide posts (START, Manual Posts as source)
2. Traverse graph from START to END
3. Evaluate conditions based on connection colors (orange=OR, blue=AND)
4. Apply score modifiers from conditions
5. If post passes, add to `feed_posts` table

### Stage 3: Feed Serving (Query Time)
1. **Pinned Posts** - Add at fixed positions (0, 1, 2...)
2. **Rotating Posts** - Add at fixed positions
3. **Fixed Position Modules** - Add at guaranteed positions (chain in order, conflicts auto-resolve)
4. Fetch posts from `feed_posts` (source posts)
5. Apply scoring modules (accumulate scores)
6. Apply sorting modules (chain in order) - **Only affects source posts**
7. Apply injection modules (insert at intervals) - **NOT affected by sorting**
8. Return to user

**Important:** 
- Sorting only affects posts from `feed_posts` (source nodes)
- Pinned posts, rotating posts, and fixed position modules are NOT affected by sorting
- Fixed position modules execute BEFORE sorting (guaranteed positions)
- Injection modules execute AFTER sorting (inserted at intervals)

## END Node Input Ports

The END node has **4 distinct input ports**:

1. **LEFT (Port 0)** - Main flow (green)
   - Source nodes, conditions, logic, scoring modules
   - Stage 2: Feed assignment

2. **RIGHT (Port 3)** - Fixed position modules (yellow)
   - Fixed position modules
   - Stage 3: BEFORE sorting
   - Guaranteed positions

3. **BOTTOM (Port 2)** - Sorting modules (purple)
   - Sorting modules
   - Stage 3: After fixed positions, before injection
   - Chain in order

4. **TOP (Port 1)** - Injection modules (orange/red)
   - Injection modules
   - Stage 3: AFTER sorting
   - Inserted at intervals

## Notes

- **Node IDs**: Must be unique within the graph
- **Edge Handles**: Determine connection type and logic
- **Score Modifiers**: Accumulate from all passed conditions
- **Module Order**: 
  - Fixed position modules chain in order (position conflicts auto-resolve)
  - Sorting modules chain in order
  - Scoring modules all apply
  - Injection modules chain in order
- **Validation**: Graph must have START and END nodes with valid path between them
- **Execution Order**: Pinned → Rotating → Fixed Position → Sorting → Injection
