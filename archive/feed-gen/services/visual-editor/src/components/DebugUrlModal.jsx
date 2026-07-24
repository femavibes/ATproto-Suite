import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // reuse base modal styles

/**
 * Debug URL Modal
 * Allows users to input a Bluesky post URL and run it through the graph
 */
function DebugUrlModal({ isOpen, onClose, onDebug }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setError('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please enter a Bluesky post URL')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await Promise.resolve(onDebug(trimmed))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Debug Post by URL</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="debugUrl">Bluesky Post URL</label>
            <input
              id="debugUrl"
              type="text"
              className="form-input"
              placeholder="https://bsky.app/profile/.../post/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
            />
            <div className="form-hint">
              Paste a Bluesky post link. We'll fetch its metadata and run it through this graph.
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Testing...' : 'Fetch & Test'}
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default DebugUrlModal

