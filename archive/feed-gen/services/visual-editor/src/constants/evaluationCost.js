/**
 * Relative evaluation cost for condition/scoring nodes (lower = run earlier in strict mode).
 * Used for junction child ordering, spine short-circuit hints, and UI cost-order warnings.
 *
 * Tiers:
 *   0 = always-pass / ingest-irrelevant  (customscore, recency, engagementscore)
 *   1 = low    — trivial field lookups    (language, posttype, dateage, image, video, media)
 *   2 = medium — array / facet iteration  (text, hashtag, mentions, links, labels, author, engagement)
 *   3 = high   — regex engine             (regex)
 */

/** @type {Record<string, number>} */
export const CONDITION_EVAL_COST_RANK = {
  // Tier 0 — always pass; no filtering value at ingest or cheap scoring-only nodes
  customscore:      0,
  recency:          0,
  engagementscore:  0,
  videofeed:        0,

  // Tier 1 — simple field / boolean lookups
  language:         1,
  posttype:         1,
  poststructure:    1,
  dateage:          1,
  image:            1,
  video:            1,
  media:            1,
  quotepost:        1,

  // Tier 2 — array scans / facet iteration
  text:             2,
  hashtag:          2,
  mentions:         2,
  links:            2,
  labels:           2,
  author:           2,
  engagement:       2,

  // Tier 3 — regex engine (most expensive)
  regex:            3,
}

const DEFAULT_RANK = 2

/**
 * @param {string} nodeType
 * @returns {number}
 */
export function getConditionCostRank(nodeType) {
  if (!nodeType || typeof nodeType !== 'string') return DEFAULT_RANK
  return CONDITION_EVAL_COST_RANK[nodeType] ?? DEFAULT_RANK
}

/**
 * @param {string} nodeType
 * @returns {'always-pass' | 'low' | 'medium' | 'high'}
 */
export function getConditionCostTier(nodeType) {
  const r = getConditionCostRank(nodeType)
  if (r >= 3) return 'high'
  if (r >= 2) return 'medium'
  if (r >= 1) return 'low'
  return 'always-pass'
}
