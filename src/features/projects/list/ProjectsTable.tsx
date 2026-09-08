import { useEffect, useRef, useState } from 'react'
import { Icon, icons, Riyal } from '@/components/ui'
import { nf, units } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { COLS, aggregate, orderCols, splitGroups, type Col, type GroupBy } from './columns'

export interface ProjectsTableProps {
  rows: ProjectRow[]
  selected: Set<string>
  onSelect: (id: string, on: boolean) => void
  onSelectAll: (on: boolean) => void
  /** مفاتيح الأعمدة الظاهرة */
  cols: string[]
  onCols: (keys: string[]) => void
  /** التجميع — بدونه جدول واحد */
  group?: GroupBy
}

/**
 * عرض الجدول — للمسح السريع لا للقرار.
 *
 * الأعمدة بتتقرا من `columns.tsx`، فنفس التعريف بيغذّي الجدول
 * والإجماليات والتصدير. والمستخدم بيزوّد أعمدة من زرار في آخر
 * الترويسة — النظام العامل فيه 62 عمودًا، والاختيار بينهم لازم
 * يبقى في إيد المستخدم لا مقفول على عشرة.
 */
export function ProjectsTable({
  rows, selected, onSelect, onSelectAll, cols, onCols, group,
}: ProjectsTableProps) {
  /* العمود اللي بنجمّع بيه بيتشال من الجدول: قيمته مكتوبة مرة
     واحدة في عنوان المجموعة، وتكرارها في كل صف عمود ضايع. */
  const shown = orderCols(cols).filter((c) => !group || c.key !== group.key)
  const groups = group ? splitGroups(rows, group) : [{ key: '', rows }]

  return (
    <div className="tblwrap">
      {groups.map((g, i) => (
        <TableBlock
          key={g.key || 'all'}
          caption={group ? { label: group.label, value: g.key } : undefined}
          rows={g.rows}
          cols={shown}
          selected={selected}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
          picker={i === 0 ? { cols, onCols } : undefined}
        />
      ))}

      {/* الإجمالي الكلي بعد المجموعات: من غيره المستخدم بيجمع
          إجماليات المجموعات في دماغه عشان يعرف المحفظة. */}
      {group && groups.length > 1 && (
        <div className="tgrand">
          <span className="tgrand-k">الإجمالي الكلي · {units.project(rows.length)}</span>
          <span className="tgrand-v">
            {shown
              .filter((c) => c.agg)
              .map((c) => (
                <span key={c.key}>
                  <span className="sub">{c.label}</span>{' '}
                  <b className="num">{nf.format(aggregate(c, rows) ?? 0)}</b>
                  {c.money && <Riyal />}
                </span>
              ))}
          </span>
        </div>
      )}
    </div>
  )
}

function TableBlock({
  caption, rows, cols, selected, onSelect, onSelectAll, picker,
}: {
  caption?: { label: string; value: string }
  rows: ProjectRow[]
  cols: Col[]
  selected: Set<string>
  onSelect: (id: string, on: boolean) => void
  onSelectAll: (on: boolean) => void
  picker?: { cols: string[]; onCols: (k: string[]) => void }
}) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const hasTotals = cols.some((c) => c.agg)

  return (
    <div className="tblock">
      {caption && (
        <div className="tcap">
          <span className="tcap-k">
            <span className="sub">{caption.label}:</span> {caption.value}
          </span>
          <span className="tcap-n sub num">{rows.length}</span>
        </div>
      )}

      <table className="tbl plist-t">
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              <input
                type="checkbox"
                checked={allOn}
                onChange={(e) => onSelectAll(e.target.checked)}
                aria-label="تحديد كل الصفوف المعروضة"
              />
            </th>
            {cols.map((c) => (
              <th key={c.key} className={c.n ? 'n' : undefined}>{c.label}</th>
            ))}
            <th className="tcolx">
              {picker && <ColumnPicker cols={picker.cols} onCols={picker.onCols} />}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={selected.has(r.id) ? 'sel' : ''}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={(e) => onSelect(r.id, e.target.checked)}
                  aria-label={`تحديد مشروع ${r.id}`}
                />
              </td>
              {cols.map((c) => (
                <td key={c.key} className={c.n ? 'n num' : undefined}>{c.cell(r)}</td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>

        {/* الإجماليات جوّه `tfoot` لا صفًّا عاديًا: المتصفح بيثبّتها
            عند الطباعة، وقارئ الشاشة بيقول إنها تلخيص لا بيان. */}
        {hasTotals && rows.length > 0 && (
          <tfoot>
            <tr>
              <td />
              {cols.map((c, i) => {
                const total = aggregate(c, rows)
                /* أول عمود بلا إجمالي بيحمل العدّاد — الرقم لازم
                   يبان جنب المجاميع عشان يفسّرها. */
                const isFirst = i === 0
                return (
                  <td key={c.key} className={c.n ? 'n num' : undefined}>
                    {total !== null ? (
                      <>
                        <b>{nf.format(total)}</b>
                        {c.money && <> <Riyal /></>}
                        {c.agg === 'avg' && <small className="sub"> وسطي</small>}
                      </>
                    ) : isFirst ? (
                      <span className="sub">{units.project(rows.length)}</span>
                    ) : null}
                  </td>
                )
              })}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** منتقي الأعمدة — زرار في آخر ترويسة الجدول */
function ColumnPicker({ cols, onCols }: { cols: string[]; onCols: (k: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const toggle = (key: string) =>
    onCols(cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key])

  return (
    <div className="tcolp" ref={box}>
      <button
        type="button"
        className="tcolb"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="الأعمدة"
        onClick={() => setOpen((x) => !x)}
      >
        <Icon path={icons.plus} size={15} />
      </button>

      {open && (
        <div className="fmenu tcolm">
          <div className="fmenu-l" role="listbox" aria-multiselectable="true">
            {COLS.map((c) => {
              const sel = cols.includes(c.key)
              return (
                <button
                  type="button"
                  key={c.key}
                  role="option"
                  aria-selected={sel}
                  disabled={c.fixed}
                  className={`fopt${sel ? ' on' : ''}${c.fixed ? ' fix' : ''}`}
                  onClick={() => !c.fixed && toggle(c.key)}
                >
                  <span className="fopt-x" aria-hidden="true">
                    {sel && <Icon path={icons.check} size={12} />}
                  </span>
                  <span className="fopt-t">{c.label}</span>
                </button>
              )
            })}
          </div>
          <div className="fmenu-f">
            <button
              type="button"
              className="fclear"
              onClick={() => onCols(COLS.filter((c) => c.fixed || c.def).map((c) => c.key))}
            >
              أعِد الأعمدة الافتراضية
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
