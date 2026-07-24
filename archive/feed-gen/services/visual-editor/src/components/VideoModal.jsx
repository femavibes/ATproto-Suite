import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

function VideoModal({ isOpen, onClose, nodeId, minWidth = null, maxWidth = null, minHeight = null, maxHeight = null, aspectRatio = null, minFileSize = null, maxFileSize = null, presentation = null, exclude = false, onSave }) {
  const [currentMinWidth, setCurrentMinWidth] = useState(minWidth)
  const [currentMaxWidth, setCurrentMaxWidth] = useState(maxWidth)
  const [currentMinHeight, setCurrentMinHeight] = useState(minHeight)
  const [currentMaxHeight, setCurrentMaxHeight] = useState(maxHeight)
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio || 'any')
  const [currentMinFileSize, setCurrentMinFileSize] = useState(minFileSize)
  const [currentMaxFileSize, setCurrentMaxFileSize] = useState(maxFileSize)
  const [currentPresentation, setCurrentPresentation] = useState(presentation || 'any')
  const [isExclude, setIsExclude] = useState(exclude)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentMinWidth(minWidth)
      setCurrentMaxWidth(maxWidth)
      setCurrentMinHeight(minHeight)
      setCurrentMaxHeight(maxHeight)
      setCurrentAspectRatio(aspectRatio || 'any')
      setCurrentMinFileSize(minFileSize)
      setCurrentMaxFileSize(maxFileSize)
      setCurrentPresentation(presentation || 'any')
      setIsExclude(exclude)
      setError('')
    }
  }, [isOpen, minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, presentation, exclude])

  const handleSave = () => {
    // Validate numeric inputs
    const numericFields = [
      { value: currentMinWidth, name: 'Min Width', min: 1 },
      { value: currentMaxWidth, name: 'Max Width', min: 1 },
      { value: currentMinHeight, name: 'Min Height', min: 1 },
      { value: currentMaxHeight, name: 'Max Height', min: 1 },
      { value: currentMinFileSize, name: 'Min File Size', min: 0 },
      { value: currentMaxFileSize, name: 'Max File Size', min: 0 },
    ]

    for (const field of numericFields) {
      if (field.value !== null && field.value !== '') {
        const num = Number(field.value)
        if (isNaN(num) || num < (field.min || 0)) {
          setError(`${field.name} must be a number >= ${field.min || 0}`)
          return
        }
      }
    }

    // Validate width/height ranges
    if (currentMinWidth !== null && currentMaxWidth !== null && Number(currentMinWidth) > Number(currentMaxWidth)) {
      setError('Min Width cannot be greater than Max Width')
      return
    }
    if (currentMinHeight !== null && currentMaxHeight !== null && Number(currentMinHeight) > Number(currentMaxHeight)) {
      setError('Min Height cannot be greater than Max Height')
      return
    }
    if (currentMinFileSize !== null && currentMaxFileSize !== null && Number(currentMinFileSize) > Number(currentMaxFileSize)) {
      setError('Min File Size cannot be greater than Max File Size')
      return
    }

    onSave(nodeId, {
      minWidth: currentMinWidth !== null && currentMinWidth !== '' ? Number(currentMinWidth) : null,
      maxWidth: currentMaxWidth !== null && currentMaxWidth !== '' ? Number(currentMaxWidth) : null,
      minHeight: currentMinHeight !== null && currentMinHeight !== '' ? Number(currentMinHeight) : null,
      maxHeight: currentMaxHeight !== null && currentMaxHeight !== '' ? Number(currentMaxHeight) : null,
      aspectRatio: currentAspectRatio !== 'any' ? currentAspectRatio : null,
      minFileSize: currentMinFileSize !== null && currentMinFileSize !== '' ? Number(currentMinFileSize) : null,
      maxFileSize: currentMaxFileSize !== null && currentMaxFileSize !== '' ? Number(currentMaxFileSize) : null,
      presentation: currentPresentation !== 'any' ? currentPresentation : null,
      exclude: isExclude,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isExclude ? 'Video Excludes' : 'Video'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Mode</label>
            <div className="mode-selector">
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  value="include"
                  checked={!isExclude}
                  onChange={() => setIsExclude(false)}
                />
                <div className="mode-content">
                  <div className="mode-label">Include</div>
                  <div className="mode-desc">Posts with matching videos are included</div>
                </div>
              </label>
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  value="exclude"
                  checked={isExclude}
                  onChange={() => setIsExclude(true)}
                />
                <div className="mode-content">
                  <div className="mode-label">Exclude</div>
                  <div className="mode-desc">Posts with matching videos are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Resolution (Width × Height):</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                value={currentMinWidth || ''}
                onChange={(e) => setCurrentMinWidth(e.target.value ? Number(e.target.value) : null)}
                placeholder="Min W"
                style={{ width: '80px' }}
              />
              <span>×</span>
              <input
                type="number"
                min="1"
                value={currentMaxWidth || ''}
                onChange={(e) => setCurrentMaxWidth(e.target.value ? Number(e.target.value) : null)}
                placeholder="Max W"
                style={{ width: '80px' }}
              />
              <span>×</span>
              <input
                type="number"
                min="1"
                value={currentMinHeight || ''}
                onChange={(e) => setCurrentMinHeight(e.target.value ? Number(e.target.value) : null)}
                placeholder="Min H"
                style={{ width: '80px' }}
              />
              <span>×</span>
              <input
                type="number"
                min="1"
                value={currentMaxHeight || ''}
                onChange={(e) => setCurrentMaxHeight(e.target.value ? Number(e.target.value) : null)}
                placeholder="Max H"
                style={{ width: '80px' }}
              />
            </div>
            <div className="form-hint">Leave empty for no limit</div>
          </div>

          <div className="form-group">
            <label htmlFor="aspectRatio">Aspect Ratio:</label>
            <select
              id="aspectRatio"
              value={currentAspectRatio}
              onChange={(e) => setCurrentAspectRatio(e.target.value)}
            >
              <option value="any">Any</option>
              <option value="square">Square (1:1)</option>
              <option value="portrait">Portrait (taller than wide)</option>
              <option value="landscape">Landscape (wider than tall)</option>
              <option value="custom">Custom (use width/height above)</option>
            </select>
          </div>

          <div className="form-group">
            <label>File Size (bytes):</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                value={currentMinFileSize || ''}
                onChange={(e) => setCurrentMinFileSize(e.target.value ? Number(e.target.value) : null)}
                placeholder="Min"
                style={{ flex: 1 }}
              />
              <span>to</span>
              <input
                type="number"
                min="0"
                value={currentMaxFileSize || ''}
                onChange={(e) => setCurrentMaxFileSize(e.target.value ? Number(e.target.value) : null)}
                placeholder="Max"
                style={{ flex: 1 }}
              />
            </div>
            <div className="form-hint">Leave empty for no limit</div>
          </div>

          <div className="form-group">
            <label htmlFor="presentation">Presentation Type:</label>
            <select
              id="presentation"
              value={currentPresentation}
              onChange={(e) => setCurrentPresentation(e.target.value)}
            >
              <option value="any">Any</option>
              <option value="gif">GIF</option>
              <option value="video">Regular Video</option>
            </select>
            <div className="form-hint">GIFs have embed.presentation === "gif"</div>
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

export default VideoModal
