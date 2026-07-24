import React, { useState, useEffect } from 'react'
import './NOfModal.css'

/**
 * N-of Modal
 * 
 * Configures N-of blocks: "At least N conditions must pass"
 * M (total conditions) is automatically determined by counting connected condition nodes
 * 
 * EXAMPLE:
 * - N=2 with 3 connected conditions: "2 of 3"
 *   → At least 2 of the 3 connected conditions must pass
 */
function NOfModal({ isOpen, onClose, nodeId, n: initialN, onSave }) {
  const [n, setN] = useState(initialN || 2)

  useEffect(() => {
    if (isOpen) {
      setN(initialN || 2)
    }
  }, [isOpen, initialN])

  const handleSave = () => {
    if (n < 1) {
      alert('N must be at least 1')
      return
    }
    onSave(nodeId, { n })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content nof-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Configure N-of Block</h2>
        <p className="modal-description">
          Set the minimum number of conditions that must pass.
          <br />
          The total number (M) is automatically determined by counting connected condition nodes.
        </p>
        
        <div className="form-group">
          <label>
            N (minimum required):
            <input
              type="number"
              min="1"
              value={n}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1
                setN(Math.max(1, val))
              }}
            />
          </label>
        </div>

        <div className="modal-preview">
          <strong>Preview:</strong> "At least {n}" - {n} or more connected conditions must pass
          <br />
          <small>(M will be shown as "{n} of M" once condition nodes are connected)</small>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} className="btn-save">Save</button>
        </div>
      </div>
    </div>
  )
}

export default NOfModal
