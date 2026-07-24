import React, { useState, useEffect } from 'react'
import './ChronologicalModal.css'

function ChronologicalModal({ isOpen, onClose, nodeId, order = 'newest', onSave }) {
  const [localOrder, setLocalOrder] = useState(order)
  const [localName, setLocalName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalOrder(order || 'newest')
      setLocalName('')
    }
  }, [isOpen, order])

  const handleSave = () => {
    onSave({
      nodeId,
      order: localOrder,
      name: localName.trim() || null,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content chronological-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chronological Sort</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Node Name (optional)</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g., Newest First"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Sort Order</label>
            <select
              value={localOrder}
              onChange={(e) => setLocalOrder(e.target.value)}
              className="form-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <p className="form-hint">
              {localOrder === 'newest' && 'Most recent posts appear at the top of the feed.'}
              {localOrder === 'oldest' && 'Oldest posts appear at the top of the feed.'}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChronologicalModal
