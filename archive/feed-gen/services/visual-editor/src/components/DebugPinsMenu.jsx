import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './DebugPinsMenu.css'

const DROPDOWN_Z = 10050

/**
 * Dropdown: pin the current debug run, list saved pins, run or remove.
 * Menu is portaled to document.body with position:fixed so it is not clipped by the panel.
 */
export default function DebugPinsMenu({
  pins = [],
  canPinCurrent = false,
  onPinCurrent,
  onRunPinned,
  onRemovePin,
  busy = false,
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const dropdownRef = useRef(null)
  const [dropdownPos, setDropdownPos] = useState(null)

  const sortedPins = useMemo(
    () => [...pins].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [pins]
  )

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null)
      return
    }
    const measure = () => {
      const wrap = wrapRef.current
      if (!wrap) return
      const r = wrap.getBoundingClientRect()
      const width = Math.min(300, Math.max(260, window.innerWidth - 16))
      let left = r.right - width
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      const top = r.bottom + 6
      const maxHeight = Math.max(120, window.innerHeight - top - 12)
      setDropdownPos({ top, left, width, maxHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, sortedPins.length])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handlePinCurrent = () => {
    onPinCurrent?.()
    setOpen(false)
  }

  const dropdownContent =
    open && dropdownPos ? (
      <div
        ref={dropdownRef}
        className="debug-pins-dropdown debug-pins-dropdown-portal"
        role="menu"
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxHeight: dropdownPos.maxHeight,
          zIndex: DROPDOWN_Z,
        }}
      >
        <div className="debug-pins-section-label">Quick debug</div>
        <button
          type="button"
          className="debug-pins-add"
          disabled={!canPinCurrent || busy}
          onClick={handlePinCurrent}
          title={canPinCurrent ? 'Save the last run (URL or manual JSON) to this list' : 'Run debug first'}
        >
          + Pin current run…
        </button>
        {sortedPins.length === 0 ? (
          <div className="debug-pins-empty">
            No pins yet. Run debug (URL or test post), then use &quot;Pin current run&quot; to save it here.
          </div>
        ) : (
          <>
            <div className="debug-pins-section-label">Saved</div>
            {sortedPins.map((pin) => (
              <div key={pin.id} className="debug-pins-row">
                <button
                  type="button"
                  className="debug-pins-run"
                  disabled={busy}
                  onClick={() => {
                    onRunPinned?.(pin)
                    setOpen(false)
                  }}
                >
                  <span className="debug-pins-label">{pin.label}</span>
                  <span className="debug-pins-run-kind">
                    {pin.kind === 'url' ? 'Bluesky URL' : 'Manual JSON'}
                  </span>
                </button>
                <button
                  type="button"
                  className="debug-pins-remove"
                  title="Remove pin"
                  onClick={() => onRemovePin?.(pin.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    ) : null

  return (
    <div className="debug-pins-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn-secondary debug-pins-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Pinned posts for quick debug"
      >
        Pins{sortedPins.length > 0 ? ` (${sortedPins.length})` : ''} {open ? '\u25B2' : '\u25BC'}
      </button>
      {typeof document !== 'undefined' && dropdownContent ? createPortal(dropdownContent, document.body) : null}
    </div>
  )
}
