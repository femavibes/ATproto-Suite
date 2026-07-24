/**
 * On-canvas logic containers (`logicbox`): React Flow subflows, dynamic size, vs zoom-only groups.
 */

import { snapToGrid, GRID_SIZE } from '../constants/grid.js'

const CHILD_GAP = 8

/** Groups that use double-click navigation; their children are hidden on the root canvas. */
export const ZOOM_CONTAINER_TYPES = new Set(['logicgroup', 'and', 'or', 'nof'])

/** Node types that may be dropped or dragged into an on-canvas logic box. */
const PLACE_IN_LOGIC_BOX = new Set([
  'text',
  'regex',
  'language',
  'posttype',
  'hashtag',
  'labels',
  'dateage',
  'author',
  'media',
  'engagement',
  'poststructure',
  'mentions',
  'links',
  'image',
  'video',
  'quotepost',
  'logicbox',
])

export function canPlaceInsideLogicBox(nodeType) {
  return PLACE_IN_LOGIC_BOX.has(String(nodeType || ''))
}

export function isDescendantOfZoomContainer(node, allNodes) {
  let id = node?.data?.containerParent
  while (id) {
    const p = allNodes.find((n) => n.id === id)
    if (!p) break
    if (ZOOM_CONTAINER_TYPES.has(p.type)) return true
    id = p.data?.containerParent
  }
  return false
}

function hasAncestorContainerId(node, ancestorId, allNodes) {
  let id = node?.data?.containerParent
  while (id) {
    if (id === ancestorId) return true
    const p = allNodes.find((x) => x.id === id)
    id = p?.data?.containerParent
  }
  return false
}

const HEADER = 52
const PAD = 16
export const LOGIC_BOX_MIN_W = 260
export const LOGIC_BOX_MIN_H = 188
export const DEFAULT_CHILD_W = 180
export const DEFAULT_CHILD_H = 100

function parseDim(v, fallback) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.endsWith('px')) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export function getLogicBoxInnerSize(box) {
  return {
    w: parseDim(box.width ?? box.measured?.width ?? box.style?.width, LOGIC_BOX_MIN_W),
    h: parseDim(box.height ?? box.measured?.height ?? box.style?.height, LOGIC_BOX_MIN_H),
  }
}

/** Absolute top-left of this node in flow coordinates (follows parentNode chain). */
export function getAbsoluteNodePosition(node, byId) {
  let x = node.position?.x || 0
  let y = node.position?.y || 0
  let cur = node
  while (cur?.parentNode) {
    const p = byId.get(cur.parentNode)
    if (!p) break
    x += p.position?.x || 0
    y += p.position?.y || 0
    cur = p
  }
  return { x, y }
}

export function flowPointInsideLogicBox(absX, absY, box, byId) {
  const { x, y } = getAbsoluteNodePosition(box, byId)
  const { w, h } = getLogicBoxInnerSize(box)
  return absX >= x && absY >= y && absX <= x + w && absY <= y + h
}

function nestingDepthInLogicBoxes(node, byId) {
  let d = 0
  let c = node
  while (c?.parentNode) {
    const p = byId.get(c.parentNode)
    if (!p || p.type !== 'logicbox') break
    d++
    c = p
  }
  return d
}

/**
 * Innermost logicbox whose bounds contain the flow point (excludes `excludeId`).
 * @param {string|null} zoomContainerId - When zoomed into a group subgraph, only consider logicboxes under that container.
 */
export function pickEnclosingLogicBox(flowX, flowY, allNodes, excludeId, zoomContainerId = null) {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const inScope = (n) => {
    if (zoomContainerId) {
      return (
        n.data?.containerParent === zoomContainerId ||
        hasAncestorContainerId(n, zoomContainerId, allNodes)
      )
    }
    return !isDescendantOfZoomContainer(n, allNodes)
  }
  const candidates = allNodes.filter(
    (n) =>
      n.type === 'logicbox' &&
      n.id !== excludeId &&
      inScope(n) &&
      flowPointInsideLogicBox(flowX, flowY, n, byId)
  )
  candidates.sort((a, b) => nestingDepthInLogicBoxes(b, byId) - nestingDepthInLogicBoxes(a, byId))
  return candidates[0] || null
}

export function resizeLogicBoxes(allNodes) {
  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const boxes = allNodes.filter((n) => n.type === 'logicbox')
  const depth = (id) => {
    let d = 0
    let c = byId.get(id)
    while (c?.parentNode) {
      d++
      c = byId.get(c.parentNode)
    }
    return d
  }
  boxes.sort((a, b) => depth(b.id) - depth(a.id))

  let next = allNodes
  for (const box of boxes) {
    const b = byId.get(box.id)
    if (!b) continue
    const kids = next.filter((c) => c.data?.containerParent === box.id && c.id !== box.id)
    let maxR = PAD + 40
    let maxB = HEADER + PAD + 40
    for (const c of kids) {
      const { w: cw, h: ch } =
        c.type === 'logicbox' ? getLogicBoxInnerSize(c) : childNodeSize(c)
      maxR = Math.max(maxR, (c.position?.x || 0) + cw + PAD)
      maxB = Math.max(maxB, (c.position?.y || 0) + ch + PAD)
    }
    const newW = Math.max(LOGIC_BOX_MIN_W, Math.ceil(maxR))
    const newH = Math.max(LOGIC_BOX_MIN_H, Math.ceil(maxB))
    const curW = parseDim(b.width ?? b.measured?.width ?? b.style?.width, LOGIC_BOX_MIN_W)
    const curH = parseDim(b.height ?? b.measured?.height ?? b.style?.height, LOGIC_BOX_MIN_H)
    if (Math.abs(curW - newW) < 0.5 && Math.abs(curH - newH) < 0.5) continue
    next = next.map((n) =>
      n.id === box.id
        ? {
            ...n,
            width: newW,
            height: newH,
            style: { ...n.style, width: newW, height: newH },
          }
        : n
    )
    byId.set(box.id, next.find((n) => n.id === box.id))
  }
  return next
}

/**
 * Sync React Flow `parentNode` / `extent` from `data.containerParent` when parent is a logicbox.
 * Zoom-group children must not use RF subflow parent.
 */
export function bindLogicBoxParentNodes(nodes) {
  return nodes.map((n) => {
    const cp = n.data?.containerParent
    if (!cp) {
      if (n.parentNode) {
        const parent = nodes.find((p) => p.id === n.parentNode)
        if (parent?.type !== 'logicbox') {
          return { ...n, parentNode: undefined, extent: undefined, expandParent: undefined }
        }
      }
      return n
    }
    const parent = nodes.find((p) => p.id === cp)
    if (parent?.type === 'logicbox') {
      const w = parseDim(n.width ?? n.style?.width, DEFAULT_CHILD_W)
      const h = parseDim(n.height ?? n.style?.height, DEFAULT_CHILD_H)
      return {
        ...n,
        parentNode: cp,
        // Do not clamp to parent bounds; placement may intentionally push a
        // child to the next row and then grow the parent to fit it.
        extent: undefined,
        // Let RF grow parent when child reaches current bounds; our explicit
        // resize pass still normalizes final dimensions after layout settles.
        expandParent: true,
        // RF expandParent moves the parent when child x/y < 0; we use resizeLogicBoxes instead.
        width: n.width ?? w,
        height: n.height ?? h,
      }
    }
    return {
      ...n,
      parentNode: undefined,
      extent: undefined,
      expandParent: undefined,
    }
  })
}

/** Parents before children for React Flow subflows. */
export function sortNodesForSubflows(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set()
  const out = []
  function visit(n) {
    if (seen.has(n.id)) return
    if (n.parentNode) {
      const p = byId.get(n.parentNode)
      if (p) visit(p)
    }
    seen.add(n.id)
    out.push(n)
  }
  for (const n of nodes) visit(n)
  return out
}

export function childNodeSize(c) {
  return {
    w: parseDim(c.width ?? c.measured?.width ?? c.style?.width, DEFAULT_CHILD_W),
    h: parseDim(c.height ?? c.measured?.height ?? c.style?.height, DEFAULT_CHILD_H),
  }
}

function layoutNodeSize(node) {
  return node?.type === 'logicbox' ? getLogicBoxInnerSize(node) : childNodeSize(node)
}

/** Bounding rect (parent-relative) for overlap checks inside a logic box. */
function occupancyRect(n) {
  if (!n?.position) return { x: 0, y: 0, w: DEFAULT_CHILD_W, h: DEFAULT_CHILD_H }
  if (n.type === 'logicbox') {
    const { w, h } = getLogicBoxInnerSize(n)
    return { x: n.position.x, y: n.position.y, w, h }
  }
  const { w, h } = childNodeSize(n)
  return { x: n.position.x, y: n.position.y, w, h }
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  const g = CHILD_GAP
  return ax < bx + bw + g && ax + aw + g > bx && ay < by + bh + g && ay + ah + g > by
}

function collectSiblingOccupancy(nodes, boxId, excludeChildId) {
  return nodes
    .filter((n) => n.data?.containerParent === boxId && n.id !== excludeChildId)
    .map((n) => ({ id: n.id, ...occupancyRect(n) }))
}

function overlapsAny(x, y, cw, ch, rects) {
  return rects.some((r) => rectsOverlap(x, y, cw, ch, r.x, r.y, r.w, r.h))
}

/**
 * Parent-relative position for a new or moved child so it does not overlap siblings (grid-snapped).
 */
export function findNonOverlappingPositionInLogicBox(
  nodes,
  boxId,
  excludeChildId,
  childW,
  childH,
  preferredRel
) {
  const box = nodes.find((n) => n.id === boxId && n.type === 'logicbox')
  if (!box) return snapToGrid(preferredRel.x, preferredRel.y)
  const { w: innerW, h: innerH } = getLogicBoxInnerSize(box)
  const rects = collectSiblingOccupancy(nodes, boxId, excludeChildId)
  const innerLeft = PAD
  const innerTop = HEADER + PAD
  const pref = snapToGrid(preferredRel.x, preferredRel.y)
  if (
    pref.x >= innerLeft &&
    pref.y >= innerTop &&
    pref.x + childW <= innerW - PAD &&
    pref.y + childH <= innerH - PAD &&
    !overlapsAny(pref.x, pref.y, childW, childH, rects)
  ) {
    return pref
  }
  const maxX = Math.max(innerLeft, innerW - childW - PAD)
  const maxY = Math.max(innerTop, innerH - childH - PAD)
  for (let y = innerTop; y <= maxY + 0.001; y += GRID_SIZE) {
    for (let x = innerLeft; x <= maxX + 0.001; x += GRID_SIZE) {
      const s = snapToGrid(x, y)
      if (s.x < innerLeft || s.x + childW > innerW - PAD) continue
      if (s.y < innerTop || s.y + childH > innerH - PAD) continue
      if (!overlapsAny(s.x, s.y, childW, childH, rects)) return s
    }
  }
  let rowY = innerTop
  if (rects.length) {
    rowY = rects.reduce((m, r) => Math.max(m, r.y + r.h + CHILD_GAP), innerTop)
  }
  return snapToGrid(innerLeft, rowY)
}

/** After a drag, move a logic-box child if it overlaps a sibling (same parent). */
export function nudgeLogicBoxChildAwayFromSiblings(nodes, childId) {
  const child = nodes.find((n) => n.id === childId)
  const boxId = child?.data?.containerParent
  if (!child || !boxId) return nodes
  const parent = nodes.find((n) => n.id === boxId && n.type === 'logicbox')
  if (!parent) return nodes
  const { w: cw, h: ch } = layoutNodeSize(child)
  const rects = collectSiblingOccupancy(nodes, boxId, childId)
  const x = child.position?.x || 0
  const y = child.position?.y || 0
  if (!overlapsAny(x, y, cw, ch, rects)) return nodes
  const pos = findNonOverlappingPositionInLogicBox(nodes, boxId, childId, cw, ch, { x, y })
  return nodes.map((n) => (n.id === childId ? { ...n, position: pos } : n))
}

export function reparentNodeToLogicBox(nodes, childId, boxId, preferAbsPosition) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const child = byId.get(childId)
  const box = byId.get(boxId)
  if (!child || !box || box.type !== 'logicbox') return nodes
  const abs = preferAbsPosition || getAbsoluteNodePosition(child, byId)
  const pAbs = getAbsoluteNodePosition(box, byId)
  let rx = abs.x - pAbs.x
  let ry = abs.y - pAbs.y
  const snapped = snapToGrid(rx, ry)
  const w = parseDim(child.width ?? child.measured?.width ?? child.style?.width, DEFAULT_CHILD_W)
  const h = parseDim(child.height ?? child.measured?.height ?? child.style?.height, DEFAULT_CHILD_H)
  const pos = findNonOverlappingPositionInLogicBox(nodes, boxId, childId, w, h, snapped)
  const { w: boxW, h: boxH } = getLogicBoxInnerSize(box)
  const grownW = Math.max(LOGIC_BOX_MIN_W, Math.ceil(pos.x + w + PAD))
  const grownH = Math.max(LOGIC_BOX_MIN_H, Math.ceil(pos.y + h + PAD))
  return nodes.map((n) => {
    if (n.id === childId) {
      return {
        ...n,
        parentNode: boxId,
        // Keep child unconstrained so reflow can exceed old bounds and trigger
        // parent growth instead of being clamped into overlap.
        extent: undefined,
        expandParent: true,
        width: child.width ?? w,
        height: child.height ?? h,
        position: pos,
        data: {
          ...n.data,
          containerParent: boxId,
        },
      }
    }
    if (n.id === boxId && (grownW > boxW || grownH > boxH)) {
      const nextW = Math.max(boxW, grownW)
      const nextH = Math.max(boxH, grownH)
      return {
        ...n,
        width: nextW,
        height: nextH,
        style: { ...n.style, width: nextW, height: nextH },
      }
    }
    return n
  })
}

export function unparentNodeFromLogicBox(nodes, childId) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const child = byId.get(childId)
  if (!child?.parentNode) return nodes
  const parent = byId.get(child.parentNode)
  if (!parent || parent.type !== 'logicbox') return nodes
  const abs = getAbsoluteNodePosition(child, byId)
  const snapped = snapToGrid(abs.x, abs.y)
  const outerCp = parent.data?.containerParent ?? null
  const outerIsLogicBox = !!(outerCp && byId.get(outerCp)?.type === 'logicbox')
  return nodes.map((n) => {
    if (n.id !== childId) return n
    return {
      ...n,
      parentNode: outerIsLogicBox ? outerCp : undefined,
      extent: outerIsLogicBox ? 'parent' : undefined,
      expandParent: undefined,
      position: snapped,
      data: { ...n.data, containerParent: outerCp },
    }
  })
}

/**
 * If `child` sits in flow space outside its logicbox parent bounds, detach to same zoom-scope as parent.
 */
export function removeLogicBoxAndLiftChildren(nodes, boxId) {
  const victim = nodes.find((n) => n.id === boxId && n.type === 'logicbox')
  if (!victim) return nodes.filter((n) => n.id !== boxId)
  let next = [...nodes]
  const childIds = next.filter((n) => n.data?.containerParent === boxId).map((n) => n.id)
  for (const cid of childIds) {
    next = unparentNodeFromLogicBox(next, cid)
  }
  return next.filter((n) => n.id !== boxId)
}

export function maybeUnparentLogicBoxChild(nodes, childId) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const child = byId.get(childId)
  if (!child?.parentNode) return nodes
  const parent = byId.get(child.parentNode)
  if (!parent || parent.type !== 'logicbox') return nodes
  const abs = getAbsoluteNodePosition(child, byId)
  const { w, h } = getLogicBoxInnerSize(parent)
  const pAbs = getAbsoluteNodePosition(parent, byId)
  const { w: cw, h: ch } = layoutNodeSize(child)
  // Center-based + slack: easier to drag out than corner bbox, avoids
  // half-out "wiggle" when the box was tight vs measured size.
  const slack = 28
  const cx = abs.x + cw / 2
  const cy = abs.y + ch / 2
  const inside =
    cx >= pAbs.x - slack &&
    cy >= pAbs.y - slack &&
    cx <= pAbs.x + w + slack &&
    cy <= pAbs.y + h + slack
  if (inside) return nodes
  return unparentNodeFromLogicBox(nodes, childId)
}
