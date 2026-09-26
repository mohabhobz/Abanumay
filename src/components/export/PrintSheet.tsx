import type { Sheet } from '@/lib/export'

/**
 * Print version.
 * Hidden on screen, shown only when printing. It exists to print **exactly what gets exported**,
 * not what's on screen: if the user checked ten rows, the PDF comes out with those ten, their
 * columns, and their totals, without the side rail, filters, or selection buttons.
 * Printing is the deliberate path to the PDF here: PDF libraries need an embedded Arabic font and a
 * shaping engine, and the browser already has both ready.
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
