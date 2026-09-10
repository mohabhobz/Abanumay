import type { Sheet } from '@/lib/export'

/**
 * نسخة الطباعة.
 *
 * مخفية على الشاشة وبتظهر وقت الطباعة بس. سبب وجودها إنها بتطبع
 * **نفس اللي بيتصدّر** لا اللي على الشاشة: لو المستخدم علّم عشرة
 * صفوف، الـPDF بيطلع بالعشرة دول بأعمدتهم وإجمالياتهم — من غير
 * الشريط الجانبي ولا الفلاتر ولا أزرار التحديد.
 *
 * والطباعة هي طريق الـPDF هنا عن قصد: مكتبات الـPDF بتحتاج خطًا
 * عربيًا مضمَّنًا ومحرّك تشكيل، والمتصفح عنده الاتنين جاهزين.
 */
export function PrintSheet({ sheet, note }: { sheet: Sheet; note?: string }) {
  return (
    <div className="printsheet" aria-hidden="true">
      <div className="ps-head">
        <h1>{sheet.title}</h1>
        {note && <p>{note}</p>}
      </div>

      <table>
        <thead>
          <tr>{sheet.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {sheet.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
        {sheet.totals && (
          <tfoot>
            <tr>{sheet.totals.map((c, i) => <td key={i}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
