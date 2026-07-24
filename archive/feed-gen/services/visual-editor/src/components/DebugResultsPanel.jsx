import React, { useCallback, useMemo, useState } from 'react'
import { computeFeedScopedNodeIds, findRootFlowSourceIds } from '../utils/graphEvaluator'
import { buildChildLinksByNode, mergeEvaluationResultsMap } from '../utils/mergeEvaluationResultsMap'
import DebugPinsMenu from './DebugPinsMenu'
import './DebugResultsPanel.css'
import './TreePanel.css'

/**
 * Debug Results Panel
 * Shows detailed evaluation results for each node
 * Now displayed as a sidebar so canvas remains visible
 */
const NODE_LABELS = {
  text: 'Text Contains',
  regex: 'Regex Contains',
  language: 'Language',
  posttype: 'Post Type',
  author: 'Author',
  media: 'Media Type',
  hashtag: 'Hashtag/Tags',
  labels: 'Labels',
  dateage: 'Post Date',
  engagement: 'Engagement',
  poststructure: 'Post Structure',
  mentions: 'Mentions',
  links: 'Links/URLs',
  image: 'Image',
  video: 'Video',
  junction: 'Junction',
  logicgroup: 'Group',
  logicbox: 'Logic (AND/OR/N-of)',
  and: 'Group',
  or: 'Group',
  nof: 'Group',
  start: 'START',
  containerin: 'IN',
  end: 'END',
  containerout: 'OUT',
}

const LOGIC_COLORS = {
  and: '#4a9eff',
  or: '#ff9500',
  nof: '#9b59b6',
  logicgroup: '#888',
  logicbox: '#5c7cfa',
}

// Flow chrome only — hide from debug tree; still traverse to real filters.
const HIDDEN_FLOW_TYPES = new Set(['start', 'containerin', 'end', 'containerout', 'junction'])

/** Whether candidateId sits under ancestorId via containerParent chain (nested groups). */
function isStrictContainerDescendant(nodes, candidateId, ancestorId) {
  if (candidateId === ancestorId) return false
  let cur = nodes.find((n) => n.id === candidateId)
  for (let i = 0; i < 64 && cur; i++) {
    const p = cur.data?.containerParent
    if (!p) return false
    if (p === ancestorId) return true
    cur = nodes.find((n) => n.id === p)
  }
  return false
}

/**
 * Junction lists every logic wire source. The same node can be wired to the junction
 * and also live inside a sibling group — it would appear twice. Keep outer siblings only.
 */
function dedupeJunctionLogicChildren(children, nodes) {
  if (children.length <= 1) return children
  return children.filter((child) => {
    for (const other of children) {
      if (other.id === child.id) continue
      if (isStrictContainerDescendant(nodes, child.id, other.id)) return false
    }
    return true
  })
}

/**
 * Only list a node under parent P if it belongs there structurally:
 * no containerParent (logic-only) or containerParent === P.
 * Otherwise the same node is linked from the junction AND nested under a group — duplicates the row.
 */
function filterLinksForStructuralParent(parentId, childLinksByNode) {
  const links = childLinksByNode.get(parentId) || []
  return links.filter(({ node: child }) => {
    const cp = child.data?.containerParent
    if (cp == null || cp === undefined || cp === '') return true
    return cp === parentId
  })
}

/**
 * Logic-only nodes (no containerParent) can be linked from multiple parents in the graph.
 * Pick one canonical parent per child so the debug tree lists each node once.
 */
/** Keep only parent→child links where both ends are in allowedIds (for scoped vs orphan trees). */
function filterChildLinksByAllowedIds(childLinksByNode, allowedIds) {
  const m = new Map()
  for (const [parentId, links] of childLinksByNode.entries()) {
    if (!allowedIds.has(parentId)) continue
    const filtered = links.filter(({ node }) => allowedIds.has(node.id))
    if (filtered.length) m.set(parentId, filtered)
  }
  return m
}

function buildCanonicalLogicParentByChildId(nodes, childLinksByNode) {
  const parentsByChild = new Map()
  for (const n of nodes) {
    for (const { node: child } of childLinksByNode.get(n.id) || []) {
      const cp = child.data?.containerParent
      if (cp != null && cp !== undefined && cp !== '') continue
      if (!parentsByChild.has(child.id)) parentsByChild.set(child.id, [])
      parentsByChild.get(child.id).push(n.id)
    }
  }
  const out = new Map()
  for (const [childId, pids] of parentsByChild) {
    const unique = [...new Set(pids)].sort()
    if (unique.length > 0) out.set(childId, unique[0])
  }
  return out
}

function filterLinksForDisplayParent(parentId, childLinksByNode, canonicalLogicParentByChildId) {
  const links = filterLinksForStructuralParent(parentId, childLinksByNode)
  if (!canonicalLogicParentByChildId || canonicalLogicParentByChildId.size === 0) return links
  return links.filter(({ node: child }) => {
    const cp = child.data?.containerParent
    if (cp != null && cp !== undefined && cp !== '') return true
    const canon = canonicalLogicParentByChildId.get(child.id)
    if (canon == null) return true
    return canon === parentId
  })
}

function statusClass(result) {
  if (!result) return 'skipped'
  return result.passed ? 'passed' : 'failed'
}

function statusText(result) {
  if (!result) return 'SKIP'
  return result.passed ? 'PASS' : 'FAIL'
}

function formatReason(nodeType, result) {
  if (!result) return ''
  const isLogicNode = ['junction', 'logicgroup', 'and', 'or', 'nof'].includes(nodeType)
  if (isLogicNode) return ''
  return result.reason || 'No reason provided'
}

function DebugTreeNode({
  node,
  allNodes,
  nodeResults,
  depth,
  collapsed,
  onToggle,
  childLinksByNode,
  canonicalLogicParentByChildId,
  onNavigateToNode,
}) {
  if (HIDDEN_FLOW_TYPES.has(node.type)) {
    const hiddenChildLinks = filterLinksForDisplayParent(node.id, childLinksByNode, canonicalLogicParentByChildId)
    if (hiddenChildLinks.length === 0) return null
    return (
      <>
        {hiddenChildLinks.map(({ node: child, relation, logicType }) => (
          <div key={`${node.id}-${child.id}-${relation}`}>
            {relation === 'logic' && (
              <div className="tree-wire-label">
                <span
                  className="tree-logic-badge"
                  style={{
                    background: logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : logicType === 'nof' ? '#9b59b6' : '#888',
                  }}
                >
                  {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                </span>
              </div>
            )}
            <DebugTreeNode
              node={child}
              allNodes={allNodes}
              nodeResults={nodeResults}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              childLinksByNode={childLinksByNode}
              canonicalLogicParentByChildId={canonicalLogicParentByChildId}
              onNavigateToNode={onNavigateToNode}
            />
          </div>
        ))}
      </>
    )
  }

  const isContainer =
    node.type === 'and' ||
    node.type === 'or' ||
    node.type === 'nof' ||
    node.type === 'logicgroup' ||
    node.type === 'logicbox'
  const childLinks = filterLinksForDisplayParent(node.id, childLinksByNode, canonicalLogicParentByChildId)
  const hasStructuralChildren = childLinks.length > 0
  const isCollapsed = collapsed.has(node.id)
  const name = node.data?.name || NODE_LABELS[node.type] || node.type
  const logicColor = LOGIC_COLORS[node.type]
  const result = nodeResults.get(node.id)
  const displayReason = formatReason(node.type, result)
  // Show full graph under parents: list every structural child. Nested rows with no
  // evaluation entry still render as SKIP (depth > 0).
  const renderNode = result != null || hasStructuralChildren || depth > 0

  if (!renderNode) return null

  const goToNode = () => onNavigateToNode?.(node.id)

  return (
    <div className="tree-node" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`tree-node-row ${isContainer ? 'tree-container' : 'tree-leaf'}${onNavigateToNode ? ' tree-node-row--navigable' : ''}`}
        onClick={onNavigateToNode ? goToNode : undefined}
        onKeyDown={
          onNavigateToNode
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goToNode()
                }
              }
            : undefined
        }
        tabIndex={onNavigateToNode ? 0 : undefined}
        title={onNavigateToNode ? 'Show this node on the canvas' : undefined}
      >
        {isContainer && hasStructuralChildren && (
          <span className="tree-toggle" onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}>
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </span>
        )}
        {isContainer && !hasStructuralChildren && <span className="tree-toggle tree-empty">\u25B7</span>}
        {!isContainer && <span className="tree-indent">\u2022</span>}

        {logicColor && (
          <span className="tree-logic-badge" style={{ background: logicColor }}>
            {NODE_LABELS[node.type]}
          </span>
        )}

        <span className="tree-name">
          {isContainer ? (node.data?.name || NODE_LABELS[node.type]) : name}
        </span>

        <span className={`debug-tree-status debug-tree-status-${statusClass(result)}`}>
          {statusText(result)}
        </span>
      </div>

      {result && (
        <div
          className={`debug-tree-reason debug-tree-reason-${statusClass(result)}${onNavigateToNode ? ' debug-tree-reason--navigable' : ''}`}
          style={{ paddingLeft: 28 }}
          onClick={onNavigateToNode ? goToNode : undefined}
          onKeyDown={
            onNavigateToNode
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    goToNode()
                  }
                }
              : undefined
          }
          tabIndex={onNavigateToNode ? 0 : undefined}
          title={onNavigateToNode ? 'Show this node on the canvas' : undefined}
        >
          {displayReason}
        </div>
      )}

      {isContainer && hasStructuralChildren && !isCollapsed && (
        <div className="tree-children">
          {childLinks.map(({ node: child, relation, logicType }) => (
            <div key={`${node.id}-${child.id}-${relation}`}>
              {relation === 'logic' && (
                <div className="tree-wire-label">
                  <span
                    className="tree-logic-badge"
                    style={{
                      background: logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : logicType === 'nof' ? '#9b59b6' : '#888',
                    }}
                  >
                    {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                  </span>
                </div>
              )}
              <DebugTreeNode
                node={child}
                allNodes={allNodes}
                nodeResults={nodeResults}
                depth={depth + 1}
                collapsed={collapsed}
                onToggle={onToggle}
                childLinksByNode={childLinksByNode}
                canonicalLogicParentByChildId={canonicalLogicParentByChildId}
                onNavigateToNode={onNavigateToNode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DebugResultsPanel({
  results,
  debugPost = null,
  nodes = [],
  edges = [],
  onClose,
  onClear,
  onRerunDebug,
  rerunInProgress = false,
  debugPins = [],
  canPinCurrent = false,
  onPinCurrent,
  onRunPinned,
  onRemovePinned,
  onOpenTestPost,
  onOpenDebugUrl,
  onNavigateToNode,
}) {
  const passed = results?.passed ?? false
  const error = results?.error
  const resultScore = results?.score ?? 0
  const endResults = Array.isArray(results?.endResults) ? results.endResults : []
  const passedEndCount = useMemo(
    () => endResults.filter((er) => er.passed).length,
    [endResults]
  )
  const hasMultiEnd = endResults.length > 1
  const engagementSummary = useMemo(() => {
    if (!debugPost) return null
    const likes = Number(debugPost.like_count ?? debugPost.likes ?? debugPost.engagement?.like_count ?? 0)
    const replies = Number(debugPost.reply_count ?? debugPost.replies ?? debugPost.engagement?.reply_count ?? 0)
    const reposts = Number(debugPost.repost_count ?? debugPost.reposts ?? debugPost.engagement?.repost_count ?? 0)
    const quotes = Number(debugPost.quote_count ?? debugPost.quotes ?? debugPost.engagement?.quote_count ?? 0)
    const bookmarks = Number(debugPost.bookmark_count ?? debugPost.bookmarks ?? debugPost.engagement?.bookmark_count ?? 0)
    return { likes, replies, reposts, quotes, bookmarks }
  }, [debugPost])
  const nodeResultsRaw = results?.results
  const [expanded, setExpanded] = useState(() => new Set())
  const [copyFeedback, setCopyFeedback] = useState(false)

  const handleClose = (e) => {
    e?.stopPropagation?.()
    // Only hide panel, don't clear results
    if (onClose) {
      onClose()
    }
  }

  const handleClear = (e) => {
    e?.stopPropagation?.()
    // Clear both panel and results
    if (onClear) {
      onClear()
    }
  }

  const toggleExpanded = (nodeId) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const collapseAll = () => setExpanded(new Set())

  /** Top-level canvas nodes (no container parent), excluding only START/END chrome. */
  const flowRootNodes = useMemo(() => {
    return nodes.filter(
      (n) =>
        !n.data?.containerParent &&
        n.type !== 'start' &&
        n.type !== 'containerin' &&
        n.type !== 'end' &&
        n.type !== 'containerout'
    )
  }, [nodes])

  const childLinksByNode = useMemo(() => buildChildLinksByNode(nodes, edges), [nodes, edges])

  const feedScope = useMemo(() => {
    const seeds = findRootFlowSourceIds(nodes)
    if (seeds.length === 0) return new Set()
    return computeFeedScopedNodeIds(seeds, nodes, edges)
  }, [nodes, edges])

  const orphanIds = useMemo(() => {
    return new Set(nodes.filter((n) => !feedScope.has(n.id)).map((n) => n.id))
  }, [nodes, feedScope])

  const scopedChildLinksByNode = useMemo(
    () => filterChildLinksByAllowedIds(childLinksByNode, feedScope),
    [childLinksByNode, feedScope]
  )

  const orphanChildLinksByNode = useMemo(
    () => filterChildLinksByAllowedIds(childLinksByNode, orphanIds),
    [childLinksByNode, orphanIds]
  )

  const scopedFlowRoots = useMemo(
    () => flowRootNodes.filter((n) => feedScope.has(n.id)),
    [flowRootNodes, feedScope]
  )

  const orphanFlowRoots = useMemo(
    () => flowRootNodes.filter((n) => orphanIds.has(n.id)),
    [flowRootNodes, orphanIds]
  )

  const canonicalScoped = useMemo(
    () => buildCanonicalLogicParentByChildId(nodes, scopedChildLinksByNode),
    [nodes, scopedChildLinksByNode]
  )

  const canonicalOrphan = useMemo(
    () => buildCanonicalLogicParentByChildId(nodes, orphanChildLinksByNode),
    [nodes, orphanChildLinksByNode]
  )

  const effectiveResults = useMemo(() => {
    if (!nodeResultsRaw) return new Map()
    return mergeEvaluationResultsMap(nodeResultsRaw, nodes, edges)
  }, [nodeResultsRaw, nodes, edges])

  const connectedResultCount = useMemo(() => {
    let n = 0
    for (const [id] of effectiveResults) {
      if (feedScope.has(id)) n++
    }
    return n
  }, [feedScope, effectiveResults])

  const handleCopyResults = useCallback(async () => {
    if (!results) return
    const payload = {
      exportedAt: new Date().toISOString(),
      overallPassed: passed,
      score: resultScore,
      error: error || undefined,
      evaluations: Array.from(effectiveResults.entries()).map(([nodeId, r]) => {
        const node = nodes.find((n) => n.id === nodeId)
        const row = {
          nodeId,
          nodeType: node?.type ?? null,
          displayName: (node?.data?.name && String(node.data.name).trim()) || null,
          passed: r.passed,
          reason: r.reason ?? null,
        }
        if (r.inferredFromParent) row.inferredFromParent = true
        if (r.inferredFromChildren) row.inferredFromChildren = true
        if (r.type) row.conditionType = r.type
        return row
      }),
    }
    const text = JSON.stringify(payload, null, 2)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2000)
      } else {
        throw new Error('clipboard unavailable')
      }
    } catch {
      window.prompt('Copy this text:', text)
    }
  }, [results, passed, resultScore, error, effectiveResults, nodes])

  const hasEvaluatedSubtreeScoped = useMemo(() => {
    const cache = new Map()
    const check = (nodeId) => {
      if (cache.has(nodeId)) return cache.get(nodeId)
      if (effectiveResults.has(nodeId)) {
        cache.set(nodeId, true)
        return true
      }
      const children = scopedChildLinksByNode.get(nodeId) || []
      const childMatch = children.some(link => check(link.node.id))
      cache.set(nodeId, childMatch)
      return childMatch
    }
    return check
  }, [scopedChildLinksByNode, effectiveResults])

  const hasEvaluatedSubtreeOrphan = useMemo(() => {
    const cache = new Map()
    const check = (nodeId) => {
      if (cache.has(nodeId)) return cache.get(nodeId)
      if (effectiveResults.has(nodeId)) {
        cache.set(nodeId, true)
        return true
      }
      const children = orphanChildLinksByNode.get(nodeId) || []
      const childMatch = children.some(link => check(link.node.id))
      cache.set(nodeId, childMatch)
      return childMatch
    }
    return check
  }, [orphanChildLinksByNode, effectiveResults])

  const junctionGroups = useMemo(() => {
    const junctions = scopedFlowRoots.filter(n => n.type === 'junction')
    return junctions.map(junction => {
      const logicEdges = edges.filter(e => e.target === junction.id && e.sourceHandle?.startsWith('logic-'))
      const rawChildren = logicEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean)
      const structurallyOk = rawChildren.filter((child) => {
        const cp = child.data?.containerParent
        if (cp == null || cp === undefined || cp === '') {
          return canonicalScoped.get(child.id) === junction.id
        }
        return cp === junction.id
      })
      const children = dedupeJunctionLogicChildren(structurallyOk, nodes)
      return { junction, children, edges: logicEdges }
    })
  }, [scopedFlowRoots, edges, nodes, canonicalScoped])

  const orphanJunctionGroups = useMemo(() => {
    const junctions = orphanFlowRoots.filter(n => n.type === 'junction')
    return junctions.map(junction => {
      const logicEdges = edges.filter(e => e.target === junction.id && e.sourceHandle?.startsWith('logic-'))
      const rawChildren = logicEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean)
      const structurallyOk = rawChildren.filter((child) => {
        const cp = child.data?.containerParent
        if (cp == null || cp === undefined || cp === '') {
          return canonicalOrphan.get(child.id) === junction.id
        }
        return cp === junction.id
      })
      const children = dedupeJunctionLogicChildren(structurallyOk, nodes)
      return { junction, children, edges: logicEdges }
    })
  }, [orphanFlowRoots, edges, nodes, canonicalOrphan])

  return (
    <div className="debug-panel-overlay">
      <div className="debug-panel-content">
        <div className="debug-panel-header">
          <h2>Debug Results</h2>
          <div className="debug-panel-header-actions">
            <DebugPinsMenu
              pins={debugPins}
              canPinCurrent={canPinCurrent}
              onPinCurrent={onPinCurrent}
              onRunPinned={onRunPinned}
              onRemovePin={onRemovePinned}
              busy={rerunInProgress}
            />
            {onRerunDebug && (
              <button
                type="button"
                className="btn-secondary debug-panel-rerun"
                onClick={onRerunDebug}
                disabled={rerunInProgress}
                title="Run the same post through the graph again (picks up graph edits)"
              >
                {rerunInProgress ? 'Running…' : 'Re-run debug'}
              </button>
            )}
            <button className="debug-panel-close" onClick={handleClose} title="Hide panel (results stay visible on canvas)">×</button>
          </div>
        </div>
        <div className="debug-panel-body">
          {!results && (
            <div className="debug-panel-empty">
              <p>
                No evaluation yet. Open a run from the <strong>START</strong> node (Debug URL or Test Post), use the
                buttons below, or choose a <strong>saved pin</strong> in the header.
              </p>
              <div className="debug-panel-empty-actions">
                {onOpenDebugUrl && (
                  <button type="button" className="btn-primary" onClick={onOpenDebugUrl}>
                    Debug by URL…
                  </button>
                )}
                {onOpenTestPost && (
                  <button type="button" className="btn-secondary" onClick={onOpenTestPost}>
                    Test post (JSON)…
                  </button>
                )}
              </div>
            </div>
          )}
          {results && error && (
            <div className="debug-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results && (
          <div className="debug-summary">
            {hasMultiEnd ? (
              <div className={`debug-status ${passedEndCount > 0 ? 'passed' : 'failed'}`}>
                <strong>Feeds Passed:</strong> {passedEndCount} / {endResults.length}
              </div>
            ) : (
              <div className={`debug-status ${passed ? 'passed' : 'failed'}`}>
                <strong>Overall Result:</strong> {passed ? '✓ PASSED' : '✗ FAILED'}
              </div>
            )}
            <div className="debug-status" style={{ marginTop: 8 }}>
              <strong>Post Score:</strong> {resultScore}
            </div>
            {engagementSummary && (
              <div className="debug-status" style={{ marginTop: 8 }}>
                <strong>Saved Engagement:</strong>{' '}
                likes {engagementSummary.likes} · replies {engagementSummary.replies} · reposts {engagementSummary.reposts} · quotes {engagementSummary.quotes} · bookmarks {engagementSummary.bookmarks}
              </div>
            )}
            <p className="debug-summary-scope-note">
              Based on the START→END feed path only — not orphaned or off-path nodes.
            </p>
            {endResults.length > 0 && (
              <div className="debug-status" style={{ marginTop: 10 }}>
                <strong>END Results:</strong>
                <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                  {endResults.map((er) => (
                    <div
                      key={er.endId}
                      style={{
                        fontSize: 12,
                        opacity: 0.95,
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: `1px solid ${er.passed ? 'rgba(81, 207, 102, 0.45)' : 'rgba(255, 107, 107, 0.45)'}`,
                        background: er.passed ? 'rgba(81, 207, 102, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                      }}
                    >
                      {er.passed ? '✓' : '✗'} {er.endName} · score {er.score} · path {Array.isArray(er.flowPath) ? er.flowPath.length : 0} nodes
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {results && (
          <div className="debug-tree-actions">
            <button className="btn-secondary" onClick={collapseAll}>
              Collapse All
            </button>
          </div>
          )}

          {results && (
          <div className="debug-tree">
            <h3>Connected to START</h3>
            <div className="debug-tree-root tree-node-row tree-junction-row">
              <span className="tree-indent">◆</span>
              <span className="tree-name">Evaluated nodes (in scope)</span>
              <span className="debug-root-count">{connectedResultCount} with results</span>
            </div>

            {junctionGroups.map(({ junction, children, edges: groupEdges }) => (
              <div key={junction.id} className="tree-junction-group">
                {children.map(child => {
                  const edge = groupEdges.find(e => e.source === child.id)
                  const logicType = edge?.data?.logicType || 'and'
                  const color = logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : logicType === 'nof' ? '#9b59b6' : '#888'
                  return (
                    <div key={child.id} style={{ paddingLeft: 16 }}>
                      <div className="tree-wire-label">
                        <span className="tree-logic-badge" style={{ background: color }}>
                          {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                        </span>
                      </div>
                      <DebugTreeNode
                        node={child}
                        allNodes={nodes}
                        nodeResults={effectiveResults}
                        depth={1}
                        collapsed={expanded}
                        onToggle={toggleExpanded}
                        childLinksByNode={scopedChildLinksByNode}
                        canonicalLogicParentByChildId={canonicalScoped}
                        onNavigateToNode={onNavigateToNode}
                      />
                    </div>
                  )
                })}
              </div>
            ))}

            {scopedFlowRoots
              .filter(n => n.type !== 'junction' && !junctionGroups.some(g => g.children.includes(n)))
              .filter(n => {
                const hasKids = (scopedChildLinksByNode.get(n.id) || []).length > 0
                return hasEvaluatedSubtreeScoped(n.id) || hasKids
              })
              .map(node => (
                <DebugTreeNode
                  key={node.id}
                  node={node}
                  allNodes={nodes}
                  nodeResults={effectiveResults}
                  depth={0}
                  collapsed={expanded}
                  onToggle={toggleExpanded}
                  childLinksByNode={scopedChildLinksByNode}
                  canonicalLogicParentByChildId={canonicalScoped}
                  onNavigateToNode={onNavigateToNode}
                />
              ))}

            {orphanIds.size > 0 && (
              <div className="debug-tree-orphan-section">
                <h3 className="debug-tree-orphan-title">Not connected to START</h3>
                <p className="debug-tree-orphan-note">
                  These nodes are not reachable from START (not on the START→END path). They still get PASS/FAIL in debug; overall feed pass/fail only uses the connected graph.
                </p>
                <div className="debug-tree-root tree-node-row tree-junction-row debug-tree-orphan-root">
                  <span className="tree-indent">○</span>
                  <span className="tree-name">Orphaned in editor</span>
                  <span className="debug-root-count">{orphanIds.size} node{orphanIds.size === 1 ? '' : 's'}</span>
                </div>

                {orphanJunctionGroups.map(({ junction, children, edges: groupEdges }) => (
                  <div key={junction.id} className="tree-junction-group">
                    {children.map(child => {
                      const edge = groupEdges.find(e => e.source === child.id)
                      const logicType = edge?.data?.logicType || 'and'
                      const color = logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : logicType === 'nof' ? '#9b59b6' : '#888'
                      return (
                        <div key={child.id} style={{ paddingLeft: 16 }}>
                          <div className="tree-wire-label">
                            <span className="tree-logic-badge" style={{ background: color }}>
                              {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                            </span>
                          </div>
                          <DebugTreeNode
                            node={child}
                            allNodes={nodes}
                            nodeResults={effectiveResults}
                            depth={1}
                            collapsed={expanded}
                            onToggle={toggleExpanded}
                            childLinksByNode={orphanChildLinksByNode}
                            canonicalLogicParentByChildId={canonicalOrphan}
                            onNavigateToNode={onNavigateToNode}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}

                {orphanFlowRoots
                  .filter(n => n.type !== 'junction' && !orphanJunctionGroups.some(g => g.children.includes(n)))
                  .filter(n => {
                    const hasKids = (orphanChildLinksByNode.get(n.id) || []).length > 0
                    return hasEvaluatedSubtreeOrphan(n.id) || hasKids
                  })
                  .map(node => (
                    <DebugTreeNode
                      key={`orphan-${node.id}`}
                      node={node}
                      allNodes={nodes}
                      nodeResults={effectiveResults}
                      depth={0}
                      collapsed={expanded}
                      onToggle={toggleExpanded}
                      childLinksByNode={orphanChildLinksByNode}
                      canonicalLogicParentByChildId={canonicalOrphan}
                      onNavigateToNode={onNavigateToNode}
                    />
                  ))}
              </div>
            )}
          </div>
          )}
        </div>
        <div className="debug-panel-footer">
          <button
            type="button"
            className="btn-secondary debug-panel-copy"
            onClick={handleCopyResults}
            disabled={!results}
            title={results ? 'Copy all results as JSON for sharing' : 'Run debug first'}
          >
            {copyFeedback ? 'Copied' : 'Copy'}
          </button>
          <button className="btn-secondary" onClick={handleClose}>
            Hide Panel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleClear}
            disabled={!results}
            title={results ? 'Clear results from the canvas' : 'Nothing to clear'}
          >
            Clear Results
          </button>
        </div>
      </div>
    </div>
  )
}

export default React.memo(DebugResultsPanel)
