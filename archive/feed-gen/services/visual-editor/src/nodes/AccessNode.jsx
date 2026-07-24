import React from 'react'
import { Handle, Position } from 'reactflow'
import { WhitelistIcon } from '../components/Icons'
import './NodeStyles.css'

const ACCESS_LABELS = {
  whitelist: 'Whitelist',
}

function AccessNode({ data, id }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure

  const label = ACCESS_LABELS[type] || type
  const name = data?.name
  const allowed = data?.allowedDids || []

  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some((e) => e.source === id && e.sourceHandle === handleId)
    }
    return edges.some((e) => e.target === id && e.targetHandle === handleId)
  }

  const handleClick = (e) => {
    if (onConfigure) {
      e.stopPropagation()
      onConfigure()
    }
  }

  return (
    <div
      className={`node access-node ${onConfigure ? 'clickable' : ''}`}
      style={{ borderColor: '#20c997' }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure allowed viewers' : undefined}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-bottom"
        style={{
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
        className={`handle-flow handle-output ${isHandleConnected('output-bottom', true) ? 'has-connection' : ''}`}
        isConnectable
      />

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <WhitelistIcon size={20} className="node-icon" />
        </span>
        <span>{label}</span>
      </div>

      {name && <div className="node-subname">{name}</div>}

      <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
        {allowed.length ? `${allowed.length} DID(s)` : 'Open — click to restrict'}
      </div>
    </div>
  )
}

export default AccessNode
