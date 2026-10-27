import { mayApprovePlan } from '@/data/plans/auth'
import { useRef, useState } from 'react'
import { Button, DecisionDialog, Num, Person } from '@/components/ui'
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
  key: 'send' | 'toManager' | 'returnEntity' | 'approve' | 'managerReturn'
  label: string
  kind: DecisionKind
  /** A return requires a note - same rule as agreements (rule 10). */
  needsNote?: boolean
  /** Locked if the plan has violations - approval alone. */
  gated?: boolean
  why: string
}

export function planActionsFor(role: RoleKey, stage: PlanStage, asEntity = false, me?: string): PlanAction[] {
  /* 12.2.7 · 12.2.9 · the entity sends its draft, and its edited plan after a return */
  if (asEntity) {
    return stage === 'draft' || stage === 'returned'
      ? [{ key: 'send', label: 'أرسل الخطة لمشرف المنح', kind: 'btn-p', gated: true, why: 'تُرسل بعد اكتمال المراحل والأنشطة والشواهد المطلوبة' }]
      : []
  }
  if ((stage === 'draft' || stage === 'returned') && role === 'supervisor') {
    return [{
      key: 'send',
      label: 'إرسال لمراجعة مشرف المنح',
      kind: 'btn-p',
      gated: true,
      why: 'الخطة تُرسل بعد اكتمال المراحل والأنشطة والشواهد المطلوبة · بالنيابة عن الجهة',
    }]
  }
  if (stage === 'supervisor' && role === 'supervisor') {
    return [
      { key: 'toManager', label: 'اعتماد وإحالة لمدير المنح', kind: 'btn-p', gated: true, why: /* doc 12.2.10 */ 'الاعتماد من مشرف المنح ثم مدير المنح' },
      { key: 'returnEntity', label: 'إعادة للجهة بملاحظات', kind: 'btn-2', needsNote: true, why: /* doc 12.2.8 */ 'الجهة كاتبة الخطة، فتُعاد إليها لتعدّلها' },
    ]
  }
  /* v3 · 12.2.11 · the grants manager, or an authority holder he delegated */
  if (stage === 'manager' && mayApprovePlan(role, me)) {
    return [
      { key: 'approve', label: 'اعتماد وتثبيت النسخة المرجعية', kind: 'btn-p', gated: true, why: 'الاعتماد يثبّت الهيكل، وأي تعديل بعده يلزمه طلب رسمي' },
      /* 12.2.11 · the manager's return goes to the supervisor, who reviews it with the entity */
      { key: 'managerReturn', label: 'إعادة لمشرف المنح بملاحظات', kind: 'btn-2', needsNote: true, why: 'يراجعها المشرف مع الجهة ثم يعيد إحالتها' },
    ]
  }
  return []
}

export interface PlanActionDockProps {
  user: CurrentUser
  plan: PlanRow
  grant: number
  actions: PlanAction[]
  onTake: (a: PlanAction, note: string) => void
  /** The dock links to the first activity awaiting review - for an approved plan. */
  onReview: () => void
}

export function PlanActionDock({
  user, plan, grant, actions, onTake, onReview,
}: PlanActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const issues = planIssues(plan, grant)
  const [pick, setPick] = useState<PlanAction | null>(null)
  const queue = waitingReview(plan).length

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
            </span>
          </div>
          <Button variant="p" onClick={onReview}>راجع أول نشاط</Button>
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

        {/* Client 26 Oct · the bar holds the buttons only · each one confirms in its popup, with the
            reason (a return) asked there */}
        <div className="payact-g">
        <div className="rowf gp-2">
          {noteFirst(actions).map((x) => {
            /* Note: the reason is written, not hidden in color - and the first violation is named,
               since "something's wrong" makes the user search for it. */
            const stop = x.gated && issues.length > 0 ? issues[0].say : ''
            return (
              <Button plain
                key={x.label}
                className={`btn ${x.kind}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(stop)}
                title={stop || x.why}
                onClick={() => setPick(x)}
              >
                {x.label}
              </Button>
            )
          })}
        </div>
        </div>
      </div>
      {pick && (
        <DecisionDialog
          title={pick.label}
          tone={pick.kind === 'btn-d' ? 'btn-d' : 'btn-p'}
          subject={<>خطة {plan.projectName} · {pick.why}</>}
          note={pick.needsNote ? 'required' : false}
          notePlaceholder="سبب الإعادة وما يلزم تعديله"
          stops={pick.gated ? issues.map((x) => x.say) : []}
          onClose={() => setPick(null)}
          onConfirm={(n) => onTake(pick, n)}
        />
      )}
    </div>
  )
}
