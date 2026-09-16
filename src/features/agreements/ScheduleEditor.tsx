import { Icon, Money, Num, Riyal, Tag, icons } from '@/components/ui'
import { nf, pct } from '@/lib/format'
import { scheduleTotal, shareOf, type DraftPay } from '@/data/mock/agreementNew'

/* ═══════════════════════════════════════════════════════════
   محرّر جدول الدفعات · هـ-5

   ⚠️ **الجدول ده جزء من الاتفاقية لا ملحق بيها (قاعدة 7)**، عشان
   كده المحرّر جوّه شاشة الاتفاقية لا في صفحة لوحدها · وهو نفس
   المكوّن في بانِي المسودة وفي صفحة الاتفاقية وهي لسه مسودة.

   ⚠️ **النسبة محسوبة لا مكتوبة.** لو المستخدم كتب المبلغ والنسبة
   بإيده، هيقع في تناقض: دفعة مكتوب عليها 40% ومبلغها ربع المنحة ·
   والشاشة ساعتها بتعرض غلطًا وبتسيبه يعدّي. فالمبلغ هو المدخل،
   والنسبة بتتحسب منه وبتتعرض للقراية.

   ⚠️ **وصفّ الإجمالي تحقّق لا تلخيص (قاعدة 8).** جدول بيقول
   «الإجمالي ٨٠٠ ألف» تحت منحة مليون **بيعرض رقمًا صحيحًا وبيخفي
   غلطًا**. الصفّ هنا بيقول «مطابق» أو بيقول الفرق بالظبط وفي أي
   اتجاه · فالمستخدم بيعرف يصلّحه من غير ما يحسب.
   ═══════════════════════════════════════════════════════════ */

export interface ScheduleEditorProps {
  rows: DraftPay[]
  /** قيمة المنحة · اللي المجموع لازم يساويها */
  amount: number
  onChange: (rows: DraftPay[]) => void
  /** بعد التوقيع التعديل ممنوع · قاعدة 17 */
  readOnly?: boolean
}

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

export function ScheduleEditor({ rows, amount, onChange, readOnly }: ScheduleEditorProps) {
  const total = scheduleTotal(rows)
  const gap = amount - total
  const match = amount > 0 && gap === 0

  /** الترقيم بيتعاد بعد أي إضافة أو حذف · الرقم ترتيب لا معرّف */
  const renum = (xs: DraftPay[]) => xs.map((r, i) => ({ ...r, no: i + 1 }))

  const patch = (i: number, p: Partial<DraftPay>) =>
    onChange(rows.map((r, x) => (x === i ? { ...r, ...p } : r)))

  const add = () => {
    const last = rows[rows.length - 1]
    onChange(renum([
      ...rows,
      { no: 0, amount: Math.max(0, gap), dueAt: last?.dueAt ?? '', requirement: '' },
    ]))
  }

  const drop = (i: number) => onChange(renum(rows.filter((_, x) => x !== i)))

  /* ⚠️ «وزّع الباقي» مش زرار تجميلي: أكتر غلط بيحصل في الجدول ده هو
     فرق ريالات من التقريب · والمستخدم بيقعد يعدّل رقمًا ورقمًا
     عشان الفرق يقفل. الزرار بيحطّ الفرق كله في الدفعة الأخيرة. */
  const settle = () => {
    if (!rows.length || gap === 0) return
    onChange(rows.map((r, i) =>
      i === rows.length - 1 ? { ...r, amount: Math.max(0, r.amount + gap) } : r))
  }

  return (
    <div className="sched">
      <div className="sched-h">
        <span>الدفعة</span>
        <span className="tnum">المبلغ</span>
        <span className="tnum">النسبة</span>
        <span>تاريخ الاستحقاق</span>
        <span>شرط الاستحقاق</span>
        <span />
      </div>

      {rows.map((r, i) => (
        <div className="sched-r" key={i}>
          <span className="num sched-n">{r.no}</span>

          <span className="tnum">
            {readOnly ? <Money>{r.amount}</Money> : (
              <span className="fld sched-f">
                <input
                  className="num"
                  inputMode="numeric"
                  value={r.amount ? nf.format(r.amount) : ''}
                  onChange={(e) => patch(i, { amount: digits(e.target.value) })}
                  aria-label={`مبلغ الدفعة ${r.no}`}
                />
                <Riyal />
              </span>
            )}
          </span>

          {/* محسوبة · فما لهاش حقل */}
          <span className="tnum num sched-s">{pct(shareOf(r.amount, amount))}</span>

          <span>
            {readOnly ? r.dueAt : (
              <span className="fld sched-f">
                <input
                  type="date"
                  value={r.dueAt}
                  onChange={(e) => patch(i, { dueAt: e.target.value })}
                  aria-label={`تاريخ الدفعة ${r.no}`}
                />
              </span>
            )}
          </span>

          <span className="sched-q">
            {readOnly ? r.requirement : (
              <span className="fld sched-f">
                <input
                  value={r.requirement}
                  placeholder="التقرير المرحلي الأول"
                  onChange={(e) => patch(i, { requirement: e.target.value })}
                  aria-label={`شرط الدفعة ${r.no}`}
                />
              </span>
            )}
          </span>

          <span>
            {!readOnly && (
              <button
                className="btn btn-ghost btn-sm"
                title={`احذف الدفعة ${r.no}`}
                aria-label={`احذف الدفعة ${r.no}`}
                onClick={() => drop(i)}
              >
                <Icon name={icons.close} size={15} />
              </button>
            )}
          </span>
        </div>
      ))}

      {/* ⚠️ صفّ الإجمالي **تحقّق**: بيقول مطابق أو بيقول الفرق
          وفي أي اتجاه · جدول بيلخّص وبس بيخفي الغلط */}
      <div className={`sched-t${match ? ' ok' : ''}`}>
        <span>الإجمالي</span>
        <span className="tnum"><Money>{total}</Money></span>
        <span className="tnum num">{pct(shareOf(total, amount))}</span>
        <span className="sched-v">
          {amount <= 0
            ? <span className="sub">مفيش قيمة منحة</span>
            : match
              ? <Tag tone="ok">مطابق لقيمة المنحة</Tag>
              : <Tag tone="warn">
                  {gap > 0 ? 'ناقص' : 'زايد'} <Num>{Math.abs(gap)}</Num>
                </Tag>}
        </span>
        <span />
        <span />
      </div>

      {!readOnly && (
        <div className="sched-a">
          <button className="btn btn-2 btn-sm" onClick={add}>
            <Icon name={icons.plus} size={15} />
            دفعة
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={gap === 0 || rows.length === 0}
            title={
              gap === 0
                ? 'الجدول مطابق'
                : `حطّ الفرق (${nf.format(Math.abs(gap))}) في الدفعة الأخيرة`
            }
            onClick={settle}
          >
            وزّع الباقي على الأخيرة
          </button>
          <span className="pc-sp" />
          <span className="sub">
            المجموع لازم يساوي قيمة المنحة · <b>قاعدة 8</b>
          </span>
        </div>
      )}
    </div>
  )
}
