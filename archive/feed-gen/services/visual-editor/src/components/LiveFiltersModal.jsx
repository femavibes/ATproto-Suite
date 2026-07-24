import React from 'react'

function renderList(values, fallback = 'None') {
  if (!Array.isArray(values) || values.length === 0) return <span>{fallback}</span>
  return <span>{values.join(', ')}</span>
}

function LiveFiltersModal({ isOpen, loading, applying, summary, filters = [], onClose, onApplyIngestionFilters }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Live Filters</h2>
        <p style={{ marginTop: 0, color: '#aaa', fontSize: 12 }}>
          These are active prefilters from live feed logic.
        </p>
        <div style={{ marginBottom: 8 }}>
          <button
            className="btn-secondary"
            onClick={onApplyIngestionFilters}
            disabled={loading || applying}
            title="Promote draft rules to live filters for this project only"
          >
            {applying ? 'Updating ingestion filters...' : 'Update Ingestion Filters'}
          </button>
        </div>

        {loading ? (
          <div className="form-group">Loading live filters...</div>
        ) : filters.length === 0 ? (
          <div className="form-group">No feeds found in this project.</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: 8 }}>
            <div
              style={{
                border: '1px solid #3a3a3a',
                borderRadius: 8,
                padding: 10,
                marginBottom: 10,
                background: '#202630',
              }}
            >
              <div style={{ fontWeight: 700 }}>Project consolidated filters</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>
                <strong>Keywords:</strong> {renderList(summary?.keywordStems)}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                <strong>Language filters:</strong> {renderList(summary?.languageCodes)}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                <strong>Regex filters:</strong> {renderList(summary?.regexPatterns)}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                <strong>Safety flags:</strong>{' '}
                keywordGateUnsafe={String(!!summary?.unsafeToDropForKeywordGate)}; languageGateUnsafe=
                {String(!!summary?.unsafeToDropForLanguageGate)}
              </div>
              {Array.isArray(summary?.notes) && summary.notes.length > 0 && (
                <div style={{ fontSize: 12, color: '#8f8f8f', marginTop: 4 }}>
                  <strong>Notes:</strong> {summary.notes.join(' | ')}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#8f8f8f', marginBottom: 8 }}>Per-feed breakdown</div>
            {filters.map((feed) => (
              <div
                key={feed.id}
                style={{
                  border: '1px solid #3a3a3a',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  background: '#1f1f1f',
                }}
              >
                <div style={{ fontWeight: 600 }}>{feed.name}</div>
                <div style={{ fontSize: 12, color: '#8f8f8f', marginTop: 2 }}>
                  slug: {feed.slug || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>
                  <strong>Keywords:</strong> {renderList(feed.keywordStems)}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  <strong>Language filters:</strong> {renderList(feed.languageCodes)}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  <strong>Regex filters:</strong> {renderList(feed.regexPatterns)}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  <strong>Safety flags:</strong>{' '}
                  keywordGateUnsafe={String(feed.unsafeToDropForKeywordGate)}; languageGateUnsafe=
                  {String(feed.unsafeToDropForLanguageGate)}
                </div>
                {Array.isArray(feed.notes) && feed.notes.length > 0 && (
                  <div style={{ fontSize: 12, color: '#8f8f8f', marginTop: 4 }}>
                    <strong>Notes:</strong> {feed.notes.join(' | ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">Close</button>
        </div>
      </div>
    </div>
  )
}

export default LiveFiltersModal
