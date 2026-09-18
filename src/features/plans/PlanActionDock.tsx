import { useRef } from 'react'
import { Icon, Num, Person, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { planIssues, waitingReview } from '@/data/mock/plans'
import type { CurrentUser, DecisionKind, PlanRow, PlanStage } from '@/types/domain'
import type { RoleKey } from '@/data/roles'

/* ═══════════════════════════════════════════════════════════
   مخارج الخطة · دورة اعتماد من محطتين

   السند في BPD-009 §9.3 خطوة 1 بالنص: «اعداد خطة المشروع من قبل
   الجهة المستفيدة **واعتمادها من قبل مشرف المنح ومدير المنح**».
   يعني محطتان لا واحدة، والاتنين مكتوبين.

   ⚠️ **والإعادة بتروح للجهة، مش للمحطة اللي قبلها.** إعادة مدير
   المنح بترجّع الخطة **للجهة المستفيدة** لا لمشرف المنح، لأن
   اللي بيكتب الخطة هو الجهة · فالمشرف لو استلمها هيرجّعها لها
   تاني وتبقى محطة زيادة بلا شغل. الوجهة مكتوبة في اسم الزرار
   زي الاتفاقيات بالظبط.

   ⚠️ **وبعد الاعتماد مفيش مخارج اعتماد · فيه مراجعة أنشطة.**
   الخطة المعتمدة شغلها اليومي إن المشرف يقبل أو يرفض شواهد
   (قاعدة 14)، وده بيحصل **على النشاط** في الشجرة لا في الرصيف ·
   والرصيف وقتها بيقول الطابور ويودّي له.

   ⚠️ **والتعديل الجوهري مخرج قائم بذاته (قاعدة 21).** من غيره
   الجهة اللي اتأخرت بتعدّل تواريخها بهدوء فتبقى منضبطة على
   الورق دايمًا · وبيه الانحراف بيفضل له مرجع اسمه النسخة
   المرجعية.
   ═══════════════════════════════════════════════════════════ */

export interface PlanAction {
  label: string
  kind: DecisionKind
  /** الإعادة ملزومة بملاحظة · نفس قاعدة الاتفاقيات 10 */
  needsNote?: boolean
  /** بيتقفل لو الخطة فيها مخالفات · الاعتماد وحده */
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
        why: 'الجهة هي كاتبة الخطة، فالإعادة ترجع لها لا لمحطة وسيطة',
      },
    ]
  }
  if (stage === 'manager' && role === 'grants-manager') {
    return [
      {
        label: 'اعتماد وتثبيت النسخة المرجعية',
        kind: 'btn-p',
        gated: true,
        why: 'الاعتماد يقفل الهيكل · وأي تعديل بعده بطلب رسمي (قاعدة 21)',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'الإعادة ترجع للجهة كاتبة الخطة',
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
  /** الرصيف بيودّي لأول نشاط مستنّي مراجعة · الخطة المعتمدة */
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
            <Icon name={icons.check} size={18} className="ok-ink" />
            <span className="decsent">
              اتسجّل: <b>{taken}</b>
              <span className="decsep" />
              الإشعار اتبعت للجهة المستفيدة
            </span>
          </div>
          <button className="btn btn-2" onClick={() => { onTake(''); onNote('') }}>
            تراجع
          </button>
        </div>
      </div>
    )
  }

  /* ⚠️ **الخطة المعتمدة رصيفها طابور لا اعتماد.** عرض أزرار اعتماد
     على خطة اتعتمدت خلاص بيقول للمستخدم إن في قرار مستنّيه وهو
     مفيش · والقرار الحقيقي وقتها على النشاط نفسه. */
  if (actions.length === 0) {
    if (queue === 0) return null
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Person name={user.name} size="lg" quiet={false} />
            <span className="decsent">
              <b><Num>{queue}</Num> نشاطًا</b> مستنّي قبولك
              <span className="decsep" />
              ما بيتحسبش إنجازًا قبل المراجعة · القاعدة <Num>14</Num>
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
            قرارك في خطة <b>{plan.projectName}</b>
            <span className="decsep" />
            <Num>{plan.phases.length}</Num> مراحل
          </span>
        </div>

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
          {actions.map((x) => {
            /* ⚠️ السبب مكتوب لا مخفي في اللون · والمخالفة الأولى
               بالاسم، لأن «فيه خطأ» بتخلّي المستخدم يدوّر بعينه */
            const stop =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة الأول'
                : (x.gated && issues.length > 0)
                  ? `${issues[0].say} (${issues[0].rule})`
                  : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
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
  )
}
