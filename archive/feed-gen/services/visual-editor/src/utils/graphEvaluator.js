/**
 * Graph Evaluator v2
 * Evaluates the feed graph against a test post using the wire/port/junction system.
 * 
 * Flow:
 * 1. Trace flow edges from START to END
 * 2. At each junction/group, collect logic-wired nodes grouped by port
 * 3. Evaluate each condition node
 * 4. Combine results per port using the port's logicMode (AND/OR/N-OF)
 * 5. Junction passes if ALL ports pass (ports are AND'd together)
 * 6. If any flow node fails, the post is filtered out
 * 
 * Off-path condition fill runs for every filter node missing a result (debug coverage).
 * computeFeedScopedNodeIds is for UI only (split connected vs orphaned in the debug tree).
 *
 * Options (4th argument to evaluateGraph):
 * - fullTrace (default true): evaluate all spine/junction children and fill unevaluated nodes for debug.
 *   Set false to match assignment-worker strict short-circuit behavior.
 */

import { evaluateCondition } from './conditionEvaluator.js'
import { getConditionCostRank } from '../constants/evaluationCost.js'
import { isFlowEntryCandidate, isFlowTerminalType, isRootFeedEndNode } from './flowNodeTypes.js'

/** On-canvas AND/OR/N-of container (single node type, mode in data). */
const LOGIC_BOX_TYPE = 'logicbox'

/** Nodes that inject posts into the flow (not jetstream-only — see pickFlowEntryNode). */
export const FLOW_SOURCE_TYPES = ['start', 'manualposts']

export function isFlowSourceType(type) {
  return FLOW_SOURCE_TYPES.includes(type)
}

/**
 * Root-level flow sources (same canvas as breadcrumb “root”): START, Manual Posts, future import nodes.
 * Jetstream ingestion prefilters should only use the `start` entry — see `ingestionPrefilterHints.js`.
 */
export function findRootFlowSourceIds(nodes) {
  return nodes
    .filter((n) => !n.data?.containerParent && isFlowSourceType(n.type))
    .map((n) => n.id)
}

/**
 * Whether a test post is one of the URIs configured on a Manual Posts node (`data.posts`).
 */
export function postMatchesManualPostsNode(node, testPost) {
  const uris = node.data?.posts || []
  if (!uris.length || !testPost) return false
  const candidate =
    testPost.uri || testPost.atUri || testPost.at_uri || testPost.url || testPost.postUri || ''
  if (!candidate) return false
  const c = String(candidate).trim().toLowerCase()
  return uris.some((u) => {
    const uu = String(u).trim().toLowerCase()
    return uu && (uu === c || c.includes(uu) || uu.includes(c))
  })
}

/**
 * Which flow source to use for START→END evaluation.
 * - Jetstream / generic debug post: START when present.
 * - Post URI listed on Manual Posts: that node as entry (same graph can have both START and Manual Posts without mixing ingestion).
 */
export function pickFlowEntryNode(nodes, testPost) {
  const candidates = nodes.filter((n) => isFlowEntryCandidate(n))
  if (candidates.length === 0) return null

  // Prefer root-level sources when any exist (Jetstream / manual at canvas root).
  // Inside a Group subgraph, every node has containerParent → use full candidate list.
  const rootSources = candidates.filter((n) => !n.data?.containerParent)
  const scope = rootSources.length > 0 ? rootSources : candidates

  const manualNodes = scope.filter((n) => n.type === 'manualposts')
  const startLike = scope.filter((n) => n.type === 'start' || n.type === 'containerin')

  for (const m of manualNodes) {
    if (testPost && postMatchesManualPostsNode(m, testPost)) return m
  }
  if (startLike.length > 0) return startLike[0]
  return null
}

/**
 * IDs of nodes that belong to the feed graph from flow source(s): reachable via flow edges,
 * logic-wired into that set, then all container descendants. Used by the debug panel to
 * list "connected" vs "orphaned" subtrees separately.
 *
 * @param {string|string[]} seeds - Single flow source id or all root sources (START + Manual Posts, etc.)
 */
export function computeFeedScopedNodeIds(seeds, nodes, edges) {
  const seedList = typeof seeds === 'string' ? [seeds] : Array.isArray(seeds) ? seeds : []
  const reachable = new Set()
  const queue = []

  for (const id of seedList) {
    if (nodes.some((n) => n.id === id)) {
      reachable.add(id)
      queue.push(id)
    }
  }

  while (queue.length) {
    const id = queue.shift()
    const flowOut = edges.filter(
      (e) =>
        e.source === id &&
        ((e.sourceHandle === 'output-right' && e.targetHandle === 'input-left') ||
          String(e.type || '').toLowerCase() === 'flow' ||
          (!e.sourceHandle && !e.targetHandle && e.target))
    )
    for (const e of flowOut) {
      if (!reachable.has(e.target)) {
        reachable.add(e.target)
        queue.push(e.target)
      }
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const e of edges) {
      if (!e.sourceHandle?.startsWith('logic-')) continue
      if (!reachable.has(e.target)) continue
      if (!reachable.has(e.source)) {
        reachable.add(e.source)
        changed = true
      }
    }
  }

  changed = true
  while (changed) {
    changed = false
    for (const n of nodes) {
      const p = n.data?.containerParent
      if (!p || !reachable.has(p)) continue
      if (!reachable.has(n.id)) {
        reachable.add(n.id)
        changed = true
      }
    }
  }

  return reachable
}

/**
 * Evaluate the entire graph against a test post
 * @param {Array} nodes - All nodes in the current level
 * @param {Array} edges - All edges in the current level
 * @param {Object} testPost - Post data to evaluate
 * @returns {{ passed: boolean, results: Map, score: number, error?: string }}
 */
export function evaluateGraph(nodes, edges, testPost, options = {}) {
  const fullTrace = options.fullTrace !== false
  const results = new Map()
  const rootFeedEnds = nodes.filter((n) => isRootFeedEndNode(n))
  const terminalNodes = nodes.filter((n) => isFlowTerminalType(n.type))
  const entryNode = pickFlowEntryNode(nodes, testPost)

  if (rootFeedEnds.length === 0) {
    if (fullTrace) fillMissingConditionEvaluations(nodes, testPost, results)
    return { passed: false, results, score: 0, error: 'Graph must have a feed output END node' }
  }

  if (!entryNode) {
    if (fullTrace) fillMissingConditionEvaluations(nodes, testPost, results)
    return {
      passed: false,
      results,
      score: 0,
      error:
        'No applicable flow entry (add START for jetstream, or match a Manual Posts URI for manual-only feeds)',
    }
  }

  const reachableEnds = terminalNodes.filter(
    (endNode) => traceFlowPath(entryNode.id, endNode.id, nodes, edges).length > 0
  )
  if (reachableEnds.length === 0) {
    if (fullTrace) fillMissingConditionEvaluations(nodes, testPost, results)
    return { passed: false, results, score: 0, error: 'No flow path from entry to END/OUT' }
  }

  let overallPassed = false
  let totalScore = 0
  const perEnd = []
  const mergedByNode = new Map()

  for (const endNode of reachableEnds) {
    const endEval = evaluateGraphForEnd(nodes, edges, testPost, entryNode, endNode, { fullTrace })
    perEnd.push({
      endId: endNode.id,
      endName:
        endNode.data?.name?.trim() ||
        (endNode.type === 'containerout' ? 'OUT' : 'END'),
      passed: !!endEval.passed,
      score: Number(endEval.score || 0),
      error: endEval.error || null,
      flowPath: endEval.flowPath || [],
    })
    overallPassed = overallPassed || !!endEval.passed
    totalScore = Math.max(totalScore, Number(endEval.score || 0))
    for (const [nodeId, nodeResult] of endEval.results.entries()) {
      const prev = mergedByNode.get(nodeId)
      if (!prev) {
        mergedByNode.set(nodeId, nodeResult)
        continue
      }
      const nextPassed = !!prev.passed || !!nodeResult.passed
      const reasons = [prev.reason, nodeResult.reason].filter(Boolean)
      const reason = Array.from(new Set(reasons)).join(' | ')
      const scoreModifier = Number(prev.scoreModifier || 0) + Number(nodeResult.scoreModifier || 0)
      mergedByNode.set(nodeId, {
        ...prev,
        ...nodeResult,
        passed: nextPassed,
        reason: reason || nodeResult.reason || prev.reason,
        scoreModifier,
      })
    }
  }
  for (const [k, v] of mergedByNode.entries()) {
    results.set(k, v)
  }

  if (fullTrace) {
    fillMissingConditionEvaluations(nodes, testPost, results)
  }

  return { passed: overallPassed, results, score: totalScore, endResults: perEnd }
}

function evaluateGraphForEnd(nodes, edges, testPost, entryNode, endNode, evalOptions = {}) {
  const fullTrace = evalOptions.fullTrace !== false
  const results = new Map()
  const flowPath = traceFlowPath(entryNode.id, endNode.id, nodes, edges)
  if (flowPath.length === 0) {
    return { passed: false, results, score: 0, error: 'No flow path', flowPath: [] }
  }
  let overallPassed = true
  let totalScore = 0

  for (const nodeId of flowPath) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) continue
    if (
      node.type === 'start' ||
      node.type === 'containerin' ||
      node.type === 'manualposts' ||
      node.type === 'end' ||
      node.type === 'containerout' ||
      node.type === 'videofeed'
    ) {
      const reason =
        node.type === 'end' || node.type === 'containerout'
          ? node.type === 'containerout'
            ? 'Group exit'
            : 'Exit point'
          : node.type === 'start' || node.type === 'containerin'
            ? node.type === 'containerin'
              ? 'Group entry'
              : 'Entry point (jetstream)'
            : node.type === 'videofeed'
              ? 'Video Feed — always pass'
              : 'Entry point (manual posts)'
      results.set(nodeId, { passed: true, reason })
      continue
    }
    if (node.type === LOGIC_BOX_TYPE) {
      const boxResult = evaluateLogicBoxNode(node, nodes, edges, testPost, results, { fullTrace })
      results.set(nodeId, boxResult)
      totalScore += boxResult.score || 0
      if (!boxResult.passed) {
        overallPassed = false
        if (!fullTrace) break
      }
      continue
    }
    if (node.type === 'junction' || node.type === 'logicgroup' || node.type === 'and' || node.type === 'or' || node.type === 'nof') {
      const junctionResult = evaluateJunction(node, nodes, edges, testPost, results, { fullTrace })
      results.set(nodeId, junctionResult)
      totalScore += junctionResult.score || 0
      if (!junctionResult.passed) {
        overallPassed = false
        if (!fullTrace) break
      }
      continue
    }
    if (isScoringType(node.type)) {
      const scoreResult = evaluateScoringNode(node, testPost)
      results.set(nodeId, { passed: true, reason: scoreResult.reason, scoreModifier: scoreResult.scoreModifier, type: node.type })
      totalScore += scoreResult.scoreModifier || 0
      continue
    }
    if (isConditionType(node.type)) {
      const condResult = evaluateCondition(node, testPost)
      const passed = typeof condResult === 'boolean' ? condResult : condResult.passed
      const reason = typeof condResult === 'boolean' ? (passed ? 'Passed' : 'Failed') : condResult.reason
      const scoreModifier = condResult.scoreModifier || 0
      results.set(nodeId, { passed, reason, scoreModifier })
      totalScore += passed ? scoreModifier : 0
      if (!passed) {
        overallPassed = false
        if (!fullTrace) break
      }
    }
  }
  return { passed: overallPassed, results, score: totalScore, flowPath }
}

/**
 * Trace flow path from START to END via flow edges (output-right → input-left)
 */
export function traceFlowPath(startId, endId, nodes, edges) {
  const path = []
  const visited = new Set()

  function walk(nodeId) {
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    path.push(nodeId)

    if (nodeId === endId) return true

    // Flow: strict handles or sparse export (type "flow" / missing handles)
    const flowOut = edges.filter(
      (e) =>
        e.source === nodeId &&
        ((e.sourceHandle === 'output-right' && e.targetHandle === 'input-left') ||
          String(e.type || '').toLowerCase() === 'flow' ||
          (!e.sourceHandle && !e.targetHandle && e.target))
    )

    for (const edge of flowOut) {
      if (walk(edge.target)) return true
    }

    path.pop()
    return false
  }

  walk(startId)
  return path
}

/**
 * Evaluate a junction/group node by collecting and evaluating its logic-wired children
 * 
 * Each port (top/bottom/left/right) is evaluated independently:
 * - Collect all nodes wired to that port
 * - Evaluate each node
 * - Combine using the port's logicMode (AND/OR/N-OF)
 * 
 * All ports are AND'd together (junction passes only if all ports pass)
 */
const CONTAINER_TYPES_FOR_SORT = new Set(['junction', 'logicgroup', 'and', 'or', 'nof', 'logicbox'])

function sortPortEdgesByCost(portEdges, allNodes) {
  function edgeCostTuple(node, fallbackId) {
    if (!node) return [1, fallbackId]
    const t = node.type
    if (CONTAINER_TYPES_FOR_SORT.has(t)) return [1, node.id]
    return [getConditionCostRank(t), node.id]
  }
  return [...portEdges].sort((a, b) => {
    const na = allNodes.find(n => n.id === a.source)
    const nb = allNodes.find(n => n.id === b.source)
    const ra = edgeCostTuple(na, a.source)
    const rb = edgeCostTuple(nb, b.source)
    if (ra[0] !== rb[0]) return ra[0] - rb[0]
    return String(ra[1]).localeCompare(String(rb[1]))
  })
}

/**
 * Return true for any edge that represents a logic (condition→junction or condition→condition)
 * connection. The visual editor exports edges with ``type: "logic"`` and ``logic: "or"|"and"``.
 * When saved to the DB via the setup API the fields become ``logicType: "or"|"and"`` with no
 * ``type`` key. Both formats must be accepted.
 */
function isLogicEdge(e) {
  if (String(e.type || '').toLowerCase() === 'logic') return true
  if (e.logicType != null) return true
  if (typeof e.sourceHandle === 'string' && e.sourceHandle.startsWith('logic-')) return true
  return false
}

/** Return the AND/OR mode for a logic edge, accepting both ``logic`` and ``logicType`` keys. */
function edgeLogicMode(e) {
  return String(e.logic || e.logicType || 'and').toLowerCase()
}

function logicEdgesToJunction(junctionId, edges) {
  return edges.filter((e) => e.target === junctionId && isLogicEdge(e))
}

function inferLogicPort(edge) {
  const th = edge.targetHandle || ''
  if (th.includes('logic-top')) return 'top'
  if (th.includes('logic-bottom')) return 'bottom'
  if (th.includes('logic-left')) return 'left'
  if (th.includes('logic-right')) return 'right'
  return null
}

function partitionJunctionLogicEdges(junctionId, edges) {
  const byPort = { top: [], bottom: [], left: [], right: [] }
  for (const e of logicEdgesToJunction(junctionId, edges)) {
    const p = inferLogicPort(e)
    const key = p && byPort[p] ? p : 'top'
    byPort[key].push(e)
  }
  return byPort
}

/**
 * Condition node plus incoming logic from other conditions (e.g. regex OR→text).
 * Mirrors feed-assignment-worker/engine.py evaluate_condition_with_incoming_edges.
 */
function evaluateConditionWithIncomingEdges(childNode, allNodes, allEdges, testPost, results, evalOptions) {
  const fullTrace = evalOptions.fullTrace !== false
  const incoming = allEdges.filter(
    (e) =>
      e.target === childNode.id &&
      isLogicEdge(e) &&
      isConditionType(allNodes.find((n) => n.id === e.source)?.type)
  )
  const intrinsic = evaluateCondition(childNode, testPost)
  const intrinsicPassed = typeof intrinsic === 'boolean' ? intrinsic : intrinsic.passed
  if (!incoming.length) {
    const childResult = {
      passed: intrinsicPassed,
      reason: typeof intrinsic === 'boolean' ? (intrinsicPassed ? 'Passed' : 'Failed') : intrinsic.reason,
      scoreModifier: typeof intrinsic === 'object' ? intrinsic.scoreModifier || 0 : 0,
      type: childNode.type,
      details: typeof intrinsic === 'object' ? intrinsic.details : undefined,
    }
    results.set(childNode.id, childResult)
    return childResult
  }

  const others = incoming
    .map((e) => [e, allNodes.find((n) => n.id === e.source)])
    .filter(([, src]) => src && isConditionType(src.type))
  others.sort((a, b) => {
    const ra = getConditionCostRank(a[1].type)
    const rb = getConditionCostRank(b[1].type)
    if (ra !== rb) return ra - rb
    return String(a[1].id).localeCompare(String(b[1].id))
  })

  // Separate N-of edges (need count-based evaluation) from AND/OR
  const andOrEdges = others.filter(([e]) => edgeLogicMode(e) !== 'nof')
  const nofEdges = others.filter(([e]) => edgeLogicMode(e) === 'nof')

  let combined = intrinsicPassed
  const hasAndIncoming = andOrEdges.some(([e]) => edgeLogicMode(e) === 'and')
  if (!fullTrace && combined && !hasAndIncoming && nofEdges.length === 0) {
    const childResult = {
      passed: true,
      reason: typeof intrinsic === 'object' ? intrinsic.reason : 'Passed',
      scoreModifier: typeof intrinsic === 'object' ? intrinsic.scoreModifier || 0 : 0,
      type: childNode.type,
      details: typeof intrinsic === 'object' ? intrinsic.details : undefined,
    }
    results.set(childNode.id, childResult)
    return childResult
  }

  const reasons = [typeof intrinsic === 'object' ? intrinsic.reason : (intrinsicPassed ? 'Passed' : 'Failed')]

  // AND / OR edges — evaluated sequentially (existing logic)
  for (const [e, src] of andOrEdges) {
    const srcRaw = evaluateCondition(src, testPost)
    const sp = typeof srcRaw === 'boolean' ? srcRaw : srcRaw.passed
    const srcReason = typeof srcRaw === 'boolean' ? (sp ? 'Passed' : 'Failed') : srcRaw.reason
    results.set(src.id, {
      passed: sp,
      reason: srcReason,
      scoreModifier: typeof srcRaw === 'object' ? srcRaw.scoreModifier || 0 : 0,
      type: src.type,
      details: typeof srcRaw === 'object' ? srcRaw.details : undefined,
    })
    const mode = edgeLogicMode(e)
    if (mode === 'or') combined = combined || sp
    else combined = combined && sp
    reasons.push(srcReason)
    if (!fullTrace && mode === 'or' && combined) break
    if (!fullTrace && mode === 'and' && !combined) break
  }

  // N-of edges — group by port; passCount >= N → port passes; OR'd into combined (substitution)
  if (nofEdges.length > 0) {
    const portGroups = {}
    for (const [e, src] of nofEdges) {
      const port = inferLogicPort(e) || 'top'
      if (!portGroups[port]) {
        const nKey = `logicN${port.charAt(0).toUpperCase() + port.slice(1)}`
        portGroups[port] = { sources: [], n: childNode.data?.[nKey] || 2 }
      }
      portGroups[port].sources.push([e, src])
    }
    for (const [port, { sources, n }] of Object.entries(portGroups)) {
      let passCount = 0
      const portReasons = []
      for (const [, src] of sources) {
        const srcRaw = evaluateCondition(src, testPost)
        const sp = typeof srcRaw === 'boolean' ? srcRaw : srcRaw.passed
        const srcReason = typeof srcRaw === 'boolean' ? (sp ? 'Passed' : 'Failed') : srcRaw.reason
        results.set(src.id, {
          passed: sp,
          reason: srcReason,
          scoreModifier: typeof srcRaw === 'object' ? srcRaw.scoreModifier || 0 : 0,
          type: src.type,
          details: typeof srcRaw === 'object' ? srcRaw.details : undefined,
        })
        if (sp) passCount++
        portReasons.push(srcReason)
      }
      const nofPortPassed = passCount >= n
      // N-of acts as substitution (OR semantics): satisfying N-of can rescue a failing intrinsic
      combined = combined || nofPortPassed
      reasons.push(`N-OF(${port}): ${passCount}/${sources.length} passed (need ${n}) → ${nofPortPassed ? 'PASS' : 'FAIL'}`)
    }
  }

  const childResult = {
    passed: combined,
    reason: reasons.join(' | '),
    scoreModifier: 0,
    type: childNode.type,
    details: typeof intrinsic === 'object' ? intrinsic.details : undefined,
  }
  results.set(childNode.id, childResult)
  return childResult
}

/**
 * On-canvas logic box: direct children (`containerParent` === box id) combined by `logicContainerMode`.
 */
function evaluateLogicBoxNode(boxNode, allNodes, allEdges, testPost, results, evalOptions = {}) {
  const fullTrace = evalOptions.fullTrace !== false
  const bid = boxNode.id
  const mode = String(boxNode.data?.logicContainerMode || 'and').toLowerCase()
  const needN = Math.max(1, Number(boxNode.data?.logicN) || 2)

  const direct = allNodes.filter((n) => n.data?.containerParent === bid)
  const sortKey = (node) => {
    const t = node.type
    if (t === LOGIC_BOX_TYPE || t === 'junction') return [1, node.id]
    if (isScoringType(t)) return [2, node.id]
    return [getConditionCostRank(t), node.id]
  }
  direct.sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    return String(ka[1]).localeCompare(String(kb[1]))
  })

  const childResults = []
  let totalScore = 0

  for (const child of direct) {
    let childResult
    if (child.type === LOGIC_BOX_TYPE) {
      childResult = evaluateLogicBoxNode(child, allNodes, allEdges, testPost, results, evalOptions)
      results.set(child.id, {
        passed: childResult.passed,
        reason: childResult.reason,
        score: childResult.score,
      })
    } else if (isConditionType(child.type)) {
      childResult = evaluateConditionWithIncomingEdges(
        child,
        allNodes,
        allEdges,
        testPost,
        results,
        { fullTrace }
      )
    } else if (isScoringType(child.type)) {
      const scoreResult = evaluateScoringNode(child, testPost)
      childResult = {
        passed: true,
        reason: scoreResult.reason,
        scoreModifier: scoreResult.scoreModifier,
        type: child.type,
      }
      results.set(child.id, childResult)
    } else {
      continue
    }

    childResults.push({ id: child.id, passed: !!childResult.passed, result: childResult })
    if (childResult.passed) {
      totalScore += childResult.scoreModifier || childResult.score || 0
    }

    if (!fullTrace) {
      if (mode === 'and' && !childResult.passed) break
      if (mode === 'or' && childResult.passed) break
      if (mode === 'nof') {
        const pc = childResults.filter((r) => r.passed).length
        if (pc >= needN) break
      }
    }
  }

  const passCount = childResults.filter((r) => r.passed).length
  let passed = true
  let reason = ''
  if (childResults.length === 0) {
    passed = true
    reason = 'Logic box: no child filters (vacuous pass)'
  } else if (mode === 'and') {
    passed = childResults.every((r) => r.passed)
    reason = `AND: ${passCount}/${childResults.length} passed`
  } else if (mode === 'or') {
    passed = childResults.some((r) => r.passed)
    reason = `OR: ${passCount}/${childResults.length} passed`
  } else {
    passed = passCount >= needN
    reason = `N-OF: ${passCount}/${childResults.length} passed (need ${needN})`
  }

  return { passed, reason, score: totalScore, childResults }
}

function evaluateJunction(junctionNode, allNodes, allEdges, testPost, results, evalOptions = {}) {
  const fullTrace = evalOptions.fullTrace !== false
  const junctionId = junctionNode.id
  const ports = ['top', 'bottom', 'left', 'right']
  const portResults = []
  const conditionResults = []
  let totalScore = 0

  const byPort = partitionJunctionLogicEdges(junctionId, allEdges)

  for (const port of ports) {
    const portEdges = byPort[port] || []
    if (portEdges.length === 0) continue

    // Get the port's logic mode from the junction node data
    const modeKey = `logicMode${port.charAt(0).toUpperCase() + port.slice(1)}`
    const nKey = `logicN${port.charAt(0).toUpperCase() + port.slice(1)}`
    const logicMode = String(junctionNode.data?.[modeKey] || 'and').toLowerCase()
    const logicN = junctionNode.data?.[nKey] || 2

    const orderedEdges = sortPortEdgesByCost(portEdges, allNodes)

    // Evaluate each connected node (cheap-first order; short-circuit when not fullTrace)
    const childResults = []
    for (const edge of orderedEdges) {
      const childNode = allNodes.find(n => n.id === edge.source)
      if (!childNode) continue

      let childResult
      if (childNode.type === LOGIC_BOX_TYPE) {
        childResult = evaluateLogicBoxNode(
          childNode,
          allNodes,
          allEdges,
          testPost,
          results,
          { fullTrace }
        )
        results.set(childNode.id, {
          passed: childResult.passed,
          reason: childResult.reason,
          score: childResult.score,
        })
      } else if (childNode.type === 'logicgroup' || childNode.type === 'and' || childNode.type === 'or' || childNode.type === 'nof') {
        // Nested group — evaluate its internal graph
        const descendantIds = new Set()
        const queue = [childNode.id]
        while (queue.length > 0) {
          const parentId = queue.shift()
          const directChildren = allNodes.filter(n => n.data?.containerParent === parentId)
          for (const gc of directChildren) {
            if (descendantIds.has(gc.id)) continue
            descendantIds.add(gc.id)
            queue.push(gc.id)
          }
        }

        const groupNodes = allNodes.filter(n => descendantIds.has(n.id))
        const groupEdges = allEdges.filter(e => descendantIds.has(e.source) && descendantIds.has(e.target))
        let groupResult = evaluateGraph(groupNodes, groupEdges, testPost, { fullTrace })

        // Fallback for legacy/incomplete groups without IN→…→OUT flow:
        // evaluate direct condition children so debug can show pass/fail per node.
        if (groupResult.results.size === 0 && groupNodes.some(n => isConditionType(n.type))) {
          const fallbackResults = new Map()
          let fallbackPassed = true
          let fallbackScore = 0
          for (const gc of groupNodes) {
            if (!isConditionType(gc.type)) continue
            const condResult = evaluateCondition(gc, testPost)
            const passed = typeof condResult === 'boolean' ? condResult : condResult.passed
            const reason = typeof condResult === 'boolean' ? (passed ? 'Passed' : 'Failed') : condResult.reason
            const scoreModifier = condResult.scoreModifier || 0
            fallbackResults.set(gc.id, { passed, reason, scoreModifier, type: gc.type, details: condResult.details })
            if (!passed) fallbackPassed = false
            if (passed) fallbackScore += scoreModifier
          }
          groupResult = { passed: fallbackPassed, results: fallbackResults, score: fallbackScore }
        }

        childResult = {
          passed: groupResult.passed,
          reason: groupResult.passed ? 'Group passed' : 'Group failed',
          score: groupResult.score,
        }
        results.set(childNode.id, childResult)
        // Merge child results into main results
        for (const [k, v] of groupResult.results) {
          results.set(k, v)
        }
      } else if (isScoringType(childNode.type)) {
        const scoreResult = evaluateScoringNode(childNode, testPost)
        childResult = { passed: true, reason: scoreResult.reason, scoreModifier: scoreResult.scoreModifier, type: childNode.type }
        results.set(childNode.id, childResult)
      } else if (isConditionType(childNode.type)) {
        childResult = evaluateConditionWithIncomingEdges(
          childNode,
          allNodes,
          allEdges,
          testPost,
          results,
          { fullTrace }
        )
      } else if (childNode.type === 'junction') {
        // Nested junction — evaluate recursively
        childResult = evaluateJunction(childNode, allNodes, allEdges, testPost, results, { fullTrace })
        results.set(childNode.id, childResult)
      } else {
        continue
      }

      childResults.push(childResult)
      conditionResults.push({
        nodeId: childNode.id,
        type: childNode.type,
        passed: !!childResult.passed,
        reason: childResult.reason,
        port,
      })
      if (childResult.passed) {
        totalScore += childResult.scoreModifier || childResult.score || 0
      }

      if (!fullTrace) {
        if (logicMode === 'and' && !childResult.passed) break
        if (logicMode === 'or' && childResult.passed) break
        if (logicMode === 'nof') {
          const pc = childResults.filter(r => r.passed).length
          if (pc >= logicN) break
        }
      }
    }

    // Combine child results using port's logic mode
    let portPassed = true
    let portReason = ''

    if (childResults.length === 0) {
      portPassed = true
      portReason = `${port}: no conditions`
    } else if (logicMode === 'and') {
      portPassed = childResults.every(r => r.passed)
      const passCount = childResults.filter(r => r.passed).length
      portReason = `${port} AND: ${passCount}/${childResults.length} passed`
    } else if (logicMode === 'or') {
      portPassed = childResults.some(r => r.passed)
      const passCount = childResults.filter(r => r.passed).length
      portReason = `${port} OR: ${passCount}/${childResults.length} passed`
    } else if (logicMode === 'nof') {
      const passCount = childResults.filter(r => r.passed).length
      portPassed = passCount >= logicN
      portReason = `${port} N-OF: ${passCount}/${childResults.length} passed (need ${logicN})`
    }

    portResults.push({ port, passed: portPassed, reason: portReason })

    if (!fullTrace && !portPassed) break
  }

  // All ports AND'd together
  const allPortsPassed = portResults.length === 0 || portResults.every(r => r.passed)
  const combinedReason = portResults.map(r => r.reason).join(' | ') || 'No logic connections'

  return {
    passed: allPortsPassed,
    reason: combinedReason,
    score: totalScore,
    portResults,
    conditionResults,
  }
}

/**
 * Check if a node type is a condition (filter) node
 */
export function isConditionType(type) {
  return ['text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage',
    'author', 'media', 'engagement', 'poststructure', 'mentions', 'links',
    'image', 'video'].includes(type)
}

function isScoringType(type) {
  return ['recency', 'engagementscore', 'customscore'].includes(type)
}

function engagementValue(post, key) {
  return Number(
    post?.[key] ??
    post?.[key.replace('_count', 's')] ??
    post?.engagement?.[key] ??
    0
  )
}

function evaluateScoringNode(node, post) {
  const data = node?.data || {}
  if (node.type === 'customscore') {
    const scoreModifier = Number(data.score || 0)
    return { passed: true, reason: `Custom score applied: ${scoreModifier}`, scoreModifier }
  }
  if (node.type === 'engagementscore') {
    const likeWeight = Number(data.likeWeight ?? 1)
    const replyWeight = Number(data.replyWeight ?? 2)
    const repostWeight = Number(data.repostWeight ?? 3)
    const quoteWeight = Number(data.quoteWeight ?? 4)
    const bookmarkWeight = Number(data.bookmarkWeight ?? 1)
    const likes = engagementValue(post, 'like_count')
    const replies = engagementValue(post, 'reply_count')
    const reposts = engagementValue(post, 'repost_count')
    const quotes = engagementValue(post, 'quote_count')
    const bookmarks = engagementValue(post, 'bookmark_count')
    const scoreModifier =
      likes * likeWeight +
      replies * replyWeight +
      reposts * repostWeight +
      quotes * quoteWeight +
      bookmarks * bookmarkWeight
    return { passed: true, reason: `Engagement score applied: ${scoreModifier}`, scoreModifier }
  }
  if (node.type === 'recency') {
    const createdAt = post?.createdAt || post?.created_at
    if (!createdAt) return { passed: true, reason: 'Recency skipped (missing createdAt)', scoreModifier: 0 }
    const dt = new Date(createdAt)
    if (Number.isNaN(dt.getTime())) return { passed: true, reason: 'Recency skipped (invalid createdAt)', scoreModifier: 0 }
    const decayHours = Math.max(Number(data.decayHours ?? 24), 0.1)
    const maxBoost = Number(data.maxBoost ?? 100)
    const ageHours = Math.max((Date.now() - dt.getTime()) / 3600000, 0)
    const scoreModifier = maxBoost * Math.pow(0.5, ageHours / decayHours)
    return { passed: true, reason: `Recency score applied: ${scoreModifier.toFixed(2)}`, scoreModifier }
  }
  return { passed: true, reason: 'Scoring node', scoreModifier: 0 }
}

/**
 * Run evaluateCondition for filter nodes not reached by flow/logic wiring so the debug
 * panel can show PASS/FAIL for every listed condition. Does not affect `passed` or
 * `totalScore` above — those still reflect only the active START→END path and ports.
 */
function fillMissingConditionEvaluations(nodes, testPost, results) {
  for (const node of nodes) {
    if (!isConditionType(node.type) && !isScoringType(node.type)) continue
    if (results.has(node.id)) continue
    const rawResult = isScoringType(node.type)
      ? evaluateScoringNode(node, testPost)
      : evaluateCondition(node, testPost)
    const passed = typeof rawResult === 'boolean' ? rawResult : rawResult.passed
    const reason = typeof rawResult === 'boolean' ? (passed ? 'Passed' : 'Failed') : rawResult.reason
    const scoreModifier = rawResult.scoreModifier || 0
    results.set(node.id, {
      passed,
      reason,
      scoreModifier,
      type: node.type,
      details: rawResult?.details,
      evaluatedOutsideFlowPath: true,
    })
  }
}
