import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { payBlocked } from '@/data/mock/disbursements'
import type { CurrentUser, DecisionKind, PayRequest, PayState } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { noteFirst } from '@/lib/dock'

/* Request exits - what distinguishes screens 3, 4 and 5 in the spec.

   The spec describes three review screens, and all three show the same request with the same
   attachments, conditions, and log - the only difference is the exits. So that difference lives
   here in a single function, and the view stayed one.

   The exits aren't a free button list - they're the spec's own wording:

     Grants supervisor - step 7   -> recommend approval (rule 7) - return to entity
     Grants manager - step 13     -> approve - return to supervisor (rule 8)
     Finance - step 15            -> approve the disbursement order - return with note
     Finance - step 17            -> execute the transfer (after approval - rule 9)

   Note: returning always requires a note. Rules 7 and 8 both say "with notes clarifying the reason"
   - not a courtesy phrasing. A return with no reason sends the entity a request they don't know how
   to act on, so it comes back unchanged and loops again. So the button stays locked until the note
   is written.

   Note: after disbursement there are no exits at all - rule 18: "the request may not be modified
   once approved - a change is a new request." The dock disappears rather than disabling, because a
   disabled button says "you can do this, just not now", when the truth is it isn't an exit at all. */

export interface PayAction {
  label: string
  kind: DecisionKind
  /** This action is a return - rules 7 and 8 require it to carry a note. */
  needsNote?: boolean
  /** The spec step this action carries out. */
  step: number
}

/** This role's exits at this stage - empty means the request isn't theirs. */
export function actionsFor(role: RoleKey, state: PayState): PayAction[] {
  if (state === 'supervisor' && role === 'supervisor') {
    return [
      { label: 'توصية بالموافقة', kind: 'btn-p', step: 7 },
      { label: 'إعادة للجهة', kind: 'btn-2', needsNote: true, step: 7 },
    ]
  }
  if (state === 'manager' && role === 'grants-manager') {
    return [
      { label: 'موافقة وإحالة للمالية', kind: 'btn-p', step: 13 },
      { label: 'إعادة للمشرف', kind: 'btn-2', needsNote: true, step: 13 },
      /* Rule 15 - final rejection closes the request while keeping its action log - closing isn't
         deleting, and the log stays readable. This exit belongs to the grants manager alone: the
         supervisor recommends, closing is a decision. */
      { label: 'رفض نهائي وإغلاق', kind: 'btn-d', needsNote: true, step: 15 },
    ]
  }
  /* Finance isn't a role in the switcher - the executive director sees its exits for preview, and
     the real role is determined by the token once the backend is ready. */
  if (state === 'finance' && role === 'ceo') {
    return [
      { label: 'اعتماد أمر الصرف', kind: 'btn-p', step: 15 },
      { label: 'تنفيذ التحويل', kind: 'btn-p', step: 17 },
      { label: 'إعادة بملاحظة', kind: 'btn-2', needsNote: true, step: 15 },
    ]
  }
  return []
}

export interface ActionDockProps {
  user: CurrentUser
  request: PayRequest
  actions: PayAction[]
  note: string
  onNote: (v: string) => void
  /** The last action taken - the UI states what happened rather than mutating the data. */
  taken: string | null
  onTake: (v: string) => void
}

export function ActionDock({
  user, request, actions, note, onNote, taken, onTake,
}: ActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const held = payBlocked(request)
  const needNote = actions.some((a) => a.needsNote)

  if (taken) {
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Icon name={icons.check} size="md" className="ok-ink" />
            <span className="decsent">
              سُجّل الإجراء: <b>{taken}</b>
              <span className="decsep" />
              أُرسل الإشعار · القاعدة 17
            </span>
          </div>
          <button className="btn btn-2" onClick={() => { onTake(''); onNote('') }}>
            تراجع
          </button>
        </div>
      </div>
    )
  }

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

        {/* The note isn't optional for a return - rules 7 and 8. */}
        {/* The field and buttons form one group that wraps together, so the field doesn't separate
            from "Return" when the dock grows to two lines. */}
        <div className="payact-g">
        {needNote && (
          <label className="payact-n">
            <span className="vis-h">ملاحظات الإعادة</span>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="سبب الإعادة وما يلزم استكماله · إلزامي"
            />
          </label>
        )}

        <div className="rowf gp-2">
          {noteFirst(actions).map((a) => {
            /* Rule 9 - execution stays locked until every condition is met, and the reason is
               written in `title`, not hidden in color alone. */
            const stop =
              (a.needsNote && !note.trim())
                ? 'اكتب الملاحظات أولًا · القاعدتان 7 و8'
                : (!a.needsNote && held)
                  ? 'يوجد شرط غير مستوفى · قاعدة 9'
                  : ''
            return (
              <button
                key={a.label}
                className={`btn ${a.kind}`}
                data-needs-note={a.needsNote ? '' : undefined}
                disabled={Boolean(stop)}
                title={stop || `خطوة ${a.step} في الوثيقة`}
                onClick={() => onTake(a.label)}
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
