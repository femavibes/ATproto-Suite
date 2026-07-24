/**
 * Persisted "pinned" posts/URLs for quick re-debug (localStorage).
 */

const STORAGE_KEY = 'visual-editor-debug-pins-v1'
const MAX_PINS = 30

function validatePin(p) {
  if (!p || typeof p !== 'object') return false
  if (typeof p.id !== 'string' || typeof p.label !== 'string') return false
  if (p.kind === 'url') return typeof p.url === 'string' && p.url.length > 0
  if (p.kind === 'post') return p.testPost != null && typeof p.testPost === 'object'
  return false
}

export function loadDebugPins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(validatePin).slice(-MAX_PINS)
  } catch {
    return []
  }
}

export function saveDebugPins(pins) {
  try {
    const trimmed = Array.isArray(pins) ? pins.slice(-MAX_PINS) : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.warn('Could not save debug pins', e)
  }
}
