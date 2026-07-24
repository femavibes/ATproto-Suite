# Graze Custom Nodes Reference

Complete reference for building Graze.social custom nodes and feeds.
Check POST_METADATA.md and GRAZE_FILTER_OPERATIONS.md for graze node info and post metadata info. SUPER useful for making a custom node.

## Table of Contents
- [Structure](#structure)
- [Filter Operations](#filter-operations)
- [Parameter Types](#parameter-types)
- [Post Data Model](#post-data-model)
- [Operators](#operators)
- [Metadata Options](#metadata-options)
- [Examples](#examples)

---

## Structure

### Basic Manifest Structure
```json
{
  "manifest": {
    "filter": {
      // filter logic (and/or/operations)
      "metadata": {
        "color": "green",
        "pattern": "dots",
        "title": "Section Title",
        "description": "Section description",
        "customNodeParameters": [...]
      }
    },
    "models": [...] // optional ML models
  }
}
```

### Feed Manifest (adds order)
```json
{
  "order": "new",  // or other ordering
  "manifest": { ... }
}
```

---

## Filter Operations

### Logical Operators
- `and` (All of these) - All conditions must be true
- `or` (Any of these) - At least one condition must be true

```json
{
  "and": [
    { /* condition 1 */ },
    { /* condition 2 */ }
  ],
  "metadata": {}
}
```

### Comparison Operations

#### attribute_compare
Compare post attributes to values (including parameter values).
```json
{
  "attribute_compare": [
    "embed.video.size",
    ">=",
    "$SIZE_MINIMUM"
  ]
}
```

#### param_compare
Compare parameter values (used with toggles, numbers, etc).
```json
{
  "param_compare": [
    "$VERTICAL_VIDEO_ONLY",
    "==",
    false
  ]
}
```

### Regex Operations

#### regex_matches (Regex - Contains)
Single regex pattern matching.
```json
{
  "regex_matches": [
    "text",
    "\\bthe\\b",
    true  // case insensitive (true=default, false=case sensitive)
  ]
}
```

#### regex_negation_matches (Regex - Missing)
Negation match - excludes matching patterns.
```json
{
  "regex_negation_matches": [
    "text",
    "\\bspam\\b",
    true  // case insensitive (true=default, false=case sensitive)
  ]
}
```

#### regex_any (Word List - Contains)
Match any from a list of terms (shorthand OR).
```json
{
  "regex_any": [
    "text",
    ["cat", "dog"],
    true,   // case insensitive (true=default, false=case sensitive)
    false   // multiline (false=word list mode with auto \b, true=regex mode)
  ]
}
```

#### regex_none (Word List - Missing)
Match none from a list of terms - excludes all.
```json
{
  "regex_none": [
    "text",
    ["spam", "bot"],
    true,   // case insensitive (true=default, false=case sensitive)
    false   // multiline (false=word list mode with auto \b, true=regex mode)
  ]
}
```

### Content Type Operations

#### embed_type
Filter by embed type.
```json
{
  "embed_type": ["==", "video"]
}
```
**Types:** `video`, `image`, `image_group`, `link`, `post`, `gif`

**Note:** The `video` type has special behavior - it enables video feed UI mode. This cannot be toggled conditionally in custom nodes.

**Note:** The `gif` type may be unreliable. To filter GIFs, use `attribute_compare` with `embed.presentation` field instead:
```json
{
  "attribute_compare": ["embed.presentation", "==", "gif"]
}
```

#### post_type
Filter by post type.
```json
{
  "post_type": ["not_in", ["reply"]]
}
```
**Types:** `reply`, `quote`

### Entity Operations

#### entity_matches / entity_excludes
Match/exclude entities (preferred for languages, hashtags, etc).
```json
{
  "entity_matches": [
    "langs",
    ["en", "es"]
  ]
}
```
**Entity types:** `langs`, `urls`, `domains`, `mentions`, `hashtags`

### Social Graph Operations

#### social_graph
Check follower/following relationships.
```json
{
  "social_graph": [
    "username.bsky.social",
    "in",
    "followers"
  ]
}
```
**Operators:** `in`, `not_in`  
**Directions:** `followers`, `follows`

#### social_list
Explicit DID list.
```json
{
  "social_list": [
    ["did:plc:abc123", "did:plc:def456"],
    "in"
  ]
}
```

#### list_member
Check list membership.
```json
{
  "list_member": [
    "https://bsky.app/profile/user/lists/abc123",
    "in"
  ]
}
```

#### starter_pack_member
Check starter pack membership.
```json
{
  "starter_pack_member": [
    "https://bsky.app/starter-pack/user/abc123",
    "in"
  ]
}
```

#### magic_audience
Check magic audience membership.
```json
{
  "magic_audience": [
    "42",
    "in"
  ]
}
```

### ML/AI Operations

#### text_similarity
Semantic similarity using transformer models.
```json
{
  "text_similarity": [
    "text",
    {
      "anchor_text": "This is an important update",
      "model_name": "all-MiniLM-L6-v2"
    },
    ">=",
    0.3
  ]
}
```

#### model_probability
XGBoost classification probability.
```json
{
  "model_probability": [
    {
      "model_name": "news_without_science"
    },
    ">=",
    0.9
  ]
}
```

#### content_moderation
KoalaAI/Text-Moderation categories (English only currently).
```json
{
  "content_moderation": [
    "OK",
    ">=",
    0.9
  ]
}
```

#### language_analysis
Advanced language detection.
```json
{
  "language_analysis": [
    "Dutch",
    ">=",
    0.5
  ]
}
```
**Languages:** Japanese, Dutch, Arabic, Polish, German, Italian, Portuguese, Turkish, Spanish, Hindi, Greek, Urdu, Bulgarian, English, French, Chinese, Russian, Thai, Swahili, Vietnamese

#### sentiment_analysis
Sentiment classification.
```json
{
  "sentiment_analysis": [
    "Positive",
    ">=",
    0.5
  ]
}
```
**Categories:** Positive, Negative, Neutral

#### financial_sentiment_analysis
Financial sentiment (FinBERT).
```json
{
  "financial_sentiment_analysis": [
    "Positive",
    ">=",
    0.5
  ]
}
```
**Categories:** Positive, Negative, Neutral

#### emotion_sentiment_analysis
Emotion detection (GoEmotions).
```json
{
  "emotion_sentiment_analysis": [
    "Curiosity",
    ">=",
    0.5
  ]
}
```
**Categories:** Admiration, Amusement, Anger, Annoyance, Approval, Caring, Confusion, Curiosity, Desire, Disappointment, Disapproval, Disgust, Embarrassment, Excitement, Fear, Gratitude, Grief, Joy, Love, Nervousness, Optimism, Pride, Realization, Relief, Remorse, Sadness, Surprise, Neutral

#### toxicity_analysis
Toxicity detection (ToxicBert).
```json
{
  "toxicity_analysis": [
    "Toxic",
    "<=",
    0.5
  ]
}
```
**Categories:** Toxic, Severe Toxicity, Obscene, Threat, Insult, Identity Hate

#### topic_analysis
Topic classification.
```json
{
  "topic_analysis": [
    "Gaming",
    ">=",
    0.5
  ]
}
```
**Categories:** Arts & Culture, Business & Entrepreneurs, Celebrity & Pop Culture, Diaries & Daily Life, Family, Fashion & Style, Film TV & Video, Fitness & Health, Food & Dining, Gaming, Learning & Educational, Music, News & Social Concern, Other Hobbies, Relationships, Science & Technology, Sports, Travel & Adventure, Youth & Student Life

#### text_arbitrary
Arbitrary text label classification (mDeBERTa).
```json
{
  "text_arbitrary": [
    "scotland",
    ">=",
    0.5
  ]
}
```

#### image_nsfw
NSFW image detection.
```json
{
  "image_nsfw": [
    "NSFW",
    "<=",
    0.5
  ]
}
```
**Categories:** NSFW, SFW

#### image_arbitrary
Arbitrary image label classification (CLIP).
```json
{
  "image_arbitrary": [
    "scotland",
    ">=",
    0.5,
    0.0
  ]
}
```

### Special Custom Node Operations

#### each
Loop over list parameters.
```json
{
  "each": [
    "$MEMBER_LISTS",
    {
      "list_member": [
        "$MEMBER_LISTS_ITEM",
        "in"
      ]
    }
  ]
}
```
**Note:** Use `$PARAM_NAME_ITEM` to reference current item in loop.

---

## Parameter Types

Parameters are defined in `metadata.customNodeParameters`:

```json
{
  "name": "PARAM_NAME",
  "type": "toggle",
  "description": "What this parameter does",
  "displayName": "User-facing name",
  "exampleValue": true
}
```

### input
Simple string input.
```json
{
  "name": "HANDLE",
  "type": "input",
  "description": "Enter your handle",
  "exampleValue": "user.bsky.social"
}
```
**Note:** If no `type` specified, defaults to input.

### regex
Regex pattern (auto-escaped for use in regex nodes).
```json
{
  "name": "PATTERN",
  "type": "regex",
  "description": "Regex pattern to match",
  "exampleValue": "\\bword\\b"
}
```

### number
Numeric value.
```json
{
  "name": "THRESHOLD",
  "type": "number",
  "description": "Minimum threshold",
  "exampleValue": 10,
  "isPercentage": false
}
```

### toggle
Boolean on/off switch.
```json
{
  "name": "ENABLE_FEATURE",
  "type": "toggle",
  "description": "Enable this feature",
  "displayName": "Enable Feature?",
  "exampleValue": false
}
```

### select
Dropdown with options.
```json
{
  "name": "SIZE_MINIMUM",
  "type": "select",
  "labels": ["1MB+", "2MB+", "5MB+"],
  "options": ["1000000", "2000000", "5000000"],
  "description": "Minimum file size",
  "displayName": "Set Minimum Size:",
  "exampleValue": "1000000"
}
```

### list
Array of values (works with `each` node).
```json
{
  "name": "MEMBER_LISTS",
  "type": "list",
  "description": "Add lists or starter packs",
  "exampleValue": ["https://bsky.app/profile/user/lists/abc123"]
}
```

---

## Post Data Model

### Core Post Attributes
- `text` - Post text content
- `$type` - Record type ("app.bsky.feed.post")
- `createdAt` - ISO 8601 timestamp (e.g., "2026-02-11T00:25:50.501Z")
  - Note: Some posts may have timezone offsets or appear in the future due to client clock issues
- `langs` - Array of language codes (ISO 639-1), e.g., `["en"]`
- `langs[*]` - Individual language code (for filtering)

### Reply Structure
Posts that are replies include a `reply` object:
- `reply.root.uri` - AT URI of the root post in the thread
- `reply.root.cid` - Content ID of the root post
- `reply.parent.uri` - AT URI of the immediate parent post
- `reply.parent.cid` - Content ID of the parent post

Note: In direct replies, `root` and `parent` are the same. In deeper threads, `root` stays constant while `parent` changes.

### Labels
Self-applied content labels:
- `labels.$type` - "com.atproto.label.defs#selfLabels"
- `labels.values` - Array of label objects
- `labels.values[*].val` - Label value (e.g., "porn", "graphic-media")

Note: Custom labeler labels are applied post-creation and require hydration (not in base post record).

### Facets
Rich text features (links, mentions, hashtags):
- `facets` - Array of facet objects
- `facets[*].$type` - "app.bsky.richtext.facet"
- `facets[*].index.byteStart` - Start position in text (byte offset)
- `facets[*].index.byteEnd` - End position in text (byte offset)
- `facets[*].features` - Array of feature objects
- `facets[*].features[*].$type` - Feature type:
  - `app.bsky.richtext.facet#link` - Hyperlinks
  - `app.bsky.richtext.facet#mention` - User mentions
  - `app.bsky.richtext.facet#tag` - Hashtags
- `facets[*].features[*].uri` - URI for links
- `facets[*].features[*].did` - DID for mentions
- `facets[*].features[*].tag` - Tag text for hashtags (without #)

### Embed Types

Posts can have one primary embed. The `embed.$type` field determines the embed type.

#### No Embed
Text-only posts have no `embed` field.

#### External Link Embed
`embed.$type` = "app.bsky.embed.external"
- `embed.external.uri` - Link URL
- `embed.external.title` - Link title
- `embed.external.description` - Link description
- `embed.external.thumb` - Thumbnail blob (optional)
  - `embed.external.thumb.$type` - "blob"
  - `embed.external.thumb.ref.$link` - Content hash (IPFS CID)
  - `embed.external.thumb.mimeType` - Image MIME type (e.g., "image/jpeg")
  - `embed.external.thumb.size` - Thumbnail size in bytes

#### Images Embed
`embed.$type` = "app.bsky.embed.images"
- `embed.images` - Array of image objects (1-4 images)
- `embed.images[*].alt` - Alt text (can be empty string)
- `embed.images[*].image` - Image blob
  - `embed.images[*].image.$type` - "blob"
  - `embed.images[*].image.ref.$link` - Content hash
  - `embed.images[*].image.mimeType` - Image MIME type (e.g., "image/jpeg", "image/png")
  - `embed.images[*].image.size` - Image file size in bytes
- `embed.images[*].aspectRatio` - Aspect ratio object
  - `embed.images[*].aspectRatio.width` - Width value
  - `embed.images[*].aspectRatio.height` - Height value

Note: Single image posts use the same structure with one item in the array.

#### Video Embed
`embed.$type` = "app.bsky.embed.video"
- `embed.video` - Video blob
  - `embed.video.$type` - "blob"
  - `embed.video.ref.$link` - Content hash
  - `embed.video.mimeType` - "video/mp4"
  - `embed.video.size` - Video file size in bytes
- `embed.aspectRatio` - Aspect ratio object (not array!)
  - `embed.aspectRatio.width` - Width value
  - `embed.aspectRatio.height` - Height value
- `embed.presentation` - "gif" (optional, indicates GIF-like playback)

Note: GIFs are videos with `presentation: "gif"`. This field was added recently to distinguish GIFs from videos.

#### Quote Post Embed
`embed.$type` = "app.bsky.embed.record"
- `embed.record.uri` - AT URI of quoted post (format: `at://did/collection/rkey`)
- `embed.record.cid` - Content ID of quoted post

#### Quote Post with Media Embed
`embed.$type` = "app.bsky.embed.recordWithMedia"

Combines a quote post with media (images, video, or external link):
- `embed.media` - Media embed object
  - `embed.media.$type` - One of:
    - "app.bsky.embed.images"
    - "app.bsky.embed.video"
    - "app.bsky.embed.external"
  - (Contains same structure as respective embed type)
- `embed.record` - Quote post record
  - `embed.record.$type` - "app.bsky.embed.record"
  - `embed.record.record.uri` - AT URI of quoted post
  - `embed.record.record.cid` - Content ID of quoted post

Note: You cannot combine images with external links directly, but you can quote a post and attach either.

### Hydrated Metadata

These fields are added by Graze during processing and are not in the original post record.

#### Hydrated User Metadata
- `hydrated_metadata.user.did` - User DID
- `hydrated_metadata.user.handle` - User handle
- `hydrated_metadata.user.display_name` - Display name
- `hydrated_metadata.user.description` - User bio
- `hydrated_metadata.user.labels[*].val` - User labels

#### Hydrated Mentions
- `hydrated_metadata.mentions[*].handle` - Mentioned user handle
- `hydrated_metadata.mentions[*].display_name` - Mentioned user display name
- `hydrated_metadata.mentions[*].description` - Mentioned user bio

#### Hydrated Quote Post
- `hydrated_metadata.quote_post.author.handle` - Quoted post author handle
- `hydrated_metadata.quote_post.author.display_name` - Quoted post author display name
- `hydrated_metadata.quote_post.record.text` - Quoted post text

#### Hydrated Parent Post (for replies)
- `hydrated_metadata.parent_post.author.handle` - Parent post author handle
- `hydrated_metadata.parent_post.author.display_name` - Parent post author display name
- `hydrated_metadata.parent_post.record.text` - Parent post text

#### Hydrated Reply Post
- `hydrated_metadata.reply_post.author.handle` - Reply author handle
- `hydrated_metadata.reply_post.record.text` - Reply text

### Inferences (ML-generated)

These fields are generated by Graze's ML processing:
- `inferences.video.audio_transcription.text` - Video transcription text
- `inferences.video.audio_transcription.language` - Transcription language

---

## Operators

### Comparison Operators
- `==` - Equal to
- `!=` - Not equal to
- `>=` - Greater than or equal to
- `<=` - Less than or equal to
- `>` - Greater than
- `<` - Less than
- `in` - Contained in
- `not_in` - Not contained in

---

## Metadata Options

Metadata can be added at various levels for organization and visualization:

```json
{
  "metadata": {
    "color": "green",
    "pattern": "dots",
    "title": "Section Title",
    "description": "Section description",
    "customNodeParameters": [...]
  }
}
```

### Colors
`green`, `blue`, `red`, `yellow`, `purple`, `indigo`, etc.

### Patterns
`dots`, `lines`, `checkerboard`, `cow`, etc.

---

## Examples

### Simple Toggle Pattern
```json
{
  "or": [
    {
      "param_compare": ["$ENABLE_FEATURE", "==", false]
    },
    {
      // feature logic when enabled
    }
  ]
}
```

### Each Loop with Lists
```json
{
  "each": [
    "$MEMBER_LISTS",
    {
      "list_member": ["$MEMBER_LISTS_ITEM", "in"]
    }
  ]
}
```

### Video Size Filter
```json
{
  "and": [
    {
      "attribute_compare": ["embed.video.size", ">=", "$SIZE_MIN"]
    },
    {
      "attribute_compare": ["embed.video.size", "<=", "$SIZE_MAX"]
    }
  ]
}
```

### Alt Text Requirement
```json
{
  "or": [
    {
      "and": [
        {"embed_type": ["!=", "image"]},
        {"embed_type": ["!=", "image_group"]}
      ]
    },
    {
      "regex_any": [
        "embed.images[*].alt",
        ["[\\w\\s]{4,}"],
        true,
        true
      ]
    }
  ]
}
```

---

## Notes

- Parameters are referenced with `$PARAM_NAME`
- In `each` loops, use `$PARAM_NAME_ITEM` for current item
- Prefer `entity_matches` for languages over regex on `langs[*]`
- Multiple approaches often exist - choose the most readable/maintainable
- Metadata can be nested at any level for organization
- Empty metadata objects (`"metadata": {}`) are common for grouping

---

## Post Record Structure Summary

### Minimal Post (text only)
```json
{
  "text": "Hello world",
  "$type": "app.bsky.feed.post",
  "langs": ["en"],
  "createdAt": "2026-02-11T00:00:00.000Z"
}
```

### Post with External Link
```json
{
  "text": "Check this out",
  "$type": "app.bsky.feed.post",
  "embed": {
    "$type": "app.bsky.embed.external",
    "external": {
      "uri": "https://example.com",
      "title": "Example",
      "description": "An example link"
    }
  },
  "langs": ["en"],
  "createdAt": "2026-02-11T00:00:00.000Z"
}
```

### Post with Images
```json
{
  "text": "Check out these photos",
  "$type": "app.bsky.feed.post",
  "embed": {
    "$type": "app.bsky.embed.images",
    "images": [
      {
        "alt": "Description of image",
        "image": { /* blob */ },
        "aspectRatio": {"width": 1920, "height": 1080}
      }
    ]
  },
  "langs": ["en"],
  "createdAt": "2026-02-11T00:00:00.000Z"
}
```

### Reply Post
```json
{
  "text": "Great point!",
  "$type": "app.bsky.feed.post",
  "reply": {
    "root": {
      "uri": "at://did:plc:abc/app.bsky.feed.post/xyz",
      "cid": "bafyrei..."
    },
    "parent": {
      "uri": "at://did:plc:abc/app.bsky.feed.post/xyz",
      "cid": "bafyrei..."
    }
  },
  "langs": ["en"],
  "createdAt": "2026-02-11T00:00:00.000Z"
}
```

### Quote Post with Media
```json
{
  "text": "Look at this!",
  "$type": "app.bsky.feed.post",
  "embed": {
    "$type": "app.bsky.embed.recordWithMedia",
    "media": {
      "$type": "app.bsky.embed.images",
      "images": [ /* ... */ ]
    },
    "record": {
      "$type": "app.bsky.embed.record",
      "record": {
        "uri": "at://did:plc:abc/app.bsky.feed.post/xyz",
        "cid": "bafyrei..."
      }
    }
  },
  "langs": ["en"],
  "createdAt": "2026-02-11T00:00:00.000Z"
}
```

---

## Embed Type Reference for Filtering

When using `embed_type` filter:
- `video` - Video posts (check `embed.presentation` to distinguish GIFs)
- `gif` - GIF posts (videos with `presentation: "gif"`)
- `image` - Single image
- `image_group` - Multiple images (both use `app.bsky.embed.images`)
- `link` - External link cards
- `post` - Quote posts (embedded records)

Note: `recordWithMedia` is not a direct embed_type - it's detected by the presence of both media and record.

---

## Aspect Ratio Notes

In post records:
- Videos: `embed.aspectRatio.width` and `embed.aspectRatio.height` (object)
- Images: `embed.images[*].aspectRatio.width` and `embed.images[*].aspectRatio.height` (object)

In custom node filters:
- Often referenced as `embed.aspectRatio[*]` with string patterns like "1920 1080"
- Graze transforms the width/height object into this format for matching

---

## TODO / Expandable Sections

- [ ] Additional filter operations not yet documented
- [ ] Models section details for custom ML models
- [ ] More complex examples combining multiple filters
- [ ] Performance considerations
- [ ] Best practices and patterns
- [ ] Hydrated labels (custom labeler labels - in development)
