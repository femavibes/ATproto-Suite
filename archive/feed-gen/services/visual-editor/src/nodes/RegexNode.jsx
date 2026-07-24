import React from 'react'
import { Handle, Position } from 'reactflow'
import { getFieldLabel } from '../constants/textFields'
import { RegexIcon } from '../components/Icons'
import './NodeStyles.css'

const getRegexBlockLabel = (exclude) => {
  return exclude ? 'Regex Excludes' : 'Regex Contains'
}

/**
 * Regex Node
 * 
 * HOW IT WORKS:
 * - Uses JavaScript RegExp for pattern matching
 * - Supports all ES2018+ regex features
 * - Searches selected fields (text, alt text, link URLs, etc.)
 * - Matches if pattern matches ANY of the selected fields
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - pattern: Regex pattern string
 * - fields: Array of field paths to search
 * - flags: Regex flags (g, i, m)
 * - exclude: Boolean for exclude mode
 * 
 * See RegexModal.jsx for detailed documentation
 */
function RegexNode({ data, id, selected }) {
  const exclude = data?.exclude || false
  const label = getRegexBlockLabel(exclude)
  const color = exclude ? '#ff6b6b' : '#6b7280' // Red for exclude mode

  const pattern = data?.pattern || ''
  const subName = data?.name // Sub-name/label
  const fields = data?.fields || ['text'] // Selected fields to search
  const fieldCount = fields.length
  const hasPattern = pattern.trim().length > 0

  const handleClick = (e) => {
    e.stopPropagation()
    // Trigger modal open - will be handled by parent
    if (data?.onConfigure) {
      data.onConfigure()
    }
  }

  const blockIcon = <RegexIcon size={20} />

  return (
    <div
      className="node condition-node clickable"
      style={{ borderColor: color }}
      onClick={handleClick}
      title="Click to configure regex pattern (uses regex matching)"
    >
      {/* Connection handles - 8 total: input and output on each side (same as ConditionNode) */}
      {/* Left side - OR logic: Top = INPUT, Bottom = OUTPUT (opposite of right) */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-left"
        style={{ top: '20%', left: '-10px', zIndex: 10 }}
        className="handle-or handle-input"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="output-left"
        style={{ top: '80%', left: '-10px', zIndex: 10 }}
        className="handle-or handle-output"
      />
      {/* Right side - OR logic / continue flow: Top = OUTPUT, Bottom = INPUT */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-right"
        style={{ top: '20%', right: '-10px', zIndex: 10 }}
        className="handle-or handle-continue handle-output"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="input-right"
        style={{ top: '80%', right: '-10px', zIndex: 10 }}
        className="handle-or handle-continue handle-input"
      />
      {/* Top side - AND logic: Left = INPUT, Right = OUTPUT */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="input-top"
        style={{ top: '-10px', left: '20%', zIndex: 10 }}
        className="handle-and handle-input"
      />
      <Handle 
        type="source" 
        position={Position.Top} 
        id="output-top"
        style={{ top: '-10px', left: '80%', zIndex: 10 }}
        className="handle-and handle-output"
      />
      {/* Bottom side - AND logic: Left = OUTPUT, Right = INPUT (opposite of top) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="output-bottom"
        style={{ bottom: '-10px', left: '20%', zIndex: 10 }}
        className="handle-and handle-output"
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="input-bottom"
        style={{ bottom: '-10px', left: '80%', zIndex: 10 }}
        className="handle-and handle-input"
      />

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">{blockIcon}</span>
        {label}
      </div>
      {subName && (
        <div className="node-subname">{subName}</div>
      )}
      {hasPattern && (
        <div className="node-subtitle" style={{ fontFamily: 'monospace', fontSize: '9px' }}>
          /{pattern.substring(0, 20)}{pattern.length > 20 ? '...' : ''}/
        </div>
      )}
      {fieldCount > 0 && (
        <div className="node-subtitle" style={{ fontSize: '9px', color: '#666' }}>
          {fieldCount === 1 
            ? getFieldLabel(fields[0])
            : `${fieldCount} fields`}
        </div>
      )}
      {!hasPattern && (
        <div className="node-subtitle" style={{ color: '#888', fontStyle: 'italic' }}>
          Click to configure
        </div>
      )}
    </div>
  )
}

export default RegexNode
