import React, { useState, useMemo } from 'react'
import { computeFeedScopedNodeIds, findRootFlowSourceIds } from '../utils/graphEvaluator'
import { buildChildLinksByNode } from '../utils/mergeEvaluationResultsMap'
import './TreePanel.css'

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

/** Match debug panel: flow chrome is traversed but not listed as its own row. */
const HIDDEN_FLOW_TYPES = new Set(['start', 'containerin', 'end', 'containerout', 'junction'])

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

function filterLinksForStructuralParent(parentId, childLinksByNode) {
  const links = childLinksByNode.get(parentId) || []
  return links.filter(({ node: child }) => {
    const cp = child.data?.containerParent
    if (cp == null || cp === undefined || cp === '') return true
    return cp === parentId
  })
}

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

function TreeNode({
  node,
  allNodes,
  depth,
  onNodeFocus,
  connectedNodeIds,
  childLinksByNode,
  canonicalLogicParentByChildId,
}) {
  const [collapsed, setCollapsed] = useState(false)

  const displayLinks = useMemo(
    () => filterLinksForDisplayParent(node.id, childLinksByNode, canonicalLogicParentByChildId),
    [node.id, childLinksByNode, canonicalLogicParentByChildId]
  )

  const summary = useMemo(() => {
    if (HIDDEN_FLOW_TYPES.has(node.type)) return null
    if (node.type === 'text') {
      const kw = (node.data?.keywords || [])
        .map((k) =>
          typeof k === 'string'
            ? { value: k, wholeWord: false }
            : { value: String(k?.value || ''), wholeWord: !!k?.wholeWord }
        )
        .filter((k) => k.value.trim())
      if (kw.length === 0) return null
      const text = kw.slice(0, 3).map((k) => `${k.value}${k.wholeWord ? ' (word)' : ''}`).join(', ')
      return text + (kw.length > 3 ? '...' : '')
    }
    if (node.type === 'language') {
      const langs = node.data?.languages || []
      return langs.length > 0 ? langs.join(', ') : null
    }
    if (node.type === 'posttype') {
      const types = node.data?.types || []
      return types.length > 0 ? types.join(', ') : null
    }
    if (node.type === 'hashtag') {
      const tags = node.data?.tags || []
      return tags.length > 0 ? tags.slice(0, 3).join(', ') + (tags.length > 3 ? '...' : '') : null
    }
    if (node.type === 'regex') {
      const p = node.data?.pattern || ''
      return p ? (p.length > 30 ? p.slice(0, 30) + '...' : p) : null
    }
    if (node.type === 'dateage') {
      const v = node.data?.value || {}
      return v.amount ? `${node.data?.mode === 'newer_than' ? '<' : '>'} ${v.amount} ${v.unit || 'hours'}` : null
    }
    if (node.type === 'nof') {
      return `at least ${node.data?.n || 2}`
    }
    return null
  }, [node])

  if (HIDDEN_FLOW_TYPES.has(node.type)) {
    if (displayLinks.length === 0) return null
    return (
      <>
        {displayLinks.map(({ node: child, relation, logicType }) => (
          <div key={`${node.id}-${child.id}-${relation}`}>
            {relation === 'logic' && (
              <div className="tree-wire-label">
                <span
                  className="tree-logic-badge"
                  style={{
                    background:
                      logicType === 'and'
                        ? '#4a9eff'
                        : logicType === 'or'
                          ? '#ff9500'
                          : logicType === 'nof'
                            ? '#9b59b6'
                            : '#888',
                  }}
                >
                  {logicType === 'nof' ? 'N-OF' : String(logicType || 'and').toUpperCase()}
                </span>
              </div>
            )}
            <TreeNode
              node={child}
              allNodes={allNodes}
              depth={depth + 1}
              onNodeFocus={onNodeFocus}
              connectedNodeIds={connectedNodeIds}
              childLinksByNode={childLinksByNode}
              canonicalLogicParentByChildId={canonicalLogicParentByChildId}
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
  const hasStructuralChildren = displayLinks.length > 0
  const name = node.data?.name || NODE_LABELS[node.type] || node.type
  const isExclude = node.data?.exclude
  const logicColor = LOGIC_COLORS[node.type]
  const isOrphaned = connectedNodeIds && !connectedNodeIds.has(node.id)

  const goTo = () => onNodeFocus?.(node.id)

  return (
    <div className="tree-node" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`tree-node-row ${isContainer ? 'tree-container' : 'tree-leaf'} ${isOrphaned ? 'tree-orphaned' : ''}${onNodeFocus ? ' tree-node-row--navigable' : ''}`}
        onClick={onNodeFocus ? goTo : undefined}
        onKeyDown={
          onNodeFocus
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goTo()
                }
              }
            : undefined
        }
        tabIndex={onNodeFocus ? 0 : undefined}
        title={onNodeFocus ? 'Show on canvas' : undefined}
      >
        {isContainer && hasStructuralChildren && (
          <span
            className="tree-toggle"
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(!collapsed)
            }}
          >
            {collapsed ? '\u25B6' : '\u25BC'}
          </span>
        )}
        {isContainer && !hasStructuralChildren && <span className="tree-toggle tree-empty">\u25B7</span>}
        {!isContainer && <span className="tree-indent">\u2022</span>}
        {logicColor && (
          <span className="tree-logic-badge" style={{ background: logicColor }}>
            {NODE_LABELS[node.type]}
          </span>
        )}
        <span className={`tree-name ${isExclude ? 'tree-exclude' : ''}`}>
          {isContainer ? (node.data?.name || '') : name}
          {isExclude ? ' (exclude)' : ''}
        </span>
        {summary && <span className="tree-summary">{summary}</span>}
        {isContainer && <span className="tree-count">{displayLinks.length}</span>}
      </div>
      {isContainer && hasStructuralChildren && !collapsed && (
        <div className="tree-children">
          {displayLinks.map(({ node: child, relation, logicType }) => (
            <div key={`${node.id}-${child.id}-${relation}`}>
              {relation === 'logic' && (
                <div className="tree-wire-label">
                  <span
                    className="tree-logic-badge"
                    style={{
                      background:
                        logicType === 'and'
                          ? '#4a9eff'
                          : logicType === 'or'
                            ? '#ff9500'
                            : logicType === 'nof'
                              ? '#9b59b6'
                              : '#888',
                    }}
                  >
                    {logicType === 'nof' ? 'N-OF' : String(logicType || 'and').toUpperCase()}
                  </span>
                </div>
              )}
              <TreeNode
                node={child}
                allNodes={allNodes}
                depth={depth + 1}
                onNodeFocus={onNodeFocus}
                connectedNodeIds={connectedNodeIds}
                childLinksByNode={childLinksByNode}
                canonicalLogicParentByChildId={canonicalLogicParentByChildId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TreePanel({ nodes, edges, connectedNodeIds, onNodeFocus }) {
  const [collapsed, setCollapsed] = useState(false)

  const flowRootNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          !n.data?.containerParent &&
          n.type !== 'start' &&
          n.type !== 'containerin' &&
          n.type !== 'end' &&
          n.type !== 'containerout'
      ),
    [nodes]
  )

  const childLinksByNode = useMemo(() => buildChildLinksByNode(nodes, edges), [nodes, edges])

  const feedScope = useMemo(() => {
    const seeds = findRootFlowSourceIds(nodes)
    if (seeds.length === 0) return new Set()
    return computeFeedScopedNodeIds(seeds, nodes, edges)
  }, [nodes, edges])

  const orphanIds = useMemo(
    () => new Set(nodes.filter((n) => !feedScope.has(n.id)).map((n) => n.id)),
    [nodes, feedScope]
  )

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

  const junctionGroups = useMemo(() => {
    const junctions = scopedFlowRoots.filter((n) => n.type === 'junction')
    return junctions.map((junction) => {
      const logicEdges = edges.filter((e) => e.target === junction.id && e.sourceHandle?.startsWith('logic-'))
      const rawChildren = logicEdges.map((e) => nodes.find((n) => n.id === e.source)).filter(Boolean)
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
    const junctions = orphanFlowRoots.filter((n) => n.type === 'junction')
    return junctions.map((junction) => {
      const logicEdges = edges.filter((e) => e.target === junction.id && e.sourceHandle?.startsWith('logic-'))
      const rawChildren = logicEdges.map((e) => nodes.find((n) => n.id === e.source)).filter(Boolean)
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

  const hasAnyRoots =
    junctionGroups.length > 0 ||
    scopedFlowRoots.some((n) => n.type !== 'junction' && !junctionGroups.some((g) => g.children.includes(n))) ||
    orphanJunctionGroups.length > 0 ||
    orphanFlowRoots.some((n) => n.type !== 'junction' && !orphanJunctionGroups.some((g) => g.children.includes(n)))

  if (collapsed) {
    return (
      <div className="tree-panel tree-panel-collapsed" onClick={() => setCollapsed(false)}>
        <span className="tree-panel-expand">{'\u25C0'} Tree</span>
      </div>
    )
  }

  return (
    <div className="tree-panel">
      <div className="tree-panel-header">
        <span className="tree-panel-title">Feed Structure</span>
        <button type="button" className="tree-panel-close" onClick={() => setCollapsed(true)}>
          {'\u25B6'}
        </button>
      </div>
      <div className="tree-panel-body">
        {!hasAnyRoots && <div className="tree-empty-msg">No nodes yet</div>}

        {junctionGroups.map(({ junction, children, edges: groupEdges }) => (
          <div key={junction.id} className="tree-junction-group">
            {children.map((child) => {
              const edge = groupEdges.find((e) => e.source === child.id)
              const logicType = edge?.data?.logicType || 'and'
              const color =
                logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : logicType === 'nof' ? '#9b59b6' : '#888'
              return (
                <div key={child.id} style={{ paddingLeft: 16 }}>
                  <div className="tree-wire-label">
                    <span className="tree-logic-badge" style={{ background: color }}>
                      {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                    </span>
                  </div>
                  <TreeNode
                    node={child}
                    allNodes={nodes}
                    depth={1}
                    onNodeFocus={onNodeFocus}
                    connectedNodeIds={connectedNodeIds}
                    childLinksByNode={scopedChildLinksByNode}
                    canonicalLogicParentByChildId={canonicalScoped}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {scopedFlowRoots
          .filter((n) => n.type !== 'junction' && !junctionGroups.some((g) => g.children.includes(n)))
          .map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              allNodes={nodes}
              depth={0}
              onNodeFocus={onNodeFocus}
              connectedNodeIds={connectedNodeIds}
              childLinksByNode={scopedChildLinksByNode}
              canonicalLogicParentByChildId={canonicalScoped}
            />
          ))}

        {orphanIds.size > 0 && (
          <div className="tree-panel-orphan-section">
            <h3 className="tree-panel-orphan-title">Not on feed path</h3>
            <p className="tree-panel-orphan-note">
              Nodes not reachable from START in this container. They are still listed so you can find them in the editor.
            </p>

            {orphanJunctionGroups.map(({ junction, children, edges: groupEdges }) => (
              <div key={junction.id} className="tree-junction-group">
                {children.map((child) => {
                  const edge = groupEdges.find((e) => e.source === child.id)
                  const logicType = edge?.data?.logicType || 'and'
                  const color =
                    logicType === 'and'
                      ? '#4a9eff'
                      : logicType === 'or'
                        ? '#ff9500'
                        : logicType === 'nof'
                          ? '#9b59b6'
                          : '#888'
                  return (
                    <div key={child.id} style={{ paddingLeft: 16 }}>
                      <div className="tree-wire-label">
                        <span className="tree-logic-badge" style={{ background: color }}>
                          {logicType === 'nof' ? 'N-OF' : logicType.toUpperCase()}
                        </span>
                      </div>
                      <TreeNode
                        node={child}
                        allNodes={nodes}
                        depth={1}
                        onNodeFocus={onNodeFocus}
                        connectedNodeIds={connectedNodeIds}
                        childLinksByNode={orphanChildLinksByNode}
                        canonicalLogicParentByChildId={canonicalOrphan}
                      />
                    </div>
                  )
                })}
              </div>
            ))}

            {orphanFlowRoots
              .filter((n) => n.type !== 'junction' && !orphanJunctionGroups.some((g) => g.children.includes(n)))
              .map((node) => (
                <TreeNode
                  key={`orphan-${node.id}`}
                  node={node}
                  allNodes={nodes}
                  depth={0}
                  onNodeFocus={onNodeFocus}
                  connectedNodeIds={connectedNodeIds}
                  childLinksByNode={orphanChildLinksByNode}
                  canonicalLogicParentByChildId={canonicalOrphan}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TreePanel
