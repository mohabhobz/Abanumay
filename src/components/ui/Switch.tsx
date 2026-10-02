import type { ReactNode } from 'react'

/**
 * On/off switch · for a setting that applies the moment it changes (no save button).
 *
 * A filter chip (`Toggle`) narrows a list; this changes how the system behaves for its owner, so it
 * reads as a setting: label and explanation on the start side, the switch at the end. The whole
 * row is the hit target, so it keeps the 44px control height even though the track is smaller.
 */
export function Switch({
  label, note, on, onChange, disabled, lockNote,
}: {
  label: ReactNode
  note?: ReactNode
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** Why the switch is locked · shown under the label instead of a silent disabled control */
  lockNote?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`swrow${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="swrow-t">
        <span className="swrow-l">{label}</span>
        {(note || (disabled && lockNote)) && <span className="sub swrow-n">{disabled && lockNote ? lockNote : note}</span>}
      </span>
      <span className="swt" aria-hidden="true"><i /></span>
    </button>
  )
}
