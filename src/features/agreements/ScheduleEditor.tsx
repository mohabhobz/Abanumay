import { DateField, DateText, Icon, Money, Num, Riyal, Tag, icons } from '@/components/ui'
import { nf, pct } from '@/lib/format'
import { scheduleTotal, shareOf, type DraftPay } from '@/data/mock/agreementNew'
import type { AgreementPayment } from '@/types/domain'

/* Payment schedule - one table for both reading and editing.

   Note: the first version invented its own grid (`.sched`) instead of using `.tbl`. As a result,
   the agreement page showed one shape for the payment schedule and the draft builder showed
   another: different font size, different card padding, different row height - for the exact same
   data.

   `.tbl` is the system table: row height (`--row-h`) is a result, not a fixed number (8 + 44 + 8),
   and the in-cell control's height (`--h-md` = 44) fits the row exactly; card padding is
   `.tblcard`. So the edited table and the read-only table are the same shape, and the only
   difference is that a cell holds a field.

   Note: the percentage is calculated, not entered. If a user typed both amount and percentage by
   hand, they'd end up in conflict - a payment shown as 40% but worth a quarter of the grant.

   Note: the total row is a check, not a summary (rule 8). A table that says "total: 800,000" under
   a grant of one million shows a correct-looking number while hiding an error. */

export interface ScheduleEditorProps {
  rows: DraftPay[]
  /** Grant value - what the total must equal. */
  amount: number
  onChange?: (rows: DraftPay[]) => void
  /** No edits after signing - rule 17. */
  readOnly?: boolean
}

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

/** Saved agreement schedule - same shape as the draft, so it's one component. */
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

  /** Numbering resets after any add or delete - the number is an order, not an identifier. */
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

  /* Note: "distribute remainder" isn't decorative - the most common error in this table is a rounding
   gap of a few riyals, with users adjusting numbers one by one to close it. This button puts the
   whole gap into the last payment. */
  const settle = () => {
    if (!rows.length || gap === 0) return
    onChange?.(rows.map((r, i) =>
      i === rows.length - 1 ? { ...r, amount: Math.max(0, r.amount + gap) } : r))
  }

  return (
    <>
      <div className="tblwrap">
        <table className="tbl t-sched" aria-label="جدول الدفعات">
          {/* Note: widths live in CSS (`.t-sched`), not here. `<col>` is deliberately empty - it anchors the
   column, and width is a style concern. */}
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
                <td><Num>{r.no}</Num></td>

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

                {/* Calculated, so it has no field even in edit mode. */}
                <td className="n">{pct(shareOf(r.amount, amount))}</td>

                <td>
                  {edit ? (
                    <DateField
                      value={r.dueAt}
                      onChange={(x) => patch(i, { dueAt: x })}
                      label={`تاريخ الدفعة ${r.no}`}
                    />
                  ) : <DateText>{r.dueAt}</DateText>}
                </td>

                <td>
                  {edit ? (
                    <span className="fld">
                      <input
                        value={r.requirement}
                        placeholder="مثال: التقرير المرحلي الأول"
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
                      <Icon name={icons.close} size="sm" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          {/* Note: `tfoot` is a check - it says either "balanced" or shows the difference and its direction. A
   table that only summarizes hides the error. */}
          <tfoot>
            <tr className={match ? '' : 'bad'}>
              <td>الإجمالي</td>
              <td className="n"><Money sm>{total}</Money></td>
              <td className="n">{pct(shareOf(total, amount))}</td>
              <td colSpan={edit ? 3 : 2}>
                {amount <= 0
                  ? <span className="sub">لا توجد قيمة منحة</span>
                  : match
                    ? <Tag tone="ok">مطابق لقيمة المنحة</Tag>
                    : <Tag tone="warn">
                        {gap > 0 ? 'ينقص' : 'يزيد'} <Num>{Math.abs(gap)}</Num>
                      </Tag>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {edit && (
        <div className="rowf gp-2 mt-3">
          <button className="btn btn-2 btn-sm" onClick={add}>
            <Icon name={icons.plus} size="sm" />
            أضف دفعة
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={gap === 0 || rows.length === 0}
            title={
              gap === 0
                ? 'الجدول مطابق'
                : `اضبط الدفعة الأخيرة بمقدار الفرق (${nf.format(Math.abs(gap))})`
            }
            onClick={settle}
          >
            وزّع الباقي على الأخيرة
          </button>
          <span className="pc-sp" />
          <span className="sub">يلزم أن يساوي المجموع قيمة المنحة · <b>قاعدة 8</b></span>
        </div>
      )}
    </>
  )
}
