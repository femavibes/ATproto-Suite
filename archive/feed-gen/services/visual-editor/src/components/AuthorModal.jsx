import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './AuthorModal.css'

/**
 * Modal for configuring Author block
 * 
 * HOW IT WORKS:
 * - Matches posts by author DID or handle
 * - Supports individual authors (DIDs/handles) and lists
 * - Lists can be: User Lists, Moderation Lists, Starter Packs, or AT Protocol Lists
 * - Matches if author is ANY of the selected authors OR in ANY of the selected lists (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores authors: ['did:plc:xxx', 'alice.bsky.social'] (mix of DIDs and handles)
 * - Stores list URIs: ['at://did:plc:xxx/app.bsky.graph.list/xxx']
 * - Backend checks: post.author_did in authors OR post.author_did in list_members
 * 
 * LIST TYPES:
 * - User Lists: Custom lists created by users (follows, blocks, etc.)
 * - Moderation Lists: Lists for moderation purposes
 * - Starter Packs: Lists used in starter packs
 * - AT Protocol Lists: Any app.bsky.graph.list
 * 
 * EXAMPLE:
 * - Authors: ['did:plc:xxx', 'alice.bsky.social']
 * - Lists: ['at://did:plc:yyy/app.bsky.graph.list/vip-users']
 * - Post by alice.bsky.social → MATCHES
 * - Post by user in vip-users list → MATCHES
 * - Post by other user → NO MATCH
 */
function AuthorModal({ isOpen, onClose, nodeId, authors, listUris, name, exclude, onSave }) {
  const [localAuthors, setLocalAuthors] = useState(authors || [''])
  const [localListUris, setLocalListUris] = useState(listUris || [''])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)
  const [newListUri, setNewListUri] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalAuthors(authors && authors.length > 0 ? authors : [''])
      setLocalListUris(listUris || [])
      setBlockName(name || '')
      setIsExclude(exclude || false)
      setNewListUri('')
    }
  }, [isOpen, authors, listUris, name, exclude])

  const addAuthor = () => {
    setLocalAuthors([...localAuthors, ''])
  }

  const removeAuthor = (index) => {
    if (localAuthors.length > 1) {
      setLocalAuthors(localAuthors.filter((_, i) => i !== index))
    }
  }

  const updateAuthor = (index, value) => {
    const updated = [...localAuthors]
    updated[index] = value
    setLocalAuthors(updated)
  }

  const addList = () => {
    if (newListUri.trim()) {
      setLocalListUris([...localListUris, newListUri.trim()])
      setNewListUri('')
    }
  }

  const removeList = (index) => {
    setLocalListUris(localListUris.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    // Filter out empty authors
    const validAuthors = localAuthors.filter((a) => a.trim() !== '')
    
    if (validAuthors.length === 0 && localListUris.length === 0) {
      return
    }

    onSave(nodeId, {
      authors: validAuthors,
      listUris: localListUris,
      name: blockName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalAuthors(authors && authors.length > 0 ? authors : [''])
    setLocalListUris(listUris || [])
    setBlockName('')
    setIsExclude(exclude || false)
    setNewListUri('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content author-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Author Block</h3>
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
                  <div className="mode-desc">Posts by selected authors are included</div>
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
                  <div className="mode-desc">Posts by selected authors are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., VIP Authors"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Individual Authors</label>
            <div className="authors-list">
              {localAuthors.map((author, index) => (
                <div key={index} className="author-input-row">
                  <input
                    type="text"
                    placeholder="DID (did:plc:xxx) or handle (alice.bsky.social)"
                    value={author}
                    onChange={(e) => updateAuthor(index, e.target.value)}
                    className="form-input author-input"
                  />
                  {localAuthors.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeAuthor(index)}
                      title="Remove author"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-add-keyword" onClick={addAuthor}>
              + Add Author
            </button>
          </div>

          <div className="form-group">
            <label>Lists</label>
            <div className="list-input-row">
              <input
                type="text"
                placeholder="List URI (at://did:plc:xxx/app.bsky.graph.list/xxx)"
                value={newListUri}
                onChange={(e) => setNewListUri(e.target.value)}
                className="form-input list-input"
              />
              <button className="btn-add-list" onClick={addList} disabled={!newListUri.trim()}>
                Add
              </button>
            </div>
            {localListUris.length > 0 && (
              <div className="lists-list">
                {localListUris.map((uri, index) => (
                  <div key={index} className="list-item">
                    <div className="list-uri">{uri}</div>
                    <button
                      className="btn-remove-small"
                      onClick={() => removeList(index)}
                      title="Remove list"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="form-hint">
              Supports: User Lists, Moderation Lists, Starter Packs, AT Protocol Lists
            </div>
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts by <strong>any</strong> selected author or in <strong>any</strong> selected list will be <strong>excluded</strong>.</>
              ) : (
                <>Posts by <strong>any</strong> selected author or in <strong>any</strong> selected list will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Authors can be specified as DIDs (did:plc:xxx) or handles (alice.bsky.social). Lists are specified by AT Protocol URI.
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
            disabled={localAuthors.filter(a => a.trim()).length === 0 && localListUris.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthorModal
