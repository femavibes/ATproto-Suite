import React, { useMemo, useState, useEffect } from 'react'

function EndFeedBindingModal({
  isOpen,
  nodeId,
  currentFeedId,
  availableFeeds,
  onClose,
  onSave,
}) {
  const [selectedFeedId, setSelectedFeedId] = useState(currentFeedId || '')

  useEffect(() => {
    setSelectedFeedId(currentFeedId || '')
  }, [currentFeedId, isOpen])

  const options = useMemo(() => availableFeeds || [], [availableFeeds])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Bind Feed to END</h2>
        <p style={{ marginTop: 0, color: '#aaa', fontSize: '12px' }}>
          Select one unbound feed from Feed Management.
        </p>

        <div className="form-group">
          <label>Feed</label>
          <select
            className="form-input"
            value={selectedFeedId}
            onChange={(e) => setSelectedFeedId(e.target.value)}
          >
            <option value="">Unbound</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.slug || 'no-slug'})
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button
            onClick={() => onSave(nodeId, selectedFeedId)}
            className="btn-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default EndFeedBindingModal
