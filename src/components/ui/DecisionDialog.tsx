import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { icons } from './icons'

/* Client 26 Oct · «أي شاشة فيها البار ده وفيه سبب هيتكتب … لما أدوس على الأكشن يطلعلي بوب أب فيها
   السبب أو كونفيرميشن للقرار · الإكسبيريانس لازم تتوحّد في كل حتة».

   The one confirmation of a decision taken from a page's action bar. The bar holds the buttons only ·
   never a note field beside them · a press opens this popup: what is decided and on what, the fields
   the decision needs (an amount, a file), the reason when the decision needs one (a return, a
   rejection, a cancellation · required), and «تأكيد». A decision that can't run says why inside it.
   The project page's decision bar already worked this way · every other bar now does the same. */

export interface DecisionDialogProps {
  /** The action as its button says it */
  title: string
  /** One line under the title · the record and its amount */
  subject?: ReactNode
  tone?: 'btn-p' | 'btn-2' | 'btn-d'
  /** The reason · `required` for a return, a rejection, a cancellation · `optional` adds a note */
  note?: 'required' | 'optional' | false
  noteLabel?: string
  notePlaceholder?: string
  /** The reason the popup opens with · still editable */
  initialNote?: string
  /** What stops the decision now · shown, and the confirm stays off */
  stops?: string[]
  /** The decision's own fields (an amount, a file) above the reason */
  children?: ReactNode
  /** The decision's own fields are complete */
  ready?: boolean
  confirmLabel?: string
  /** Runs it · returns what refused it (the popup stays open and says so) */
  onConfirm: (note: string) => string[] | void
  onClose: () => void
}

export function DecisionDialog({
  title, subject, tone = 'btn-p', note = false, noteLabel, notePlaceholder, initialNote = '', stops = [], children, ready = true,
  confirmLabel, onConfirm, onClose,
}: DecisionDialogProps) {
  const [text, setText] = useState(initialNote)
  const [bad, setBad] = useState<string[]>([])
  const must = note === 'required'
  const label = noteLabel ?? (must ? 'السبب' : 'ملاحظة')
  const off = stops.length > 0 || !ready || (must && !text.trim())
  const why = stops[0] ?? (!ready ? 'أكمل الحقول أولًا' : must && !text.trim() ? 'اكتب السبب أولًا' : undefined)
  const go = () => {
    const out = onConfirm(text.trim())
    if (out && out.length) { setBad(out); return }
    onClose()
  }
  return createPortal(
    <div className="bmask decsheet" role="presentation" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <Icon name={tone === 'btn-d' ? icons.alert : icons.check} size="md" />
          <b>{title}</b>
        </div>
        <div className="mb col">
          {subject && <p className="sub cnote">{subject}</p>}
          {[...stops, ...bad].length > 0 && (
            <ul className="payq-ck decwhy">
              {[...stops, ...bad].map((w) => (
                <li key={w} className="no"><Icon name={icons.alert} size="sm" /><span>{w}</span></li>
              ))}
            </ul>
          )}
          {children}
          {note && (
            <label className="regf regf-w">
              <span className="lb">{label}{must && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
              <span className="fld fld-a">
                <textarea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={label}
                  placeholder={notePlaceholder ?? (must ? 'يُسجَّل مع القرار ويصل إلى صاحب الخطوة' : 'اختيارية · تُسجَّل مع القرار')} />
              </span>
            </label>
          )}
          {!note && stops.length === 0 && <p className="sub cnote">يُسجَّل القرار باسمك ووقته في سجل الإجراء.</p>}
        </div>
        <div className="mf">
          <button type="button" className={`btn ${tone === 'btn-d' ? 'btn-d' : 'btn-p'}`} disabled={off} title={why} onClick={go}>
            {confirmLabel ?? `تأكيد: ${title}`}
          </button>
          <button type="button" className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export interface DockAction {
  label: string
  kind: string
  needsNote?: boolean
  /** What stops it now · the button stays off with the first one as its title */
  stops?: string[]
  /** The button's title when it runs */
  why?: string
  /** No reason field at all · a plain confirmation */
  plain?: boolean
}

/** A bar's buttons · each opens the one confirmation popup · the actions that need a reason first,
    the primary action last, as `noteFirst` ordered them */
export function DockActions<T extends DockAction>({ actions, subject, onRun, placeholder }: {
  actions: T[]
  subject?: ReactNode
  onRun: (a: T, note: string) => string[] | void
  placeholder?: string
}) {
  const [pick, setPick] = useState<T | null>(null)
  const order = [...actions.filter((x) => x.needsNote), ...actions.filter((x) => !x.needsNote)]
  return (
    <>
      <div className="rowf gp-2">
        {order.map((a) => (
          <button key={a.label} type="button" className={`btn ${a.kind}`} data-needs-note={a.needsNote ? '' : undefined}
            disabled={Boolean(a.stops?.length)} title={a.stops?.[0] ?? a.why} onClick={() => setPick(a)}>
            {a.label}
          </button>
        ))}
      </div>
      {pick && (
        <DecisionDialog
          title={pick.label}
          tone={pick.kind.includes('btn-d') ? 'btn-d' : 'btn-p'}
          subject={subject}
          note={pick.needsNote ? 'required' : pick.plain ? false : 'optional'}
          notePlaceholder={pick.needsNote ? placeholder : undefined}
          stops={pick.stops}
          onClose={() => setPick(null)}
          onConfirm={(n) => onRun(pick, n)}
        />
      )}
    </>
  )
}
