import React from 'react'
import { Handle, Position } from 'reactflow'
import { RotatingPostsIcon } from '../components/Icons'
import './NodeStyles.css'

const INJECTION_LABELS = {
  rotatingposts: 'Rotating Posts',
  feedads: 'Ads',
}

const getInjectionIcon = (type) => {
  const iconProps = { size: 20, className: 'node-icon' }
  switch (type) {
    case 'rotatingposts':
    case 'feedads':
      return <RotatingPostsIcon {...iconProps} />
    default:
      return null
  }
}

function InjectionNode({ data, id, selected }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure
  
  const label = INJECTION_LABELS[type] || type
  const blockIcon = getInjectionIcon(type)
  const name = data?.name

  // Check if handles are connected
  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some(e => e.source === id && e.sourceHandle === handleId)
    } else {
      return edges.some(e => e.target === id && e.targetHandle === handleId)
    }
  }

  const handleClick = (e) => {
    if (onConfigure) {
      e.stopPropagation()
      onConfigure()
    }
  }

  return (
    <div
      className={`node injection-node ${onConfigure ? 'clickable' : ''}`}
      style={{ borderColor: '#ff6b6b' }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure injection' : undefined}
    >
      {/* Top input — upstream injection or sorting (output-top) */}
      <Handle
        type="target"
        position={Position.Top}
        id="input-top"
        style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-flow handle-input ${isHandleConnected('input-top', false) ? 'has-connection' : ''}`}
        isConnectable
      />

      {/* Bottom output — downstream injection or END top */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="output-bottom"
        style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-flow handle-output ${isHandleConnected('output-bottom', true) ? 'has-connection' : ''}`}
        isConnectable={true}
      />

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        {blockIcon && <span className="node-icon-wrapper">{blockIcon}</span>}
        <span>{label}</span>
      </div>

      {name && (
        <div className="node-subname">{name}</div>
      )}

      {/* Display configuration summary */}
      {(type === 'rotatingposts' || type === 'feedads') && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.postUrls?.length ? `${data.postUrls.length} posts` : 'Add posts'}
          {data?.strategy && ` • ${data.strategy}`}
        </div>
      )}
    </div>
  )
}

export default InjectionNode
