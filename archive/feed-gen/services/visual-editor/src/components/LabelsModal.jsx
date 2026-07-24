import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './LabelsModal.css'

/**
 * Modal for configuring Labels block
 * 
 * HOW IT WORKS:
 * - Searches labels.values[*].val for self-applied labels
 * - Common labels: porn, graphic-media, sexual, nudity, etc.
 * - Matches if post has ANY of the selected labels (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores labels: ['porn', 'graphic-media']
 * - Backend checks: post.labels?.values?.some(label => label.val === 'porn')
 * 
 * CURRENT LIMITATIONS:
 * - Only supports self-applied labels (labels.values[*].val)
 * - Labeler labels require API resolution (not available in raw post data)
 * - Future: May add separate block for labeler labels when we resolve posts via API
 * 
 * LABEL TYPES:
 * - Self-applied labels: Applied by users to their own posts/accounts
 * - Common values: porn, sexual, nudity, graphic-media
 * - Labeler labels: Applied by third-party moderation services (requires API resolution)
 * 
 * EXAMPLE:
 * - Labels: ['porn', 'graphic-media']
 * - Post with self-label "porn" → MATCHES
 * - Post with no labels → NO MATCH
 */
function LabelsModal({ isOpen, onClose, nodeId, labels, name, exclude, onSave }) {
  const [localLabels, setLocalLabels] = useState(labels || [''])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)

  const commonLabels = [
    'porn',
    'sexual',
    'nudity',
    'graphic-media',
    'spam',
    'impersonation',
    'rude',
    'sexual-figurative',
  ]

  useEffect(() => {
    if (isOpen) {
      setLocalLabels(labels && labels.length > 0 ? labels : [''])
      setBlockName(name || '')
      setIsExclude(exclude || false)
    }
  }, [isOpen, labels, name, exclude])

  const addLabel = () => {
    setLocalLabels([...localLabels, ''])
  }

  const removeLabel = (index) => {
    if (localLabels.length > 1) {
      setLocalLabels(localLabels.filter((_, i) => i !== index))
    }
  }

  const updateLabel = (index, value) => {
    const updated = [...localLabels]
    updated[index] = value
    setLocalLabels(updated)
  }

  const addCommonLabel = (label) => {
    if (!localLabels.includes(label)) {
      setLocalLabels([...localLabels.filter(l => l.trim()), label])
    }
  }

  const handleSave = () => {
    // Filter out empty labels
    const validLabels = localLabels.filter((l) => l.trim() !== '')
    
    if (validLabels.length === 0) {
      return
    }

    onSave(nodeId, {
      labels: validLabels,
      name: blockName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalLabels(labels && labels.length > 0 ? labels : [''])
    setBlockName('')
    setIsExclude(exclude || false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content labels-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Labels Block</h3>
          <button className="modal-close" onClick={handleCancel}>
            ×
          </button>
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
                  <div className="mode-desc">Posts with selected labels are included</div>
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
                  <div className="mode-desc">Posts with selected labels are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Content Moderation"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>


          <div className="form-group">
            <label>Common Labels</label>
            <div className="common-labels-list">
              {commonLabels.map((label) => (
                <button
                  key={label}
                  className="common-label-btn"
                  onClick={() => addCommonLabel(label)}
                  disabled={localLabels.includes(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="form-hint" style={{ marginTop: '8px' }}>
              Click to add common labels, or enter custom labels below
            </div>
          </div>

          <div className="form-group">
            <label>Labels</label>
            <div className="labels-list">
              {localLabels.map((label, index) => (
                <div key={index} className="label-input-row">
                  <input
                    type="text"
                    placeholder="Enter label value"
                    value={label}
                    onChange={(e) => updateLabel(index, e.target.value)}
                    className="form-input label-input"
                  />
                  {localLabels.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeLabel(index)}
                      title="Remove label"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-add-keyword" onClick={addLabel}>
              + Add Label
            </button>
            <div className="form-hint">
              Currently supports self-applied labels only. Labeler labels require API resolution (may add separate block later).
            </div>
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts with <strong>any</strong> selected label will be <strong>excluded</strong>.</>
              ) : (
                <>Posts with <strong>any</strong> selected label will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Note: Only self-applied labels are available in raw post data. Labeler labels require API resolution and may be added in a future update.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={localLabels.filter(l => l.trim()).length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabelsModal
