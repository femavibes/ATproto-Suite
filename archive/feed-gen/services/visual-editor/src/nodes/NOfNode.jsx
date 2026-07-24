import React from 'react'
import { Handle, Position } from 'reactflow'
import { useNavigation } from '../contexts/NavigationContext'
import './NodeStyles.css'

function NOfNode({ data, id }) {
  const { zoomIn } = useNavigation()
  const n = (typeof data?.n === 'number' && data.n >= 1) ? data.n : 2
  const childCount = data?.childCount || 0
  const onConfigure = data?.onConfigure
  const evaluationResult = data?.evaluationResult
  const baseColor = '#9b59b6'
  const color = evaluationResult 
    ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') 
    : baseColor
  const name = data?.name || null
  const label = childCount > 0 ? `${n} of ${childCount}` : `At least ${n}`

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    zoomIn(id, name || label)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (onConfigure) onConfigure()
  }

  return (
    <div
      className="node logic-node logic-block"
      style={{ borderColor: color }}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      title="Double-click to open, click to configure N"
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-left"
        style={{ top: '50%', left: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className="handle-flow handle-input"
        isConnectable={true}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-right"
        style={{ top: '50%', right: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className="handle-flow handle-output"
        isConnectable={true}
      />
      {/* Top/bottom ports for logic shortcut lines */}
      <Handle 
        type="source" 
        position={Position.Top} 
        id="logic-top"
        style={{ top: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className="handle-logic"
        isConnectable={true}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="logic-bottom"
        style={{ bottom: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className="handle-logic"
        isConnectable={true}
      />

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="logic-badge" style={{ background: baseColor }}>{label}</span>
        {name && <span>{name}</span>}
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      <div className="node-subtitle">At least {n} must match</div>
      {childCount > 0 && (
        <div className="node-subtitle">{childCount} item{childCount !== 1 ? 's' : ''} inside</div>
      )}
      <div className="node-subtitle" style={{ color: '#555', fontSize: '9px' }}>Double-click to open</div>
    </div>
  )
}

export default NOfNode
