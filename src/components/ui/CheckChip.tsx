import type { ReactNode } from 'react'
import { CheckMark } from './menu'

/* 24 Oct · on the client's comment · a chip in a multiple choice shows a checkbox · the selected ones
   read as selected at a glance (a filled box with its mark, a firmer surface), not by a ring that
   barely differs from its neighbours. One component for every multi-select chip row, so a new row
   can't drift back to a bare toggle. A single choice stays a radio chip (`role="radio"`). */

export interface CheckChipProps {
  on: boolean
  onToggle: () => void
  disabled?: boolean
  title?: string
  /** For a chip that opens a field when picked («أخرى») */
  expands?: boolean
  children: ReactNode
}

export function CheckChip({ on, onToggle, disabled, title, expands, children }: CheckChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-expanded={expands ? on : undefined}
      disabled={disabled}
      title={title}
      className={`cfgchip ckchip${on ? ' on' : ''}`}
      onClick={onToggle}
    >
      <span className="ckchip-b" aria-hidden="true">{on && <CheckMark />}</span>
      {children}
    </button>
  )
}
