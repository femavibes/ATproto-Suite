import React, { useState, useEffect } from 'react'
import './KeywordModal.css'

/**
 * Modal for configuring "Quotes Post" condition node.
 *
 * Matches posts that quote a specific post URI, or any post from a specific author DID.
 *
 * DATA STRUCTURE:
 *   uris: string[]   — AT-URIs of specific quoted posts (at://did:.../app.bsky.feed.post/rkey)
 *   dids: string[]   — Author DIDs; matches any post quoted from these authors
 *   exclude: boolean — If true, matching posts are excluded instead of included
 *
 * FIELD CHECKED:
 *   embed.record.uri (quote post)
 *   embed.record.record.uri (recordWithMedia quote)
 */
function QuotePostModal({ isOpen, onClose, nodeId, uris = [], dids = [], name = '', exclude = false, onSave }) {
  const [localUris, setLocalUris] = useState(uris.length > 0 ? uris : [''])
  const [localDids, setLocalDids] = useState(dids.length > 0 ? dids : [''])
  const [currentName, setCurrentName] = useState(name)
  const [isExclude, setIsExclude] = useState(exclude)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalUris(uris.length > 0 ? uris : [''])
      setLocalDids(dids.length > 0 ? dids : [''])
      setCurrentName(name || '')
      setIsExclude(exclude || false)
      setError('')
    }
  }, [isOpen, uris, dids, name, exclude])

  const updateItem = (setter, list, index, value) => {
    const updated = [...list]
    updated[index] = value
    setter(updated)
    if (error) setError('')
  }

  const addItem = (setter, list) => setter([...list, ''])
  const removeItem = (setter, list, index) => {
    if (list.length > 1) setter(list.filter((_, i) => i !== index))
  }

  const normalizeUri = (raw) => {
    raw = raw.trim()
    // Convert https://bsky.app/profile/DID/post/RKEY → at://DID/app.bsky.feed.post/RKEY
    const bskyMatch = raw.match(/^https?:\/\/bsky\.app\/profile\/(did:[^/]+)\/post\/([a-zA-Z0-9]+)/)
    if (bskyMatch) return `at://${bskyMatch[1]}/app.bsky.feed.post/${bskyMatch[2]}`
    return raw
  }

  const handleSave = () => {
    const cleanUris = localUris.map(normalizeUri).filter(Boolean)
    const cleanDids = localDids.map((d) => d.trim()).filter(Boolean)

    if (cleanUris.length === 0 && cleanDids.length === 0) {
      setError('Enter at least one post URI or author DID')
      return
    }

    const badUri = cleanUris.find((u) => u && !u.startsWith('at://'))
    if (badUri) {
      setError(`"${badUri}" is not a valid AT-URI. Use at://did:.../app.bsky.feed.post/... or a bsky.app post URL.`)
      return
    }

    const badDid = cleanDids.find((d) => d && !d.startsWith('did:'))
    if (badDid) {
      setError(`"${badDid}" is not a valid DID. DIDs start with did: (e.g. did:plc:...).`)
      return
    }

    onSave(nodeId, {
      uris: cleanUris,
      dids: cleanDids,
      name: currentName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isExclude ? 'Quotes Post Excludes' : 'Quotes Post'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          <div className="form-group">
            <label>Mode</label>
            <div className="mode-selector">
              <label className="mode-option">
                <input type="radio" name="mode" value="include" checked={!isExclude} onChange={() => setIsExclude(false)} />
                <div className="mode-content">
                  <div className="mode-label">Include</div>
                  <div className="mode-desc">Posts quoting the specified targets are included</div>
                </div>
              </label>
              <label className="mode-option">
                <input type="radio" name="mode" value="exclude" checked={isExclude} onChange={() => setIsExclude(true)} />
                <div className="mode-content">
                  <div className="mode-label">Exclude</div>
                  <div className="mode-desc">Posts quoting the specified targets are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Quote posts from @example"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Specific Post URIs</label>
            <div className="form-hint" style={{ marginBottom: 6 }}>
              AT-URIs (<code>at://did:.../app.bsky.feed.post/rkey</code>) or bsky.app post URLs.
              Matches posts that quote exactly these posts.
            </div>
            <div className="keywords-list">
              {localUris.map((uri, i) => (
                <div key={i} className="keyword-input-row">
                  <input
                    type="text"
                    placeholder="at://did:plc:.../app.bsky.feed.post/... or bsky.app URL"
                    value={uri}
                    onChange={(e) => updateItem(setLocalUris, localUris, i, e.target.value)}
                    className="form-input keyword-input"
                  />
                  {localUris.length > 1 && (
                    <button className="btn-remove" onClick={() => removeItem(setLocalUris, localUris, i)} title="Remove">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setLocalUris, localUris)} className="btn-secondary" style={{ marginTop: 8 }}>
              + Add URI
            </button>
          </div>

          <div className="form-group">
            <label>Quoted Author DIDs</label>
            <div className="form-hint" style={{ marginBottom: 6 }}>
              Match posts that quote <em>any</em> post by these authors.
              Enter DIDs (<code>did:plc:...</code>).
            </div>
            <div className="keywords-list">
              {localDids.map((did, i) => (
                <div key={i} className="keyword-input-row">
                  <input
                    type="text"
                    placeholder="did:plc:..."
                    value={did}
                    onChange={(e) => updateItem(setLocalDids, localDids, i, e.target.value)}
                    className="form-input keyword-input"
                  />
                  {localDids.length > 1 && (
                    <button className="btn-remove" onClick={() => removeItem(setLocalDids, localDids, i)} title="Remove">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addItem(setLocalDids, localDids)} className="btn-secondary" style={{ marginTop: 8 }}>
              + Add DID
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-info" style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: '#888' }}>
              Checks <code>embed.record.uri</code> (and <code>embed.record.record.uri</code> for quote+media posts).
              If both URIs and DIDs are provided, a match on either is enough.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={handleSave} className="btn-primary">Save</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default QuotePostModal
