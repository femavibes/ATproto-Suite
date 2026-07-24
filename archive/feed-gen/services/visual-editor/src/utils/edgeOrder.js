/**
 * Calculate evaluation order for edges connected to logic nodes
 * 
 * For logic nodes (AND/OR/N-of), we number the incoming edges to show
 * the order in which conditions are evaluated.
 * 
 * Order is determined by TOPOLOGICAL/PATH-BASED traversal from START:
 * - Start from START nodes
 * - Traverse the graph following edges
 * - Assign order based on when nodes are reached in the traversal
 * - This ensures order is stable regardless of node position
 * 
 * For AND: all must pass, but order shows evaluation sequence
 * For OR: short-circuit evaluation (first true stops), order matters
 * For N-of: order shows which conditions are checked
 */

/**
 * Calculate topological order of nodes starting from START nodes
 * Uses breadth-first traversal to assign order numbers
 */
function calculateTopologicalOrder(edges, nodes) {
  const isSourceNode = (type) =>
    type === 'start' || type === 'containerin' || type === 'manualposts'
  const nodeOrder = new Map()
  const visited = new Set()
  const queue = []
  
  // Root-level flow sources only (same as pickFlowEntryNode). Inner IN is reached via BFS.
  nodes.forEach((node) => {
    if (!isSourceNode(node.type)) return
    if (node.data?.containerParent) return
    queue.push({ nodeId: node.id, order: 0 })
    nodeOrder.set(node.id, 0)
    visited.add(node.id)
  })
  
  // BFS traversal
  while (queue.length > 0) {
    const { nodeId, order } = queue.shift()
    
    // Find all edges starting from this node
    const outgoingEdges = edges.filter(e => e.source === nodeId)
    
    for (const edge of outgoingEdges) {
      const targetId = edge.target
      
      if (!visited.has(targetId)) {
        const nextOrder = order + 1
        nodeOrder.set(targetId, nextOrder)
        visited.add(targetId)
        queue.push({ nodeId: targetId, order: nextOrder })
      }
    }
  }
  
  return nodeOrder
}

/**
 * Calculate evaluation order for all edges
 * @param {Array} edges - Array of edge objects
 * @param {Array} nodes - Array of node objects
 * @returns {Array} Updated edges with order numbers
 */
export function calculateEdgeOrder(edges, nodes) {
  const isLogicNode = (type) => type === 'and' || type === 'or' || type === 'nof'
  
  // Calculate topological order for all nodes
  const nodeOrder = calculateTopologicalOrder(edges, nodes)
  
  // Group edges by target node (logic nodes)
  const edgesByTarget = {}
  
  edges.forEach(edge => {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (targetNode && isLogicNode(targetNode.type)) {
      if (!edgesByTarget[edge.target]) {
        edgesByTarget[edge.target] = []
      }
      edgesByTarget[edge.target].push(edge)
    }
  })
  
  // Calculate order for each logic node's incoming edges
  const updatedEdges = edges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target)
    
    // Only add order to edges connecting to logic nodes
    if (!targetNode || !isLogicNode(targetNode.type)) {
      return { ...edge, data: { ...(edge.data || {}), order: null } }
    }
    
    // Get all edges connecting to this logic node
    const incomingEdges = edgesByTarget[edge.target] || []
    
    if (incomingEdges.length <= 1) {
      // Single edge, no need for order number
      return { ...edge, data: { ...(edge.data || {}), order: null } }
    }
    
    // Sort edges by topological order of source nodes
    // If two nodes have the same order, break tie by node ID for stability
    const sortedEdges = [...incomingEdges].sort((a, b) => {
      const sourceNodeA = nodes.find(n => n.id === a.source)
      const sourceNodeB = nodes.find(n => n.id === b.source)
      
      if (!sourceNodeA || !sourceNodeB) return 0
      
      const orderA = nodeOrder.get(a.source) ?? Infinity
      const orderB = nodeOrder.get(b.source) ?? Infinity
      
      // Primary sort: topological order
      if (orderA !== orderB) {
        return orderA - orderB
      }
      
      // Secondary sort: node ID (for stability when order is same)
      return a.source.localeCompare(b.source)
    })
    
    // Find this edge's position in the sorted list
    const order = sortedEdges.findIndex(e => e.id === edge.id) + 1
    
    return {
      ...edge,
      data: {
        ...(edge.data || {}),
        order: order,
      },
    }
  })
  
  return updatedEdges
}
