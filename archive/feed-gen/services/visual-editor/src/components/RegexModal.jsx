import React, { useState, useEffect, useRef } from 'react'
import { getFieldsByCategory, getFieldLabel } from '../constants/textFields'
import './KeywordModal.css'
import './RegexModal.css'

/**
 * Modal for configuring Regex Contains block
 * 
 * HOW IT WORKS:
 * - Uses JavaScript RegExp for pattern matching
 * - Supports all ES2018+ features (lookaheads, lookbehinds, named groups, etc.)
 * - Searches selected fields (text, alt text, link URLs, etc.)
 * - Matches if pattern matches ANY of the selected fields
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b' (regex string)
 * - Stores fields: ['text', 'embed.external.uri']
 * - Stores flags: 'gi' (global, ignore case)
 * - Backend creates RegExp(pattern, flags) and tests against each field
 * 
 * EXAMPLE:
 * - Pattern: '\\b(email|@)\\b'
 * - Fields: ['text', 'embed.external.uri']
 * - Post with text "Contact me at email" → MATCHES
 * - Post with link "contact@example.com" → MATCHES
 * - Post with neither → NO MATCH
 * 
 * ADVANCED FEATURES:
 * - Lookaheads: (?=pattern), (?!pattern)
 * - Lookbehinds: (?<=pattern), (?<!pattern)
 * - Named groups: (?<name>pattern)
 * - Backreferences: \\1, \\2
 */
function RegexModal({ isOpen, onClose, nodeId, pattern, name, fields, exclude, onSave }) {
  const [localPattern, setLocalPattern] = useState(pattern || '')
  const [blockName, setBlockName] = useState(name || '')
  const [selectedFields, setSelectedFields] = useState(fields || ['text'])
  const [isExclude, setIsExclude] = useState(exclude || false)
  const [regexFlags, setRegexFlags] = useState({
    global: false,
    ignoreCase: true,
    multiline: false,
  })
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [patternError, setPatternError] = useState(null)

  const patternTextareaRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setLocalPattern(pattern || '')
      setBlockName(name || '')
      setSelectedFields(fields && fields.length > 0 ? fields : ['text'])
      setIsExclude(exclude || false)
      setTestText('')
      setTestResult(null)
      setPatternError(null)
      // Auto-resize textarea if pattern exists
      setTimeout(() => {
        if (patternTextareaRef.current) {
          patternTextareaRef.current.style.height = 'auto'
          patternTextareaRef.current.style.height = patternTextareaRef.current.scrollHeight + 'px'
        }
      }, 0)
    }
  }, [isOpen, pattern, name, fields, exclude])

  const validatePattern = (pat) => {
    if (!pat.trim()) {
      setPatternError(null)
      return true
    }
    try {
      const flags = buildFlagsString()
      new RegExp(pat, flags)
      setPatternError(null)
      return true
    } catch (e) {
      setPatternError(e.message)
      return false
    }
  }

  const buildFlagsString = () => {
    let flags = ''
    if (regexFlags.global) flags += 'g'
    if (regexFlags.ignoreCase) flags += 'i'
    if (regexFlags.multiline) flags += 'm'
    return flags
  }

  const handlePatternChange = (value) => {
    setLocalPattern(value)
    validatePattern(value)
    // Auto-test if test text exists
    if (testText) {
      testRegex(value, testText)
    }
  }

  const testRegex = (pat, text) => {
    if (!pat.trim() || !text.trim()) {
      setTestResult(null)
      return
    }
    try {
      const flags = buildFlagsString()
      const regex = new RegExp(pat, flags)
      const matches = text.match(regex)
      setTestResult({
        matches: matches !== null,
        matchCount: matches ? matches.length : 0,
        firstMatch: matches ? matches[0] : null,
      })
      setPatternError(null)
    } catch (e) {
      setTestResult({ error: e.message })
      setPatternError(e.message)
    }
  }

  const handleTest = () => {
    testRegex(localPattern, testText)
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

  const handleSave = () => {
    // Validate pattern if it's not empty
    if (localPattern.trim() && !validatePattern(localPattern)) {
      // Don't save if pattern is invalid
      return
    }
    // Allow saving even with empty pattern (user can configure later)
    onSave(nodeId, {
      pattern: localPattern.trim() || '',
      name: blockName.trim() || null,
      fields: selectedFields.length > 0 ? selectedFields : ['text'],
      exclude: isExclude,
      flags: buildFlagsString(),
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalPattern(pattern || '')
    setBlockName('')
    setSelectedFields(fields || ['text'])
    setIsExclude(exclude || false)
    setTestText('')
    setTestResult(null)
    setPatternError(null)
    onClose()
  }

  const fieldsByCategory = getFieldsByCategory()

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content regex-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Regex Contains Block</h3>
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
                  <div className="mode-desc">Posts matching pattern are included</div>
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
                  <div className="mode-desc">Posts matching pattern are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Email Pattern"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Regex Pattern</label>
            <div className="pattern-input-wrapper">
              <span className="pattern-prefix">/</span>
              <textarea
                ref={patternTextareaRef}
                placeholder="your pattern here"
                value={localPattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                className={`form-input pattern-input ${patternError ? 'error' : ''}`}
                rows={1}
                style={{ 
                  resize: 'vertical',
                  minHeight: '36px',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  fontSize: '14px',
                }}
                onInput={(e) => {
                  // Auto-resize textarea
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
              />
              <span className="pattern-suffix">/{buildFlagsString()}</span>
            </div>
            {patternError && (
              <div className="error-message">{patternError}</div>
            )}
            <div className="form-hint">
              JavaScript regex pattern. Supports lookaheads, lookbehinds, and all ES2018+ features.{' '}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                MDN regex guide
              </a>
            </div>
            <div className="form-hint" style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
              Examples: <code>(?=.*word1)(?=.*word2)</code> (both words), <code>(?&lt;=prefix)</code> (lookbehind), <code>(?!exclude)</code> (negative lookahead)
            </div>
          </div>

          <div className="form-group">
            <label>Flags</label>
            <div className="flags-selector">
              <label className="flag-option">
                <input
                  type="checkbox"
                  checked={regexFlags.ignoreCase}
                  onChange={(e) => setRegexFlags({ ...regexFlags, ignoreCase: e.target.checked })}
                />
                <span>i (ignore case)</span>
              </label>
              <label className="flag-option">
                <input
                  type="checkbox"
                  checked={regexFlags.global}
                  onChange={(e) => setRegexFlags({ ...regexFlags, global: e.target.checked })}
                />
                <span>g (global - find all matches)</span>
              </label>
              <label className="flag-option">
                <input
                  type="checkbox"
                  checked={regexFlags.multiline}
                  onChange={(e) => setRegexFlags({ ...regexFlags, multiline: e.target.checked })}
                />
                <span>m (multiline)</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Test Pattern</label>
            <textarea
              placeholder="Enter test text to see if pattern matches..."
              value={testText}
              onChange={(e) => {
                setTestText(e.target.value)
                if (localPattern) {
                  testRegex(localPattern, e.target.value)
                }
              }}
              className="form-input test-textarea"
              rows="3"
            />
            {testResult && (
              <div className={`test-result ${testResult.error ? 'error' : testResult.matches ? 'match' : 'no-match'}`}>
                {testResult.error ? (
                  <div>Error: {testResult.error}</div>
                ) : testResult.matches ? (
                  <div>
                    ✓ Match found! ({testResult.matchCount} match{testResult.matchCount !== 1 ? 'es' : ''})
                    {testResult.firstMatch && (
                      <div className="test-match-text">First match: "{testResult.firstMatch}"</div>
                    )}
                  </div>
                ) : (
                  <div>✗ No match</div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Search Fields</label>
            <div className="fields-selector">
              {Object.entries(fieldsByCategory).map(([category, fieldList]) => (
                <div key={category} className="field-category">
                  <div className="field-category-header">{category}</div>
                  <div className="field-options">
                    {fieldList.map(({ field, label, description }) => (
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

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts matching this regex pattern in selected fields will be <strong>excluded</strong>.</>
              ) : (
                <>Posts matching this regex pattern in selected fields will be <strong>included</strong>.</>
              )}
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
          <button className="btn-primary" onClick={handleSave} disabled={!!patternError}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default RegexModal
