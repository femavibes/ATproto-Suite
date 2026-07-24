/**
 * Stage-3 pipeline nodes that belong inside the END "pipeline" canvas (sorting tab).
 * Plain sorting types — one active module per END (built-in or future module slot).
 */
export const PLAIN_SORTING_NODE_TYPES = [
  'chronological',
  'byscore',
  'mostlikes',
  'mostengagement',
  'random',
]

export function isPlainSortingNodeType(type) {
  return PLAIN_SORTING_NODE_TYPES.includes(type)
}

/** Access / membership nodes on the END pipeline canvas (who may view the feed). */
export const PLAIN_ACCESS_NODE_TYPES = ['whitelist']

export function isPlainAccessNodeType(type) {
  return PLAIN_ACCESS_NODE_TYPES.includes(type)
}

/** Injection / promos on the END pipeline canvas (post-sort inserts). */
export const PLAIN_INJECTION_NODE_TYPES = ['rotatingposts', 'feedads']

export function isPlainInjectionNodeType(type) {
  return PLAIN_INJECTION_NODE_TYPES.includes(type)
}

/** Fixed slot modules on the END pipeline canvas (pinned / featured). */
export const PLAIN_FIXED_SLOT_NODE_TYPES = ['pinnedposts', 'dynamicpinned', 'featuredpost']

export function isPlainFixedSlotNodeType(type) {
  return PLAIN_FIXED_SLOT_NODE_TYPES.includes(type)
}
