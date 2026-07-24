/**
 * Block Type Definitions
 * 
 * Blocks represent different stages in the feed generation pipeline:
 * 
 * START Block:
 * - Represents the incoming database of posts from Jetstream ingestion
 * - All posts that passed keyword/language filtering are available here
 * - This is the source of truth for posts to evaluate
 * 
 * END Block:
 * - Represents the final feed skeleton (Bluesky Feed API output)
 * - Posts that reach END are added to the feed_posts table
 * - This becomes the final list returned by getFeedSkeleton
 */

export const BLOCK_TYPES = {
  START: 'start',
  END: 'end',
  AND: 'and',
  OR: 'or',
  TEXT: 'text',
  LANGUAGE: 'language',
  POST_TYPE: 'posttype',
  LIKES: 'likes',
  AUTHOR: 'author',
  MEDIA: 'media',
}

export const BLOCK_DESCRIPTIONS = {
  [BLOCK_TYPES.START]: 'Incoming posts from database (Jetstream ingestion)',
  [BLOCK_TYPES.END]: 'Final feed skeleton (posts added to feed)',
  [BLOCK_TYPES.AND]: 'All connected conditions must match',
  [BLOCK_TYPES.OR]: 'Any connected condition can match',
  [BLOCK_TYPES.TEXT]: 'Check if post text contains keywords',
  [BLOCK_TYPES.LANGUAGE]: 'Check post language',
  [BLOCK_TYPES.POST_TYPE]: 'Check if post/reply/quote',
  [BLOCK_TYPES.LIKES]: 'Check like count',
  [BLOCK_TYPES.AUTHOR]: 'Check author DID or list',
  [BLOCK_TYPES.MEDIA]: 'Check if post has images/video',
}
