import { useRef } from 'react'
import { Icon, Num, Person, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import {
  closeCycle, closeStageLabel, evalBlockers, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow, CloseStage, CurrentUser, DecisionKind } from '@/types/domain'
import type { RoleKey } from '@/data/roles'

/* ═══════════════════════════════════════════════════════════
   مخارج الإغلاق · **دورتان لا دورة**

   ⚠️ **ودي أهم حاجة في الملف ده.** القاعدة 17 بتقول إن التقرير
   الختامي وتقييم المشروع «يخضعان لدورتي اعتماد مستقلتين» · يعني
   «اعتماد مدير المنح» بيحصل **مرتين** في حياة الطلب الواحد
   وبيعني حاجتين مختلفتين: مرة على تقرير الجهة، ومرة على تقييم
   المشرف. فاسم الزرار بيقول **على إيه** لا «اعتمد» وخلاص.

   ⚠️ **والإعادة بترجع لكاتب الملف لا للمحطة اللي قبلها** · نفس
   درس الخطة والاتفاقية: التقرير بتكتبه **الجهة**، فإعادته
   بترجّعه لها · والتقييم بيكتبه **مشرف المنح**، فإعادته بترجّعه
   له. الوجهة مكتوبة في اسم الزرار.

   ⚠️ **ومحطة `reportDone` مفيهاش اعتماد، فيها بداية.** التقرير
   اتعتمد والتقييم ما بدأش (قاعدة 6) · فعرض أزرار اعتماد هنا
   بيقول إن فيه قرار مستنّي وهو مفيش. اللي مستنّي هو **إعداد**.

   ⚠️ **وبعد `closed` مفيش مخارج خالص** · قاعدة 21: أي تعديل بعد
   الإغلاق النهائي بيحتاج **إجراء جديد**، فالرصيف بيختفي لا
   بيعرض زرارًا مقفولًا.
   ═══════════════════════════════════════════════════════════ */

export interface CloseAction {
  label: string
  kind: DecisionKind
  /** الإعادة ملزومة بملاحظة · نفس قاعدة الاتفاقيات 10 */
  needsNote?: boolean
  /** بيتقفل لو الملف ناقص · الإرسال والاعتماد */
  gated?: boolean
  why: string
}

export function closeActionsFor(role: RoleKey, stage: CloseStage): CloseAction[] {
  /* ═══ دورة التقرير · الجهة بتكتب ═══ */

  if (stage === 'draft' || stage === 'returned') {
    /* ⚠️ الجهة هي اللي بتبعت · وأفعالها في الشاشة لا في الرصيف
       (نفس صفحة الخطة بعين الجهة)، فالمؤسسة مالهاش مخرج هنا
       غير المتابعة. */
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
        why: 'قاعدة 19 · الإعادة ترجع للجهة كاتبة التقرير وتخلّي إصدارًا جديدًا',
      },
    ]
  }
  /* ⚠️ **إدارة الاتصال المؤسسي مش دور في النموذج** · النموذج فيه
     تلات أدوار (مشرف · مدير منح · تنفيذي)، فمشرف المنح صاحب الطلب
     هو اللي بيسجّل نتيجة مراجعة الاتصال · نفس ما بيحصل في محطة
     الجهة في الاتفاقيات بالحرف. **وسؤال س-21 مفتوح**: هل الاتصال
     المؤسسي مستخدم بحساب في النظام ولا بيبلّغ المشرف؟ */
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
        why: 'نقص في المواد الإعلامية يرجع للجهة لا لمشرف المنح',
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
        why: 'قاعدة 19 · كل إعادة إصدار جديد والقديم بيفضل في السجلّ',
      },
    ]
  }
  if (stage === 'executive' && role === 'ceo') {
    return [
      {
        label: 'اعتماد التقرير الختامي',
        kind: 'btn-p',
        gated: true,
        why: 'قاعدة 6 · اعتماد المدير التنفيذي هو اللي بيفتح إجراءات التقييم',
      },
      {
        label: 'إعادة للجهة بملاحظات',
        kind: 'btn-2',
        needsNote: true,
        why: 'الإعادة ترجع للجهة كاتبة التقرير',
      },
    ]
  }

  /* ═══ دورة التقييم · مشرف المنح بيكتب ═══ */

  if (stage === 'reportDone' && role === 'supervisor') {
    return [{
      label: 'ابدأ تقييم المشروع',
      kind: 'btn-p',
      why: 'قاعدة 6 · التقييم يبدأ بعد اعتماد المدير التنفيذي، وبيعدّه مشرف المنح',
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
        why: 'التقييم بيعدّه المشرف، فإعادته ترجع له لا للجهة',
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
        why: 'الإعادة ترجع لكاتب التقييم',
      },
    ]
  }

  return []
}

export interface CloseActionDockProps {
  user: CurrentUser
  row: CloseRow
  actions: CloseAction[]
  /** اللي مانع الزرار المسوَّر · محسوب في الشاشة */
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
            <Icon name={icons.check} size={18} className="ok-ink" />
            <span className="decsent">
              اتسجّل: <b>{taken}</b>
              <span className="decsep" />
              الإشعار اتبعت لأطراف الإجراء
            </span>
          </div>
          <button className="btn btn-2" onClick={() => { onTake(''); onNote('') }}>
            تراجع
          </button>
        </div>
      </div>
    )
  }

  /* ⚠️ **الطلب اللي واقف على طرف تاني رصيفه بيقول مين** لا بيختفي
     ولا بيعرض زرارًا مقفولًا · المشرف اللي فتح الطلب عايز يعرف
     الكرة عند مين، ودي إجابة بذاتها. */
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
              مفيش قرار مستنّيك هنا
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
                <Num>{missing.length}</Num> بند ناقص
              </>
            )}
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
               بالاسم، لأن «فيه ناقص» بتخلّي المستخدم يدوّر بعينه */
            const why =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة الأول'
                : (x.gated && stop) ? stop : ''
            return (
              <button
                key={x.label}
                className={`btn ${x.kind}`}
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
  )
}
