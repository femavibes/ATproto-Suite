import React from 'react'
import './NodeDeleteButton.css'

/**
 * Delete button for nodes
 * Appears on hover in the top-right corner of nodes
 */
function NodeDeleteButton({ onDelete, nodeId }) {
  return (
    <button
      className="node-delete-button"
      onClick={(e) => {
        e.stopPropagation()
        onDelete(nodeId)
      }}
      title="Delete node"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="3" x2="11" y2="11" />
        <line x1="11" y1="3" x2="3" y2="11" />
      </svg>
    </button>
  )
}

export default NodeDeleteButton
