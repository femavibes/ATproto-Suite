/**
 * Flags condition/scoring nodes where a higher-cost filter is evaluated before a
 * lower-cost one along the real evaluation path (flow spine + junction logic order).
 */

import { pickFlowEntryNode } from './graphEvaluator.js'
import { getConditionCostRank } from '../constants/evaluationCost.js'

/**
 * Same as graphEvaluator.traceFlowPath but accepts sparse exports (e.g. type "flow" without handles).
 * Used only for cost-order warnings, not for evaluation.
 */
function traceFlowPathLoose(startId, endId, nodes, edges) {
  const path = []
  const visited = new Set()

  function walk(nodeId) {
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    path.push(nodeId)
    if (nodeId === endId) return true

    const flowOut = edges.filter((e) => {
      if (e.source !== nodeId) return false
      if (e.sourceHandle === 'output-right' && e.targetHandle === 'input-left') return true
      if (e.type === 'flow') return true
      if (!e.sourceHandle && !e.targetHandle && e.target) return true
      return false
    })

    for (const e of flowOut) {
      if (walk(e.target)) return true
    }
    path.pop()
    return false
  }

  walk(startId)
  return path
}

const JUNCTION_TYPES = new Set(['junction', 'logicgroup', 'and', 'or', 'nof', 'logicbox'])
const CONTAINER_TYPES_FOR_SORT = new Set(['junction', 'logicgroup', 'and', 'or', 'nof', 'logicbox'])
const CONDITION_TYPES = new Set([
  'text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage',
  'author', 'media', 'engagement', 'poststructure', 'mentions', 'links',
  'image', 'video', 'quotepost',
])

function isCostTrackedType(type) {
  if (!type) return false
  const scoring = ['recency', 'engagementscore', 'customscore']
  const conditions = [
    'text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage',
    'author', 'media', 'engagement', 'poststructure', 'mentions', 'links',
    'image', 'video',
  ]
  return conditions.includes(type) || scoring.includes(type)
}

function edgeCostSortKey(allNodes, edge) {
  const sid = String(edge.source || '')
  const node = allNodes.find((n) => n.id === sid)
  if (!node) return [1, sid]
  const t = node.type
  if (CONTAINER_TYPES_FOR_SORT.has(t)) return [1, sid]
  return [getConditionCostRank(t), sid]
}

function sortPortEdgesByCost(portEdges, allNodes) {
  return [...portEdges].sort((a, b) => {
    const ra = edgeCostSortKey(allNodes, a)
    const rb = edgeCostSortKey(allNodes, b)
    if (ra[0] !== rb[0]) return ra[0] - rb[0]
    return String(ra[1]).localeCompare(String(rb[1]))
  })
}

/** Return true for any edge that represents a logic connection (accepts both export and DB formats). */
function isLogicEdge(e) {
  if (String(e.type || '').toLowerCase() === 'logic') return true
  if (e.logicType != null) return true
  if (typeof e.sourceHandle === 'string' && e.sourceHandle.startsWith('logic-')) return true
  return false
}

/** Logic edges feeding a junction (matches engine intent; tolerates sparse exports). */
function logicEdgesToJunction(junctionId, edges) {
  return edges.filter((e) => e.target === junctionId && isLogicEdge(e))
}

function inferPortFromEdge(edge) {
  const th = edge.targetHandle || ''
  if (th.includes('logic-top')) return 'top'
  if (th.includes('logic-bottom')) return 'bottom'
  if (th.includes('logic-left')) return 'left'
  if (th.includes('logic-right')) return 'right'
  return null
}

/**
 * Condition / scoring ids in engine evaluation order for one junction (ports top→bottom→left→right,
 * within each port sorted by ascending cost).
 */
function collectConditionsFromJunction(junctionNode, allNodes, edges, visitedJunctions) {
  const out = []
  const jid = junctionNode.id
  if (visitedJunctions.has(jid)) return out
  visitedJunctions.add(jid)

  const le = logicEdgesToJunction(jid, edges)
  const byPort = { top: [], bottom: [], left: [], right: [], unknown: [] }
  for (const e of le) {
    const p = inferPortFromEdge(e)
    if (p) byPort[p].push(e)
    else byPort.unknown.push(e)
  }

  const ports = ['top', 'bottom', 'left', 'right']
  const orderedEdgeGroups = [
    ...ports.map((p) => sortPortEdgesByCost(byPort[p], allNodes)),
    sortPortEdgesByCost(byPort.unknown, allNodes),
  ]

  for (const group of orderedEdgeGroups) {
    for (const edge of group) {
      const child = allNodes.find((n) => n.id === edge.source)
      if (!child) continue
      if (isCostTrackedType(child.type)) {
        out.push({ id: child.id, rank: getConditionCostRank(child.type) })
      } else if (JUNCTION_TYPES.has(child.type)) {
        out.push(...collectConditionsFromJunction(child, allNodes, edges, visitedJunctions))
      }
    }
  }
  return out
}

/**
 * Flat evaluation order of condition/scoring nodes from START to END (spine + junction expansions).
 */
function flattenEvaluationOrder(nodes, edges, entryId, endId) {
  const path = traceFlowPathLoose(entryId, endId, nodes, edges)
  const seq = []
  const visitedJunctions = new Set()
  for (const nodeId of path) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue
    if (
      node.type === 'start' ||
      node.type === 'containerin' ||
      node.type === 'manualposts' ||
      node.type === 'end' ||
      node.type === 'containerout'
    )
      continue
    if (JUNCTION_TYPES.has(node.type)) {
      seq.push(...collectConditionsFromJunction(node, nodes, edges, visitedJunctions))
    } else if (isCostTrackedType(node.type)) {
      seq.push({ id: node.id, rank: getConditionCostRank(node.type) })
    }
  }
  return seq
}

/**
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {{ violatingNodeIds: Set<string>, pairs: Array<{ earlierId: string, laterId: string, earlierRank: number, laterRank: number }> }}
 */
export function analyzeCostOrderViolations(nodes, edges) {
  const violatingNodeIds = new Set()
  const pairs = []
  const entryNode = pickFlowEntryNode(nodes, null)
  if (!entryNode) {
    return { violatingNodeIds, pairs }
  }
  const endNodes = nodes.filter((n) => n.type === 'end' || n.type === 'containerout')
  for (const endNode of endNodes) {
    const path = traceFlowPathLoose(entryNode.id, endNode.id, nodes, edges)
    if (path.length === 0) continue

    const seq = flattenEvaluationOrder(nodes, edges, entryNode.id, endNode.id)
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        if (seq[i].rank > seq[j].rank) {
          violatingNodeIds.add(seq[i].id)
          violatingNodeIds.add(seq[j].id)
          pairs.push({
            earlierId: seq[i].id,
            laterId: seq[j].id,
            earlierRank: seq[i].rank,
            laterRank: seq[j].rank,
          })
        }
      }
    }
  }
  return { violatingNodeIds, pairs }
}

/**
 * Compute ingestion-oriented execution order for the current graph shape.
 * Order is structural (entry -> flow spine -> junction-expansion with cost sorting),
 * not runtime pass/fail dependent.
 *
 * @param {Array} nodes
 * @param {Array} edges
 * @returns {Map<string, number>} nodeId -> 1-based execution order
 */
export function computeIngestionRunOrderMap(nodes, edges) {
  const out = new Map()
  const entryNode = pickFlowEntryNode(nodes, null)
  if (!entryNode) return out

  const push = (nodeId) => {
    if (!nodeId || out.has(nodeId)) return
    out.set(nodeId, out.size + 1)
  }

  const terminals = nodes
    .filter((n) => n.type === 'end' || n.type === 'containerout')
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  for (const endNode of terminals) {
    const path = traceFlowPathLoose(entryNode.id, endNode.id, nodes, edges)
    if (path.length === 0) continue
    const visitedJunctions = new Set()
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const isConditionType = (t) => CONDITION_TYPES.has(String(t || ''))

    const appendIncomingConditionOrder = (conditionNode) => {
      if (!conditionNode?.id) return
      const incoming = edges
        .filter(
          (e) =>
            e.target === conditionNode.id &&
            isLogicEdge(e) &&
            isConditionType(nodeById.get(e.source)?.type)
        )
        .map((e) => nodeById.get(e.source))
        .filter(Boolean)
        .sort((a, b) => {
          const ra = getConditionCostRank(a.type)
          const rb = getConditionCostRank(b.type)
          if (ra !== rb) return ra - rb
          return String(a.id).localeCompare(String(b.id))
        })

      for (const src of incoming) push(src.id)
    }

    const appendJunctionEvalOrder = (junctionNode) => {
      const jid = junctionNode.id
      if (visitedJunctions.has(jid)) return
      visitedJunctions.add(jid)

      const byPort = { top: [], bottom: [], left: [], right: [], unknown: [] }
      for (const e of logicEdgesToJunction(jid, edges)) {
        const p = inferPortFromEdge(e)
        if (p) byPort[p].push(e)
        else byPort.unknown.push(e)
      }

      const orderedGroups = [
        sortPortEdgesByCost(byPort.top, nodes),
        sortPortEdgesByCost(byPort.bottom, nodes),
        sortPortEdgesByCost(byPort.left, nodes),
        sortPortEdgesByCost(byPort.right, nodes),
        sortPortEdgesByCost(byPort.unknown, nodes),
      ]

      for (const group of orderedGroups) {
        for (const edge of group) {
          const child = nodeById.get(edge.source)
          if (!child) continue
          push(child.id)
          if (JUNCTION_TYPES.has(child.type)) {
            appendJunctionEvalOrder(child)
          } else if (isConditionType(child.type)) {
            // Mirrors evaluateConditionWithIncomingEdges: intrinsic first, then incoming sources.
            appendIncomingConditionOrder(child)
          }
        }
      }
    }

    for (const nodeId of path) {
      const node = nodeById.get(nodeId)
      if (!node) continue
      push(node.id)

      if (JUNCTION_TYPES.has(node.type)) {
        appendJunctionEvalOrder(node)
      }
    }
  }

  return out
}
