/**
 * Aligns raw evaluateGraph() results with what the debug UI needs:
 * - infer child rows from parent conditionResults
 * - infer container pass/fail when children were evaluated but parent id was missing
 *
 * Container inference only considers nodes reachable from START (see computeFeedScopedNodeIds)
 * so off-path / orphaned debug fill does not roll up into scoped parents.
 *
 * Used by both the debug sidebar and canvas node badges so they stay consistent.
 */

import { computeFeedScopedNodeIds, findRootFlowSourceIds } from './graphEvaluator'

const CONTAINER_TYPES = new Set(['junction', 'logicgroup', 'and', 'or', 'nof', 'logicbox'])

export function buildChildLinksByNode(nodes, edges) {
  const map = new Map()
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  const addLink = (parentId, childNode, relation, logicType = null) => {
    if (!parentId || !childNode) return
    if (!map.has(parentId)) map.set(parentId, [])
    const exists = map.get(parentId).some(link => link.node.id === childNode.id)
    if (!exists) {
      map.get(parentId).push({ node: childNode, relation, logicType })
    }
  }

  for (const node of nodes) {
    const parent = node.data?.containerParent
    if (!parent) continue
    addLink(parent, node, 'container')
  }

  for (const edge of edges) {
    if (!edge?.sourceHandle?.startsWith('logic-')) continue
    const parent = nodeById.get(edge.target)
    const child = nodeById.get(edge.source)
    if (!parent || !child) continue
    addLink(parent.id, child, 'logic', edge?.data?.logicType || 'and')
  }

  return map
}

/**
 * @param {Map} nodeResults - raw results from evaluateGraph()
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {Map} merged copy (does not mutate input)
 */
export function mergeEvaluationResultsMap(nodeResults, nodes, edges) {
  const childLinksByNode = buildChildLinksByNode(nodes, edges)
  const merged = new Map(nodeResults)
  const scopeSeeds = findRootFlowSourceIds(nodes)
  const feedScope = scopeSeeds.length ? computeFeedScopedNodeIds(scopeSeeds, nodes, edges) : new Set()

  for (const [, parentResult] of nodeResults.entries()) {
    if (!parentResult?.conditionResults || parentResult.conditionResults.length === 0) continue

    for (const cond of parentResult.conditionResults) {
      if (!cond?.nodeId || merged.has(cond.nodeId)) continue
      merged.set(cond.nodeId, {
        passed: !!cond.passed,
        type: cond.type,
        reason: cond.reason || 'Evaluated via parent logic node',
        inferredFromParent: true,
      })
    }
  }

  let changed = true
  let guard = 0
  while (changed && guard++ < nodes.length + 2) {
    changed = false
    for (const n of nodes) {
      if (!CONTAINER_TYPES.has(n.type)) continue
      if (merged.has(n.id)) continue
      if (!feedScope.has(n.id)) continue
      const links = childLinksByNode.get(n.id) || []
      const inScopeLinks = links.filter(({ node: child }) => feedScope.has(child.id))
      if (inScopeLinks.length === 0) continue
      const statuses = inScopeLinks.map(({ node: child }) => merged.get(child.id))
      const resolved = statuses.filter(s => s != null && typeof s.passed === 'boolean')
      if (resolved.length === 0) continue
      if (resolved.some(s => !s.passed)) {
        merged.set(n.id, { passed: false, inferredFromChildren: true })
        changed = true
        continue
      }
      if (resolved.length === inScopeLinks.length && resolved.every(s => s.passed)) {
        merged.set(n.id, { passed: true, inferredFromChildren: true })
        changed = true
      }
    }
  }

  return merged
}
