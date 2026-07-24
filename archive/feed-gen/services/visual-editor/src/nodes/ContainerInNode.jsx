import React from 'react'
import { Handle, Position } from 'reactflow'
import { StartIcon } from '../components/Icons'
import './NodeStyles.css'

/**
 * IN — subgraph entry inside a Group (logic group). Same flow role as the old inner START;
 * not a separate Jetstream source.
 */
function ContainerInNode({ data, id }) {
  const edges = data?.edges || []
  const isConnected = edges.some((e) => e.source === id && e.sourceHandle === 'output-right')

  return (
    <div
      className="node start-node"
      title="Group entry: flow continues from the parent into this subgraph. Not Jetstream."
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
        IN
      </div>
      <div className="node-subtitle">Into this group</div>
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

export default ContainerInNode
