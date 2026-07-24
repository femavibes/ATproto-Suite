import React, { useEffect, useMemo, useState } from 'react'
import './RotatingPostsModal.css'

function normalizeItem(item, fallbackPriority) {
  if (!item || typeof item !== 'object') {
    return { uri: '', priority: fallbackPriority }
  }
  return {
    uri: String(item.uri || item.postUri || '').trim(),
    priority: Number.isFinite(Number(item.priority)) ? Math.max(1, parseInt(item.priority, 10)) : fallbackPriority,
  }
}

function PinnedPostsModal({ isOpen, onClose, nodeId, items, name, onSave }) {
  const [localName, setLocalName] = useState(name || '')
  const [localItems, setLocalItems] = useState([{ uri: '', priority: 1 }])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const source = Array.isArray(items) && items.length > 0 ? items : [{ uri: '', priority: 1 }]
    setLocalItems(source.map((item, idx) => normalizeItem(item, idx + 1)))
    setLocalName(name || '')
    setError('')
  }, [isOpen, items, name])

  const priorities = useMemo(
    () => localItems.map((i) => parseInt(i.priority, 10)).filter((n) => Number.isFinite(n) && n > 0),
    [localItems]
  )

  const hasDuplicatePriority = useMemo(() => {
    return new Set(priorities).size !== priorities.length
  }, [priorities])

  const updateItem = (index, patch) => {
    setLocalItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addItem = () => {
    setLocalItems((prev) => [...prev, { uri: '', priority: prev.length + 1 }])
  }

  const removeItem = (index) => {
    setLocalItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const handleSave = () => {
    const cleaned = localItems
      .map((item, idx) => normalizeItem(item, idx + 1))
      .filter((item) => item.uri)

    if (cleaned.length === 0) {
      setError('Add at least one post URI.')
      return
    }

    const used = new Set()
    for (const item of cleaned) {
      if (used.has(item.priority)) {
        setError('Priorities must be unique within this node.')
        return
      }
      used.add(item.priority)
    }

    if (onSave && nodeId) {
      onSave(nodeId, {
        items: cleaned,
        name: localName.trim(),
      })
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pinned Posts</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Node Name (optional)</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Pinned Posts"
            />
          </div>

          <div className="form-group">
            <label>Pinned Items</label>
            {localItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={item.uri}
                  onChange={(e) => updateItem(idx, { uri: e.target.value })}
                  placeholder="at://... or https://bsky.app/profile/.../post/..."
                />
                <input
                  type="number"
                  min="1"
                  value={item.priority}
                  onChange={(e) => updateItem(idx, { priority: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                  placeholder="Priority"
                />
                <button className="btn-secondary" type="button" onClick={() => removeItem(idx)} title="Remove row">
                  ×
                </button>
              </div>
            ))}
            <button className="btn-secondary" type="button" onClick={addItem}>
              + Add pinned post
            </button>
            <div className="form-hint">
              Lower number = higher priority inside this node (1 first). Priorities must be unique.
            </div>
            {hasDuplicatePriority && (
              <div className="error-message" style={{ marginTop: 6 }}>
                Duplicate priorities detected. Each row needs a unique priority.
              </div>
            )}
          </div>
          {error ? <div className="error-message">{error}</div> : null}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default PinnedPostsModal

