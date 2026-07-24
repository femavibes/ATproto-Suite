import React from 'react'
import { Handle, Position, useEdges } from 'reactflow'
import { EndIcon } from '../components/Icons'
import './NodeStyles.css'

/**
 * OUT — subgraph exit inside a Group. Not a feed END: no feed pipeline canvas
 * (sorting / injection / fixed / access belong on canvas-level END nodes only).
 */
function ContainerOutNode({ data, id }) {
  const rfEdges = useEdges()
  const isLeftConnected = rfEdges.some((e) => e.target === id && e.targetHandle === 'input-left')

  return (
    <div
      className="node end-node"
      title="Group exit: flow returns to the parent. Feed pipeline (sort, inject, etc.) is configured on the canvas END node for each feed."
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input-left"
        style={{ top: '50%', left: '-10px' }}
        className={`handle-flow handle-input ${isLeftConnected ? 'has-connection' : ''}`}
      />
      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <EndIcon size={18} />
        </span>
        {data?.name?.trim() ? data.name.trim() : 'OUT'}
      </div>
      <div className="node-subtitle">Out of this group</div>
    </div>
  )
}

export default ContainerOutNode
