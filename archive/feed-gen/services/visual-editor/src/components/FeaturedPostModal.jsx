import React, { useState, useEffect } from 'react'
import './RotatingPostsModal.css'

function FeaturedPostModal({ isOpen, onClose, nodeId, position, apiEndpoint, name, onSave }) {
  const [localPosition, setLocalPosition] = useState(position || 1)
  const [localApiEndpoint, setLocalApiEndpoint] = useState(apiEndpoint || '')
  const [localName, setLocalName] = useState(name || '')

  useEffect(() => {
    if (isOpen) {
      setLocalPosition(position || 1)
      setLocalApiEndpoint(apiEndpoint || '')
      setLocalName(name || '')
    }
  }, [isOpen, position, apiEndpoint, name])

  const handleSave = () => {
    if (onSave && nodeId) {
      onSave(nodeId, {
        position: localPosition,
        apiEndpoint: localApiEndpoint,
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
          <h2>Featured Post</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Position</label>
            <input
              type="number"
              min="0"
              value={localPosition}
              onChange={(e) => setLocalPosition(parseInt(e.target.value) || 0)}
              placeholder="1"
            />
            <div className="form-hint">Fixed position in feed (0 = top)</div>
          </div>

          <div className="form-group">
            <label>API Endpoint (Optional)</label>
            <input
              type="text"
              value={localApiEndpoint}
              onChange={(e) => setLocalApiEndpoint(e.target.value)}
              placeholder="https://api.example.com/get-featured-post"
            />
            <div className="form-hint">External API that returns post URI. If empty, uses manual post URLs.</div>
          </div>

          <div className="form-group">
            <label>Node Name (Optional)</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Featured Content"
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

export default FeaturedPostModal
