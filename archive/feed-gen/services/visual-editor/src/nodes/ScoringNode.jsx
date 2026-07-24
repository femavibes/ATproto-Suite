import React from 'react'
import { Handle, Position } from 'reactflow'
import { RecencyIcon, ScoreIcon, CustomScoreIcon } from '../components/Icons'
import './NodeStyles.css'

// Scoring nodes are always tier 0 (always-pass, no filtering value)

const SCORING_LABELS = {
  recency: 'Recency Boost',
  engagementscore: 'Engagement Score',
  customscore: 'Custom Score',
}

const getScoringIcon = (type) => {
  const iconProps = { size: 20, className: 'node-icon' }
  switch (type) {
    case 'recency':
      return <RecencyIcon {...iconProps} />
    case 'engagementscore':
      return <ScoreIcon {...iconProps} />
    case 'customscore':
      return <CustomScoreIcon {...iconProps} />
    default:
      return null
  }
}

function ScoringNode({ data, id, selected }) {
  const edges = data?.edges || []
  const type = id.split('-')[0]
  const onConfigure = data?.onConfigure
  const evaluationResult = data?.evaluationResult

  const label = SCORING_LABELS[type] || type
  const blockIcon = getScoringIcon(type)
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
      className={`node scoring-node ${data?.costOrderWarning ? 'has-cost-order-warning' : ''} ${onConfigure ? 'clickable' : ''}`}
      style={{
        borderColor: evaluationResult ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') : '#748ffc',
      }}
      onClick={onConfigure ? handleClick : undefined}
      title={onConfigure ? 'Click to configure scoring' : undefined}
    >
      {data?.costOrderWarning && (
        <div className="cost-order-banner" role="alert">
          ⚠ Cost order: {data.costOrderWarning}
        </div>
      )}
      {/* Left side - Green FLOW: Single INPUT */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-left"
        style={{ top: '50%', left: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-input ${isHandleConnected('input-left', false) ? 'has-connection' : ''}`}
        isConnectable={true}
      />
      {/* Right side - Green FLOW: Single OUTPUT */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-right"
        style={{ top: '50%', right: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-flow handle-output ${isHandleConnected('output-right', true) ? 'has-connection' : ''}`}
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
        <span className="cost-tier-badge cost-tier-always" title="Always passes — no filtering cost">always</span>
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>

      {name && (
        <div className="node-subname">{name}</div>
      )}

      {/* Display scoring configuration */}
      {type === 'recency' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.decayHours ? `Decay: ${data.decayHours}h` : 'Configure decay'}
        </div>
      )}

      {type === 'engagementscore' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.weights ? `Weights configured` : 'Configure weights'}
        </div>
      )}

      {type === 'customscore' && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
          {data?.score !== undefined ? `Score: ${data.score}` : 'Set score'}
        </div>
      )}
    </div>
  )
}

export default ScoringNode
