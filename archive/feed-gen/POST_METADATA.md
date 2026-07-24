`# Post Metadata Guide

All available fields in Bluesky posts for filtering.

**Fields with (UI Name)** - Available in Graze visual editor dropdown menus  
**Fields without (UI Name)** - JSON editor only

## Core Fields

**text** - Post text content
**createdAt** - ISO timestamp (2026-02-11T00:00:00.000Z)
**langs** - Array of language codes ["en", "es"] or locale codes ["en-US", "es-MX"]. Language filtering matches both base codes and locale variants (e.g., selecting "en" matches both "en" and "en-US").
**$type** - Record type (app.bsky.feed.post)

### Bridged Content Fields
**tags** - Array of outline tags (Bluesky's new tag feature) OR hashtags/categories from bridged platforms (e.g., ["art", "artsky"] or ["spotify", "Real Estate"])
**tags[*]** - Individual tag (without #)
**bridgyOriginalText** - Original HTML/text from bridged platform (Mastodon, web, etc.) — searchable via Text Contains and Regex nodes
**bridgyOriginalUrl** - Original URL from bridged platform (e.g., "https://snarfed.org/2025-08-06_55514") — searchable via Text Contains and Regex nodes

**Note:** The `tags` field appears on:
1. **Native Bluesky posts** with outline tags (Bluesky's new feature for adding tags without showing them in post text)
2. **Bridged posts** from other platforms via Bridgy Fed (contains hashtags or RSS categories from source platform)

Outline tags are separate from visible hashtags in `facets`.

## Labels

**labels.$type** - Label definition type ("com.atproto.label.defs#selfLabels")
**labels.values** - Array of label objects
**labels.values[*].val** - Self-applied labels (porn, graphic-media, etc.)

## Facets (Rich Text)

**facets** - Array of rich text facet objects
**facets[*].$type** - Facet type ("app.bsky.richtext.facet")
**facets[*].index.byteStart** - Start position in text
**facets[*].index.byteEnd** - End position in text
**facets[*].features** - Array of feature objects
**facets[*].features[*].$type** - Feature type (#link, #mention, #tag)
**facets[*].features[*].uri** - Link URLs
**facets[*].features[*].did** - Mentioned user DIDs
**facets[*].features[*].tag** - Hashtag text (without #)

**Hidden Hashtags:** Bluesky supports hidden hashtags where `facets[*].index.byteEnd` exceeds the text length. These hashtags exist for discoverability but don't appear in the visible post text. You can filter for hidden hashtags by comparing byteEnd with text length.

### Internal: Jetstream → database → evaluators (why “database” shows up)

Posts **do** come from Jetstream with the normal ATProto record (`text`, `facets`, `tags`, etc.). On ingest, `services/jetstream-ingestion/worker.py` walks `record.facets` and **`record.tags`**, then stores **denormalized** columns on `posts`:

- **`facet_tags`** — `TEXT[]` of visible hashtag strings from facet features (`app.bsky.richtext.facet#tag`), without `#`
- **`outline_tags`** — `TEXT[]` from `record.tags` (outline / hidden tags and bridged tags)

The graph evaluators (Python assignment worker, ingest gate mirror, JS visual debugger) are still written against the **logical post shape** from this document: `facets[*].features[*].tag` and `tags[*]`. So any code path that starts from a **`posts` table row** (assignment sweep, `/debug/post` when the post is already indexed) must **reconstruct** `facets` / `tags` from those arrays if the row does not carry a full `record_json` blob. That reconstruction is not “ignoring Jetstream”; it is **rehydrating** the same information we already extracted at ingest time.

Relevant code:

- Ingestion extraction: `services/jetstream-ingestion/worker.py` (facet / outline tag lists written with the row)
- Assignment canonical payload: `services/feed-assignment-worker/post_payload.py` (`canonical_post_payload` backfills `facets` / `tags` from `facet_tags` / `outline_tags`)
- Debug URL flow: `services/feed-api/feed.py` (`_fetch_post_from_bluesky` includes `facet_tags` / `outline_tags`) and `services/visual-editor/src/components/Canvas.jsx` (`normalizeDebugPost` maps them for `evaluateGraph`)

## Reply Structure

**reply.root.uri** - Root post URI
**reply.parent.uri** - Parent post URI

## Embeds

### Images
**embed.$type** - Images embed type ("app.bsky.embed.images")
**embed.images** - Array of image objects (1-4 images)
**embed.images[*].alt** - Alt text
**embed.images[*].image** - Image blob object
**embed.images[*].image.mimeType** - Image MIME type ("image/jpeg", "image/png")
**embed.images[*].image.size** - File size in bytes
**embed.images[*].aspectRatio** - Aspect ratio object
**embed.images[*].aspectRatio.width** - Image width
**embed.images[*].aspectRatio.height** - Image height

### Video
**embed.$type** - Video embed type ("app.bsky.embed.video")
**embed.video** - Video blob object
**embed.video.mimeType** - Video MIME type ("video/mp4")
**embed.video.size** - File size in bytes
**embed.alt** - Video alt text
**embed.aspectRatio** - Aspect ratio object
**embed.aspectRatio.width** - Video width
**embed.aspectRatio.height** - Video height
**embed.presentation** - "gif" for GIFs

### External Links
**embed.$type** - External link embed type ("app.bsky.embed.external")
**embed.external.uri** - URL
**embed.external.title** - Title
**embed.external.description** - Description
**embed.external.thumb** - Thumbnail blob (optional)
**embed.external.thumb.mimeType** - Thumbnail MIME type
**embed.external.thumb.size** - Thumbnail size in bytes

### Quoted Posts
**embed.$type** - Quote post embed type ("app.bsky.embed.record")
**embed.record.uri** - Quoted post URI
**embed.record.cid** - Quoted post CID

### Quote Post with Media
**embed.$type** - Quote post with media type ("app.bsky.embed.recordWithMedia")
**embed.media** - Media embed object
**embed.media.$type** - Media type (images, video, external)
**embed.media.images[*].alt** - Image alt text in quote with media
**embed.media.external.uri** - Link URL in quote with media
**embed.media.external.title** - Link title in quote with media
**embed.media.external.description** - Link description in quote with media
**embed.record** - Quote post record object
**embed.record.record.uri** - Quoted post URI
**embed.record.record.cid** - Quoted post CID

## Hydrated Metadata [GRAZE SPECIFIC-- IGNORE!!!!!!!!!! ALL HYDRATED STUFF]

### User
**hydrated_metadata.user.did** - User DID
**hydrated_metadata.user.handle** - Handle
**hydrated_metadata.user.display_name** - Display name
**hydrated_metadata.user.description** - Bio
**hydrated_metadata.user.avatar** - Avatar URL
**hydrated_metadata.user.banner** - Banner URL
**hydrated_metadata.user.created_at** - Account creation timestamp
**hydrated_metadata.user.indexed_at** - Last indexed timestamp
**hydrated_metadata.user.followers_count** - Number of followers
**hydrated_metadata.user.follows_count** - Number of accounts followed
**hydrated_metadata.user.posts_count** - Number of posts
**hydrated_metadata.user.labels[*].val** - Label values (see Label Types below)
**hydrated_metadata.user.labels[*].src** - Label source DID (user's own DID = self-label, external DID = labeler)
**hydrated_metadata.user.labels[*].uri** - What was labeled (profile/self = account label, post URI = post label)
**hydrated_metadata.user.labels[*].cts** - Label creation timestamp
**hydrated_metadata.user.labels[*].cid** - Label CID
**hydrated_metadata.user.pinned_post.uri** - Pinned post URI
**hydrated_metadata.user.pinned_post.cid** - Pinned post CID
**hydrated_metadata.user.joined_via_starter_pack** - Starter pack used to join (if any)

#### Label Types and Limitations

**Self-Labels** (src = user's own DID):
- Applied by users to their own accounts or posts
- Common values: porn, sexual, nudity, graphic-media
- Privacy: `!no-unauthenticated` (requires login to view profile)
- Federation: `bridged-from-bridgy-fed-activitypub`, `bridged-from-bridgy-fed-web` (accounts bridged from other platforms)
- URI format: `at://did:plc:xxx/app.bsky.actor.profile/self` (account-level)

**External Labeler Labels** (src = labeler DID like `did:plc:ar7c4by46qjdydhdevvrndac`):
- Applied by third-party moderation services
- Common values: porn, sexual, nudity, spam, impersonation, rude, sexual-figurative
- URI formats:
  - `at://did:plc:xxx/app.bsky.actor.profile/self` - Account-level label
  - `at://did:plc:xxx/app.bsky.feed.post/xxx` - Post-level label
  - `did:plc:xxx` - Account-level label (short form)

**CRITICAL LIMITATION**: Post-level labels from external labelers only appear in `hydrated_metadata` when that post is referenced as a parent_post, quote_post, or reply_post. When viewing the labeled post itself as the main post, the labels array will NOT include those post-level labels. This makes external labeler post-level filtering effectively impossible in Graze. Account-level labels (profile/self) work reliably for blocking entire accounts.

### Mentions
**hydrated_metadata.mentions[*].handle** - Mentioned handles
**hydrated_metadata.mentions[*].display_name** - Display names
**hydrated_metadata.mentions[*].description** - Mentioned user bios

### Quote Post
**hydrated_metadata.quote_post.author.handle** - Author handle
**hydrated_metadata.quote_post.author.display_name** - Author display name
**hydrated_metadata.quote_post.record.text** - Text

### Parent Post
**hydrated_metadata.parent_post.author.handle** - Author handle
**hydrated_metadata.parent_post.author.display_name** - Author display name
**hydrated_metadata.parent_post.record.text** - Text

### Reply Post (Thread Root)
**hydrated_metadata.reply_post.author.handle** - Reply author handle
**hydrated_metadata.reply_post.record.text** - Reply text

## Verification

**hydrated_metadata.user.verification.trusted_verifier_status** - Trusted verifier status ("none" or "valid")
**hydrated_metadata.user.verification.verified_status** - Overall verification status ("valid")
**hydrated_metadata.user.verification.verifications[*].issuer** - Verifier DID (e.g., did:plc:z72i7hdynmk6r22z27h6tvur)
**hydrated_metadata.user.verification.verifications[*].is_valid** - Boolean verification validity
**hydrated_metadata.user.verification.verifications[*].created_at** - Verification timestamp
**hydrated_metadata.user.verification.verifications[*].uri** - Verification record URI

## Engagement Metrics (Parent/Quote/Reply Posts Only)

**IMPORTANT**: These fields only appear in `hydrated_metadata.parent_post`, `hydrated_metadata.quote_post`, and `hydrated_metadata.reply_post` objects. They do NOT exist at the root level for the current post being viewed.

**hydrated_metadata.parent_post.like_count** - Number of likes on parent post
**hydrated_metadata.parent_post.reply_count** - Number of replies on parent post
**hydrated_metadata.parent_post.quote_count** - Number of quote posts on parent post
**hydrated_metadata.parent_post.repost_count** - Number of reposts on parent post
**hydrated_metadata.parent_post.bookmarkCount** - Number of bookmarks on parent post

**hydrated_metadata.quote_post.like_count** - Number of likes on quoted post
**hydrated_metadata.quote_post.reply_count** - Number of replies on quoted post
**hydrated_metadata.quote_post.quote_count** - Number of quote posts on quoted post
**hydrated_metadata.quote_post.repost_count** - Number of reposts on quoted post
**hydrated_metadata.quote_post.bookmarkCount** - Number of bookmarks on quoted post

**hydrated_metadata.reply_post.like_count** - Number of likes on reply post
**hydrated_metadata.reply_post.reply_count** - Number of replies on reply post
**hydrated_metadata.reply_post.quote_count** - Number of quote posts on reply post
**hydrated_metadata.reply_post.repost_count** - Number of reposts on reply post
**hydrated_metadata.reply_post.bookmarkCount** - Number of bookmarks on reply post

## Viewer State (Current User's Relationship)

### Account-Level Viewer State
**hydrated_metadata.user.viewer.blocked_by** - Boolean: current user is blocked by this account
**hydrated_metadata.user.viewer.blocking** - URI if current user is blocking this account
**hydrated_metadata.user.viewer.blocking_by_list** - URI of list used to block this account
**hydrated_metadata.user.viewer.followed_by** - URI if this account follows current user
**hydrated_metadata.user.viewer.following** - URI if current user follows this account
**hydrated_metadata.user.viewer.muted** - Boolean: current user has muted this account
**hydrated_metadata.user.viewer.muted_by_list** - URI of list used to mute this account
**hydrated_metadata.user.viewer.known_followers.count** - Number of mutual followers
**hydrated_metadata.user.viewer.known_followers.followers[*].did** - DIDs of mutual followers
**hydrated_metadata.user.viewer.known_followers.followers[*].handle** - Handles of mutual followers
**hydrated_metadata.user.viewer.known_followers.followers[*].display_name** - Display names of mutual followers

### Post-Level Viewer State (Parent/Quote/Reply Posts Only)
**hydrated_metadata.parent_post.viewer.bookmarked** - Boolean: current user bookmarked this post
**hydrated_metadata.parent_post.viewer.like** - URI if current user liked this post
**hydrated_metadata.parent_post.viewer.repost** - URI if current user reposted this post
**hydrated_metadata.parent_post.viewer.pinned** - Boolean: post is pinned by author
**hydrated_metadata.parent_post.viewer.reply_disabled** - Boolean: replies are disabled
**hydrated_metadata.parent_post.viewer.embedding_disabled** - Boolean: embedding is disabled
**hydrated_metadata.parent_post.viewer.thread_muted** - Boolean: thread is muted by current user

## Thread Controls

**hydrated_metadata.parent_post.threadgate.record.allow[*].py_type** - Thread reply restrictions
- "app.bsky.feed.threadgate#followerRule" - Only followers can reply
- "app.bsky.feed.threadgate#followingRule" - Only accounts author follows can reply
- "app.bsky.feed.threadgate#mentionRule" - Only mentioned accounts can reply
- "app.bsky.feed.threadgate#listRule" - Only accounts in specified list can reply
**hydrated_metadata.parent_post.threadgate.lists[*].uri** - List URIs for list-based reply restrictions
**hydrated_metadata.parent_post.threadgate.record.hidden_replies** - Array of hidden reply URIs

## Account Settings

**hydrated_metadata.user.associated.chat.allow_incoming** - Chat settings ("all", "following", "none")
**hydrated_metadata.user.associated.feedgens** - Number of custom feeds created
**hydrated_metadata.user.associated.labeler** - Boolean: account is a labeler service
**hydrated_metadata.user.associated.lists** - Number of lists created
**hydrated_metadata.user.associated.starter_packs** - Number of starter packs created
**hydrated_metadata.user.associated.activitySubscription.allowSubscriptions** - Activity subscription settings ("followers", "mutuals", "none")
**hydrated_metadata.user.associated.germ.showButtonTo** - Germ button visibility ("usersIFollow")
**hydrated_metadata.user.associated.germ.messageMeUrl** - Germ message URL

## Inferences

**inferences.video.audio_transcription.text** - Video transcription
**inferences.video.audio_transcription.language** - Language
