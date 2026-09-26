import { useState, type ReactNode } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { Icon, icons, MenuOpt, MenuPanel } from '@/components/ui'
import { nf, pct, unitAfter } from '@/lib/format'
import {
  aggregate, allPaths, countLeaves, defaultCols, groupTree, orderCols,
  type Col, type GroupBy, type GroupNode,
} from './model'
import { useColumnResize, type ColumnResize } from './useColumnResize'

export interface DataTableProps<T> {
  rows: T[]
  /** All columns defined for this entity. */
  all: Col<T>[]
  /** Keys of the visible columns. */
  cols: string[]
  onCols: (keys: string[]) => void
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * Select/deselect **only the table rows a click applies to**.
   * With grouping, each group has its own header row. The checkbox above the "Qassim" group targets
   * only Qassim's rows, not the entire table — a parent selects its own children. So it sends its
   * own rows' ids, and the page adds or removes them from the selection instead of replacing it.
   */
  onSelectAll?: (on: boolean, ids: string[]) => void
  /** Opening the row — makes the whole row clickable. */
  onOpen?: (r: T) => void
  /**
   * Grouping chain — without it, it's a single table.
   * ⚠️ **A chain, not a single dimension.** Its order is the hierarchy: the first is the parent,
   * the next is the child, and reversing it is an entirely different question.
   */
  group?: GroupBy<T>[]
  /** Unit name in the totals: "6 projects." */
  count: (n: number) => string
  /** Table name — column widths the user dragged are stored against it. */
  table?: string
}

/**
 * Generic table.
 * Every table in the system uses it: same totals, same grouping, same column picker, same row
 * behavior. A module only supplies its own columns.
 */
/* Group expand/collapse.
   ⚠️ **Default is collapsed.** Grouping isn't a table decoration, it's **a question**: "where is
   the money going?" — and the answer is the summary rows. When the table stays expanded after
   grouping, dozens of rows fill the screen and the answer that responds to the question gets lost
   among them, and the user ends up scrolling around looking for what they actually asked for.
   So the moment grouping turns on: **summaries only**, and the user opens the one they care about —
   like getting a report in a second.
   ⚠️ **And anything at the group level belongs on the group row.** The "select all" checkbox and
   the column picker used to live in the table header, and the table can now be collapsed, so both
   would disappear with no explanation. So the checkbox moved down to the group row, and the picker
   moved up to a bar above the groups, and neither is duplicated in both places. */
const NONE: ReadonlySet<string> = new Set()

export function DataTable<T>({
  rows, all, cols, onCols, id, selected, onSelect, onSelectAll, onOpen, group, count, table,
}: DataTableProps<T>) {
  const resize = useColumnResize(table)
  const bys = group ?? []
  const on = bys.length > 0

  /* Columns used for grouping are removed: their value is already written once on the group row,
     and repeating it in every row's own column wastes space. */
  const keys = new Set(bys.map((b) => b.key))
  const shown = orderCols(all, cols).filter((c) => !keys.has(c.key))
  const tree = on ? groupTree(rows, bys) : []

  /* ⚠️ State is tied **to the chain itself**: if the user changes from "region" to "entity," or
     even reverses the order of the same two dimensions, the previously opened paths no longer make
     sense — the comparison happens during render rather than in an effect, so there's no first
     render with stale state. */
  const dim = bys.map((b) => b.key).join(',')
  const [open, setOpen] = useState<{ dim: string; keys: ReadonlySet<string> }>({ dim, keys: NONE })
  const openKeys = open.dim === dim ? open.keys : NONE

  const toggle = (k: string) =>
    setOpen(() => {
      const next = new Set(openKeys)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return { dim, keys: next }
    })

  const every = on ? allPaths(tree) : []
  const allOpen = every.length > 0 && every.every((p) => openKeys.has(p))

  return (
    <div className="tblwrap">
      {on && (
        <div className="tgbar">
          <span className="tgbar-t">
            مجمَّع حسب
            {/* ⚠️ The chain, in its order, is shown **as a chain** — "region then entity" is
                different from "entity then region," and if the bar showed both the same way, the
                user wouldn't know which question they're in. */}
            {bys.map((b, i) => (
              <span key={b.key} className="tgbar-s">
                {i > 0 && <Icon name={icons.chevron} size="sm" />}
                <b>{b.label}</b>
              </span>
            ))}
            <span className="pc-dot" />
            <span className="num">{tree.length}</span> مجموعة
            {bys.length > 1 && (
              <>
                <span className="pc-dot" />
                <span className="num">{countLeaves(tree)}</span> مجموعة فرعية
              </>
            )}
            <span className="pc-dot" />
            <span className="num">{openKeys.size}</span> مفتوحة
          </span>
          <span className="pc-sp" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen({ dim, keys: allOpen ? NONE : new Set(every) })}
          >
            <Icon name={allOpen ? icons.shrink : icons.expand} size="sm" />
            {allOpen ? 'اطوِ الكل' : 'افتح الكل'}
          </button>
          <ColumnPicker all={all} cols={cols} onCols={onCols} />
        </div>
      )}

      {on
        ? tree.map((n) => (
            <Branch
              key={n.path}
              node={n}
              cols={shown}
              id={id}
              selected={selected}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              onOpen={onOpen}
              count={count}
              resize={resize}
              openKeys={openKeys}
              onToggle={toggle}
            />
          ))
        : (
          <Block
            rows={rows}
            cols={shown}
            id={id}
            selected={selected}
            onSelect={onSelect}
            onSelectAll={onSelectAll}
            onOpen={onOpen}
            count={count}
            resize={resize}
            picker={{ all, cols, onCols }}
          />
        )}

      {/* The grand total after the groups: without it, the user has to add up group totals in their
          head. */}
      {on && tree.length > 1 && (
        <div className="tgrand">
          <span className="tgrand-k">الإجمالي الكلي · {count(rows.length)}</span>
          <span className="tgrand-v">
            {shown.filter((c) => c.agg).map((c) => (
              <span className="tagg" key={c.key}>
                <span className="sub tagg-l">{c.label}</span>
                <span className="tagg-v">
                  <b className="num">{c.aggPct ? pct(aggregate(c, rows) ?? 0) : nf.format(aggregate(c, rows) ?? 0)}</b>
                  {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                    <small className="sub"> {unitAfter(aggregate(c, rows) ?? 0, c.aggSay ?? 'وسطي')}</small>
                  )}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * A branch of the grouping tree.
 * ⚠️ **An intermediate node doesn't open a table, it opens its children.** That's the whole idea:
 * an intermediate group opens onto its children with their own summaries, and a leaf group is what
 * opens onto rows. If every level opened a table, nesting would just repeat the table once per
 * level instead of summarizing.
 */
function Branch<T>({
  node, cols, id, selected, onSelect, onSelectAll, onOpen, count, resize, openKeys, onToggle,
}: {
  node: GroupNode<T>
  cols: Col<T>[]
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  onSelectAll?: (on: boolean, ids: string[]) => void
  onOpen?: (r: T) => void
  count: (n: number) => string
  resize: ColumnResize
  openKeys: ReadonlySet<string>
  onToggle: (path: string) => void
}) {
  const shut = !openKeys.has(node.path)
  const leaf = node.kids.length === 0

  /* An expanded intermediate node's children sit directly beneath it, so its row doesn't attach to
     a table — an expanded leaf group does attach to its own table. */
  const cap = (
    <Cap
      node={node}
      cols={cols}
      shut={shut}
      pick={Boolean(selected && onSelect)}
      selected={selected}
      id={id}
      onSelectAll={onSelectAll}
      onToggle={() => onToggle(node.path)}
      leafOpen={leaf && !shut}
    />
  )

  if (leaf) {
    return (
      <Block
        caption={cap}
        rows={node.rows}
        cols={cols}
        id={id}
        selected={selected}
        onSelect={onSelect}
        onSelectAll={onSelectAll}
        onOpen={onOpen}
        count={count}
        resize={resize}
        shut={shut}
      />
    )
  }

  return (
    <div className="tbranch">
      {cap}
      {!shut && (
        <div className="tkids">
          {node.kids.map((k) => (
            <Branch
              key={k.path}
              node={k}
              cols={cols}
              id={id}
              selected={selected}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              onOpen={onOpen}
              count={count}
              resize={resize}
              openKeys={openKeys}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Group row — a summary, not a heading.
 * ⚠️ Before collapsing existed, it was a heading above an always-visible table, with totals below
 * in `tfoot` — meaning a collapsed group would have been a name with no answer.
 */
function Cap<T>({
  node, cols, shut, pick, selected, id, onSelectAll, onToggle, leafOpen,
}: {
  node: GroupNode<T>
  cols: Col<T>[]
  shut: boolean
  pick: boolean
  selected?: Set<string>
  id: (r: T) => string
  onSelectAll?: (on: boolean, ids: string[]) => void
  onToggle: () => void
  /** The last level, and expanded — in that case it attaches to its own table. */
  leafOpen: boolean
}) {
  const allOn = pick && node.rows.length > 0 && node.rows.every((r) => selected!.has(id(r)))

  return (
    <div
      className={`tcap${shut ? ' shut' : ''}${leafOpen ? ' ontbl' : ''}`}
      data-lv={node.level}
    >
      {pick && (
        <input
          type="checkbox"
          className="tcap-x"
          checked={allOn}
          onChange={(e) => onSelectAll?.(e.target.checked, node.rows.map(id))}
          aria-label={`تحديد كل صفوف ${node.key}`}
        />
      )}

      <button
        type="button"
        className="tcap-b"
        aria-expanded={!shut}
        onClick={onToggle}
        title={shut ? `افتح ${node.key}` : `اطوِ ${node.key}`}
      >
        <Icon name={icons.chevronDown} size="sm" />
        <span className="tcap-k">
          <span className="sub">{node.by.label}:</span> {node.key}
        </span>
        <span className="tcap-n sub num">{node.rows.length}</span>
      </button>

      <span className="pc-sp" />

      {/* ⚠️ **These totals show only while collapsed.** When a group is expanded onto a table, the
          same figures sit in `tfoot` **beneath their own columns** — more useful there than as a
          chip in a header row above. But an expanded intermediate node has no `tfoot`, so its
          totals stay here. */}
      {(shut || !leafOpen) && (
        <span className="tcap-v">
          {cols.filter((c) => c.agg).map((c) => (
            <span className="tagg" key={c.key}>
              <span className="sub tagg-l">{c.label}</span>
              <span className="tagg-v">
              <b className="num">{c.aggPct ? pct(aggregate(c, node.rows) ?? 0) : nf.format(aggregate(c, node.rows) ?? 0)}</b>
              {/* The same wording as `tfoot` — the number in the collapsed header and the one in
                  the totals row must say the same thing. */}
              {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                <small className="sub"> {unitAfter(aggregate(c, node.rows) ?? 0, c.aggSay ?? 'وسطي')}</small>
              )}
              </span>
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

function Block<T>({
  caption, rows, cols, id, selected, onSelect, onSelectAll, onOpen, picker, count, resize,
  shut,
}: {
  /** Group row — drawn in a shared component because it's shared with intermediate nodes. */
  caption?: ReactNode
  /** The group is collapsed — summary row only. */
  shut?: boolean
  rows: T[]
  cols: Col<T>[]
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * Select/deselect **only the table rows a click applies to**.
   * With grouping, each group has its own header row. The checkbox above a given group targets only
   * that group's rows, not the entire table — a parent selects its own children. So it sends its
   * own rows' ids, and the page adds or removes them from the selection instead of replacing it.
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

  /* The boundary line: appears on hover over the handle, and spans the full table, not just the
     header — the line being dragged sits over the rows, so the user needs to see it there before
     dragging. Its position is measured from the header's own edge, not the cursor's position: the
     cursor can be anywhere inside the touch target, which used to make the line drift off the real
     boundary. */
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

      {caption}

      {shut ? null : (
      <table className="tbl">
        {/* Widths live in `colgroup`, not on the cells: one slot per column instead of repeating it
            in every row, and the browser reads it once before painting. */}
        <colgroup>
          {pick && <col style={{ width: 44 }} />}
          {cols.map((c) => (
            <col key={c.key} style={{ width: widths[c.key] ?? c.w ?? 120 }} />
          ))}
          <col style={{ width: 38 }} />
        </colgroup>

        <thead>
          <tr>
            {/* With grouping this checkbox moves down to the group row — the slot stays reserved so
                the row's columns below it don't shift. */}
            {pick && (
              <th className="tchk">
                {!caption && (
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => onSelectAll?.(e.target.checked, rows.map(id))}
                    aria-label="تحديد كل الصفوف المعروضة"
                  />
                )}
              </th>
            )}
            {cols.map((c, i) => (
              <th key={c.key} className={c.n ? 'n' : undefined} title={c.label}>
                <span className="th-t">{c.label}</span>
                {/* The handle sits on the column's inner edge — meaning the boundary between it and
                    the next one. The last column has no handle: there's no boundary after it to
                    drag, and the column picker sits next to it. */}
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
                    title="اسحب لتغيير العرض، وانقر مرتين لاستعادة العرض الافتراضي"
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
                /* The whole row opens, not just the name: a small target makes the user aim with
                   the mouse instead of reading. Clicking the selection checkbox or a link inside
                   the row doesn't open it. */
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
                  /* The title is the export text itself: the cell truncates as the column narrows,
                     and the tooltip returns what got cut without wrapping the row to a second line. */
                  <td key={c.key} className={c.n ? 'n' : undefined} title={c.text(r)}>
                    {c.cell(r)}
                  </td>
                ))}
                {/* Picker slot — pinned to the edge like its header. */}
                <td className="tcolx" />
              </tr>
            )
          })}
        </tbody>

        {/* Totals live inside `tfoot`: the browser keeps it fixed when printing, and a screen
            reader announces it as a summary, not a data row. */}
        {hasTotals && rows.length > 0 && (
          <tfoot>
            <tr>
              {pick && <td />}
              {cols.map((c, i) => {
                const total = aggregate(c, rows)
                return (
                  <td key={c.key} className={c.n ? 'n' : undefined}>
                    {total !== null ? (
                      /* The number and the word sit in an Arabic run, with isolation applied to the
                         digits alone — same rule as `Money`. The cell used to put both in an
                         English-direction run, so the unit word would land on the wrong side and
                         not line up with the number above it in the column. */
                      <span className="tfv">
                        <b className="num">{c.aggPct ? pct(total) : nf.format(total)}</b>
                        {/* The word comes from the column, and "average" is the default for the
                            mean alone. See `aggSay` in `model.ts`. */}
                        {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                          <small className="sub">{unitAfter(total, c.aggSay ?? 'وسطي')}</small>
                        )}
                      </span>
                    ) : i === 0 ? (
                      <span className="sub">{count(rows.length)}</span>
                    ) : null}
                  </td>
                )
              })}
              <td className="tcolx" />
            </tr>
          </tfoot>
        )}
      </table>
      )}
    </div>
  )
}

/** Column picker — a button at the end of the table header. */
function ColumnPicker<T>({
  all, cols, onCols,
}: { all: Col<T>[]; cols: string[]; onCols: (k: string[]) => void }) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()

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
        onClick={() => setOpen((x: boolean) => !x)}
      >
        <Icon name={icons.plus} size="sm" />
      </button>

      {open && (
        <MenuPanel
          extra="tcolm"
          foot={
            <button type="button" className="fclear" onClick={() => onCols(defaultCols(all))}>
              أعد الأعمدة الافتراضية
            </button>
          }
        >
          {all.map((c) => (
            <MenuOpt
              key={c.key}
              on={cols.includes(c.key)}
              fix={c.fixed}
              off={c.fixed}
              onPick={() => toggle(c.key)}
            >
              {c.label}
            </MenuOpt>
          ))}
        </MenuPanel>
      )}
    </div>
  )
}
