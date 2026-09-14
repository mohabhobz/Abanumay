import { useRef } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { payBlocked } from '@/data/mock/disbursements'
import type { CurrentUser, DecisionKind, PayRequest, PayState } from '@/types/domain'
import type { RoleKey } from '@/data/roles'

/* ═══════════════════════════════════════════════════════════
   مخارج الطلب · اللي بيفرّق بين شاشات 3 و4 و5 في الوثيقة

   الوثيقة بتوصف تلات شاشات مراجعة، والتلاتة بيعرضوا نفس الطلب
   بنفس المرفقات ونفس الشروط ونفس السجل · اللي بيختلف هو **المخارج**
   بس. فالفرق اتحطّ هنا في دالة واحدة، والعرض فضل واحد.

   والمخارج مش قائمة أزرار حرّة، هي **نصّ الوثيقة**:

     مشرف المنح · خطوة 7   → توصية بالموافقة (قاعدة 7) · إعادة للجهة
     مدير المنح · خطوة 13  → موافقة · إعادة للمشرف (قاعدة 8)
     المالية   · خطوة 15   → اعتماد أمر الصرف · إعادة بملاحظة
     المالية   · خطوة 17   → تنفيذ التحويل (بعد الاعتماد · قاعدة 9)

   ⚠️ **والإعادة ملزومة بملاحظة.** قاعدتا 7 و8 بتقولا «مع توضيح
   الملاحظات» · مش مجاملة في الصياغة. الإعادة بلا سبب بترجع للجهة
   طلبًا ما تعرفش تعمل فيه إيه، فبتعيد إرساله زي ما هو وتلفّ الدورة
   تاني. فالزرار مقفول لحد ما الملاحظة تتكتب.

   ⚠️ **وبعد الصرف مفيش مخارج خالص** · قاعدة 18: «ممنوع تعديل الطلب
   بعد اعتماده · التعديل = طلب جديد». الدوك بيختفي لا بيتعطّل، لأن
   زرارًا معطَّلًا بيقول «تقدر تعمل ده بس مش دلوقتي» والصح إنه مش
   مخرجًا أصلًا.
   ═══════════════════════════════════════════════════════════ */

export interface PayAction {
  label: string
  kind: DecisionKind
  /** الفعل ده إعادة · قاعدتا 7 و8 بيلزموه بملاحظة */
  needsNote?: boolean
  /** خطوة الوثيقة اللي الفعل ده بينفّذها */
  step: number
}

/** مخارج الدور في المرحلة دي · فاضية = الطلب مش عندك */
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
    ]
  }
  /* المالية مش دور في المبدّل · المدير التنفيذي بيشوف مخارجها
     للمعاينة، والدور الحقيقي بيتحدّد من التوكن لما الباك اند يجهز */
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
  /** آخر فعل اتاخد · النموذج بيقول اللي حصل بدل ما يغيّر الداتا */
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
            <Icon name={icons.check} size={18} className="ok-ink" />
            <span className="decsent">
              اتسجّل: <b>{taken}</b>
              <span className="decsep" />
              الإشعار اتبعت · القاعدة 17
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
            قرارك في <b>{request.projectName}</b>
            <span className="decsep" />
            <Money>{request.asked}</Money>
          </span>
        </div>

        {/* الملاحظة مش اختيارية للإعادة · قاعدتا 7 و8 */}
        {needNote && (
          <label className="payact-n">
            <span className="vis-h">ملاحظات الإعادة</span>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="ملاحظات الإعادة · إلزامية"
            />
          </label>
        )}

        <div className="rowf gp-2">
          {actions.map((a) => {
            /* قاعدة 9 · التنفيذ مقفول لحد ما كل الشروط تستوفى،
               والسبب مكتوب في `title` لا مخفي في اللون */
            const stop =
              (a.needsNote && !note.trim())
                ? 'اكتب الملاحظات الأول · قاعدة 7 و8'
                : (!a.needsNote && held)
                  ? 'فيه شرط غير مستوفى · قاعدة 9'
                  : ''
            return (
              <button
                key={a.label}
                className={`btn ${a.kind}`}
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
  )
}
