import React from 'react'
import { Handle, Position } from 'reactflow'
import './NodeStyles.css'

function JunctionNode({ data, id }) {
  const edges = data?.edges || []
  const logicModeTop = data?.logicModeTop || 'and'
  const logicModeBottom = data?.logicModeBottom || 'and'
  const hasTopLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-top'))
  const hasBottomLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-bottom'))
  const name = data?.name || null
  const evaluationResult = data?.evaluationResult
  const evalColor = evaluationResult ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') : null

  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some(e => e.source === id && e.sourceHandle === handleId)
    } else {
      return edges.some(e => e.target === id && e.targetHandle === handleId)
    }
  }

  return (
    <div className={`node condition-node junction-node ${data?.isOrphaned ? 'orphaned' : ''}`} style={evalColor ? { borderColor: evalColor } : undefined} title="Junction - pass-through for organizing logic">
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
        className={`handle-logic ${hasTopLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasTopLogic && (
          <div className="port-mode-label" style={{ background: logicModeTop === 'and' ? '#4a9eff' : logicModeTop === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeTop === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('top', Math.max(1, (data?.logicNTop || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('top') }}>{data?.logicNTop || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('top', (data?.logicNTop || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('top') }}>
                {logicModeTop === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="logic-bottom"
        style={{ bottom: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className={`handle-logic ${hasBottomLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasBottomLogic && (
          <div className="port-mode-label" style={{ background: logicModeBottom === 'and' ? '#4a9eff' : logicModeBottom === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeBottom === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('bottom', Math.max(1, (data?.logicNBottom || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('bottom') }}>{data?.logicNBottom || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('bottom', (data?.logicNBottom || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('bottom') }}>
                {logicModeBottom === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        {name || 'Junction'}
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      <div className="node-subtitle">Pass-through</div>

    </div>
  )
}

export default JunctionNode
