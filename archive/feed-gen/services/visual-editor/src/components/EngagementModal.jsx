import React, { useState, useEffect } from 'react'
import './KeywordModal.css' // Reusing general modal styles

const METRIC_TYPES = [
  { value: 'likes', label: 'Likes' },
  { value: 'replies', label: 'Replies' },
  { value: 'reposts', label: 'Reposts' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'bookmarks', label: 'Bookmarks' },
]

const COMPARISON_OPERATORS = [
  { value: 'greater_than', label: 'Greater than (>)', symbol: '>' },
  { value: 'greater_equal', label: 'Greater than or equal (≥)', symbol: '≥' },
  { value: 'equal', label: 'Equal (=)', symbol: '=' },
  { value: 'less_equal', label: 'Less than or equal (≤)', symbol: '≤' },
  { value: 'less_than', label: 'Less than (<)', symbol: '<' },
]

function EngagementModal({
  isOpen,
  onClose,
  nodeId,
  metricType = 'likes',
  operator = 'greater_than',
  threshold = 0,
  onSave,
}) {
  const [currentMetricType, setCurrentMetricType] = useState(metricType)
  const [currentOperator, setCurrentOperator] = useState(operator)
  const [currentThreshold, setCurrentThreshold] = useState(threshold)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCurrentMetricType(metricType)
      setCurrentOperator(operator)
      setCurrentThreshold(threshold)
      setError('')
    }
  }, [isOpen, metricType, operator, threshold])

  const handleSave = () => {
    const thresholdNum = parseInt(currentThreshold, 10)
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      setError('Threshold must be a non-negative number')
      return
    }

    onSave(nodeId, {
      metricType: currentMetricType,
      operator: currentOperator,
      threshold: thresholdNum,
    })
    onClose()
  }

  if (!isOpen) return null

  const selectedOperator = COMPARISON_OPERATORS.find(op => op.value === currentOperator)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Engagement</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="metricType">Engagement Metric:</label>
            <select
              id="metricType"
              value={currentMetricType}
              onChange={(e) => setCurrentMetricType(e.target.value)}
            >
              {METRIC_TYPES.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="operator">Comparison:</label>
            <select
              id="operator"
              value={currentOperator}
              onChange={(e) => setCurrentOperator(e.target.value)}
            >
              {COMPARISON_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="threshold">Threshold:</label>
            <input
              id="threshold"
              type="number"
              min="0"
              value={currentThreshold}
              onChange={(e) => {
                const val = e.target.value
                setCurrentThreshold(val === '' ? '' : parseInt(val, 10))
              }}
              placeholder="0"
            />
            <div className="form-hint">
              Post must have {selectedOperator?.symbol || '>'} {currentThreshold || 0}{' '}
              {METRIC_TYPES.find((m) => m.value === currentMetricType)?.label.toLowerCase() ||
                'likes'}
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

export default EngagementModal
