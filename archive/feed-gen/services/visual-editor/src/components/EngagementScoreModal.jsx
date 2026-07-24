import React, { useState, useEffect } from 'react'
import './KeywordModal.css'

function EngagementScoreModal({ isOpen, onClose, nodeId, likeWeight = 1, replyWeight = 2, repostWeight = 3, quoteWeight = 4, bookmarkWeight = 1, onSave }) {
  const [currentLikeWeight, setCurrentLikeWeight] = useState(likeWeight)
  const [currentReplyWeight, setCurrentReplyWeight] = useState(replyWeight)
  const [currentRepostWeight, setCurrentRepostWeight] = useState(repostWeight)
  const [currentQuoteWeight, setCurrentQuoteWeight] = useState(quoteWeight)
  const [currentBookmarkWeight, setCurrentBookmarkWeight] = useState(bookmarkWeight)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentLikeWeight(likeWeight)
      setCurrentReplyWeight(replyWeight)
      setCurrentRepostWeight(repostWeight)
      setCurrentQuoteWeight(quoteWeight)
      setCurrentBookmarkWeight(bookmarkWeight)
      setError('')
    }
  }, [isOpen, likeWeight, replyWeight, repostWeight, quoteWeight, bookmarkWeight])

  const handleSave = () => {
    onSave(nodeId, {
      likeWeight: Number(currentLikeWeight),
      replyWeight: Number(currentReplyWeight),
      repostWeight: Number(currentRepostWeight),
      quoteWeight: Number(currentQuoteWeight),
      bookmarkWeight: Number(currentBookmarkWeight),
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Engagement Score</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Multipliers coming soon. For now this node stores weights only.
          </div>
          <div className="form-group">
            <label htmlFor="likeWeight">Like Weight:</label>
            <input
              id="likeWeight"
              type="number"
              min="0"
              step="0.1"
              value={currentLikeWeight}
              onChange={(e) => setCurrentLikeWeight(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">Score = likes × weight</div>
          </div>

          <div className="form-group">
            <label htmlFor="replyWeight">Reply Weight:</label>
            <input
              id="replyWeight"
              type="number"
              min="0"
              step="0.1"
              value={currentReplyWeight}
              onChange={(e) => setCurrentReplyWeight(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">Score = replies × weight</div>
          </div>

          <div className="form-group">
            <label htmlFor="repostWeight">Repost Weight:</label>
            <input
              id="repostWeight"
              type="number"
              min="0"
              step="0.1"
              value={currentRepostWeight}
              onChange={(e) => setCurrentRepostWeight(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">Score = reposts × weight</div>
          </div>

          <div className="form-group">
            <label htmlFor="quoteWeight">Quote Weight:</label>
            <input
              id="quoteWeight"
              type="number"
              min="0"
              step="0.1"
              value={currentQuoteWeight}
              onChange={(e) => setCurrentQuoteWeight(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">Score = quotes × weight</div>
          </div>

          <div className="form-group">
            <label htmlFor="bookmarkWeight">Bookmark Weight:</label>
            <input
              id="bookmarkWeight"
              type="number"
              min="0"
              step="0.1"
              value={currentBookmarkWeight}
              onChange={(e) => setCurrentBookmarkWeight(e.target.value ? Number(e.target.value) : 0)}
            />
            <div className="form-hint">Score = bookmarks × weight</div>
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

export default EngagementScoreModal
