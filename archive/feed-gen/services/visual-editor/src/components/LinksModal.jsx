import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

function LinksModal({ isOpen, onClose, nodeId, urls = [], name = "", exclude = false, requireThumbnail = false, onSave }) {
  const [localUrls, setLocalUrls] = useState(urls && urls.length > 0 ? urls : [''])
  const [currentName, setCurrentName] = useState(name)
  const [isExclude, setIsExclude] = useState(exclude)
  const [currentRequireThumbnail, setCurrentRequireThumbnail] = useState(requireThumbnail)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalUrls(urls && urls.length > 0 ? urls : [''])
      setCurrentName(name || '')
      setIsExclude(exclude || false)
      setCurrentRequireThumbnail(requireThumbnail || false)
      setError('')
    }
  }, [isOpen, urls, name, exclude, requireThumbnail])

  // Helper function to validate a URL or domain
  const isValidUrlOrDomain = (urlString) => {
    if (!urlString || urlString.trim() === '') return false
    try {
      // Try to parse as URL (adds http:// if needed for validation)
      const testUrl = urlString.startsWith('http://') || urlString.startsWith('https://') ? urlString : `https://${urlString}`
      new URL(testUrl)
      return true
    } catch {
      // Check if it's a valid domain (basic check)
      const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      return domainPattern.test(urlString)
    }
  }

  // Helper function to normalize URL (add https:// if missing)
  const normalizeUrl = (urlString) => {
    if (!urlString || urlString.trim() === '') return urlString
    if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
      return urlString
    }
    return `https://${urlString}`
  }

  const addUrl = () => {
    setLocalUrls([...localUrls, ''])
  }

  const removeUrl = (index) => {
    if (localUrls.length > 1) {
      setLocalUrls(localUrls.filter((_, i) => i !== index))
    }
  }

  const updateUrl = (index, value) => {
    const updated = [...localUrls]
    updated[index] = value
    setLocalUrls(updated)
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSave = () => {
    // Filter out empty URLs and validate
    const validUrls = localUrls
      .map(u => u.trim())
      .filter(u => u !== '')
      .map(normalizeUrl)

    if (validUrls.length === 0 && !currentRequireThumbnail) {
      setError('Please enter at least one URL or domain, or enable "Require link preview thumbnail"')
      return
    }

    // Validate all URLs (only when URLs are provided)
    const invalidUrls = validUrls.filter(u => !isValidUrlOrDomain(u))
    if (invalidUrls.length > 0) {
      setError(`Invalid URLs/domains: ${invalidUrls.join(', ')}. Enter full URLs (e.g., "https://example.com") or domains (e.g., "example.com")`)
      return
    }

    // Remove duplicates
    const uniqueUrls = Array.from(new Set(validUrls))

    onSave(nodeId, {
      urls: uniqueUrls,
      name: currentName.trim() || null,
      exclude: isExclude,
      requireThumbnail: currentRequireThumbnail,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isExclude ? 'Links Excludes' : 'Links Contains'}</h2>
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
                  <div className="mode-desc">Posts with selected URLs/domains are included</div>
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
                  <div className="mode-desc">Posts with selected URLs/domains are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Important Links"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block (shown below "Links/URLs")
            </div>
          </div>


          <div className="form-group">
            <label>URLs or Domains</label>
            <div className="keywords-list">
              {localUrls.map((url, index) => (
                <div key={index} className="keyword-input-row">
                  <input
                    type="text"
                    placeholder="Enter URL or domain (e.g., https://example.com or example.com)"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    className="form-input keyword-input"
                  />
                  {localUrls.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeUrl(index)}
                      title="Remove URL"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addUrl}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              + Add URL
            </button>
            <div className="form-hint" style={{ marginTop: '5px' }}>
              Enter full URLs (e.g., "https://example.com") or domains (e.g., "example.com"). Checks both links in text (facets) and link cards (embed.external.uri).
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={currentRequireThumbnail}
                onChange={(e) => setCurrentRequireThumbnail(e.target.checked)}
              />
              <span>Require link preview thumbnail</span>
            </label>
            <div className="form-hint">
              When enabled, only link cards with a preview image (<code>embed.external.thumb</code>) will match.
              Leave URLs empty to match any link card that has a thumbnail.
            </div>
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

export default LinksModal
