import React, { useState, useEffect } from 'react'
import './KeywordModal.css'

function RecencyBoostModal({ isOpen, onClose, nodeId, decayHours = 24, maxBoost = 100, onSave }) {
  const [currentDecayHours, setCurrentDecayHours] = useState(decayHours)
  const [currentMaxBoost, setCurrentMaxBoost] = useState(maxBoost)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentDecayHours(decayHours)
      setCurrentMaxBoost(maxBoost)
      setError('')
    }
  }, [isOpen, decayHours, maxBoost])

  const handleSave = () => {
    if (currentDecayHours <= 0) {
      setError('Decay hours must be greater than 0')
      return
    }
    if (currentMaxBoost < 0) {
      setError('Max boost cannot be negative')
      return
    }

    onSave(nodeId, {
      decayHours: Number(currentDecayHours),
      maxBoost: Number(currentMaxBoost),
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Recency Boost</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="decayHours">Decay Half-Life (hours):</label>
            <input
              id="decayHours"
              type="number"
              min="0.1"
              step="0.1"
              value={currentDecayHours}
              onChange={(e) => setCurrentDecayHours(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">
              Posts lose half their boost after this many hours. Lower = faster decay.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="maxBoost">Maximum Boost:</label>
            <input
              id="maxBoost"
              type="number"
              min="0"
              value={currentMaxBoost}
              onChange={(e) => setCurrentMaxBoost(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">
              Maximum score boost for brand new posts (decays over time).
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

export default RecencyBoostModal
