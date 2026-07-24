import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

function ImageModal({ isOpen, onClose, nodeId, imageCount = null, minWidth = null, maxWidth = null, minHeight = null, maxHeight = null, aspectRatio = null, minFileSize = null, maxFileSize = null, exclude = false, onSave }) {
  const [currentImageCount, setCurrentImageCount] = useState(imageCount)
  const [currentMinWidth, setCurrentMinWidth] = useState(minWidth)
  const [currentMaxWidth, setCurrentMaxWidth] = useState(maxWidth)
  const [currentMinHeight, setCurrentMinHeight] = useState(minHeight)
  const [currentMaxHeight, setCurrentMaxHeight] = useState(maxHeight)
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio || 'any')
  const [currentMinFileSize, setCurrentMinFileSize] = useState(minFileSize)
  const [currentMaxFileSize, setCurrentMaxFileSize] = useState(maxFileSize)
  const [isExclude, setIsExclude] = useState(exclude)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentImageCount(imageCount)
      setCurrentMinWidth(minWidth)
      setCurrentMaxWidth(maxWidth)
      setCurrentMinHeight(minHeight)
      setCurrentMaxHeight(maxHeight)
      setCurrentAspectRatio(aspectRatio || 'any')
      setCurrentMinFileSize(minFileSize)
      setCurrentMaxFileSize(maxFileSize)
      setIsExclude(exclude)
      setError('')
    }
  }, [isOpen, imageCount, minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, exclude])

  const handleSave = () => {
    // Validate numeric inputs
    const numericFields = [
      { value: currentImageCount, name: 'Image Count', min: 1, max: 4 },
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
        if (field.max && num > field.max) {
          setError(`${field.name} must be <= ${field.max}`)
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
      imageCount: currentImageCount !== null && currentImageCount !== '' ? Number(currentImageCount) : null,
      minWidth: currentMinWidth !== null && currentMinWidth !== '' ? Number(currentMinWidth) : null,
      maxWidth: currentMaxWidth !== null && currentMaxWidth !== '' ? Number(currentMaxWidth) : null,
      minHeight: currentMinHeight !== null && currentMinHeight !== '' ? Number(currentMinHeight) : null,
      maxHeight: currentMaxHeight !== null && currentMaxHeight !== '' ? Number(currentMaxHeight) : null,
      aspectRatio: currentAspectRatio !== 'any' ? currentAspectRatio : null,
      minFileSize: currentMinFileSize !== null && currentMinFileSize !== '' ? Number(currentMinFileSize) : null,
      maxFileSize: currentMaxFileSize !== null && currentMaxFileSize !== '' ? Number(currentMaxFileSize) : null,
      exclude: isExclude,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isExclude ? 'Image Excludes' : 'Image'}</h2>
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
                  <div className="mode-desc">Posts with matching images are included</div>
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
                  <div className="mode-desc">Posts with matching images are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="imageCount">Image Count (1-4):</label>
            <input
              id="imageCount"
              type="number"
              min="1"
              max="4"
              value={currentImageCount || ''}
              onChange={(e) => setCurrentImageCount(e.target.value ? Number(e.target.value) : null)}
              placeholder="Any"
            />
            <div className="form-hint">Leave empty to match any count</div>
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

export default ImageModal
