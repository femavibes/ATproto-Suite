import React from 'react'
import { Handle, Position } from 'reactflow'
import { ChronologicalIcon, ByScoreIcon, MostLikesIcon, MostEngagementIcon, RandomIcon } from '../components/Icons'
import './NodeStyles.css'

const FIXED_SORTING_LABELS = {
  fixedchronological: 'Fixed Chronological',
  fixedbyscore: 'Fixed By Score',
  fixedmostlikes: 'Fixed Most Likes',
  fixedmostengagement: 'Fixed Most Engagement',
  fixedrandom: 'Fixed Random',
}

const getFixedSortingIcon = (type) => {
  const iconProps = { size: 20, className: 'node-icon' }
  switch (type) {
    case 'fixedchronological':
      return <ChronologicalIcon {...iconProps} />
    case 'fixedbyscore':
      return <ByScoreIcon {...iconProps} />
    case 'fixedmostlikes':
      return <MostLikesIcon {...iconProps} />
    case 'fixedmostengagement':
      return <MostEngagementIcon {...iconProps} />
    case 'fixedrandom':
      return <RandomIcon {...iconProps} />
    default:
      return null
  }
}

function FixedSortingNode({ data, id, selected }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure

  const label = FIXED_SORTING_LABELS[type] || type
  const blockIcon = getFixedSortingIcon(type)
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
      className={`node fixed-sorting-node ${onConfigure ? 'clickable' : ''}`}
      style={{ borderColor: '#ffd43b' }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure fixed sorting' : undefined}
    >
      {/* Centered top - OUTPUT (connects to other fixed position/sorting nodes, sorting nodes, or END right input) */}
      <Handle
        type="source"
        position={Position.Top}
        id="output-top"
        style={{ top: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
        className={`handle-fixed-position handle-output ${isHandleConnected('output-top', true) ? 'has-connection' : ''}`}
        isConnectable={true}
      />

      {/* Centered bottom - INPUT (receives from other fixed position/sorting nodes) */}
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
      {type === 'fixedchronological' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.startPosition !== undefined && data?.endPosition !== undefined
            ? `Pos ${data.startPosition}-${data.endPosition}`
            : data?.startPosition !== undefined
            ? `From pos ${data.startPosition}`
            : 'Configure position range'}
          {data?.order && ` • ${data.order === 'newest' ? 'Newest' : 'Oldest'}`}
        </div>
      )}

      {(type === 'fixedbyscore' || type === 'fixedmostlikes' || type === 'fixedmostengagement' || type === 'fixedrandom') && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.startPosition !== undefined && data?.endPosition !== undefined
            ? `Pos ${data.startPosition}-${data.endPosition}`
            : data?.startPosition !== undefined
            ? `From pos ${data.startPosition}`
            : 'Configure position range'}
        </div>
      )}
    </div>
  )
}

export default FixedSortingNode
