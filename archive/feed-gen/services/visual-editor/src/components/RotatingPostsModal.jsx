import React, { useState, useEffect } from 'react'
import './RotatingPostsModal.css'

function RotatingPostsModal({
  isOpen,
  onClose,
  nodeId,
  postUrls = [],
  strategy = 'round-robin',
  onSave,
  heading = 'Rotating Posts',
  urlHint,
}) {
  const [localPostUrls, setLocalPostUrls] = useState(postUrls)
  const [localStrategy, setLocalStrategy] = useState(strategy)
  const [localName, setLocalName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalPostUrls(postUrls || [])
      setLocalStrategy(strategy || 'round-robin')
      setLocalName('')
    }
  }, [isOpen, postUrls, strategy])

  const handleAddPostUrl = () => {
    setLocalPostUrls([...localPostUrls, ''])
  }

  const handleRemovePostUrl = (index) => {
    setLocalPostUrls(localPostUrls.filter((_, i) => i !== index))
  }

  const handlePostUrlChange = (index, value) => {
    const updated = [...localPostUrls]
    updated[index] = value
    setLocalPostUrls(updated)
  }

  const handleSave = () => {
    const validUrls = localPostUrls.filter(url => url.trim())
    if (validUrls.length === 0) {
      alert('Please add at least one post URL')
      return
    }

    onSave({
      nodeId,
      postUrls: validUrls,
      strategy: localStrategy,
      name: localName.trim() || null,
    })
    onClose()
  }

  if (!isOpen) return null

  const postUrlsHint =
    urlHint ||
    'Add Bluesky post URLs. These posts will rotate based on the selected strategy.'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rotating-posts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{heading}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Node Name (optional)</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g., Featured Content"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Post URLs</label>
            <p className="form-hint">{postUrlsHint}</p>
            <div className="post-urls-list">
              {localPostUrls.map((url, index) => (
                <div key={index} className="post-url-item">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handlePostUrlChange(index, e.target.value)}
                    placeholder="https://bsky.app/profile/.../post/..."
                    className="form-input post-url-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePostUrl(index)}
                    className="btn-remove"
                    title="Remove this post URL"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddPostUrl}
                className="btn-add"
              >
                + Add Post URL
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Rotation Strategy</label>
            <select
              value={localStrategy}
              onChange={(e) => setLocalStrategy(e.target.value)}
              className="form-select"
            >
              <option value="round-robin">Round-Robin (cycle through in order)</option>
              <option value="random">Random (equal probability)</option>
              <option value="weighted-random">Weighted Random (based on weights)</option>
              <option value="time-based">Time-Based (rotate every X minutes)</option>
              <option value="user-based">User-Based (consistent per user)</option>
            </select>
            <p className="form-hint">
              {localStrategy === 'round-robin' && 'Posts are shown in order, cycling back to the first after the last.'}
              {localStrategy === 'random' && 'Each post has an equal chance of being selected.'}
              {localStrategy === 'weighted-random' && 'Posts are selected based on their weight values (higher = more frequent).'}
              {localStrategy === 'time-based' && 'Posts rotate based on time intervals (e.g., every 60 minutes).'}
              {localStrategy === 'user-based' && 'Each user sees a consistent post based on their user ID (deterministic).'}
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

export default RotatingPostsModal
