import { isPlainSortingNodeType } from '../constants/pipelineNodes'

const EDGE_SORT_STYLE = { stroke: '#9775fa', strokeWidth: 2 }
const MARKER_END = {
  type: 'arrowclosed',
  color: '#9775fa',
  width: 20,
  height: 20,
}

/**
 * Remove and rebuild purple sorting edges for plain sorting nodes parented to `endId`.
 * Slot index 0 is closest to END (smallest y); higher indices are upstream (chain downward).
 */
export function rebuildSortingChainForEndPipeline(nodes, edges, endId) {
  const sorting = nodes.filter(
    (n) =>
      n.data?.containerParent === endId && isPlainSortingNodeType(n.type)
  )
  const sortIds = new Set(sorting.map((n) => n.id))

  let nextEdges = edges.filter((e) => {
    if (!sortIds.has(e.source)) return true
    if (
      e.sourceHandle === 'output-top' &&
      ((e.target === endId && e.targetHandle === 'input-left') ||
        (sortIds.has(e.target) && e.targetHandle === 'input-bottom'))
    ) {
      return false
    }
    return true
  })

  const sorted = [...sorting].sort(
    (a, b) =>
      (a.data?.endPipelineSlotIndex ?? 0) -
      (b.data?.endPipelineSlotIndex ?? 0)
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const upstream = sorted[i + 1]
    const downstream = sorted[i]
    nextEdges.push({
      id: `edge-sort-chain-${upstream.id}-${downstream.id}`,
      source: upstream.id,
      target: downstream.id,
      sourceHandle: 'output-top',
      targetHandle: 'input-bottom',
      type: 'ordered',
      style: { ...EDGE_SORT_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  if (sorted.length >= 1) {
    const head = sorted[0]
    nextEdges.push({
      id: `edge-sort-${head.id}-${endId}`,
      source: head.id,
      target: endId,
      sourceHandle: 'output-top',
      targetHandle: 'input-left',
      type: 'ordered',
      style: { ...EDGE_SORT_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  return nextEdges
}
