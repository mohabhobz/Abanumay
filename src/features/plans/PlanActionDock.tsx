import { useRef } from 'react'
import { Icon, Num, Person, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { planIssues, waitingReview } from '@/data/mock/plans'
import type { CurrentUser, DecisionKind, PlanRow, PlanStage } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { NOUN, nounAfter } from '@/lib/format'
import { noteFirst } from '@/lib/dock'

/* Plan exits - a two-stage approval cycle.

   The basis, per the spec, section 9.3 step 1, verbatim: "the project plan is prepared by the
   beneficiary entity and approved by both the grants supervisor and the grants manager." Two
   stages, not one, both stated.

   Note: a return goes to the entity, not the preceding stage. The grants manager's return sends the
   plan back to the beneficiary entity, not to the grants supervisor, because the entity is the one
   who wrote the plan - if the supervisor received it, they'd just send it back to the entity again,
   becoming an extra stage that does no work. The destination is written in the button's label,
   exactly as on agreements.

   Note: after approval there are no approval exits - there's activity review instead. An approved
   plan's day-to-day work is the supervisor accepting or rejecting evidence (rule 14), and that
   happens on the activity itself in the tree, not on the dock - the dock at that point states the
   queue and links to it.

   Note: a substantive amendment is its own exit (rule 21). Without it, an entity running late could
   quietly push its dates and always look on schedule on paper - with it, any drift keeps a
   reference point called the baseline. */

export interface PlanAction {
  label: string
  kind: DecisionKind
  /** A return requires a note - same rule as agreements (rule 10). */
  needsNote?: boolean
  /** Locked if the plan has violations - approval alone. */
  gated?: boolean
  why: string
}

export function planActionsFor(role: RoleKey, stage: PlanStage): PlanAction[] {
  if ((stage === 'draft' || stage === 'returned') && role === 'supervisor') {
    return [{
      label: 'إرسال لمراجعة مشرف المنح',
      kind: 'btn-p',
      gated: true,
      why: 'الخطة تُرسل بعد اكتمال المراحل والأنشطة والشواهد المطلوبة',
    }]
  }
  if (stage === 'supervisor' && role === 'supervisor') {
    return [
      {
        label: 'اعتماد وإحالة لمدير المنح',
        kind: 'btn-p',
        gated: true,
        why: 'BPD-009 §9.3 · الاعتماد من مشرف المنح ثم مدير المنح',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'الجهة هي كاتبة الخطة، فتُعاد إليها لا إلى محطة وسيطة',
      },
    ]
  }
  if (stage === 'manager' && role === 'grants-manager') {
    return [
      {
        label: 'اعتماد وتثبيت النسخة المرجعية',
        kind: 'btn-p',
        gated: true,
        why: 'الاعتماد يثبّت الهيكل، وأي تعديل بعده يلزمه طلب رسمي (قاعدة 21)',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'تُعاد الخطة إلى الجهة التي كتبتها',
      },
    ]
  }
  return []
}

export interface PlanActionDockProps {
  user: CurrentUser
  plan: PlanRow
  grant: number
  actions: PlanAction[]
  note: string
  onNote: (v: string) => void
  taken: string | null
  onTake: (v: string) => void
  /** The dock links to the first activity awaiting review - for an approved plan. */
  onReview: () => void
}

export function PlanActionDock({
  user, plan, grant, actions, note, onNote, taken, onTake, onReview,
}: PlanActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const issues = planIssues(plan, grant)
  const needNote = actions.some((a) => a.needsNote)
  const queue = waitingReview(plan).length

  if (taken) {
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Icon name={icons.check} size="md" className="ok-ink" />
            <span className="decsent">
              سُجّل: <b>{taken}</b>
              <span className="decsep" />
              أُرسل الإشعار إلى الجهة المستفيدة
            </span>
          </div>
          <button className="btn btn-2" onClick={() => { onTake(''); onNote('') }}>
            تراجع
          </button>
        </div>
      </div>
    )
  }

  /* Note: an approved plan's dock is a queue, not an approval. Showing approval buttons on an
   already-approved plan tells the user a decision is pending when there isn't one - the real
   decision at that point sits on the activity itself. */
  if (actions.length === 0) {
    if (queue === 0) return null
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Person name={user.name} size="lg" quiet={false} />
            <span className="decsent">
              <b><Num>{queue}</Num> {nounAfter(queue, NOUN.activity)}</b> بانتظار قبولك
              <span className="decsep" />
              لا يُحتسب إنجازًا قبل المراجعة · القاعدة <Num>14</Num>
            </span>
          </div>
          <button className="btn btn-p" onClick={onReview}>راجع أول نشاط</button>
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
            قرارك بشأن خطة <b>{plan.projectName}</b>
            <span className="decsep" />
            <Num>{plan.phases.length}</Num> {nounAfter(plan.phases.length, NOUN.phase)}
          </span>
        </div>

        {/* The field and buttons form one group that wraps together, so the field doesn't separate from
   "Return" when the dock grows to two lines. */}
        <div className="payact-g">
        {needNote && (
          <label className="payact-n">
            <span className="vis-h">ملاحظات الإعادة</span>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="سبب الإعادة وما يلزم تعديله · إلزامي"
            />
          </label>
        )}

        <div className="rowf gp-2">
          {noteFirst(actions).map((x) => {
            /* Note: the reason is written, not hidden in color - and the first violation is named, since
   "something's wrong" makes the user search for it. */
            const stop =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة أولًا'
                : (x.gated && issues.length > 0)
                  ? `${issues[0].say} (${issues[0].rule})`
                  : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(stop)}
                title={stop || x.why}
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
