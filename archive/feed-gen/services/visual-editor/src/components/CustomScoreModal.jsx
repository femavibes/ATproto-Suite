import React, { useState, useEffect } from 'react'
import './KeywordModal.css'

function CustomScoreModal({ isOpen, onClose, nodeId, score = 0, onSave }) {
  const [currentScore, setCurrentScore] = useState(score)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentScore(score)
      setError('')
    }
  }, [isOpen, score])

  const handleSave = () => {
    if (isNaN(currentScore)) {
      setError('Score must be a number')
      return
    }

    onSave(nodeId, {
      score: Number(currentScore),
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Custom Score</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Multipliers coming soon. Current behavior is flat additive points.
          </div>
          <div className="form-group">
            <label htmlFor="score">Score to Add:</label>
            <input
              id="score"
              type="number"
              value={currentScore}
              onChange={(e) => setCurrentScore(e.target.value ? Number(e.target.value) : 0)}
              placeholder="0"
            />
            <div className="form-hint">
              This score will be added to all posts that pass through this node. Can be positive or negative.
            </div>
          </div>

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

export default CustomScoreModal
