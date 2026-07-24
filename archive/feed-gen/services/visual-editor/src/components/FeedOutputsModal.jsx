import React, { useState } from 'react'

function FeedOutputsModal({
  isOpen,
  projects = [],
  selectedProjectId = '',
  onSelectProject,
  onCreateProject,
  feeds,
  bindings,
  onClose,
  onCreateFeed,
  onEditFeed,
  onTogglePublished,
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [avatar, setAvatar] = useState('')

  const create = () => {
    if (!name.trim()) {
      alert('Feed name is required')
      return
    }
    if (!slug.trim()) {
      alert('Feed slug is required')
      return
    }
    onCreateFeed({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      avatar: avatar.trim(),
    })
    setName('')
    setSlug('')
    setDescription('')
    setAvatar('')
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Feed Management</h2>
        <div className="form-group">
          <label>Project</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="form-input"
              value={selectedProjectId}
              onChange={(e) => onSelectProject?.(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              className="btn-secondary"
              onClick={() => {
                const name = window.prompt('Project name')
                if (!name) return
                const description = window.prompt('Project description', '') ?? ''
                onCreateProject?.({ name: name.trim(), description: description.trim() })
              }}
            >
              New Project
            </button>
          </div>
        </div>
        <p style={{ marginTop: 0, color: '#aaa', fontSize: '12px' }}>
          Create feeds here. END nodes only bind to available feeds.
        </p>

        <div style={{ border: '1px solid #3a3a3a', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Create feed</div>
          <div className="form-group">
            <label>Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Slug</label>
            <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Avatar URL</label>
            <input className="form-input" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
          </div>
          <button className="btn-save" onClick={create}>Create Feed</button>
        </div>

        <div style={{ maxHeight: '360px', overflowY: 'auto', marginTop: '8px' }}>
          {feeds.length === 0 ? (
            <div className="form-group">No feeds yet.</div>
          ) : (
            feeds.map((f) => (
              <div
                key={f.id}
                style={{
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '8px',
                  background: '#1f1f1f',
                }}
              >
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                  feedId: {f.id} · slug: {f.slug || '—'}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  Bound END: {bindings.get(f.id) || 'unbound'}
                </div>
                {f.description && (
                  <div style={{ fontSize: '12px', color: '#8f8f8f', marginTop: '2px' }}>
                    {f.description}
                  </div>
                )}
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const next = window.prompt('Feed name', f.name)
                      if (next === null) return
                      const nextSlug = window.prompt('Feed slug', f.slug || '')
                      if (nextSlug === null) return
                      const nextDesc = window.prompt('Feed description', f.description || '')
                      if (nextDesc === null) return
                      const nextAvatar = window.prompt('Feed avatar URL', f.avatar || '')
                      if (nextAvatar === null) return
                      onEditFeed(f.id, {
                        name: next.trim(),
                        slug: nextSlug.trim(),
                        description: nextDesc.trim(),
                        avatar: nextAvatar.trim(),
                      })
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-save"
                    style={{ marginLeft: 8 }}
                    onClick={() => onTogglePublished(f.id)}
                  >
                    {f.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">Close</button>
        </div>
      </div>
    </div>
  )
}

export default FeedOutputsModal
