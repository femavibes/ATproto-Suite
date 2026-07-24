import React, { useState, useEffect } from 'react'
import { getFieldsByCategory, getFieldLabel } from '../constants/textFields'
import './KeywordModal.css'

/**
 * Modal for configuring Text Contains block
 * 
 * HOW IT WORKS:
 * - Uses Aho-Corasick algorithm for efficient keyword matching
 * - O(n) time complexity where n = post text length
 * - Matches all keywords in a single pass
 * - Searches selected fields (text, alt text, link URLs, etc.)
 * - Matches if post contains ANY of the keywords (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores keywords: ['urbanism', 'transit', 'housing']
 * - Stores fields: ['text', 'embed.images[*].alt', 'embed.external.uri']
 * - Backend checks each field for keyword matches using Aho-Corasick
 * 
 * EXAMPLE:
 * - Keywords: ['urbanism', 'transit']
 * - Fields: ['text', 'embed.external.uri']
 * - Post with text "I love urbanism" → MATCHES
 * - Post with link URL "transit-planning.com" → MATCHES
 * - Post with neither → NO MATCH
 */
function normalizeKeywordEntry(entry) {
  if (typeof entry === 'string') return { value: entry, wholeWord: false }
  if (entry && typeof entry === 'object') {
    return {
      value: String(entry.value || ''),
      wholeWord: !!entry.wholeWord,
    }
  }
  return { value: '', wholeWord: false }
}

function KeywordModal({ isOpen, onClose, nodeId, keywords, name, fields, exclude, onSave }) {
  const [localKeywords, setLocalKeywords] = useState(
    (keywords && keywords.length > 0 ? keywords : ['']).map(normalizeKeywordEntry)
  )
  const [blockName, setBlockName] = useState(name || '')
  const [selectedFields, setSelectedFields] = useState(fields || ['text'])
  const [isExclude, setIsExclude] = useState(exclude || false)

  useEffect(() => {
    if (isOpen) {
      setLocalKeywords((keywords && keywords.length > 0 ? keywords : ['']).map(normalizeKeywordEntry))
      setBlockName(name || '')
      setSelectedFields(fields && fields.length > 0 ? fields : ['text'])
      setIsExclude(exclude || false)
    }
  }, [isOpen, keywords, name, fields, exclude])

  const addKeyword = () => {
    setLocalKeywords([...localKeywords, { value: '', wholeWord: false }])
  }

  const removeKeyword = (index) => {
    if (localKeywords.length > 1) {
      setLocalKeywords(localKeywords.filter((_, i) => i !== index))
    }
  }

  const updateKeyword = (index, value) => {
    const updated = [...localKeywords]
    updated[index] = { ...updated[index], value }
    setLocalKeywords(updated)
  }

  const toggleWholeWord = (index, wholeWord) => {
    const updated = [...localKeywords]
    updated[index] = { ...updated[index], wholeWord }
    setLocalKeywords(updated)
  }

  const handleSave = () => {
    // Filter out empty keywords
    const validKeywords = localKeywords
      .map(normalizeKeywordEntry)
      .filter((k) => k.value.trim() !== '')
    onSave(nodeId, {
      keywords: validKeywords,
      name: blockName.trim() || null,
      fields: selectedFields.length > 0 ? selectedFields : ['text'],
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalKeywords((keywords && keywords.length > 0 ? keywords : ['']).map(normalizeKeywordEntry))
    setBlockName('')
    setSelectedFields(fields || ['text'])
    setIsExclude(exclude || false)
    onClose()
  }

  const toggleField = (field) => {
    if (selectedFields.includes(field)) {
      // Don't allow deselecting all fields
      if (selectedFields.length > 1) {
        setSelectedFields(selectedFields.filter((f) => f !== field))
      }
    } else {
      setSelectedFields([...selectedFields, field])
    }
  }

  const fieldsByCategory = getFieldsByCategory()

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Text Contains Block</h3>
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
                  <div className="mode-desc">Posts matching keywords are included</div>
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
                  <div className="mode-desc">Posts matching keywords are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Urbanism Keywords"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block (shown below "Text Contains")
            </div>
          </div>

          <div className="form-group">
            <label>Search Fields</label>
            <div className="fields-selector">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category} className="field-category">
                  <div className="field-category-header">{category}</div>
                  <div className="field-options">
                    {fields.map(({ field, label, description }) => (
                      <label key={field} className={`field-option ${selectedFields.includes(field) ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field)}
                          onChange={() => toggleField(field)}
                          disabled={selectedFields.length === 1 && selectedFields.includes(field)}
                        />
                        <div className="field-option-content">
                          <div className="field-option-main">
                            <span className="field-option-label">{label}</span>
                            <span className="field-option-raw">{field}</span>
                          </div>
                          <div className="field-option-desc">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-hint">
              Select one or more fields to search. At least one field must be selected.
            </div>
          </div>

          <div className="form-group">
            <label>Keywords</label>
            <div className="keywords-list">
              {localKeywords.map((keyword, index) => (
                <div key={index} className="keyword-input-row">
                  <div className="keyword-input-main">
                    <input
                      type="text"
                      placeholder="Enter keyword..."
                      value={keyword.value}
                      onChange={(e) => updateKeyword(index, e.target.value)}
                      className="form-input keyword-input"
                    />
                    <label className="keyword-boundary-toggle">
                      <input
                        type="checkbox"
                        checked={!!keyword.wholeWord}
                        onChange={(e) => toggleWholeWord(index, e.target.checked)}
                      />
                      Whole word
                    </label>
                  </div>
                  {localKeywords.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeKeyword(index)}
                      title="Remove keyword"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-add-keyword" onClick={addKeyword}>
              + Add Keyword
            </button>
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts with <strong>any</strong> of these keywords in selected fields will be <strong>excluded</strong>.</>
              ) : (
                <>Posts with <strong>any</strong> of these keywords in selected fields will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Uses <strong>Aho-Corasick</strong> algorithm for efficient keyword matching.
            </p>
            {selectedFields.length > 0 && (
              <p style={{ marginTop: '8px', fontSize: '11px', color: '#4a9eff' }}>
                Searching: {selectedFields.map((f) => getFieldLabel(f)).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default KeywordModal
