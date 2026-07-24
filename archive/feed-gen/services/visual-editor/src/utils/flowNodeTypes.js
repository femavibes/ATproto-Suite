/**
 * Flow boundary helpers: root START/END vs container subgraph IN/OUT.
 * Keep in sync with services/feed-assignment-worker/engine.py.
 */

export function isFlowTerminalType(type) {
  return type === 'end' || type === 'containerout'
}

/** Bluesky feed output: canvas-level END only (never container OUT). */
export function isRootFeedEndNode(n) {
  return n?.type === 'end' && !n?.data?.containerParent
}

/** Nodes that can be chosen as the flow entry for the current node set (root or subgraph). */
export function isFlowEntryCandidate(n) {
  if (!n) return false
  const t = n.type
  if (t === 'manualposts') return true
  if (t === 'containerin') return true
  if (t === 'start') return true
  return false
}
