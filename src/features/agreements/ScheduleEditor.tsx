import { DateText, Icon, Money, Num, Riyal, Tag, icons } from '@/components/ui'
import { nf, pct } from '@/lib/format'
import { scheduleTotal, shareOf, type DraftPay } from '@/data/mock/agreementNew'
import type { AgreementPayment } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   جدول الدفعات · هـ-5 · **جدول واحد للقراية وللتحرير**

   ⚠️ **أول نسخة اخترعت شبكتها (`.sched`) بدل ما تستعمل `.tbl`.**
   والنتيجة إن صفحة الاتفاقية فيها جدول دفعات بشكل، وبانِي المسودة
   فيه نفس الجدول بشكل تاني: مقاس خطّ مختلف، وحشو كارت مختلف،
   وارتفاع صفّ مختلف · وكل ده لنفس الداتا بالظبط.

   `.tbl` هو جدول السيستم: ارتفاع الصفّ `--row-h` **ناتج** لا رقم
   (٨ + ٤٤ + ٨)، والتحكّم جوّه الخلية ارتفاعه `--h-md` = ٤٤ فبيقع
   جوّه الصفّ بالظبط، والكارت حشوه `.tblcard`. يعني الجدول المحرَّر
   والجدول المقروء **نفس الشكل**، والفرق إن الخلية فيها حقل.

   ⚠️ **والنسبة محسوبة لا مكتوبة.** لو المستخدم كتب المبلغ والنسبة
   بإيده، هيقع في تناقض: دفعة مكتوب عليها 40% ومبلغها ربع المنحة.

   ⚠️ **وصفّ الإجمالي تحقّق لا تلخيص (قاعدة 8).** جدول بيقول
   «الإجمالي ٨٠٠ ألف» تحت منحة مليون **بيعرض رقمًا صحيحًا وبيخفي
   غلطًا**.
   ═══════════════════════════════════════════════════════════ */

export interface ScheduleEditorProps {
  rows: DraftPay[]
  /** قيمة المنحة · اللي المجموع لازم يساويها */
  amount: number
  onChange?: (rows: DraftPay[]) => void
  /** بعد التوقيع التعديل ممنوع · قاعدة 17 */
  readOnly?: boolean
}

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

/** جدول الاتفاقية المحفوظ ← نفس شكل المسودة · فالمكوّن واحد */
export const asDraft = (ps: AgreementPayment[]): DraftPay[] =>
  ps.map((p) => ({
    no: p.no,
    amount: p.amount,
    dueAt: p.dueAt,
    requirement: p.requirement ?? '',
  }))

export function ScheduleEditor({ rows, amount, onChange, readOnly }: ScheduleEditorProps) {
  const total = scheduleTotal(rows)
  const gap = amount - total
  const match = amount > 0 && gap === 0
  const edit = !readOnly && Boolean(onChange)

  /** الترقيم بيتعاد بعد أي إضافة أو حذف · الرقم ترتيب لا معرّف */
  const renum = (xs: DraftPay[]) => xs.map((r, i) => ({ ...r, no: i + 1 }))

  const patch = (i: number, p: Partial<DraftPay>) =>
    onChange?.(rows.map((r, x) => (x === i ? { ...r, ...p } : r)))

  const add = () => {
    const last = rows[rows.length - 1]
    onChange?.(renum([
      ...rows,
      { no: 0, amount: Math.max(0, gap), dueAt: last?.dueAt ?? '', requirement: '' },
    ]))
  }

  const drop = (i: number) => onChange?.(renum(rows.filter((_, x) => x !== i)))

  /* ⚠️ «وزّع الباقي» مش زرار تجميلي: أكتر غلط بيحصل في الجدول ده هو
     فرق ريالات من التقريب · والمستخدم بيقعد يعدّل رقمًا ورقمًا
     عشان الفرق يقفل. الزرار بيحطّ الفرق كله في الدفعة الأخيرة. */
  const settle = () => {
    if (!rows.length || gap === 0) return
    onChange?.(rows.map((r, i) =>
      i === rows.length - 1 ? { ...r, amount: Math.max(0, r.amount + gap) } : r))
  }

  return (
    <>
      <div className="tblwrap">
        <table className="tbl t-sched" aria-label="جدول الدفعات">
          {/* ⚠️ **العروض في الـCSS (`.t-sched`) لا هنا.** `<col>` فاضي
              عن قصد: هو مرساة العمود، والعرض خاصية ستايل. */}
          <colgroup>
            <col /><col /><col /><col /><col />
            {edit && <col />}
          </colgroup>

          <thead>
            <tr>
              <th><span className="th-t">الدفعة</span></th>
              <th className="n"><span className="th-t">المبلغ</span></th>
              <th className="n"><span className="th-t">النسبة</span></th>
              <th><span className="th-t">الاستحقاق</span></th>
              <th><span className="th-t">شرط الاستحقاق</span></th>
              {edit && <th aria-label="حذف" />}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.no}</td>

                <td className="n">
                  {edit ? (
                    <span className="fld">
                      <input
                        className="num"
                        inputMode="numeric"
                        value={r.amount ? nf.format(r.amount) : ''}
                        onChange={(e) => patch(i, { amount: digits(e.target.value) })}
                        aria-label={`مبلغ الدفعة ${r.no}`}
                      />
                      <Riyal />
                    </span>
                  ) : <Money sm>{r.amount}</Money>}
                </td>

                {/* محسوبة · فما لهاش حقل حتى في وضع التحرير */}
                <td className="n num">{pct(shareOf(r.amount, amount))}</td>

                <td>
                  {edit ? (
                    <span className="fld">
                      <input
                        type="date"
                        value={r.dueAt}
                        onChange={(e) => patch(i, { dueAt: e.target.value })}
                        aria-label={`تاريخ الدفعة ${r.no}`}
                      />
                    </span>
                  ) : <DateText>{r.dueAt}</DateText>}
                </td>

                <td>
                  {edit ? (
                    <span className="fld">
                      <input
                        value={r.requirement}
                        placeholder="التقرير المرحلي الأول"
                        onChange={(e) => patch(i, { requirement: e.target.value })}
                        aria-label={`شرط الدفعة ${r.no}`}
                      />
                    </span>
                  ) : <span className="sub">{r.requirement || 'بلا شرط'}</span>}
                </td>

                {edit && (
                  <td className="n">
                    <button
                      className="btn btn-ghost btn-sm"
                      title={`احذف الدفعة ${r.no}`}
                      aria-label={`احذف الدفعة ${r.no}`}
                      onClick={() => drop(i)}
                    >
                      <Icon name={icons.close} size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          {/* ⚠️ `tfoot` **تحقّق**: بيقول مطابق أو بيقول الفرق وفي أي
              اتجاه · جدول بيلخّص وبس بيخفي الغلط */}
          <tfoot>
            <tr className={match ? '' : 'bad'}>
              <td>الإجمالي</td>
              <td className="n"><Money sm>{total}</Money></td>
              <td className="n num">{pct(shareOf(total, amount))}</td>
              <td colSpan={edit ? 3 : 2}>
                {amount <= 0
                  ? <span className="sub">مفيش قيمة منحة</span>
                  : match
                    ? <Tag tone="ok">مطابق لقيمة المنحة</Tag>
                    : <Tag tone="warn">
                        {gap > 0 ? 'ناقص' : 'زايد'} <Num>{Math.abs(gap)}</Num>
                      </Tag>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {edit && (
        <div className="rowf gp-2 mt-3">
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
          <span className="sub">المجموع لازم يساوي قيمة المنحة · <b>قاعدة 8</b></span>
        </div>
      )}
    </>
  )
}
