import type { ReactNode } from 'react'
import { Tag } from '@/components/ui'
import { DocDownload, DocFile } from './DocFile'

/* Document list — **the one shape for any attachment list in the system**.

   ⚠️ **`DocFile` was already one component; the list around it wasn't.** Every screen wrote its own
   table by hand: a name column, a status column, a status tag, a download button, and a dimmed row
   for anything not uploaded. The result was the same list appearing in four different forms
   (project attachments, entity documents, agreement documents, bank accounts), and every layout
   change had to be made four times — and anyone who missed one left a screen behaving differently
   from its siblings.

   **The reference is the "Attachments" table on the project page** (the agreed baseline), and this
   component matches it exactly:

     - No column headers — the card title above already says "Attachments," and a "File / Status"
     header underneath would just repeat it. Each cell describes itself.
     - The name is a preview button with its thumbnail — the type shows before opening, so a
     reviewer knows the budget is a **scanned image** from the row itself.
     - Download sits **at the end of the row next to status**, not after the name, so the icons line
     up in one column.
     - Anything not uploaded has no thumbnail (there's no content), and its row is dimmed.

   The extra columns (upload date, expiry) are passed via `extra` — they're data for that particular
   screen, not a second shape for the list.

   ⚠️ **Actions are passed in, never written into the row** — "request it from the entity" is the
   screen's action, not the file's, so it goes in `action` and lands in the last column with the
   same alignment everywhere.

   A build check blocks any document table drawn outside this component. */

export interface DocRow {
  /** File name with its extension — the thumbnail and type are read from it. */
  name: string
  /** Line under the name: source or date. */
  meta?: string
  uploaded: boolean
  /** Changes the "not uploaded" tag text — required or optional. */
  required?: boolean
  /** Uploaded but expired — the "Expired" tag. */
  expired?: boolean
  /** Extra cells between the name and status — an upload date, for example. */
  extra?: ReactNode[]
  /** The screen's action on this row — placed in the last column. */
  action?: ReactNode
}

export interface DocListProps {
  rows: DocRow[]
  /** List name for screen readers — "project attachments and their status." */
  label: string
  /** Headings for the extra columns — a header row shows only if one is passed. */
  heads?: string[]
}

const stateTag = (r: DocRow) => {
  if (!r.uploaded) {
    return <Tag tone={r.required === false ? 'mute' : 'warn'}>
      {r.required === false ? 'اختياري، غير مرفوع' : 'مطلوب، غير مرفوع'}
    </Tag>
  }
  if (r.expired) return <Tag tone="no">منتهي الصلاحية</Tag>
  return <Tag tone="ok">مرفوع</Tag>
}

export function DocList({ rows, label, heads }: DocListProps) {
  const acts = rows.some((r) => r.action)

  return (
    <div className="dlist">
      <table className="tbl" aria-label={label}>
        {/* ⚠️ The header row shows **only** when there are extra columns needing a label — the name and
   status columns describe themselves, and a "File / Status" header would just repeat the card title
   above. */}
        {heads && heads.length > 0 && (
          <thead>
            <tr>
              <th>المستند</th>
              {heads.map((h) => <th key={h}>{h}</th>)}
              {/* ⚠️ **Status is a word, not a number** — the header's start and the cell agree. It used to be a
   numeric-style column, then moved above the download icon. */}
              <th>الحالة</th>
              {acts && <th> </th>}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r.uploaded ? '' : 'off'}>
              <td>
                {/* ⚠️ **A missing document uses the same geometry as an uploaded one.** It used to be a bare name
   with no thumbnail slot, starting well off from an uploaded row's start; the thumbnail slot is now
   held with a dashed border meaning "no file here." */}
                {r.uploaded
                  ? <DocFile name={r.name} meta={r.meta} download={false} />
                  : (
                    <span className="dfile dmiss">
                      <span className="dfile-b">
                        <span className="dthumb dthumb-miss" aria-hidden="true" />
                        <span className="dfile-t">
                          <span className="dfile-n" title={r.name}>{r.name}</span>
                          {r.meta && <span className="sub">{r.meta}</span>}
                        </span>
                      </span>
                    </span>
                  )}
              </td>
              {/* ⚠️ The key comes from the **column name**, not its position — the header list is the same columns
   in the same order in every row. */}
              {(r.extra ?? []).map((c, i) => (
                <td key={`${r.name}-${heads?.[i] ?? i}`}>{c ?? <span className="sub"> </span>}</td>
              ))}
              <td>
                <span className="dstat">
                  {stateTag(r)}
                  {/* The download cell is reserved even when empty — otherwise the status tag would jump between an
   uploaded and a missing row in the same column. */}
                  {r.uploaded ? <DocDownload name={r.name} /> : <span className="dfile-dl dl-slot" aria-hidden="true" />}
                </span>
              </td>
              {acts && <td className="n">{r.action}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
