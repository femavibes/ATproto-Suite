import { isPlainAccessNodeType } from '../constants/pipelineNodes'

const EDGE_STYLE = { stroke: '#20c997', strokeWidth: 2 }
const MARKER_END = {
  type: 'arrowclosed',
  color: '#20c997',
  width: 20,
  height: 20,
}

/**
 * Rebuild teal edges from all access nodes parented to `endId` → END `input-left`.
 * Multiple modules may share the same END handle.
 */
export function rebuildAccessEdgesForEndPipeline(nodes, edges, endId) {
  const access = nodes.filter(
    (n) =>
      n.data?.containerParent === endId && isPlainAccessNodeType(n.type)
  )
  const ids = new Set(access.map((n) => n.id))

  let nextEdges = edges.filter(
    (e) =>
      !(
        ids.has(e.source) &&
        e.target === endId &&
        e.targetHandle === 'input-left' &&
        e.sourceHandle === 'output-bottom'
      )
  )

  for (const n of access) {
    nextEdges.push({
      id: `edge-access-${n.id}-${endId}`,
      source: n.id,
      target: endId,
      sourceHandle: 'output-bottom',
      targetHandle: 'input-left',
      type: 'ordered',
      style: { ...EDGE_STYLE },
      data: {},
      markerEnd: { ...MARKER_END },
    })
  }

  return nextEdges
}
