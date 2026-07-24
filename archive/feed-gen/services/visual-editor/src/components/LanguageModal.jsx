import React, { useState, useEffect } from 'react'
import { getLanguageOptions, getLanguageName, LANGUAGES } from '../constants/languages'
import './KeywordModal.css'
import './LanguageModal.css'

/**
 * Modal for configuring Language block
 * 
 * HOW IT WORKS:
 * - Searches the `langs` field in post metadata (array of language codes)
 * - Matches if post has ANY of the selected languages (OR logic)
 * - Base language codes (e.g., "en") also match locale variants (e.g., "en-US", "en-GB")
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores language codes: ['en', 'es', 'fr']
 * - Backend checks: post.langs.includes('en') || post.langs.includes('es') || ...
 * 
 * EXAMPLE:
 * - User selects: English, Spanish
 * - Post with langs: ['en'] → MATCHES
 * - Post with langs: ['en-US'] → MATCHES (en matches en-US)
 * - Post with langs: ['fr'] → NO MATCH
 */
function LanguageModal({ isOpen, onClose, nodeId, languages, name, exclude, onSave }) {
  const [selectedLanguages, setSelectedLanguages] = useState(languages || [])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSelectedLanguages(languages || [])
      setBlockName(name || '')
      setIsExclude(exclude || false)
      setSearchQuery('')
    }
  }, [isOpen, languages, name, exclude])

  const toggleLanguage = (code) => {
    if (selectedLanguages.includes(code)) {
      // Don't allow deselecting all languages
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== code))
      }
    } else {
      setSelectedLanguages([...selectedLanguages, code])
    }
  }

  const handleSave = () => {
    if (selectedLanguages.length === 0) {
      return
    }
    onSave(nodeId, {
      languages: selectedLanguages,
      name: blockName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setSelectedLanguages(languages || [])
    setBlockName('')
    setIsExclude(exclude || false)
    setSearchQuery('')
    onClose()
  }

  const languageOptions = getLanguageOptions()
  
  // Filter languages by search query
  const filteredOptions = searchQuery
    ? languageOptions.filter((lang) => {
        const matchesBase = lang.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCode = lang.code.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesLocales = lang.locales.some((loc) =>
          loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.code.toLowerCase().includes(searchQuery.toLowerCase())
        )
        return matchesBase || matchesCode || matchesLocales
      })
    : languageOptions

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content language-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Language Block</h3>
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
                  <div className="mode-desc">Posts with selected languages are included</div>
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
                  <div className="mode-desc">Posts with selected languages are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., English Only"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Languages</label>
            <div className="language-search">
              <input
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="languages-list">
              {filteredOptions.map((lang) => (
                <div key={lang.code} className="language-group">
                  <label className="language-option">
                    <input
                      type="checkbox"
                      checked={selectedLanguages.includes(lang.code)}
                      onChange={() => toggleLanguage(lang.code)}
                      disabled={selectedLanguages.length === 1 && selectedLanguages.includes(lang.code)}
                    />
                    <div className="language-content">
                      <div className="language-name">{lang.name}</div>
                      <div className="language-code">{lang.code}</div>
                    </div>
                  </label>
                  {lang.locales.length > 0 && (
                    <div className="language-locales">
                      {lang.locales.map((locale) => (
                        <label key={locale.code} className="language-option locale-option">
                          <input
                            type="checkbox"
                            checked={selectedLanguages.includes(locale.code)}
                            onChange={() => toggleLanguage(locale.code)}
                            disabled={selectedLanguages.length === 1 && selectedLanguages.includes(locale.code)}
                          />
                          <div className="language-content">
                            <div className="language-name">{locale.name}</div>
                            <div className="language-code">{locale.code}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedLanguages.length > 0 && (
              <div className="selected-languages-summary">
                Selected: {selectedLanguages.map((code) => getLanguageName(code)).join(', ')}
              </div>
            )}
          </div>


          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts with <strong>any</strong> of the selected languages will be <strong>excluded</strong>.</>
              ) : (
                <>Posts with <strong>any</strong> of the selected languages will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Matches against the <code>langs</code> field in post metadata. Base language codes (e.g., "en") also match locale variants (e.g., "en-US").
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={selectedLanguages.length === 0}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default LanguageModal
