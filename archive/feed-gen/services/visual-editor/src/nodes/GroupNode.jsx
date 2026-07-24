import React from 'react'
import { Handle, Position } from 'reactflow'
import { useNavigation } from '../contexts/NavigationContext'
import './NodeStyles.css'

function GroupNode({ data, id, type }) {
  const { zoomIn } = useNavigation()
  const edges = data?.edges || []
  const childCount = data?.childCount || 0
  const evaluationResult = data?.evaluationResult
  const name = data?.name || 'Group'
  const color = evaluationResult 
    ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') 
    : '#888'
  const isNof = typeof data?.n !== 'undefined'
  const n = isNof ? (data.n || 2) : null

  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some(e => e.source === id && e.sourceHandle === handleId)
    } else {
      return edges.some(e => e.target === id && e.targetHandle === handleId)
    }
  }

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    zoomIn(id, name, { view: 'group' })
  }

  return (
    <div
      className={`node logic-node logic-block ${data?.isOrphaned ? 'orphaned' : ''}`}
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
        {name}
        {isNof && (
          <span style={{ marginLeft: 6, background: '#9b59b6', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
            N = {n}
          </span>
        )}
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      {isNof && (
        <div className="node-subtitle">
          At least {n} of {childCount > 0 ? childCount : '?'} must pass
        </div>
      )}
      {childCount > 0 && !isNof && (
        <div className="node-subtitle">{childCount} item{childCount !== 1 ? 's' : ''} inside</div>
      )}
      {isNof && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 4, fontSize: 10, padding: '2px 8px' }}
          onClick={(e) => { e.stopPropagation(); data?.onConfigure?.() }}
        >
          Set N
        </button>
      )}
      <div className="node-subtitle" style={{ color: '#555', fontSize: '9px' }}>
        {type === 'logicgroup'
          ? 'Double-click to open nested canvas (organize).'
          : 'Double-click to open — use Logic (AND/OR/N-of) on the main canvas for resizable filter boxes.'}
      </div>
    </div>
  )
}

export default GroupNode
