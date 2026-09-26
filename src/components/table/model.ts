import type { ReactNode } from 'react'

/* Table model — generic for any entity.

   The requirement: **every table** in the system behaves the same way — same row-count picker, same
   grouping, same column picker, same export. Copying the table per module means any improvement has
   to be made several times, and the differences between them only grow over time.

   So the definition here is generic, and each module supplies only its own columns. */

/** How the column is summarized in the totals row. */
export type Agg = 'sum' | 'avg'

export interface Col<T> {
  key: string
  label: string
  /** A numeric column — right-aligned (in this direction) and uses tabular figures. */
  n?: boolean
  /** Can't be removed from the picker: without it the row loses its identity. */
  fixed?: boolean
  /** Visible by default. */
  def?: boolean
  cell: (r: T) => ReactNode
  /** Plain text for export and image output. */
  text: (r: T) => string
  /**
   * The number that gets aggregated — omitting this property means an empty cell in the totals.
   * ⚠️ **And `null` means "this row has no value," not "its value is zero."** A "review duration"
   * column has rows that were never closed, and a "governance score" column has rows not yet rated
   * — they used to return `0`, so the average would divide by rows that never had a value at all
   * and come out lower than the truth. An indicator card and the table on the same screen would
   * then state two different numbers for the same thing. Zero is a number; the absence of a number
   * isn't zero.
   */
  value?: (r: T) => number | null
  agg?: Agg
  /**
   * A small word next to the total figure — **required whenever the total summarizes a different
   * quantity than the cell itself shows**.
   * ⚠️ **A number was found floating with no context.** A documents column's cells say "1 of 2" and
   * "2 of 2," and underneath it, in the totals row, sat a bare number: 5. The number is correct
   * (five missing documents in total) but the cells above it count **complete** items while the
   * total counts **missing** ones — so a reader can't connect the number to anything they're
   * looking at.
   * The rule: **the total must state what it's totaling whenever the cell isn't a plain number.** A
   * column whose cell is a plain number and whose total is a sum needs no word; one whose cell is a
   * percentage or a tag does.
   * (`avg` defaults to "average" when nothing else is given.)
   */
  aggSay?: string
  /**
   * A percentage total — rendered so the sign sits inside the number's own directional run (it used
   * to be a separate word with an Arabic sign next to the percentage in the cells).
   */
  aggPct?: boolean
  /** The total in SAR. */
  money?: boolean
  /**
   * Default width in pixels.
   * The table uses fixed layout so truncation works: with automatic layout, a column stretches to
   * its longest content, so there's never a case of "narrower than the content" or anything to clip
   * at all — at the cost of columns splitting evenly if no width is given, which used to make every
   * column take the same width as the longest name. So every column states its width here, and the
   * browser distributes any surplus or shortfall across them proportionally.
   */
  w?: number
}

/**
 * The column's total over a set of rows — `null` means the column isn't summarized.
 * ⚠️ Rows whose value is `null` are **removed from the whole calculation**: they don't move the
 * sum, and the average divides only by the rows that have a value. Excluding them from the
 * denominator is the difference between "average duration" and "average duration if every unclosed
 * one counted as zero."
 */
export const aggregate = <T,>(col: Col<T>, rows: T[]): number | null => {
  if (!col.value || !col.agg || rows.length === 0) return null
  const read = col.value
  const vals: number[] = []
  for (const r of rows) {
    const v = read(r)
    if (v !== null && v !== undefined && Number.isFinite(v)) vals.push(v)
  }
  if (vals.length === 0) return null
  const total = vals.reduce((a, b) => a + b, 0)
  return col.agg === 'avg' ? Math.round(total / vals.length) : total
}

export const defaultCols = <T,>(cols: Col<T>[]): string[] =>
  cols.filter((c) => c.fixed || c.def).map((c) => c.key)

/** Columns in the order defined by the module, not the order they were picked. */
export const orderCols = <T,>(cols: Col<T>[], keys: string[]): Col<T>[] =>
  cols.filter((c) => keys.includes(c.key))

/* === Column preference === */

/**
 * Selected columns are a personal preference, not a filter.
 * So they live in local storage, not the URL: a link sent to a colleague should carry **the
 * question** (filter and grouping), not the sender's own table layout. The key includes the table
 * name so different tables don't collide.
 */
export const readCols = <T,>(table: string, cols: Col<T>[]): string[] => {
  const fallback = defaultCols(cols)
  try {
    const raw = localStorage.getItem(`ab-cols-${table}`)
    if (!raw) return fallback
    const keys = JSON.parse(raw) as unknown
    if (!Array.isArray(keys)) return fallback
    const valid = keys.filter((k): k is string => typeof k === 'string' && cols.some((c) => c.key === k))
    /* Defaults are returned even if the stored value is outdated and missing them. */
    const fixed = cols.filter((c) => c.fixed).map((c) => c.key)
    return valid.length ? [...new Set([...fixed, ...valid])] : fallback
  } catch {
    return fallback
  }
}

export const writeCols = (table: string, keys: string[]): void => {
  try {
    localStorage.setItem(`ab-cols-${table}`, JSON.stringify(keys))
  } catch {
    /* Storage may be blocked — the selection then only lasts for this session. */
  }
}

/* === Column width === */

/** Width in pixels for each column the user dragged — the rest keeps its default width. */
export type ColWidths = Record<string, number>

/** Narrowest allowed width — below it, the column becomes a bar showing nothing useful. */
export const MIN_COL_W = 56

/** Widths are a personal preference like column selection, so they're stored alongside it under the
 * same logic. */
export const readWidths = (table: string): ColWidths => {
  try {
    const raw = localStorage.getItem(`ab-colw-${table}`)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: ColWidths = {}
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n >= MIN_COL_W) out[k] = Math.round(n)
    }
    return out
  } catch {
    return {}
  }
}

export const writeWidths = (table: string, w: ColWidths): void => {
  try {
    localStorage.setItem(`ab-colw-${table}`, JSON.stringify(w))
  } catch {
    /* Storage is blocked — widths then only last for this session. */
  }
}

/* === Grouping === */

export interface GroupBy<T> {
  key: string
  label: string
  of: (r: T) => string
}

export interface Group<T> {
  key: string
  rows: T[]
}

/**
 * Splitting rows into groups, sorted largest first.
 * Order is by size, not alphabetical: someone grouping by region is asking "where is support
 * concentrated?", and the answer is the first group.
 */
export const splitGroups = <T,>(rows: T[], by: GroupBy<T>): Group<T>[] => {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = by.of(r) || 'بلا قيمة'
    const bucket = map.get(k)
    if (bucket) bucket.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()]
    .map(([key, rs]) => ({ key, rows: rs }))
    .sort((a, b) => b.rows.length - a.rows.length)
}

/* Nested grouping.
   An example from a colleague: "salesperson then customer then payment method" — three nested
   dimensions, not one.
   ⚠️ **And order isn't incidental, it's the question itself.**
     Region then entity asks: "in Riyadh, who's receiving the most?"
     Entity then region asks: "this entity, where does it operate?"
   Same two dimensions, same rows, two entirely different questions. So selection is **by click
   order**, not list order, and the UI shows a number next to each dimension so the order is read,
   not guessed.
   ⚠️ **And a cap of three is deliberate.** Each level multiplies the row count, and a fourth would
   produce groups of a single row each — a tree the size of the table that summarizes nothing. */
export const MAX_GROUP_DEPTH = 3

export interface GroupNode<T> {
  /** The dimension's value at this level. */
  key: string
  /** A key unique across levels — open/closed state is keyed on it. */
  path: string
  level: number
  by: GroupBy<T>
  rows: T[]
  /** Empty at the last level — the table itself is what opens there. */
  kids: GroupNode<T>[]
}

export const groupTree = <T,>(
  rows: T[],
  bys: GroupBy<T>[],
  level = 0,
  parent = '',
): GroupNode<T>[] => {
  const by = bys[level]
  if (!by) return []
  return splitGroups(rows, by).map((g) => {
    const path = parent ? `${parent}␟${g.key}` : g.key
    return {
      key: g.key,
      path,
      level,
      by,
      rows: g.rows,
      kids: groupTree(g.rows, bys, level + 1, path),
    }
  })
}

/** All paths in the tree — "expand all" needs every level. */
export const allPaths = <T,>(nodes: GroupNode<T>[]): string[] =>
  nodes.flatMap((n) => [n.path, ...allPaths(n.kids)])

/** Number of groups at the first level — this is what's stated to the user. */
export const countLeaves = <T,>(nodes: GroupNode<T>[]): number =>
  nodes.reduce((s, n) => s + (n.kids.length ? countLeaves(n.kids) : 1), 0)

/**
 * Reading the grouping chain from the link.
 * ⚠️ **The cleanup here isn't polish.** The link is sent, saved, and hand-edited, so it can arrive
 * with a key that no longer exists, the same key twice (which would produce a tree where every node
 * has one child sharing its own name), or ten levels deep. All three would draw a broken screen
 * with no thrown error.
 */
export const groupChain = <T,>(value: string | undefined, all: GroupBy<T>[]): GroupBy<T>[] => {
  const seen = new Set<string>()
  const out: GroupBy<T>[] = []
  for (const k of (value ?? '').split(',')) {
    if (!k || seen.has(k)) continue
    const by = all.find((g) => g.key === k)
    if (!by) continue
    seen.add(k)
    out.push(by)
    if (out.length === MAX_GROUP_DEPTH) break
  }
  return out
}

/* Export matching the on-screen view.
   The requirement: the export must come out the way it's seen, with grouping and totals.
   ⚠️ **And this doesn't mean grouping columns at the start of the row.** It means the file is **the
   same sheet**: group rows, their totals row underneath, then the next group, and the grand total
   at the end. If the file came out as loose rows with a single total underneath, a user exporting
   for a quick report would end up redoing the addition in Excel.
   ⚠️ **And it's written once, here.** Several screens used to build the sheet by hand with the same
   three lines, and one copy of them left behind when grouping changed would mean several different
   files from several screens. */
export interface SheetParts {
  headers: string[]
  rows: string[][]
  totals: string[]
}

/**
 * Totals row.
 * ⚠️ The first column gets **a label**, not a number: "Riyadh total" or "6 projects." A totals row
 * with no label reads as a data row in an Excel file, and the user adds it to the rows above.
 */
const totalsRow = <T,>(cols: Col<T>[], rows: T[], lead: string[], mark: string): string[] => [
  ...lead,
  ...cols.map((c, i) => {
    const t = aggregate(c, rows)
    if (t !== null) return String(t)
    return i === 0 ? mark : ''
  }),
]

/** Filling empty cells so every row in the file has the same column count. */
const pad = (xs: string[], n: number): string[] =>
  xs.length >= n ? xs.slice(0, n) : [...xs, ...Array<string>(n - xs.length).fill('')]

export const sheetOf = <T,>(
  rows: T[], cols: Col<T>[], bys: GroupBy<T>[], count: (n: number) => string,
): SheetParts => {
  const headers = [...bys.map((b) => b.label), ...cols.map((c) => c.label)]

  if (bys.length === 0) {
    return {
      headers,
      rows: rows.map((r) => cols.map((c) => c.text(r))),
      totals: totalsRow(cols, rows, [], count(rows.length)),
    }
  }

  const out: string[][] = []
  const walk = (nodes: GroupNode<T>[], trail: string[]) => {
    for (const n of nodes) {
      const path = [...trail, n.key]
      if (n.kids.length) walk(n.kids, path)
      else {
        for (const r of n.rows) out.push([...pad(path, bys.length), ...cols.map((c) => c.text(r))])
      }
      /* A group's totals row — after its own rows, exactly as shown on screen. */
      out.push(totalsRow(cols, n.rows, pad(path, bys.length), `إجمالي ${n.key} · ${count(n.rows.length)}`))
    }
  }
  walk(groupTree(rows, bys), [])

  return {
    headers,
    rows: out,
    totals: totalsRow(cols, rows, pad(['الإجمالي الكلي'], bys.length), count(rows.length)),
  }
}
