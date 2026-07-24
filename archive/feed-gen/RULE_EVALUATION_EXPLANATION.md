# Rule Evaluation Engine Explanation

## What is Rule Evaluation?

**Rule Evaluation** is the process of checking if a post matches a feed's rules. When a new post comes in from Jetstream, we need to decide: "Does this post belong in Feed X?"

## The Rule Structure

Rules are stored as JSONB in the `feeds.assignment_rules` column. The format is:

```json
{
  "logic": "OR",
  "groups": [
    {
      "logic": "AND",
      "conditions": [
        {
          "field": "text",
          "operator": "contains",
          "value": "urbanism"
        },
        {
          "field": "like_count",
          "operator": ">=",
          "value": 100
        }
      ]
    },
    {
      "logic": "AND",
      "conditions": [
        {
          "field": "author_did",
          "operator": "in_list",
          "value": "list-uuid-123"
        }
      ]
    }
  ]
}
```

## Logic Explained

### Top-Level Logic: "OR"
- If **ANY** group matches → post is included
- Example: Group 1 OR Group 2 OR Group 3

### Group-Level Logic: "AND"
- **ALL** conditions in a group must be true
- Example: (text contains "urbanism" AND likes >= 100)

## Evaluation Process

```
New post arrives
  ↓
For each feed:
  ↓
  Load feed's assignment_rules
  ↓
  For each rule group:
    ↓
    Evaluate all conditions in group
    ↓
    If group logic is "AND":
      All conditions must be true
    If group logic is "OR":
      At least one condition must be true
    ↓
  If ANY group matches (top-level OR):
    Add post to feed_posts table
```

## Condition Types

### 1. Text Conditions
```json
{
  "field": "text",
  "operator": "contains",
  "value": "urbanism"
}
```
- Checks if post text contains the word
- Operators: `contains`, `not contains`, `equals`, `matches regex`

### 2. Numeric Conditions
```json
{
  "field": "like_count",
  "operator": ">=",
  "value": 100
}
```
- Compares numbers
- Operators: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Fields: `like_count`, `repost_count`, `reply_count`, `follower_count`, etc.

### 3. Boolean Conditions
```json
{
  "field": "has_images",
  "operator": "is true"
}
```
- Checks true/false
- Operators: `is true`, `is false`
- Fields: `has_images`, `has_video`, `has_link`

### 4. List Conditions
```json
{
  "field": "author_did",
  "operator": "in_list",
  "value": "list-uuid-123"
}
```
- Checks if value is in a user list
- Operators: `in_list`, `not in_list`
- Looks up `user_lists` table

### 5. Module Conditions (Future)
```json
{
  "field": "module_sentiment",
  "operator": "==",
  "value": "positive"
}
```
- Uses enrichment data from modules
- Queries `post_enrichments` table

## Data Sources

When evaluating conditions, we need data from multiple places:

### From `posts` table:
- `text`, `author_did`, `has_images`, `has_video`, `has_link`
- `created_at` (for age calculations)
- `post_type`, `reply_parent`, `reply_root`

### From `post_enrichments` table:
- `engagement` → `like_count`, `repost_count`, `reply_count`
- `author_profile` → `follower_count`, `following_count`
- `video_metadata` → `duration`, `resolution`
- `labels` → `nsfw`, `spam`

### From `author_cache` table:
- `follower_count`, `following_count`
- `created_at` (for account age)

### From `user_lists` table:
- `members` array (for `in_list` conditions)

## Example Evaluation

**Post:**
```json
{
  "cid": "abc123",
  "text": "I love urbanism and walkable cities!",
  "author_did": "did:plc:user456",
  "has_images": true,
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Feed Rules:**
```json
{
  "logic": "OR",
  "groups": [
    {
      "logic": "AND",
      "conditions": [
        {"field": "text", "operator": "contains", "value": "urbanism"},
        {"field": "has_images", "operator": "is true"}
      ]
    }
  ]
}
```

**Evaluation:**
1. Check Group 1:
   - Condition 1: Does text contain "urbanism"? ✅ YES
   - Condition 2: Does has_images equal true? ✅ YES
   - Group logic is AND: Both true → Group matches ✅
2. Top-level logic is OR: At least one group matches → **POST INCLUDED** ✅

## Performance Considerations

### Optimization Strategies:

1. **Early Exit**: If one group matches (OR logic), stop checking
2. **Index Usage**: Use database indexes for fast lookups
3. **Caching**: Cache author profiles, user lists
4. **Batch Processing**: Evaluate multiple posts at once
5. **Keyword Pre-filtering**: Use Aho-Corasick to filter posts before rule evaluation

### Aho-Corasick Pre-filtering

Before rule evaluation, we can quickly filter posts using keywords:
- Load ALL keywords from ALL feeds
- Build Aho-Corasick automaton
- Only evaluate rules for posts that match keywords
- Massive performance boost (avoids evaluating every post)

## Implementation Steps

1. **Rule Parser**: Parse JSONB rules into Python objects
2. **Condition Evaluator**: Evaluate individual conditions
3. **Group Evaluator**: Evaluate groups with AND/OR logic
4. **Rule Evaluator**: Evaluate top-level OR logic
5. **Data Fetcher**: Fetch post data, enrichments, author cache
6. **Integration**: Connect to feed-assignment-worker service

## Why This is Complex

- **Multiple data sources**: Posts, enrichments, cache, lists
- **Nested logic**: Groups within groups
- **Performance**: Need to be fast (thousands of posts/minute)
- **Extensibility**: Must support module fields we don't know yet
- **Edge cases**: Missing data, null values, type mismatches

## When to Build This

**After:**
- ✅ Database schema (done)
- ✅ Basic feed API (to test)
- ✅ Jetstream ingestion (to have posts to evaluate)

**Before:**
- Module system (rules use module data)
- Visual builder backend (saves rules in this format)
