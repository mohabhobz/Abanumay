import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import type { AgreementRow } from '@/types/domain'
import type { AgrAction } from '@/data/agreements/store'
import { noteFirst } from '@/lib/dock'

/* Agreement exits · what differentiates the stations of the flow (BPD-008).

   A return doesn't have a single destination, and that's easy to forget. The spec names each
   return's destination individually, and they differ:

   Manager's return → grants supervisor
   Executive's return → **the grants manager**, not the supervisor (8.2.19)
   Entity's return → **the grants supervisor**, not the manager (8.2.25)

   So the destination is written into the button's own name. Sending to the entity doesn't exist
   before the executive's approval · not disabled, simply absent (8.4.13). And after signing there
   are no content exits · a change opens a new version (8.4.17).

   The actions come from the store (`agrActions`) and run through it · this dock only collects the
   note or the signed copy, and states why an action is blocked. */

export interface AgrActionDockProps {
  who: string
  agreement: AgreementRow
  actions: AgrAction[]
  note: string
  onNote: (v: string) => void
  /** Why the forward action is blocked · the completeness check's first finding */
  stop?: string
  /** The store's answer to the last action · shown in the bar */
  said?: string
  onAct: (a: AgrAction, file?: string) => void
}

export function AgrActionDock({ who, agreement, actions, note, onNote, stop, said, onAct }: AgrActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const needNote = actions.some((a) => a.needsNote)

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={who} size="lg" quiet={false} />
          <span className="decsent">
            قرارك في اتفاقية <b>{agreement.projectName}</b>
            <span className="decsep" />
            <Money>{agreement.amount}</Money>
            {said && <><span className="decsep" /><span className="bad">{said}</span></>}
          </span>
        </div>

        {/* The field and buttons are one wrapping group, so the field doesn't get separated from
            the "return" button when the dock wraps onto two lines */}
        <div className="payact-g">
          {needNote && (
            <label className="payact-n">
              <span className="vis-h">ملاحظات الإعادة</span>
              <input value={note} onChange={(e) => onNote(e.target.value)} placeholder="سبب الإعادة · إلزامي" aria-label="ملاحظات الإعادة" />
            </label>
          )}

          <div className="rowf gp-2">
            {noteFirst(actions).map((x) => {
              const why = x.needsNote && !note.trim()
                ? /* doc 8.2.15 */ 'اكتب السبب أولًا'
                : x.kind === 'btn-p' && !x.needsFile && stop ? stop : ''
              if (x.needsFile) {
                return (
                  <label key={x.label} className={`btn ${x.kind}`} title={`خطوة ${x.step} في الوثيقة`}>
                    <Icon name={icons.upload} size="sm" />{x.label}
                    <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={x.label} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAct(x, f.name); e.target.value = '' }} />
                  </label>
                )
              }
              return (
                <button
                  key={x.label}
                  className={`btn ${x.kind}`}
                  data-needs-note={x.needsNote ? '' : undefined}
                  disabled={Boolean(why)}
                  title={why || `خطوة ${x.step} في الوثيقة`}
                  onClick={() => onAct(x)}
                >
                  {x.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
