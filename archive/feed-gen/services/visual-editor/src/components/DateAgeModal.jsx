import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './DateAgeModal.css'

/**
 * Modal for configuring Post Date block
 * 
 * HOW IT WORKS:
 * - Filters posts by age (time since createdAt)
 * - Supports multiple modes: older than, newer than, between times
 * - Time math: X days/hours old, or posts between specific times (e.g., 9pm-12pm PST)
 * - Matches if post age meets the criteria
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores mode: 'older_than', 'newer_than', 'between_times'
 * - Stores value: { amount: 24, unit: 'hours' } or { start: '21:00', end: '12:00', timezone: 'PST' }
 * - Backend calculates: current_time - post.createdAt and compares
 * 
 * MODES:
 * - Older Than: Post is older than X days/hours
 * - Newer Than: Post is newer than X days/hours
 * - Between Times: Post was created between specific times (e.g., 9pm-12pm PST)
 * 
 * FUTURE:
 * - Account Date block will use same featureset but apply to account.created_at
 * - Will require API resolution to get account metadata
 * 
 * EXAMPLE:
 * - Mode: 'newer_than', Value: { amount: 24, unit: 'hours' }
 * - Post created 12 hours ago → MATCHES
 * - Post created 48 hours ago → NO MATCH
 */
function DateAgeModal({ isOpen, onClose, nodeId, mode, value, name, exclude, onSave }) {
  const [selectedMode, setSelectedMode] = useState(mode || 'newer_than')
  const [amount, setAmount] = useState(value?.amount || 24)
  const [unit, setUnit] = useState(value?.unit || 'hours')
  const [startTime, setStartTime] = useState(value?.start || '21:00')
  const [endTime, setEndTime] = useState(value?.end || '12:00')
  const [timezone, setTimezone] = useState(value?.timezone || 'PST')
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(mode || 'newer_than')
      setAmount(value?.amount || 24)
      setUnit(value?.unit || 'hours')
      setStartTime(value?.start || '21:00')
      setEndTime(value?.end || '12:00')
      setTimezone(value?.timezone || 'PST')
      setBlockName(name || '')
      setIsExclude(exclude || false)
    }
  }, [isOpen, mode, value, name, exclude])

  const handleSave = () => {
    let saveValue
    if (selectedMode === 'between_times') {
      saveValue = {
        start: startTime,
        end: endTime,
        timezone: timezone,
      }
    } else {
      saveValue = {
        amount: amount,
        unit: unit,
      }
    }

    onSave(nodeId, {
      mode: selectedMode,
      value: saveValue,
      name: blockName.trim() || null,
      exclude: isExclude,
    })
    onClose()
  }

  const handleCancel = () => {
    setSelectedMode(mode || 'newer_than')
    setAmount(value?.amount || 24)
    setUnit(value?.unit || 'hours')
    setStartTime(value?.start || '21:00')
    setEndTime(value?.end || '12:00')
    setTimezone(value?.timezone || 'PST')
    setBlockName('')
    setIsExclude(exclude || false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content date-age-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Post Date Block</h3>
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
                  <div className="mode-desc">Posts matching age criteria are included</div>
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
                  <div className="mode-desc">Posts matching age criteria are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Recent Posts Only"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Age Filter Type</label>
            <div className="age-mode-selector">
              <label className="age-mode-option">
                <input
                  type="radio"
                  name="ageMode"
                  value="newer_than"
                  checked={selectedMode === 'newer_than'}
                  onChange={() => setSelectedMode('newer_than')}
                />
                <div className="age-mode-content">
                  <div className="age-mode-label">Newer Than</div>
                  <div className="age-mode-desc">Posts created within last X time</div>
                </div>
              </label>
              <label className="age-mode-option">
                <input
                  type="radio"
                  name="ageMode"
                  value="older_than"
                  checked={selectedMode === 'older_than'}
                  onChange={() => setSelectedMode('older_than')}
                />
                <div className="age-mode-content">
                  <div className="age-mode-label">Older Than</div>
                  <div className="age-mode-desc">Posts created more than X time ago</div>
                </div>
              </label>
              <label className="age-mode-option">
                <input
                  type="radio"
                  name="ageMode"
                  value="between_times"
                  checked={selectedMode === 'between_times'}
                  onChange={() => setSelectedMode('between_times')}
                />
                <div className="age-mode-content">
                  <div className="age-mode-label">Between Times</div>
                  <div className="age-mode-desc">Posts created between specific times</div>
                </div>
              </label>
            </div>
          </div>

          {selectedMode !== 'between_times' && (
            <div className="form-group">
              <label>Age</label>
              <div className="age-input-row">
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                  className="form-input age-amount-input"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="form-select age-unit-select"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
          )}

          {selectedMode === 'between_times' && (
            <>
              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="form-input"
                />
                <div className="form-hint">
                  Start of time range (e.g., 21:00 for 9pm)
                </div>
              </div>

              <div className="form-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="form-input"
                />
                <div className="form-hint">
                  End of time range (e.g., 12:00 for 12pm)
                </div>
              </div>

              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="form-select"
                >
                  <option value="PST">PST (Pacific Standard Time)</option>
                  <option value="PDT">PDT (Pacific Daylight Time)</option>
                  <option value="EST">EST (Eastern Standard Time)</option>
                  <option value="EDT">EDT (Eastern Daylight Time)</option>
                  <option value="CST">CST (Central Standard Time)</option>
                  <option value="CDT">CDT (Central Daylight Time)</option>
                  <option value="MST">MST (Mountain Standard Time)</option>
                  <option value="MDT">MDT (Mountain Daylight Time)</option>
                  <option value="UTC">UTC</option>
                </select>
                <div className="form-hint">
                  Timezone for time range calculation
                </div>
              </div>
            </>
          )}


          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts matching the age criteria will be <strong>excluded</strong>.</>
              ) : (
                <>Posts matching the age criteria will be <strong>included</strong>.</>
              )}
            </p>
            {selectedMode === 'between_times' && (
              <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                Note: "Between times" checks if post was created during the specified time range (e.g., 9pm-12pm PST). This is useful for filtering posts by time of day.
              </p>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default DateAgeModal
