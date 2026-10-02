import { useContext, useEffect, type ReactNode } from 'react'
import { DockSlot as Slot } from './dockSlot'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { BulkBar } from './BulkBar'

/**
 * Unsaved-changes bar · the system's action dock, not buttons in a card header.
 *
 * Saving a draft is the same moment as a bulk decision: something is pending and waits on you. So
 * it takes the same floating dock (count, sentence, actions, ✕), and the user who already knows
 * that bar from the projects list reads it without reading. ✕ discards the draft.
 *
 * The editor that owns the draft sits deep in the page, but the dock must live beside the page's
 * view stack (that's what it floats over). A page provides a slot with `useDockSlot`, and any
 * editor inside renders `<SaveBar>` into it; the page also learns the dock is up, so its content
 * gets the bottom space the dock covers.
 */

export interface SaveBarProps {
  count: number
  sentence: ReactNode
  onSave: () => void
  onDiscard: () => void
  saveLabel?: string
  disabled?: boolean
}

export function SaveBar({ count, sentence, onSave, onDiscard, saveLabel = 'احفظ', disabled }: SaveBarProps) {
  const slot = useContext(Slot)
  const setOn = slot?.setOn
  useEffect(() => {
    setOn?.(true)
    return () => setOn?.(false)
  }, [setOn])
  if (!slot?.el) return null
  return createPortal(
    <BulkBar count={count} sentence={sentence} onClear={onDiscard} clearLabel="تراجع عن التغييرات">
      <button type="button" className="btn btn-2 btn-sm" onClick={onDiscard}>تراجع</button>
      <button type="button" className="btn btn-p btn-sm" onClick={onSave} disabled={disabled}>
        <Icon name={icons.check} size="sm" />
        {saveLabel}
      </button>
    </BulkBar>,
    slot.el,
  )
}
