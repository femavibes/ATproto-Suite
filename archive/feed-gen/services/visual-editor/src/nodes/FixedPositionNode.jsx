import React from 'react'
import { Handle, Position } from 'reactflow'
import { DynamicPinnedIcon, FeaturedPostIcon } from '../components/Icons'
import './NodeStyles.css'

const FIXED_POSITION_LABELS = {
  pinnedposts: 'Pinned Posts',
  dynamicpinned: 'Dynamic Pinned',
  featuredpost: 'Featured Post',
}

const getFixedPositionIcon = (type) => {
  const iconProps = { size: 20, className: 'node-icon' }
  switch (type) {
    case 'dynamicpinned':
      return <DynamicPinnedIcon {...iconProps} />
    case 'pinnedposts':
      return <DynamicPinnedIcon {...iconProps} />
    case 'featuredpost':
      return <FeaturedPostIcon {...iconProps} />
    default:
      return null
  }
}

function FixedPositionNode({ data, id, selected }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure

  const label = FIXED_POSITION_LABELS[type] || type
  const blockIcon = getFixedPositionIcon(type)
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
      className={`node fixed-position-node ${onConfigure ? 'clickable' : ''}`}
      style={{ borderColor: '#ffd43b' }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure fixed position' : undefined}
    >
      {/* Centered top - OUTPUT (connects to other fixed position nodes, sorting nodes, or END right input) */}
      <Handle
        type="source"
        position={Position.Top}
        id="output-top"
        style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-fixed-position handle-output ${isHandleConnected('output-top', true) ? 'has-connection' : ''}`}
        isConnectable={true}
      />

      {/* Centered bottom - INPUT (receives from other fixed position nodes) */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="input-bottom"
        style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-fixed-position handle-input ${isHandleConnected('input-bottom', false) ? 'has-connection' : ''}`}
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
      {type === 'pinnedposts' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {Array.isArray(data?.items) && data.items.length > 0
            ? `${data.items.length} pinned item${data.items.length === 1 ? '' : 's'}`
            : 'Configure pinned posts'}
        </div>
      )}

      {type === 'dynamicpinned' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.position !== undefined ? `Position ${data.position}` : 'Configure position'}
          {data?.apiEndpoint && ` • API`}
        </div>
      )}

      {type === 'featuredpost' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.position !== undefined ? `Position ${data.position}` : 'Configure position'}
          {data?.apiEndpoint && ` • API`}
        </div>
      )}
    </div>
  )
}

export default FixedPositionNode
