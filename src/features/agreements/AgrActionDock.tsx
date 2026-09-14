import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { agrBlocked } from '@/data/mock/agreements'
import type { AgreementRow, AgreementStage, CurrentUser, DecisionKind } from '@/types/domain'
import type { RoleKey } from '@/data/roles'

/* ═══════════════════════════════════════════════════════════
   مخارج الاتفاقية · اللي بيفرّق بين المحطات الأربعة في المخطط

   ⚠️ **الإعادة مالهاش مسار واحد، وده اللي بيتنسي.** الوثيقة بتحدّد
   وجهة كل إعادة بالاسم، والتلاتة مختلفين:

     خطوة 14 · إعادة مدير المنح       → مشرف المنح
     خطوة 18 · إعادة المدير التنفيذي  → **مدير المنح** لا المشرف
     خطوة 22 · إعادة الجهة المستفيدة  → **مشرف المنح** لا المدير

   «رجّع للخطوة اللي قبلها» كان هيبقى صح في واحدة وغلط في اتنين ·
   وغلط زي ده ما بيبانش في الواجهة خالص، بيبان بعد أسبوعين لما
   اتفاقية تقع في إيد الشخص الغلط. فالوجهة مكتوبة في اسم الزرار.

   ⚠️ **وقاعدة 13 بتمنع الإرسال للجهة قبل اكتمال اعتمادات المؤسسة**،
   فمخرج «إرسال للتوقيع» مش موجود قبل اعتماد المدير التنفيذي — مش
   معطَّلًا، مش موجودًا.

   ⚠️ **وبعد التوقيع مفيش مخارج.** قاعدة 17: ممنوع التعديل بعد
   اكتمال التوقيعات، وأي تعديل = إصدار جديد ودورة اعتماد كاملة.
   فالدوك بيختفي، ومكانه زرار «إصدار جديد» — لأن ده المخرج الحقيقي
   الوحيد الباقي.
   ═══════════════════════════════════════════════════════════ */

export interface AgrAction {
  label: string
  kind: DecisionKind
  /** الإعادة ملزومة بملاحظة · قاعدة 10 */
  needsNote?: boolean
  /** خطوة الوثيقة اللي الفعل ده بينفّذها */
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
      /* خطوة 18 · إعادة المدير التنفيذي بتروح **لمدير المنح** */
      { label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true, step: 18 },
      /* قاعدة 26 · الإلغاء ما بيحوّلش المشروع لـ«تحت التنفيذ» */
      { label: 'إلغاء الاتفاقية', kind: 'btn-d', needsNote: true, step: 18 },
    ]
  }
  /* محطة الجهة · بورتال الجهة برّه النموذج، فالمشرف بيسجّل نتيجتها
     زي ما بيعمل في النظام العامل لما التوقيع بيوصل ورقيًا */
  if (stage === 'entity' && role === 'supervisor') {
    return [
      { label: 'تسجيل توقيع الجهة', kind: 'btn-p', step: 21 },
      /* خطوة 22 · إعادة الجهة بتروح **لمشرف المنح** */
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
            <Icon name={icons.check} size={18} className="ok-ink" />
            <span className="decsent">
              اتسجّل: <b>{taken}</b>
              <span className="decsep" />
              الإشعار اتبعت لكل الأطراف · القاعدة 20
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
            /* قاعدة 9 · ممنوع الاعتماد عند نقص البيانات أو المرفقات
               أو جدول الدفعات · والسبب مكتوب لا مخفي في اللون */
            const stop =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة الأول · قاعدة 10'
                : (x.kind === 'btn-p' && held)
                  ? 'جدول الدفعات أو المخصص أو المرفقات ناقصة · قاعدة 9'
                  : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
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
  )
}
