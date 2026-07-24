/**
 * Keyboard Event Handlers
 * Handles keyboard shortcuts for the canvas
 */

/**
 * Handle node deletion with Delete/Backspace keys
 * Prevents deletion of START and END nodes
 * Shows confirmation prompt before deleting
 * Only works when not typing in an input/textarea
 */
export const handleNodeDeletion = (event, nodes, setNodes, setEdges) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    // Don't interfere if user is typing in an input field
    const target = event.target
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    
    event.preventDefault()
    const selectedNodes = nodes.filter((node) => node.selected)
    if (selectedNodes.length > 0) {
      // Don't allow deleting START or END nodes
      const deletableNodes = selectedNodes.filter(
        (node) => node.id !== 'start' && node.id !== 'end'
      )
      if (deletableNodes.length > 0) {
        const nodeCount = deletableNodes.length
        const nodeNames = deletableNodes.map(n => {
          const type = n.type === 'text' ? 'Text Contains' :
                       n.type === 'regex' ? 'Regex Contains' :
                       n.type === 'language' ? 'Language' :
                       n.type === 'posttype' ? 'Post Type' :
                       n.type === 'author' ? 'Author' :
                       n.type === 'media' ? 'Media Type' :
                       n.type === 'hashtag' ? 'Hashtag/Tags' :
                       n.type === 'labels' ? 'Labels' :
                       n.type === 'dateage' ? 'Post Date' :
                       n.type === 'and' ? 'AND' :
                       n.type === 'or' ? 'OR' :
                       n.type === 'nof' ? 'N-of' :
                       n.type
          return type
        }).join(', ')
        
        const message = nodeCount === 1
          ? `Delete "${nodeNames}"?`
          : `Delete ${nodeCount} nodes (${nodeNames})?`
        
        if (confirm(message)) {
          setNodes((nds) =>
            nds.filter((node) => !deletableNodes.includes(node))
          )
          // Also remove edges connected to deleted nodes
          const nodeIds = deletableNodes.map((n) => n.id)
          setEdges((eds) =>
            eds.filter(
              (edge) =>
                !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
            )
          )
        }
      }
    }
  }
}
