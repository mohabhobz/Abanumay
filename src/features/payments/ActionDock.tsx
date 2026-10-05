import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { payStops, type PayAction } from '@/data/payments/store'
import type { CurrentUser, PayRequest } from '@/types/domain'
import { noteFirst } from '@/lib/dock'

/* Request exits - what distinguishes screens 3, 4 and 5 in the spec.

   The spec describes three review screens, and all three show the same request with the same
   attachments, conditions, and log - the only difference is the exits. The exits come from the
   payments store (`payActions`), which also refuses what the stage or the controls don't allow, so
   the dock only states the reason before the click.

     Grants supervisor - step 7   -> recommend approval (rule 7) - return to entity
     Grants manager - step 13     -> approve - return to supervisor (rule 8) - final rejection
     Finance - step 15            -> approve the disbursement order - return with note
     Finance - step 17            -> execute the transfer (after the order - rule 9) · its proof is
                                     uploaded with it

   Note: returning always requires a note. Rules 7 and 8 both say "with notes clarifying the reason"
   - a return with no reason sends the entity a request they don't know how to act on.

   Note: after disbursement there are no exits at all - rule 18: "the request may not be modified
   once approved - a change is a new request." The dock disappears rather than disabling. */

export interface ActionDockProps {
  user: CurrentUser
  request: PayRequest
  actions: PayAction[]
  note: string
  onNote: (v: string) => void
  onAct: (a: PayAction, file?: string) => void
}

export function ActionDock({ user, request, actions, note, onNote, onAct }: ActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const needNote = actions.some((a) => a.needsNote)

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={user.name} size="lg" quiet={false} />
          <span className="decsent">
            قرارك بشأن <b>{request.projectName}</b>
            <span className="decsep" />
            <Money>{request.asked}</Money>
          </span>
        </div>

        {/* The field and buttons form one group that wraps together. */}
        <div className="payact-g">
          {needNote && (
            <label className="payact-n">
              <span className="vis-h">ملاحظات الإعادة</span>
              <input
                value={note}
                onChange={(e) => onNote(e.target.value)}
                placeholder="سبب الإعادة أو الرفض وما يلزم استكماله · إلزامي"
              />
            </label>
          )}

          <div className="rowf gp-2">
            {noteFirst(actions).map((a) => {
              /* Rules 9 · 14 · 11 · 10 - a forward exit stays locked until every control passes,
                 and the reason is written in `title`, not hidden in color alone. */
              const stops = payStops(request, a.act)
              const stop = a.needsNote && !note.trim() ? 'اكتب الملاحظات أولًا · القاعدتان 7 و8' : stops[0] ?? ''
              if (a.needsFile && !stop) {
                return (
                  <label key={a.label} className={`btn ${a.kind}`} title={`ارفع ${a.needsFile} · خطوة ${a.step} في الوثيقة`}>
                    <Icon name={icons.upload} size="sm" />{a.label}
                    <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={`${a.label} · ${a.needsFile}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAct(a, f.name); e.target.value = '' }} />
                  </label>
                )
              }
              return (
                <button
                  key={a.label}
                  className={`btn ${a.kind}`}
                  data-needs-note={a.needsNote ? '' : undefined}
                  disabled={Boolean(stop)}
                  title={stop || `خطوة ${a.step} في الوثيقة`}
                  onClick={() => onAct(a)}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
