import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { agrBlocked } from '@/data/mock/agreements'
import type { AgreementRow, AgreementStage, CurrentUser, DecisionKind } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { noteFirst } from '@/lib/dock'

/* Agreement exits · what differentiates the four stages in the flow.

   A return doesn't have a single destination, and that's easy to forget. The spec names each
   return's destination individually, and they differ:

   Manager's return → grants officer
   Executive's return → **the grants manager**, not the officer
   Beneficiary entity's return → **the grants officer**, not the manager

   "Send back to the previous step" would be correct for one and wrong for the other two — and a
   mistake like that never shows up in the UI itself, it shows up two weeks later when an agreement
   lands with the wrong person. So the destination is written into the button's own name.

   And a rule blocks sending to the entity before the organization's own approvals are complete, so
   a "send for signature" exit doesn't exist before executive approval — not disabled, simply
   absent.

   And there are no exits after signing. Editing is blocked once signatures are complete, and any
   change means a new version and a full approval cycle. So the dock disappears, replaced by a "new
   version" button — since that's the only real exit left. */

export interface AgrAction {
  label: string
  kind: DecisionKind
  /** A return requires a note */
  needsNote?: boolean
  /** The document step this action executes */
  step: number
}

export function agrActionsFor(role: RoleKey, stage: AgreementStage): AgrAction[] {
  if ((stage === 'draft' || stage === 'returned') && role === 'supervisor') {
    return [
      { label: 'إرسال لمدير المنح', kind: 'btn-p', step: 12 },
    ]
  }
  if (stage === 'manager' && role === 'grants-manager') {
    return [
      { label: 'اعتماد وإحالة للتنفيذي', kind: 'btn-p', step: 13 },
      { label: 'إعادة لمشرف المنح', kind: 'btn-2', needsNote: true, step: 14 },
    ]
  }
  if (stage === 'executive' && role === 'ceo') {
    return [
      { label: 'اعتماد وإرسال للجهة', kind: 'btn-p', step: 20 },
      /* The executive's return goes to **the grants manager** */
      { label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true, step: 18 },
      /* Cancellation doesn't move the project to "in execution" */
      { label: 'إلغاء الاتفاقية', kind: 'btn-d', needsNote: true, step: 18 },
    ]
  }
  /* The entity's station: the entity portal sits outside this form, so the officer records its
     outcome the same way the live system does when a signature arrives on paper */
  if (stage === 'entity' && role === 'supervisor') {
    return [
      { label: 'تسجيل توقيع الجهة', kind: 'btn-p', step: 21 },
      /* The entity's return goes to **the grants officer** */
      { label: 'تسجيل إعادة الجهة بملاحظات', kind: 'btn-2', needsNote: true, step: 22 },
    ]
  }
  return []
}

export interface AgrActionDockProps {
  user: CurrentUser
  agreement: AgreementRow
  actions: AgrAction[]
  note: string
  onNote: (v: string) => void
  taken: string | null
  onTake: (v: string) => void
}

export function AgrActionDock({
  user, agreement, actions, note, onNote, taken, onTake,
}: AgrActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const held = agrBlocked(agreement)
  const needNote = actions.some((a) => a.needsNote)

  if (taken) {
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Icon name={icons.check} size="md" className="ok-ink" />
            <span className="decsent">
              سُجّل: <b>{taken}</b>
              <span className="decsep" />
              أُرسل الإشعار إلى جميع الأطراف · القاعدة 20
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
            قرارك في اتفاقية <b>{agreement.projectName}</b>
            <span className="decsep" />
            <Money>{agreement.amount}</Money>
          </span>
        </div>

        {/* The field and buttons are one wrapping group, so the field doesn't get separated from
            the "return" button when the dock wraps onto two lines */}
        <div className="payact-g">
        {needNote && (
          <label className="payact-n">
            <span className="vis-h">ملاحظات الإعادة</span>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="سبب الإعادة · إلزامي"
            />
          </label>
        )}

        <div className="rowf gp-2">
          {noteFirst(actions).map((x) => {
            /* Approval is blocked when data, attachments, or the payment schedule are incomplete —
               the reason is stated, not hidden in a color */
            const stop =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة أولًا · قاعدة 10'
                : (x.kind === 'btn-p' && held)
                  ? 'يلزم استكمال جدول الدفعات والمخصص والمرفقات · قاعدة 9'
                  : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(stop)}
                title={stop || `خطوة ${x.step} في الوثيقة`}
                onClick={() => onTake(x.label)}
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
