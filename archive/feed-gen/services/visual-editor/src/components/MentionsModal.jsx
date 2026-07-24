import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

function MentionsModal({ isOpen, onClose, nodeId, mentions = [], listUris = [], name = "", exclude = false, onSave }) {
  const [localMentions, setLocalMentions] = useState(mentions && mentions.length > 0 ? mentions : [''])
  const [localListUris, setLocalListUris] = useState(listUris || [])
  const [currentName, setCurrentName] = useState(name)
  const [isExclude, setIsExclude] = useState(exclude)
  const [newListUri, setNewListUri] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLocalMentions(mentions && mentions.length > 0 ? mentions : [''])
      setLocalListUris(listUris || [])
      setCurrentName(name || '')
      setIsExclude(exclude || false)
      setNewListUri('')
      setError('')
    }
  }, [isOpen, mentions, listUris, name, exclude])

  // Helper function to validate a mention (handle or DID)
  const isValidMention = (mention) => {
    if (!mention || mention.trim() === '') return false
    const trimmed = mention.trim()
    const isHandle = /^[a-zA-Z][a-zA-Z0-9.]*$/.test(trimmed)
    const isDID = trimmed.startsWith('did:')
    return isHandle || isDID
  }

  const addMention = () => {
    setLocalMentions([...localMentions, ''])
  }

  const removeMention = (index) => {
    if (localMentions.length > 1) {
      setLocalMentions(localMentions.filter((_, i) => i !== index))
    }
  }

  const updateMention = (index, value) => {
    const updated = [...localMentions]
    updated[index] = value
    setLocalMentions(updated)
    // Clear error when user starts typing
    if (error) setError('')
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
    // Filter out empty mentions and validate
    const validMentions = localMentions
      .map(m => m.trim())
      .filter(m => m !== '')

    // Check if we have at least one mention or list
    if (validMentions.length === 0 && localListUris.length === 0) {
      setError('Please enter at least one handle, DID, or list URI')
      return
    }

    // Validate all mentions
    const invalidMentions = validMentions.filter(m => !isValidMention(m))
    if (invalidMentions.length > 0) {
      setError(`Invalid mentions: ${invalidMentions.join(', ')}. Mentions must be handles (e.g., "user.bsky.social") or DIDs (e.g., "did:plc:...")`)
      return
    }

    // Remove duplicates
    const uniqueMentions = Array.from(new Set(validMentions))

    onSave(nodeId, {
      mentions: uniqueMentions,
      listUris: localListUris,
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
          <h2>{isExclude ? 'Mentions Excludes' : 'Mentions Contains'}</h2>
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
                  <div className="mode-desc">Posts mentioning selected users are included</div>
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
                  <div className="mode-desc">Posts mentioning selected users are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Mentions Important Users"
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block (shown below "Mentions")
            </div>
          </div>


          <div className="form-group">
            <label>Individual Mentions</label>
            <div className="keywords-list">
              {localMentions.map((mention, index) => (
                <div key={index} className="keyword-input-row">
                  <input
                    type="text"
                    placeholder="Enter handle (e.g., user.bsky.social) or DID (e.g., did:plc:...)"
                    value={mention}
                    onChange={(e) => updateMention(index, e.target.value)}
                    className="form-input keyword-input"
                  />
                  {localMentions.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => removeMention(index)}
                      title="Remove mention"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addMention}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              + Add Mention
            </button>
            <div className="form-hint" style={{ marginTop: '5px' }}>
              Enter Bluesky handles (e.g., "user.bsky.social") or DIDs (e.g., "did:plc:...")
            </div>
          </div>

          <div className="form-group">
            <label>Lists</label>
            <div className="list-input-row">
              <input
                type="text"
                placeholder="at://did:plc:xxx/app.bsky.graph.list/xxx"
                value={newListUri}
                onChange={(e) => setNewListUri(e.target.value)}
                className="form-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addList()
                  }
                }}
              />
              <button className="btn-secondary" onClick={addList}>
                Add List
              </button>
            </div>
            {localListUris.length > 0 && (
              <div className="lists-display" style={{ marginTop: '10px' }}>
                {localListUris.map((uri, index) => (
                  <div key={index} className="list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{uri}</span>
                    <button
                      className="btn-remove"
                      onClick={() => removeList(index)}
                      title="Remove list"
                      style={{ marginLeft: '8px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="form-hint" style={{ marginTop: '5px' }}>
              List URI matching is not implemented yet (saved for future backend list resolution).
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

export default MentionsModal
