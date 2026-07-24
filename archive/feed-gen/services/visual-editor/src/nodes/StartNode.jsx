import React from 'react'
import { Handle, Position } from 'reactflow'
import { StartIcon } from '../components/Icons'
import './NodeStyles.css'

/**
 * START Block
 *
 * Root-level only: Jetstream / default graph entry. Inner groups use ContainerInNode (IN).
 */
function StartNode({ data, id }) {
  const onDelete = data?.onDelete
  const onDebug = data?.onDebug
  const onTest = data?.onTest
  const edges = data?.edges || []
  const isConnected = edges.some((e) => e.source === id && e.sourceHandle === 'output-right')

  const handleClick = (e) => {
    if (e.button === 0 && onDebug) {
      e.stopPropagation()
      onDebug()
    }
  }

  const handleContextMenu = (e) => {
    if (onTest) {
      e.preventDefault()
      e.stopPropagation()
      onTest()
    }
  }

  return (
    <div
      className="node start-node"
      title="Incoming posts from database (Jetstream ingestion). Left-click: Debug by URL, Right-click: Test Post"
      onClick={onDebug ? handleClick : undefined}
      onContextMenu={onTest ? handleContextMenu : undefined}
      style={onDebug || onTest ? { cursor: 'pointer' } : undefined}
    >
      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <StartIcon size={18} />
        </span>
        START
      </div>
      <div className="node-subtitle">Click to debug</div>
      <Handle
        type="source"
        position={Position.Right}
        id="output-right"
        style={{ top: '50%', right: '-10px' }}
        className={`handle-flow handle-output ${isConnected ? 'has-connection' : ''}`}
      />
    </div>
  )
}

export default StartNode
