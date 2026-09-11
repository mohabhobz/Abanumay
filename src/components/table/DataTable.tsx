import { useEffect, useRef, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { nf } from '@/lib/format'
import { aggregate, defaultCols, orderCols, splitGroups, type Col, type GroupBy } from './model'
import { useColumnResize, type ColumnResize } from './useColumnResize'

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
  /** اسم الجدول — بيتخزّن عليه عرض الأعمدة اللي المستخدم سحبها */
  table?: string
}

/**
 * جدول عام.
 *
 * كل جداول السيستم بتستخدمه: نفس الإجماليات ونفس التجميع ونفس
 * منتقي الأعمدة ونفس سلوك الصف. الموديول بيجيب أعمدته وبس.
 */
export function DataTable<T>({
  rows, all, cols, onCols, id, selected, onSelect, onSelectAll, onOpen, group, count, table,
}: DataTableProps<T>) {
  const resize = useColumnResize(table)

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
          resize={resize}
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
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

function Block<T>({
  caption, rows, cols, id, selected, onSelect, onSelectAll, onOpen, picker, count, resize,
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
  resize: ColumnResize
}) {
  const pick = Boolean(selected && onSelect)
  const allOn = pick && rows.length > 0 && rows.every((r) => selected!.has(id(r)))
  const hasTotals = cols.some((c) => c.agg)

  const { widths, dragging, start, reset } = resize

  /* خط الحدّ: بيبان بمجرّد الهوفر على المقبض، وبيمتدّ على طول الجدول
     لا على الترويسة لوحدها — الحدّ اللي هتسحبه بيقع على الصفوف،
     فالمستخدم لازم يشوفه عليها قبل ما يسحب. وموضعه بيتقاس من حافة
     الترويسة نفسها لا من موضع المؤشّر: المؤشّر ممكن يكون في أي مكان
     جوّه مساحة اللمس (١١px)، فالخط كان بينحرف عن الحدّ الحقيقي. */
  const [hover, setHover] = useState<number | null>(null)

  const edgeOf = (el: HTMLElement): number | null => {
    const th = el.closest('th')
    const host = el.closest('.tblock')
    if (!th || !host) return null
    const t = th.getBoundingClientRect()
    const h = host.getBoundingClientRect()
    return (getComputedStyle(th).direction === 'rtl' ? t.left : t.right) - h.left
  }

  const guide = dragging ? dragging.x : hover

  return (
    <div className={`tblock${dragging ? ' resizing' : ''}`}>
      {guide !== null && (
        <span
          className={`tguide${dragging ? ' on' : ''}`}
          style={{ left: guide }}
          aria-hidden="true"
        />
      )}

      {caption && (
        <div className="tcap">
          <span className="tcap-k">
            <span className="sub">{caption.label}:</span> {caption.value}
          </span>
          <span className="tcap-n sub num">{rows.length}</span>
        </div>
      )}

      <table className="tbl">
        {/* العروض في `colgroup` لا على الخلايا: خانة واحدة لكل عمود
            بدل تكرارها في كل صف، والمتصفح بيقراها مرة قبل الرسم. */}
        <colgroup>
          {pick && <col style={{ width: 44 }} />}
          {cols.map((c) => (
            <col key={c.key} style={{ width: widths[c.key] ?? c.w ?? 120 }} />
          ))}
          <col style={{ width: 38 }} />
        </colgroup>

        <thead>
          <tr>
            {pick && (
              <th className="tchk">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => onSelectAll?.(e.target.checked, rows.map(id))}
                  aria-label="تحديد كل الصفوف المعروضة"
                />
              </th>
            )}
            {cols.map((c, i) => (
              <th key={c.key} className={c.n ? 'n' : undefined} title={c.label}>
                <span className="th-t">{c.label}</span>
                {/* المقبض على حافة العمود الداخلية — يعني الحدّ بينه
                    وبين اللي بعده. آخر عمود ما لهوش مقبض: مفيش حدّ
                    بعده يتسحب، وخانة منتقي الأعمدة جنبه. */}
                {i < cols.length - 1 && (
                  <span
                    className={`thgrip${dragging?.key === c.key ? ' on' : ''}`}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`تغيير عرض عمود ${c.label}`}
                    onPointerDown={(e) => start(c.key, e)}
                    onPointerEnter={(e) => setHover(edgeOf(e.currentTarget))}
                    onPointerLeave={() => setHover(null)}
                    onDoubleClick={() => reset(c.key)}
                    title="اسحب لتغيير العرض · دبل كليك للعرض الافتراضي"
                  />
                )}
              </th>
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
                  <td className="tchk">
                    <input
                      type="checkbox"
                      checked={selected!.has(rid)}
                      onChange={(e) => onSelect!(rid, e.target.checked)}
                      aria-label={`تحديد ${rid}`}
                    />
                  </td>
                )}
                {cols.map((c) => (
                  /* العنوان هو نصّ التصدير نفسه: الخلية بتتقصّ لما
                     العمود يضيق، والتلميح بيرجّع اللي اتقصّ من غير
                     ما الصفّ يلفّ سطرًا. */
                  <td key={c.key} className={c.n ? 'n num' : undefined} title={c.text(r)}>
                    {c.cell(r)}
                  </td>
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
                  <td key={c.key} className={c.n ? 'n' : undefined}>
                    {total !== null ? (
                      /* الرقم والكلمة في مجموعة عربية، والعزل نازل على
                         الأرقام وحدها — نفس قاعدة `Money`. الخلية اللي
                         كانت `.num` كانت بتحطّ الاتنين في مجرى إنجليزي،
                         فـ«وسطي» بتقع على الجنب الغلط ومش متسطّرة مع
                         الرقم اللي فوقها في العمود. */
                      <span className="tfv">
                        <b className="num">{nf.format(total)}</b>
                        {c.agg === 'avg' && <small className="sub">وسطي</small>}
                      </span>
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
        <Icon name={icons.plus} size={15} />
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
                    {sel && <Icon name={icons.check} size={12} />}
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
