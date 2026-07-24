import React, { useState, useEffect } from 'react'
import './RotatingPostsModal.css'

function FixedByScoreModal({ isOpen, onClose, nodeId, startPosition, endPosition, name, onSave }) {
  const [localStartPosition, setLocalStartPosition] = useState(startPosition !== undefined ? startPosition : '')
  const [localEndPosition, setLocalEndPosition] = useState(endPosition !== undefined ? endPosition : '')
  const [localName, setLocalName] = useState(name || '')

  useEffect(() => {
    if (isOpen) {
      setLocalStartPosition(startPosition !== undefined ? startPosition : '')
      setLocalEndPosition(endPosition !== undefined ? endPosition : '')
      setLocalName(name || '')
    }
  }, [isOpen, startPosition, endPosition, name])

  const handleSave = () => {
    if (onSave && nodeId) {
      onSave(nodeId, {
        startPosition: localStartPosition === '' ? undefined : parseInt(localStartPosition) || undefined,
        endPosition: localEndPosition === '' ? undefined : parseInt(localEndPosition) || undefined,
        name: localName,
      })
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Fixed By Score Sort</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Start Position (Optional)</label>
            <input
              type="number"
              min="0"
              value={localStartPosition}
              onChange={(e) => setLocalStartPosition(e.target.value)}
              placeholder="Leave empty for all posts"
            />
            <div className="form-hint">Sort posts starting from this position (0 = top). Leave empty to sort all posts.</div>
          </div>

          <div className="form-group">
            <label>End Position (Optional)</label>
            <input
              type="number"
              min="0"
              value={localEndPosition}
              onChange={(e) => setLocalEndPosition(e.target.value)}
              placeholder="Leave empty for all posts"
            />
            <div className="form-hint">Sort posts up to this position. Leave empty to sort all posts from start position.</div>
          </div>

          <div className="form-group">
            <label>Node Name (Optional)</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Fixed By Score Sort"
            />
            <div className="form-hint">Name this node for easier identification</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default FixedByScoreModal
