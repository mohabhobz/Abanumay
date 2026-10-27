import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { icons } from './icons'

/* Client 26 Oct · «أي سطر من السطور الاسترشادية … يتشال» · the gray guidance sentences under the
   cards are gone. The few a reader still needs (a rule that explains why a number reads the way it
   does) sit behind one (i) beside the card's title · hovered or focused it opens, and the card
   itself stays data only. */
export function Hint({ text }: { text: ReactNode }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const id = useId()
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setAt({ x: r.left + r.width / 2, y: r.bottom + 6 })
  }
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="hint"
        aria-label={typeof text === 'string' ? text : 'تفاصيل الرقم'}
        aria-describedby={at ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setAt(null)}
        onFocus={show}
        onBlur={() => setAt(null)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (at) setAt(null); else show() }}
      >
        <Icon name={icons.info} size="sm" />
      </button>
      {at && createPortal(
        <span id={id} role="tooltip" className="hint-tip" style={{ left: at.x, top: at.y }}>{text}</span>,
        document.body,
      )}
    </>
  )
}
