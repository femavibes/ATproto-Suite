import React from 'react'
import { Handle, Position } from 'reactflow'
import { useNavigation } from '../contexts/NavigationContext'
import './NodeStyles.css'

function LogicNode({ data, id }) {
  const { zoomIn } = useNavigation()
  const edges = data?.edges || []
  const childCount = data?.childCount || 0
  const isAnd = id.startsWith('and')
  const label = isAnd ? 'AND' : 'OR'
  const subtitle = isAnd ? 'All must match' : 'Any can match'
  const evaluationResult = data?.evaluationResult
  const baseColor = isAnd ? '#4a9eff' : '#ff9500'
  const color = evaluationResult 
    ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') 
    : baseColor
  const name = data?.name || null

  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some(e => e.source === id && e.sourceHandle === handleId)
    } else {
      return edges.some(e => e.target === id && e.targetHandle === handleId)
    }
  }

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    zoomIn(id, name || label)
  }

  return (
    <div
      className="node logic-node logic-block"
      style={{ borderColor: color }}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open"
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-left"
        style={{ top: '50%', left: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-input ${isHandleConnected('input-left', false) ? 'has-connection' : ''}`}
        isConnectable={true}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-right"
        style={{ top: '50%', right: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-output ${isHandleConnected('output-right', true) ? 'has-connection' : ''}`}
        isConnectable={true}
      />
      {/* Top/bottom ports for logic shortcut lines */}
      <Handle 
        type="source" 
        position={Position.Top} 
        id="logic-top"
        style={{ top: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className={`handle-logic ${isHandleConnected('logic-top', true) || isHandleConnected('logic-top', false) ? 'has-connection' : ''}`}
        isConnectable={true}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="logic-bottom"
        style={{ bottom: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className={`handle-logic ${isHandleConnected('logic-bottom', true) || isHandleConnected('logic-bottom', false) ? 'has-connection' : ''}`}
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
      <div className="node-subtitle">{subtitle}</div>
      {childCount > 0 && (
        <div className="node-subtitle">{childCount} item{childCount !== 1 ? 's' : ''} inside</div>
      )}
      <div className="node-subtitle" style={{ color: '#555', fontSize: '9px' }}>Double-click to open</div>
    </div>
  )
}

export default LogicNode
