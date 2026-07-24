import React from 'react'
import { Handle, Position } from 'reactflow'
import { ChronologicalIcon, ByScoreIcon, MostLikesIcon, MostEngagementIcon, RandomIcon } from '../components/Icons'
import './NodeStyles.css'

const SORTING_LABELS = {
  chronological: 'Chronological',
  byscore: 'By Score',
  mostlikes: 'Most Likes',
  mostengagement: 'Most Engagement',
  random: 'Random',
}

const getSortingIcon = (type) => {
  const iconProps = { size: 20, className: 'node-icon' }
  switch (type) {
    case 'chronological':
      return <ChronologicalIcon {...iconProps} />
    case 'byscore':
      return <ByScoreIcon {...iconProps} />
    case 'mostlikes':
      return <MostLikesIcon {...iconProps} />
    case 'mostengagement':
      return <MostEngagementIcon {...iconProps} />
    case 'random':
      return <RandomIcon {...iconProps} />
    default:
      return null
  }
}

function SortingNode({ data, id, selected }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure
  
  const label = SORTING_LABELS[type] || type
  const blockIcon = getSortingIcon(type)
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
      className={`node sorting-node ${onConfigure ? 'clickable' : ''}`}
      style={{ borderColor: '#9775fa' }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure sorting' : undefined}
    >
      {/* Centered top - OUTPUT (connects to other sorting nodes or injection nodes) */}
      <Handle 
        type="source" 
        position={Position.Top} 
        id="output-top"
        style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-flow handle-output ${isHandleConnected('output-top', true) ? 'has-connection' : ''}`}
        isConnectable={true}
      />
      
      {/* Centered bottom - INPUT (receives from other sorting nodes or main flow) */}
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="input-bottom"
        style={{ bottom: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-flow handle-input ${isHandleConnected('input-bottom', false) ? 'has-connection' : ''}`}
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
      {type === 'chronological' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.order === 'newest' ? 'Newest first' : data?.order === 'oldest' ? 'Oldest first' : 'Configure order'}
        </div>
      )}

      {type === 'byscore' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          Sort by score
        </div>
      )}

      {type === 'mostlikes' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          Most likes first
        </div>
      )}

      {type === 'mostengagement' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          Most engagement first
        </div>
      )}

      {type === 'random' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          Random shuffle
        </div>
      )}
    </div>
  )
}

export default SortingNode
