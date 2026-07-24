import { isPlainInjectionNodeType } from '../constants/pipelineNodes'

const EDGE_STYLE = { stroke: '#ff6b6b', strokeWidth: 2 }
const MARKER_END = {
  type: 'arrowclosed',
  color: '#ff6b6b',
  width: 20,
  height: 20,
}

/**
 * Rebuild injection chain: higher slot index = upstream; slot 0 connects to END `input-left`.
 * Upstream output-bottom → downstream input-top.
 */
export function rebuildInjectionChainForEndPipeline(nodes, edges, endId) {
  const inj = nodes.filter(
    (n) =>
      n.data?.containerParent === endId && isPlainInjectionNodeType(n.type)
  )
  const ids = new Set(inj.map((n) => n.id))

  let nextEdges = edges.filter((e) => {
    if (!ids.has(e.source)) return true
    if (
      e.sourceHandle === 'output-bottom' &&
      ((e.target === endId && e.targetHandle === 'input-left') ||
        (ids.has(e.target) && e.targetHandle === 'input-top'))
    ) {
      return false
    }
    return true
  })

  const sorted = [...inj].sort(
    (a, b) =>
      (a.data?.endPipelineInjectionSlotIndex ?? 0) -
      (b.data?.endPipelineInjectionSlotIndex ?? 0)
  )

  for (let i = 0; i < sorted.length - 1; i++) {
    const upstream = sorted[i + 1]
    const downstream = sorted[i]
    nextEdges.push({
      id: `edge-inj-chain-${upstream.id}-${downstream.id}`,
      source: upstream.id,
      target: downstream.id,
      sourceHandle: 'output-bottom',
      targetHandle: 'input-left',
      type: 'ordered',
      style: { ...EDGE_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  if (sorted.length >= 1) {
    const head = sorted[0]
    nextEdges.push({
      id: `edge-inj-${head.id}-${endId}`,
      source: head.id,
      target: endId,
      sourceHandle: 'output-bottom',
      targetHandle: 'input-top',
      type: 'ordered',
      style: { ...EDGE_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  return nextEdges
}
