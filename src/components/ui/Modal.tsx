import type { MouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import type { IconGlyph } from './icons'

/* The system's one modal.

   A frosted mask over the page and a dialog card centred on it, portalled to `document.body` so no
   ancestor's `backdrop-filter` or stacking context can trap it. A click on the mask closes it, a
   click inside the card doesn't. The card's inside is the caller's: a `ModalHead`, then the
   `.mb` body and the `.mf` footer as each dialog needs them.

   - `className` adds to the card (`modal-w` wide, `modal-xl` extra wide)
   - `mask` adds to the mask (`decsheet` · the decision sheet's variant)
   - `escape` also closes it on Escape while focus is inside */

export interface ModalProps {
  /** The dialog's accessible name */
  label: string
  onClose: () => void
  /** Extra classes on the card · `modal-w`, `modal-xl` */
  className?: string
  /** Extra classes on the mask · `decsheet` */
  mask?: string
  /** Escape closes the dialog */
  escape?: boolean
  children: ReactNode
}

export function Modal({ label, onClose, className, mask, escape, children }: ModalProps) {
  return createPortal(
    <div
      className={mask ? `bmask ${mask}` : 'bmask'}
      role="presentation"
      onClick={onClose}
      onKeyDown={escape ? (e) => { if (e.key === 'Escape') onClose() } : undefined}
    >
      <div
        className={className ? `chrome modal ${className}` : 'chrome modal'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** The modal's title row · an icon, the title, then anything that sits after it (a tag, a note) */
export function ModalHead({ icon, title, children }: { icon?: IconGlyph; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mh">
      {icon && <Icon name={icon} size="md" />}
      <b>{title}</b>
      {children}
    </div>
  )
}
