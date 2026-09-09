import { useEffect, useRef, useState } from 'react'
import { Icon, icons, Riyal } from '@/components/ui'
import { nf } from '@/lib/format'
import { aggregate, defaultCols, orderCols, splitGroups, type Col, type GroupBy } from './model'

export interface DataTableProps<T> {
  rows: T[]
  /** كل الأعمدة المعرَّفة للكيان ده */
  all: Col<T>[]
  /** مفاتيح الأعمدة الظاهرة */
  cols: string[]
  onCols: (keys: string[]) => void
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * تحديد/إلغاء **صفوف الجدول اللي اتضغط فيه بس**.
   *
   * مع التجميع، كل مجموعة جدول بترويسته. الصندوق اللي فوق مجموعة
   * «القصيم» يقصد أربعة صفوف القصيم لا الثلاثين كلهم — الأب بيحدّد
   * أولاده. فبيبعت معرّفات صفوفه، والصفحة بتضمّها أو تشيلها من
   * المحدَّد بدل ما تستبدله.
   */
  onSelectAll?: (on: boolean, ids: string[]) => void
  /** فتح الصف — بيخلي الصف كله كليكبول */
  onOpen?: (r: T) => void
  /** التجميع — بدونه جدول واحد */
  group?: GroupBy<T>
  /** اسم الوحدة في الإجماليات: «6 مشاريع» */
  count: (n: number) => string
}

/**
 * جدول عام.
 *
 * كل جداول السيستم بتستخدمه: نفس الإجماليات ونفس التجميع ونفس
 * منتقي الأعمدة ونفس سلوك الصف. الموديول بيجيب أعمدته وبس.
 */
export function DataTable<T>({
  rows, all, cols, onCols, id, selected, onSelect, onSelectAll, onOpen, group, count,
}: DataTableProps<T>) {
  /* العمود اللي بنجمّع بيه بيتشال: قيمته مكتوبة مرة في عنوان
     المجموعة، وتكرارها في كل صف عمود ضايع. */
  const shown = orderCols(all, cols).filter((c) => !group || c.key !== group.key)
  const groups = group ? splitGroups(rows, group) : [{ key: '', rows }]

  return (
    <div className="tblwrap">
      {groups.map((g, i) => (
        <Block
          key={g.key || 'all'}
          caption={group ? { label: group.label, value: g.key } : undefined}
          rows={g.rows}
          cols={shown}
          id={id}
          selected={selected}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
          onOpen={onOpen}
          count={count}
          picker={i === 0 ? { all, cols, onCols } : undefined}
        />
      ))}

      {/* الإجمالي الكلي بعد المجموعات: من غيره المستخدم بيجمع
          إجماليات المجموعات في دماغه. */}
      {group && groups.length > 1 && (
        <div className="tgrand">
          <span className="tgrand-k">الإجمالي الكلي · {count(rows.length)}</span>
          <span className="tgrand-v">
            {shown.filter((c) => c.agg).map((c) => (
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

function Block<T>({
  caption, rows, cols, id, selected, onSelect, onSelectAll, onOpen, picker, count,
}: {
  caption?: { label: string; value: string }
  rows: T[]
  cols: Col<T>[]
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * تحديد/إلغاء **صفوف الجدول اللي اتضغط فيه بس**.
   *
   * مع التجميع، كل مجموعة جدول بترويسته. الصندوق اللي فوق مجموعة
   * «القصيم» يقصد أربعة صفوف القصيم لا الثلاثين كلهم — الأب بيحدّد
   * أولاده. فبيبعت معرّفات صفوفه، والصفحة بتضمّها أو تشيلها من
   * المحدَّد بدل ما تستبدله.
   */
  onSelectAll?: (on: boolean, ids: string[]) => void
  onOpen?: (r: T) => void
  picker?: { all: Col<T>[]; cols: string[]; onCols: (k: string[]) => void }
  count: (n: number) => string
}) {
  const pick = Boolean(selected && onSelect)
  const allOn = pick && rows.length > 0 && rows.every((r) => selected!.has(id(r)))
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

      <table className="tbl">
        <thead>
          <tr>
            {pick && (
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => onSelectAll?.(e.target.checked, rows.map(id))}
                  aria-label="تحديد كل الصفوف المعروضة"
                />
              </th>
            )}
            {cols.map((c) => (
              <th key={c.key} className={c.n ? 'n' : undefined}>{c.label}</th>
            ))}
            <th className="tcolx">
              {picker && <ColumnPicker {...picker} />}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const rid = id(r)
            return (
              <tr
                key={rid}
                className={`${pick && selected!.has(rid) ? 'sel' : ''}${onOpen ? ' clickable' : ''}`}
                /* الصف كله يفتح، مش الاسم بس: الهدف الصغير بيخلي
                   المستخدم يصوّب بالماوس بدل ما يقرا. والضغط على
                   صندوق التحديد أو رابط جوّه الصف ما يفتحش. */
                onClick={
                  onOpen
                    ? (e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a,button,input,label')) return
                        onOpen(r)
                      }
                    : undefined
                }
              >
                {pick && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected!.has(rid)}
                      onChange={(e) => onSelect!(rid, e.target.checked)}
                      aria-label={`تحديد ${rid}`}
                    />
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} className={c.n ? 'n num' : undefined}>{c.cell(r)}</td>
                ))}
                <td />
              </tr>
            )
          })}
        </tbody>

        {/* الإجماليات جوّه `tfoot`: المتصفح بيثبّتها عند الطباعة،
            وقارئ الشاشة بيقول إنها تلخيص لا بيان. */}
        {hasTotals && rows.length > 0 && (
          <tfoot>
            <tr>
              {pick && <td />}
              {cols.map((c, i) => {
                const total = aggregate(c, rows)
                return (
                  <td key={c.key} className={c.n ? 'n num' : undefined}>
                    {total !== null ? (
                      <>
                        <b>{nf.format(total)}</b>
                        {c.money && <> <Riyal /></>}
                        {c.agg === 'avg' && <small className="sub"> وسطي</small>}
                      </>
                    ) : i === 0 ? (
                      <span className="sub">{count(rows.length)}</span>
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
function ColumnPicker<T>({
  all, cols, onCols,
}: { all: Col<T>[]; cols: string[]; onCols: (k: string[]) => void }) {
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
            {all.map((c) => {
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
            <button type="button" className="fclear" onClick={() => onCols(defaultCols(all))}>
              أعِد الأعمدة الافتراضية
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
