import { isPlainFixedSlotNodeType } from '../constants/pipelineNodes'

const EDGE_STYLE = { stroke: '#ffd43b', strokeWidth: 2 }
const MARKER_END = {
  type: 'arrowclosed',
  color: '#ffd43b',
  width: 20,
  height: 20,
}

/**
 * Rebuild fixed-position chain: higher slot index = upstream; slot 0 connects to END `input-left`.
 * Upstream output-top → downstream input-bottom.
 */
export function rebuildFixedSlotChainForEndPipeline(nodes, edges, endId) {
  const fixed = nodes.filter(
    (n) =>
      n.data?.containerParent === endId && isPlainFixedSlotNodeType(n.type)
  )
  const ids = new Set(fixed.map((n) => n.id))

  let nextEdges = edges.filter((e) => {
    if (!ids.has(e.source)) return true
    if (
      e.sourceHandle === 'output-top' &&
      ((e.target === endId && e.targetHandle === 'input-left') ||
        (ids.has(e.target) && e.targetHandle === 'input-bottom'))
    ) {
      return false
    }
    return true
  })

  const sorted = [...fixed].sort(
    (a, b) =>
      (a.data?.endPipelineFixedSlotIndex ?? 0) -
      (b.data?.endPipelineFixedSlotIndex ?? 0)
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const upstream = sorted[i + 1]
    const downstream = sorted[i]
    nextEdges.push({
      id: `edge-fixed-chain-${upstream.id}-${downstream.id}`,
      source: upstream.id,
      target: downstream.id,
      sourceHandle: 'output-top',
      targetHandle: 'input-bottom',
      type: 'ordered',
      style: { ...EDGE_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  if (sorted.length >= 1) {
    const head = sorted[0]
    nextEdges.push({
      id: `edge-fixed-${head.id}-${endId}`,
      source: head.id,
      target: endId,
      sourceHandle: 'output-top',
      targetHandle: 'input-left',
      type: 'ordered',
      style: { ...EDGE_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  return nextEdges
}
