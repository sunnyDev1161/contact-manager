const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫']

// A physical-register-style keypad. `value` is the string being edited;
// the parent owns the state so it can seed/clear it (e.g. per selected
// cart line) and validate on confirm.
export default function NumericKeypad({ value, onChange, onConfirm, confirmLabel = 'OK', disabled = false }) {
  function press(key) {
    if (disabled) return
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.' && value.includes('.')) return
    onChange(value + key)
  }

  return (
    <div className="keypad">
      <div className="keypad-grid">
        {KEYS.map(k => (
          <button
            key={k}
            type="button"
            className={k === '⌫' ? 'keypad-key keypad-backspace' : 'keypad-key'}
            onClick={() => press(k)}
            disabled={disabled}
          >
            {k}
          </button>
        ))}
      </div>
      {onConfirm && (
        <button type="button" className="keypad-confirm" onClick={onConfirm} disabled={disabled}>
          {confirmLabel}
        </button>
      )}
    </div>
  )
}
