import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

const STRUCTURE_TYPES = [
  { value: 'is_reply', label: 'Is Reply' },
  { value: 'is_quote', label: 'Is Quote' },
  { value: 'has_quote', label: 'Has Quote' },
  { value: 'reply_depth', label: 'Reply Depth' },
]

const REPLY_DEPTH_OPERATORS = [
  { value: 'equals', label: 'Equals (=)', symbol: '=' },
  { value: 'greater_than', label: 'Greater than (>)', symbol: '>' },
  { value: 'greater_equal', label: 'Greater than or equal (≥)', symbol: '≥' },
  { value: 'less_than', label: 'Less than (<)', symbol: '<' },
  { value: 'less_equal', label: 'Less than or equal (≤)', symbol: '≤' },
]

function PostStructureModal({ isOpen, onClose, nodeId, structureType = 'is_reply', operator = 'equals', depth = 1, onSave }) {
  const [currentStructureType, setCurrentStructureType] = useState(structureType)
  const [currentOperator, setCurrentOperator] = useState(operator)
  const [currentDepth, setCurrentDepth] = useState(depth)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentStructureType(structureType)
      setCurrentOperator(operator)
      setCurrentDepth(depth)
      setError('')
    }
  }, [isOpen, structureType, operator, depth])

  const handleSave = () => {
    if (currentStructureType === 'reply_depth') {
      const depthNum = parseInt(currentDepth, 10)
      if (isNaN(depthNum) || depthNum < 1) {
        setError('Reply depth must be a positive number (1 or greater)')
        return
      }
    }

    onSave(nodeId, {
      structureType: currentStructureType,
      operator: currentStructureType === 'reply_depth' ? currentOperator : undefined,
      depth: currentStructureType === 'reply_depth' ? parseInt(currentDepth, 10) : undefined,
    })
    onClose()
  }

  if (!isOpen) return null

  const selectedOperator = REPLY_DEPTH_OPERATORS.find(op => op.value === currentOperator)
  const isReplyDepth = currentStructureType === 'reply_depth'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Post Structure</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="structureType">Structure Type:</label>
            <select
              id="structureType"
              value={currentStructureType}
              onChange={(e) => setCurrentStructureType(e.target.value)}
            >
              {STRUCTURE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div className="form-hint" style={{ marginTop: '5px', fontSize: '12px', color: '#888' }}>
              {currentStructureType === 'is_reply' && 'Checks if post is a reply (has reply.parent.uri or reply.root.uri)'}
              {currentStructureType === 'is_quote' && 'Checks if post is a quote post (embed.$type is app.bsky.embed.record or app.bsky.embed.recordWithMedia)'}
              {currentStructureType === 'has_quote' && 'Checks if post contains a quoted post (has embed.record.uri)'}
              {currentStructureType === 'reply_depth' && 'Checks reply depth in thread (requires database lookup for exact depth)'}
            </div>
          </div>

          {isReplyDepth && (
            <>
              <div className="form-group">
                <label htmlFor="operator">Comparison:</label>
                <select
                  id="operator"
                  value={currentOperator}
                  onChange={(e) => setCurrentOperator(e.target.value)}
                >
                  {REPLY_DEPTH_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="depth">Depth:</label>
                <input
                  id="depth"
                  type="number"
                  min="1"
                  value={currentDepth}
                  onChange={(e) => {
                    const val = e.target.value
                    setCurrentDepth(val === '' ? '' : parseInt(val, 10))
                  }}
                  placeholder="1"
                />
                <div className="form-hint">
                  Reply depth {selectedOperator?.symbol || '='} {currentDepth || 1}
                </div>
              </div>
            </>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="modal-footer">
          <button onClick={handleSave} className="btn-primary">Save</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default PostStructureModal
