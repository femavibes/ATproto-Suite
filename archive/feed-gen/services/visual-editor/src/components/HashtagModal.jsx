import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './HashtagModal.css'

/**
 * Modal for configuring Hashtag/Tags block
 * 
 * HOW IT WORKS:
 * - Searches tags array (outline tags) and/or facets hashtags
 * - Outline tags: tags[*] - Bluesky's new tag feature (hidden tags) OR bridged platform tags
 * - Visible hashtags: facets[*].features[*].tag - Hashtags visible in post text
 * - Matches if post has ANY of the selected tags/hashtags (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores tags: ['urbanism', 'transit', 'housing']
 * - Stores field types: ['outline_tags', 'hashtags'] or both
 * - Backend checks:
 *   - If 'outline_tags' selected: post.tags.includes('urbanism')
 *   - If 'hashtags' selected: post.facets[*].features[*].tag === 'urbanism'
 * 
 * TAG TYPES:
 * - Outline Tags (tags[*]): Bluesky's new hidden tag feature, also bridged platform tags
 * - Hashtags (facets[*].features[*].tag): Visible hashtags in post text (with # in UI, without # in data)
 * 
 * EXAMPLE:
 * - Tags: ['urbanism', 'transit']
 * - Field types: ['outline_tags', 'hashtags']
 * - Post with outline tag "urbanism" → MATCHES
 * - Post with hashtag "#transit" in text → MATCHES
 * - Post with neither → NO MATCH
 */
function HashtagModal({ isOpen, onClose, nodeId, tags, fieldTypes, name, exclude, onSave }) {
  const [localTags, setLocalTags] = useState(tags || [''])
  const [selectedFieldTypes, setSelectedFieldTypes] = useState(fieldTypes || ['outline_tags', 'hashtags'])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)

  const fieldTypeOptions = [
    { 
      value: 'outline_tags', 
      label: 'Outline Tags', 
      description: 'Bluesky outline tags (hidden) or bridged platform tags',
      icon: '🏷️'
    },
    { 
      value: 'hashtags', 
      label: 'Hashtags', 
      description: 'Visible hashtags in post text',
      icon: '#'
    },
  ]

  useEffect(() => {
    if (isOpen) {
      setLocalTags(tags && tags.length > 0 ? tags : [''])
      setSelectedFieldTypes(fieldTypes || ['outline_tags', 'hashtags'])
      setBlockName(name || '')
      setIsExclude(exclude || false)
    }
  }, [isOpen, tags, fieldTypes, name, exclude])

  const addTag = () => {
    setLocalTags([...localTags, ''])
  }

  const removeTag = (index) => {
    if (localTags.length > 1) {
      setLocalTags(localTags.filter((_, i) => i !== index))
    }
  }

  const updateTag = (index, value) => {
    const updated = [...localTags]
    updated[index] = value
    setLocalTags(updated)
  }

  const toggleFieldType = (type) => {
    if (selectedFieldTypes.includes(type)) {
      // Don't allow deselecting all field types
      if (selectedFieldTypes.length > 1) {
        setSelectedFieldTypes(selectedFieldTypes.filter((t) => t !== type))
      }
    } else {
      setSelectedFieldTypes([...selectedFieldTypes, type])
    // If deselecting all, select both
      if (selectedFieldTypes.length === 0) {
        setSelectedFieldTypes(['outline_tags', 'hashtags'])
      }
    }
  }

  const handleSave = () => {
    // Filter out empty tags
    const validTags = localTags.filter((t) => t.trim() !== '')
    
    if (validTags.length === 0 || selectedFieldTypes.length === 0) {
      return
    }

    onSave(nodeId, {
      tags: validTags,
      fieldTypes: selectedFieldTypes,
      name: blockName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalTags(tags && tags.length > 0 ? tags : [''])
    setSelectedFieldTypes(fieldTypes || ['outline_tags', 'hashtags'])
    setBlockName('')
    setIsExclude(exclude || false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content hashtag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Hashtag/Tags Block</h3>
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
                  <div className="mode-desc">Posts with selected tags are included</div>
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
                  <div className="mode-desc">Posts with selected tags are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Urbanism Tags"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>


          <div className="form-group">
            <label>Tag Types to Search</label>
            <div className="field-types-list">
              {fieldTypeOptions.map((type) => (
                <label key={type.value} className="field-type-option">
                  <input
                    type="checkbox"
                    checked={selectedFieldTypes.includes(type.value)}
                    onChange={() => toggleFieldType(type.value)}
                    disabled={selectedFieldTypes.length === 1 && selectedFieldTypes.includes(type.value)}
                  />
                  <div className="field-type-content">
                    <div className="field-type-header">
                      <span className="field-type-icon">{type.icon}</span>
                      <div className="field-type-label">{type.label}</div>
                    </div>
                    <div className="field-type-desc">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Tags/Hashtags</label>
            <div className="tags-list">
              {localTags.map((tag, index) => (
                <div key={index} className="tag-input-row">
                  <input
                    type="text"
                    placeholder="Enter tag (without #)"
                    value={tag}
                    onChange={(e) => updateTag(index, e.target.value)}
                    className="form-input tag-input"
                  />
                  {localTags.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeTag(index)}
                      title="Remove tag"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-add-keyword" onClick={addTag}>
              + Add Tag
            </button>
            <div className="form-hint">
              Enter tags without the # symbol. Tags are matched case-insensitively.
            </div>
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts with <strong>any</strong> selected tag will be <strong>excluded</strong>.</>
              ) : (
                <>Posts with <strong>any</strong> selected tag will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Outline tags are Bluesky's hidden tag feature. Hashtags are visible in post text. Both are searched if both types are selected.
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
            disabled={localTags.filter(t => t.trim()).length === 0 || selectedFieldTypes.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default HashtagModal
