import React from 'react'
import { Handle, Position } from 'reactflow'
import './NodeStyles.css'

const MODES = [
  { id: 'and', label: 'AND', color: '#4a9eff' },
  { id: 'or', label: 'OR', color: '#ff9500' },
  { id: 'nof', label: 'N-of', color: '#9b59b6' },
]

function LogicContainerNode({ data, id }) {
  const edges = data?.edges || []
  const mode = String(data?.logicContainerMode || 'and').toLowerCase()
  const n = Math.max(1, Math.min(99, Number(data?.logicN) || 2))
  const evaluationResult = data?.evaluationResult
  const baseTint = mode === 'or' ? '#3a2a18' : mode === 'nof' ? '#2d2238' : '#1a2d40'

  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some((e) => e.source === id && e.sourceHandle === handleId)
    }
    return edges.some((e) => e.target === id && e.targetHandle === handleId)
  }

  return (
    <div
      className={`logic-container-node logic-node ${data?.isOrphaned ? 'orphaned' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 160,
        background: `linear-gradient(180deg, ${baseTint} 0%, #1e1e1e 38%, #252525 100%)`,
        border: `2px solid ${mode === 'or' ? '#ff9500' : mode === 'nof' ? '#9b59b6' : '#4a9eff'}`,
        borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: 0,
        textAlign: 'left',
      }}
      title="Drag filters into this box. Green flow runs through the box; combine mode is chosen below."
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input-left"
        style={{ top: '50%', left: '-10px', zIndex: 20, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-input ${isHandleConnected('input-left', false) ? 'has-connection' : ''}`}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output-right"
        style={{ top: '50%', right: '-10px', zIndex: 20, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-output ${isHandleConnected('output-right', true) ? 'has-connection' : ''}`}
        isConnectable
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Combine</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className="logic-container-mode-btn"
            style={{
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              border: mode === m.id ? `2px solid ${m.color}` : '1px solid #444',
              background: mode === m.id ? `${m.color}33` : '#2a2a2a',
              color: mode === m.id ? '#fff' : '#aaa',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              data?.onSetLogicContainerMode?.(m.id)
            }}
          >
            {m.label}
          </button>
        ))}
        {mode === 'nof' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
            <button
              type="button"
              className="logic-container-mode-btn"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: '1px solid #555',
                background: '#333',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
              onClick={(e) => {
                e.stopPropagation()
                data?.onAdjustLogicN?.(-1)
              }}
            >
              −
            </button>
            <span style={{ fontSize: 12, color: '#e0e0e0', minWidth: 52, textAlign: 'center' }}>
              N = <strong>{n}</strong>
            </span>
            <button
              type="button"
              className="logic-container-mode-btn"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: '1px solid #555',
                background: '#333',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
              onClick={(e) => {
                e.stopPropagation()
                data?.onAdjustLogicN?.(1)
              }}
            >
              +
            </button>
          </span>
        )}
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order" style={{ marginLeft: 'auto' }}>
            #{data.ingestionRunOrder}
          </span>
        )}
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
            style={{ marginLeft: mode === 'nof' ? 4 : 'auto' }}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 72,
          margin: 8,
          borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

export default LogicContainerNode
