import { useRef } from 'react'
import { MISSING_ITEM, nounAfter } from '@/lib/format'
import { Icon, Num, Person, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import {
  closeCycle, closeStageLabel, evalBlockers, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow, CloseStage, CurrentUser, DecisionKind } from '@/types/domain'
import type { RoleKey } from '@/data/roles'
import { noteFirst } from '@/lib/dock'

/* Closing actions - two cycles, not one.

   Note: this is the most important part of this file. Rule 17 states that the final report and the
   project evaluation "go through two independent approval cycles" - meaning "grants manager
   approval" happens twice in the life of one request and means two different things: once on the
   entity's report, and once on the supervisor's evaluation. So the button label states what it
   approves, rather than just saying "approve".

   Note: a return goes back to whoever wrote the document, not to the previous stage - the same
   lesson as the plan and the agreement: the entity writes the report, so returning it goes back to
   the entity; the grants supervisor writes the evaluation, so returning it goes back to the
   supervisor. The destination is stated in the button label.

   Note: the `reportDone` stage has no approval action, it has a start action. The report is
   approved and the evaluation hasn't started (rule 6), so showing approval buttons here would imply
   a pending decision that doesn't exist. What's pending is drafting.

   Note: after `closed` there are no actions at all - rule 21: any change after final closure needs
   a new procedure, so the footer disappears instead of showing a disabled button. */

export interface CloseAction {
  label: string
  kind: DecisionKind
  /** A return requires a note - same as agreement rule 10. */
  needsNote?: boolean
  /** Disabled when the file is incomplete - both submit and approve. */
  gated?: boolean
  why: string
}

export function closeActionsFor(role: RoleKey, stage: CloseStage): CloseAction[] {
  /* Report cycle - written by the entity */

  if (stage === 'draft' || stage === 'returned') {
    /* Note: the entity is the one submitting, and its actions live on the screen, not in the footer
       (same as the plan page from the entity's view), so the institution has no action here besides
       following up. */
    return []
  }
  if (stage === 'supervisor' && role === 'supervisor') {
    return [
      {
        label: 'اعتماد التقرير وإحالته',
        kind: 'btn-p',
        gated: true,
        why: 'خطوة 7 · مراجعة مشرف المنح ثم الاتصال المؤسسي أو مدير المنح',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'قاعدة 19 · تعود الإعادة إلى الجهة كاتبة التقرير وتُنشئ إصدارًا جديدًا',
      },
    ]
  }
  /* Note: institutional-communications management isn't a role in the model - the model has three
     roles (supervisor, grants manager, executive), so the grants supervisor who owns the request is
     the one who logs the communications-review outcome, exactly as happens at the entity stage in
     agreements. Open question: is institutional communications a user with a system account, or
     does it notify the supervisor? */
  if (stage === 'comms' && role === 'supervisor') {
    return [
      {
        label: 'تسجيل اعتماد الاتصال المؤسسي',
        kind: 'btn-p',
        why: 'قاعدة 9 · مراجعة الاتصال المؤسسي متى كانت مطلوبة',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'يُعاد نقص المواد الإعلامية إلى الجهة لا إلى مشرف المنح',
      },
    ]
  }
  if (stage === 'manager' && role === 'grants-manager') {
    return [
      {
        label: 'اعتماد التقرير وإحالته للتنفيذي',
        kind: 'btn-p',
        gated: true,
        why: 'خطوة 11 · اعتماد مدير المنح ثم المدير التنفيذي',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'قاعدة 19 · كل إعادة تُنشئ إصدارًا جديدًا، ويبقى القديم في السجلّ',
      },
    ]
  }
  if (stage === 'executive' && role === 'ceo') {
    return [
      {
        label: 'اعتماد التقرير الختامي',
        kind: 'btn-p',
        gated: true,
        why: 'قاعدة 6 · اعتماد المدير التنفيذي هو ما يفتح إجراءات التقييم',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'تعود الإعادة إلى الجهة كاتبة التقرير',
      },
    ]
  }

  /* Evaluation cycle - written by the grants supervisor */

  if (stage === 'reportDone' && role === 'supervisor') {
    return [{
      label: 'ابدأ تقييم المشروع',
      kind: 'btn-p',
      why: 'قاعدة 6 · يبدأ التقييم بعد اعتماد المدير التنفيذي، ويُعدّه مشرف المنح',
    }]
  }
  if (stage === 'evalDraft' && role === 'supervisor') {
    return [{
      label: 'إرسال التقييم لمدير المنح',
      kind: 'btn-p',
      gated: true,
      why: 'قاعدة 17 · دورة اعتماد مستقلّة بسجلّ منفصل',
    }]
  }
  if (stage === 'evalManager' && role === 'grants-manager') {
    return [
      {
        label: 'اعتماد التقييم وإحالته للتنفيذي',
        kind: 'btn-p',
        why: 'قاعدة 17 · محطتان في دورة التقييم',
      },
      {
        label: 'إعادة لمشرف المنح بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'يُعدّ المشرف التقييم، فتعود إعادته إليه لا إلى الجهة',
      },
    ]
  }
  if (stage === 'evalExecutive' && role === 'ceo') {
    return [
      {
        label: 'اعتماد التقييم والإغلاق النهائي',
        kind: 'btn-p',
        gated: true,
        why: 'قاعدة 8 و18 · الإغلاق يحتاج التقرير والتقييم والمتطلبات معًا',
      },
      {
        label: 'إعادة لمشرف المنح بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'تعود الإعادة إلى كاتب التقييم',
      },
    ]
  }

  return []
}

export interface CloseActionDockProps {
  user: CurrentUser
  row: CloseRow
  actions: CloseAction[]
  /** What's blocking the tooltip-wrapped button - computed on screen. */
  stop: string
  note: string
  onNote: (v: string) => void
  taken: string | null
  onTake: (v: string) => void
}

export function CloseActionDock({
  user, row, actions, stop, note, onNote, taken, onTake,
}: CloseActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const needNote = actions.some((a) => a.needsNote)
  const cycle = closeCycle(row)

  if (taken) {
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Icon name={icons.check} size="md" className="ok-ink" />
            <span className="decsent">
              سُجّل: <b>{taken}</b>
              <span className="decsep" />
              أُرسل الإشعار إلى أطراف الإجراء
            </span>
          </div>
          <button className="btn btn-2" onClick={() => { onTake(''); onNote('') }}>
            تراجع
          </button>
        </div>
      </div>
    )
  }

  /* Note: a request sitting with someone else states who, rather than disappearing or showing a
     disabled button - the supervisor who opened the request wants to know whose court the ball is
     in, and that's an answer in itself. */
  if (actions.length === 0) {
    if (row.stage === 'closed') return null
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Person name={user.name} size="lg" quiet={false} />
            <span className="decsent">
              الطلب في <b>{closeStageLabel(row.stage)}</b>
              <span className="decsep" />
              {cycle === 'report' ? 'دورة التقرير الختامي' : 'دورة تقييم المشروع'}
              <span className="decsep" />
              لا يوجد قرار بانتظارك هنا
            </span>
          </div>
        </div>
      </div>
    )
  }

  const missing = cycle === 'report' ? reportBlockers(row) : evalBlockers(row)

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={user.name} size="lg" quiet={false} />
          <span className="decsent">
            قرارك في إغلاق <b>{row.projectName}</b>
            <span className="decsep" />
            {cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}
            {missing.length > 0 && (
              <>
                <span className="decsep" />
                <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}
              </>
            )}
          </span>
        </div>

        {/* Field and buttons form one group that wraps together - the field doesn't split away from
            "return" if the note runs to two lines. */}
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
            /* The reason is written out, not left to color alone - the first issue is named, since
               "something's missing" makes users hunt for it visually. */
            const why =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة أولًا'
                : (x.gated && stop) ? stop : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(why)}
                title={why || x.why}
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
