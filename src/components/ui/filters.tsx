import type { IconGlyph } from '@/components/ui/icons'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { MenuOpt, MenuPanel, useMenuSearch } from './menu'
import { Tabs } from './primitives'
import { Face } from './Person'
import { Icon } from './Icon'
import { icons } from './icons'

/* List controls · search, filters, chips, and pagination.

   The rule we follow: the system's fourteen filters don't all show up in the user's face at once.
   The ones actually used to filter every day (status, owner, delay) become chips up top, and the
   rest fold behind "advanced filters" with a counter showing how many are active. */

export function SearchBox({
  value,
  onChange,
  placeholder = 'ابحث…',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="srch">
      <Icon name={icons.search} size="md" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button className="srch-x" onClick={() => onChange('')} aria-label="مسح البحث">
          <Icon name={icons.close} size="sm" />
        </button>
      )}
    </label>
  )
}

/* Dropdown · **one behavior, written once**.

   There used to be two patterns in the system: `Select` using a native `<select>`, and
   `MultiSelect` using a drawn panel. So in the **same toolbar**, the user clicks two fields that
   look identical and gets two different things: one is the OS's own list (its font, color, and
   behavior — a different look again on Windows), and the other is a glass panel with a hairline
   border.

   This hook is the shared behavior: closes on outside click or Esc. Both now render the same
   `.fsel-b` and `.fmenu`. */

/** List option · plain text, or a value and a title when the title carries a counter */
export type SelectOption = string | { value: string; label: string }

export const optValue = (o: SelectOption): string => (typeof o === 'string' ? o : o.value)
export const optLabel = (o: SelectOption): string => (typeof o === 'string' ? o : o.label)

export interface SelectProps {
  label?: string
  value?: string
  options: readonly SelectOption[]
  onChange: (v: string | undefined) => void
  /** Text shown when nothing is selected */
  all?: string
  disabled?: boolean
  /** Makes the field take the full row width in the grid */
  wide?: boolean
  /** Icon inside the field · stands in for a title above it in the toolbar */
  icon?: IconGlyph
  /** The filter needs an "all" option; a required toggle does not */
  allowEmpty?: boolean
  /** Above this count, a search box appears inside the panel */
  searchAt?: number
  /**
   * These filter options are **people** — each option gets its own face.
   *
   * Warning: **a prop, not an inference.** The temptation is for the component to detect that an
   * option is a person's name and add a face on its own — the flaw being that "Riyadh" and "Ahmed"
   * are just two strings with no difference outside context, and the guess fails both ways: a city
   * gets an avatar, and a new person with no record doesn't. It's the screen that knows this column
   * is an owner that decides.
   */
  people?: boolean
}

/**
 * Single-select list.
 *
 * It used to be a native `<select>`. The problem wasn't only its look: its list is rendered by the
 * **operating system** — font, background, and how it opens all sit outside the system, and in dark
 * theme it opens a gray box in Latin script inside an Arabic glass UI. It also behaves differently
 * on every OS.
 *
 * It's now `MultiSelect` with one constraint: a single choice, and picking one closes the panel. So
 * both fields in the toolbar open the **same panel**.
 *
 * `all` still exists because the filter needs an "all" option; if `allowEmpty` is off, the empty
 * option doesn't show — that's the case for the budget cycle switch: the cycle is **always**
 * selected.
 */
export function Select({
  label, value, options, onChange, all = 'الكل', disabled, wide, icon,
  allowEmpty = true, searchAt = 9, people,
}: SelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

  const current = options.find((o) => optValue(o) === value)
  const summary = current ? optLabel(current) : all
  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  const pick = (v: string | undefined) => { onChange(v); setOpen(false) }

  return (
    /* Warning: **the active state means the user chose something, not that the field has a value.**
       It used to be `value ? 'on' : ''`, and sort is always passed a default (`v.sort ??
       'waiting'`) — so the field was **always active** and took the green `--edge-i` border, while
       "all statuses" next to it kept the neutral `--fld-line` border. Two different borders in one
       row for the same component, one of which falsely claims a filter is active.

       `current` is the right check: the default value isn't drawn from `options` (it's the string
       `all`), so `current` ends up `undefined` and the field stays neutral — exactly like
       `MultiSelect` checking `values.length > 0`.

       Warning: **and `allowEmpty` is a separate condition — that's what was missing.** A field with
       `allowEmpty={false}` (budget cycle · report period) is **never empty** — so `current` is
       always defined and it learned to always read as active. "Active" is supposed to mean "the
       user narrowed the results," and it's false for a field that never has an empty state to begin
       with. */
    <div className={`fsel${current && allowEmpty ? ' on' : ''}${disabled ? ' off' : ''}${wide ? ' wide' : ''}`} ref={box}>
      {label && <span className="fsel-l" id={`${id}-l`}>{label}</span>}

      <button
        type="button"
        className="fsel-b"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-b` : undefined}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {/* Warning: **the face replaces the icon, it doesn't add to it.** A "people" icon says
            "this filter is about people," and the face says **who** — showing both together repeats
            half the same information. The box has a fixed width so picking a person doesn't shift
            the whole toolbar. */}
        {people
          ? <span className="fsel-face">{current ? <Face name={optValue(current)} /> : icon && <Icon name={icon} size="sm" />}</span>
          : icon && <Icon name={icon} size="sm" />}
        {/* The ghosts reserve the widest option's width, so picking
            a value never resizes the control (see `.fsel-sz`). */}
        <span className="fmulti-s fsel-sz">
          <span>{summary}</span>
          {allowEmpty && <span aria-hidden="true">{all}</span>}
          {options.map((o) => (
            <span key={`sz-${optValue(o)}`} aria-hidden="true">{optLabel(o)}</span>
          ))}
        </span>
        <Icon name={icons.chevronDown} size="sm" />
      </button>

      {open && (
        <MenuPanel
          one
          search={search}
          needle={needle}
          onNeedle={setNeedle}
          empty={shown.length === 0}
        >
          <>
            {allowEmpty && !needle && (
              <MenuOpt
                on={!value}
                onPick={() => pick(undefined)}
                /* Warning: "all" isn't a person, so it has no face — **but it still gets the same
                   slot**. Without that space, its label would start 28px to the right of the other
                   names, and the list would read misaligned. */
                lead={people ? <span className="prs-gap" aria-hidden="true" /> : undefined}
              >
                {all}
              </MenuOpt>
            )}
            {shown.map((o) => {
              const val = optValue(o)
              return (
                <MenuOpt
                  key={val}
                  on={val === value}
                  onPick={() => pick(val)}
                  lead={people ? <Face name={val} /> : undefined}
                >
                  {optLabel(o)}
                </MenuOpt>
              )
            })}
          </>
        </MenuPanel>
      )}
    </div>
  )
}

/* Multi-select list.

   The native `<select multiple>` is rejected here: it takes up the full height of its rows in the
   grid and requires Ctrl+click to pick more than one — a behavior half of users don't know. The
   alternative is a button that opens a panel with a checkbox per option: pick with one click, and
   the selection stays visible in the button's label.

   The panel closes on outside click or Esc, not a "done" button — the filter applies the moment you
   click, so there's nothing to confirm. */

export interface MultiSelectProps {
  label?: string
  values: string[]
  options: readonly SelectOption[]
  onChange: (v: string[]) => void
  /** Text shown when nothing is selected */
  all?: string
  disabled?: boolean
  wide?: boolean
  icon?: IconGlyph
  /** Above this count, a search box appears inside the panel */
  searchAt?: number
  /**
   * These filter options are **people** — each option gets its own face.
   *
   * Warning: **a prop, not an inference.** The temptation is for the component to detect that an
   * option is a person's name and add a face on its own — the flaw being that "Riyadh" and "Ahmed"
   * are just two strings with no difference outside context, and the guess fails both ways: a city
   * gets an avatar, and a new person with no record doesn't. It's the screen that knows this column
   * is an owner that decides.
   */
  people?: boolean
}

export function MultiSelect({
  label, values, options, onChange, all = 'الكل', disabled, wide, icon, searchAt = 9, people,
}: MultiSelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

  const on = values.length > 0
  const labelOf = (val: string) =>
    optLabel(options.find((o) => optValue(o) === val) ?? val)

  /* Button label: the name if there's one, or the name plus "+2" for more. Showing every name would
     stretch the button until the row wraps, and a count badge next to it would repeat the same
     information twice. */
  const summary = !on
    ? all
    : values.length === 1
      ? labelOf(values[0])
      : `${labelOf(values[0])} +${values.length - 1}`

  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((x) => x !== val) : [...values, val])

  return (
    <div className={`fsel fmulti${on ? ' on' : ''}${disabled ? ' off' : ''}${wide ? ' wide' : ''}`} ref={box}>
      {label && <span className="fsel-l" id={`${id}-l`}>{label}</span>}

      <button
        type="button"
        className="fsel-b"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-b` : undefined}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {/* Warning: **the face follows the displayed name, not the number of selections.** Its
            condition used to be `values.length === 1`, so picking two shows a label like "Omar
            Qasem +1" while the slot next to it **stays empty** — a 28px gap in the user's face for
            no reason. The label shows the first name in both cases, so the face shows its face in
            both cases. */}
        {people
          ? <span className="fsel-face">{values.length ? <Face name={values[0]} /> : icon && <Icon name={icon} size="sm" />}</span>
          : icon && <Icon name={icon} size="sm" />}
        {/* Same ghosts as `Select`: the widest label the button can
            ever show, so toggling a value never resizes the row.
            `+N` is measured on the widest label, since that is the
            longest form the summary takes. */}
        <span className="fmulti-s fsel-sz">
          <span>{summary}</span>
          <span aria-hidden="true">{all}</span>
          {options.map((o) => (
            <span key={`sz-${optValue(o)}`} aria-hidden="true">
              {optLabel(o)}{options.length > 1 ? ` +${options.length - 1}` : ''}
            </span>
          ))}
        </span>
        <Icon name={icons.chevronDown} size="sm" />
      </button>

      {open && (
        <MenuPanel
          search={search}
          needle={needle}
          onNeedle={setNeedle}
          empty={shown.length === 0}
          foot={on ? (
            <button type="button" className="fclear" onClick={() => onChange([])}>
              مسح الاختيار
            </button>
          ) : undefined}
        >
          {shown.map((o) => {
            const val = optValue(o)
            return (
              <MenuOpt
                key={val}
                on={values.includes(val)}
                onPick={() => toggle(val)}
                lead={people ? <Face name={val} /> : undefined}
              >
                {optLabel(o)}
              </MenuOpt>
            )
          })}
        </MenuPanel>
      )}
    </div>
  )
}

/** Toggle chip · one boolean filter, one click */
export function Toggle({
  label,
  on,
  onChange,
  count,
}: {
  label: ReactNode
  on: boolean
  onChange: (v: boolean) => void
  count?: number
}) {
  return (
    <button className={`fchip${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
      {label}
      {count !== undefined && <b className="num">{count}</b>}
    </button>
  )
}

export interface SegItem {
  key: string
  label: string
  count?: number
}

/**
 * Status chips · **these are `Tabs` with a counter, not a different type**.
 *
 * They used to declare `role="tablist"` exactly like tabs, while rendering `.fseg` instead of
 * `.tab` — so the same action showed up in two shapes on the same screen. The only real difference
 * is that its key can be empty ("all"), which is a data difference, not a visual one.
 */
export function Segments({
  items,
  active,
  onChange,
}: {
  items: SegItem[]
  active?: string
  onChange: (key: string | undefined) => void
}) {
  return (
    <Tabs
      items={items.map((it) => ({ slug: it.key, label: it.label, count: it.count }))}
      active={active ?? ''}
      onChange={(slug) => onChange(slug || undefined)}
    />
  )
}

/* Rows per page.

   A preset list **plus free typing**: a user reviewing a specific disbursement knows it has 63 rows
   and wants it on one page, and a closed list would make them flip through two pages for no reason.
   The number is capped so typing 99999 doesn't freeze the screen. */

export const PAGE_SIZES = [25, 50, 75, 100] as const
const SIZE_MAX = 500

export function PageSize({
  value,
  onChange,
  options = PAGE_SIZES,
}: {
  value: number
  onChange: (n: number) => void
  options?: readonly number[]
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  /* Commits on Enter or on leaving the field, not on every keystroke: typing "100" passes through
     "1" and "10" along the way, and re-querying on each of those would flicker the screen twice for
     nothing. */
  const commit = () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || n < 1) return setDraft(String(value))
    const next = Math.min(SIZE_MAX, n)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <div className="psize" ref={box}>
      <span className="sub">عرض</span>
      <div className="psize-b">
        <input
          value={draft}
          inputMode="numeric"
          className="num"
          aria-label="عدد الصفوف في الصفحة"
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') setDraft(String(value))
          }}
        />
        <button
          type="button"
          className="psize-x"
          aria-label="اختر من القائمة"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={icons.chevronDown} size="sm" />
        </button>

        {/* Same option row as any other list: a marker for the selected one, and reserved space for
            the rest. The numbers used to be centered with no marker — a fourth shape for the same
            row. */}
        {open && (
          <MenuPanel one up extra="psize-m">
            {options.map((n) => (
              <MenuOpt
                key={n}
                on={n === value}
                onPick={() => { setOpen(false); if (n !== value) onChange(n) }}
                textClass="num"
              >
                {n}
              </MenuOpt>
            ))}
          </MenuPanel>
        )}
      </div>
      <span className="sub">صفًّا</span>
    </div>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  /** When sent, the page size shows next to the pagination */
  onPageSize?: (n: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="pager">
      {/* The counter and the page size sit together: both talk about quantity, while the navigation
          buttons talk about position. */}
      <div className="pager-c">
        <span className="sub">
          <span className="num">{from}</span>–<span className="num">{to}</span> من{' '}
          <span className="num">{total}</span>
        </span>
        {onPageSize && <PageSize value={pageSize} onChange={onPageSize} />}
      </div>
      {/* Numbers, not a sentence, and two arrows, not two words.
          "Page 1 of 2" only tells you where you are and doesn't get you anywhere: reaching page
          three means clicking "next" twice. The numbers are the buttons themselves, so jumping is
          one click and position reads off the highlighted number — the two arrows move one step at
          a time, and their direction follows reading direction: back is to the right. */}
      <nav className="pager-b" aria-label="صفحات النتائج">
        <button
          className="pgnav"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="الصفحة السابقة"
          title="السابق"
        >
          <Icon name={icons.chevronBack} size="sm" />
        </button>

        <div className="pgnums">
          {pageWindow(page, pages).map((n, i) =>
            n === '…' ? (
              <span className="pggap" key={`gap-${i}`} aria-hidden="true">…</span>
            ) : (
              <button
                key={n}
                className={`pgn num${n === page ? ' on' : ''}`}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`صفحة ${n}`}
                onClick={() => n !== page && onPage(n)}
              >
                {n}
              </button>
            ),
          )}
        </div>

        <button
          className="pgnav"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="الصفحة التالية"
          title="التالي"
        >
          <Icon name={icons.chevron} size="sm" />
        </button>
      </nav>
    </div>
  )
}

/**
 * The numbers shown: first and last always, the current one and its neighbors, and dots for the
 * rest. Without this window, a list of 40 pages would wrap to two lines and take up more room than
 * the results themselves.
 */
function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)

  const out: (number | '…')[] = [1]
  const from = Math.max(2, Math.min(page - 1, pages - 3))
  const to = Math.min(pages - 1, Math.max(page + 1, 4))
  if (from > 2) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pages - 1) out.push('…')
  out.push(pages)
  return out
}

/** Toggle between card view and table view */
export function ViewToggle({
  view,
  onChange,
}: {
  view: 'cards' | 'table'
  onChange: (v: 'cards' | 'table') => void
}) {
  return (
    <div className="vtog" role="group" aria-label="طريقة العرض">
      <button
        className={view === 'cards' ? 'on' : ''}
        onClick={() => onChange('cards')}
        aria-pressed={view === 'cards'}
        title="بطاقات"
      >
        <Icon name={icons.grid} size="sm" />
      </button>
      <button
        className={view === 'table' ? 'on' : ''}
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        title="جدول"
      >
        <Icon name={icons.rows} size="sm" />
      </button>
    </div>
  )
}

/* Grouping picker · y-1 and y-2

   Warning: **why not `MultiSelect`?** Because `MultiSelect` answers "what's selected," and grouping
   needs "what's selected **and in what order**." The order here isn't a display preference — it's
   **the question itself**:

     region -> entity  "in Riyadh, who gets funded?"
     entity -> region   "where does the Scientific Building Society operate?"

   Same two dimensions, same rows, and two different questions — so "region +1" in a `MultiSelect`
   label would have hidden exactly what the user needs to see.

   Hence: a number replaces the checkmark in the list (1 · 2 · 3), the label shows the chain with an
   arrow, and the selection is **ordered by click order**, not by list order. */
export function GroupPicker({
  value, options, onChange, max = 3, icon,
}: {
  /** Keys separated by commas · in hierarchy order */
  value: string | undefined
  options: { value: string; label: string }[]
  onChange: (v: string | undefined) => void
  /** Maximum nesting depth */
  max?: number
  icon?: IconGlyph
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const id = useId()

  const chain = (value ?? '').split(',').filter(Boolean)
    .filter((k) => options.some((o) => o.value === k))
    .slice(0, max)

  const labelOf = (k: string) => options.find((o) => o.value === k)?.label ?? k
  const full = chain.length >= max

  const emit = (next: string[]) => onChange(next.length ? next.join(',') : undefined)

  const toggle = (k: string) => {
    if (chain.includes(k)) emit(chain.filter((x) => x !== k))
    else if (!full) emit([...chain, k])
  }

  return (
    <div className={`fsel fgrp${chain.length ? ' on' : ''}`} ref={box}>
      <button
        type="button"
        className="fsel-b"
        aria-haspopup="listbox"
        aria-expanded={open}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {icon && <Icon name={icon} size="sm" />}
        <span className="fgrp-s">
          {chain.length === 0
            ? 'بلا تجميع'
            : chain.map((k, i) => (
                <span key={k} className="fgrp-p">
                  {i > 0 && <Icon name={icons.chevron} size="sm" />}
                  {labelOf(k)}
                </span>
              ))}
        </span>
        <Icon name={icons.chevronDown} size="sm" />
      </button>

      {open && (
        <MenuPanel
          foot={
            <>
              {full && <span className="sub">الحد الأقصى <span className="num">{max}</span> مستويات، وبعدها تصبح كل مجموعة صفًّا واحدًا</span>}
              {chain.length > 0 && (
                <button type="button" className="fclear" onClick={() => onChange(undefined)}>
                  إلغاء التجميع
                </button>
              )}
            </>
          }
        >
          {options.map((o) => {
            const at = chain.indexOf(o.value)
            const sel = at >= 0
            return (
              /* Warning: **a number, not a checkmark.** A checkmark says "selected"; the user needs
                 to know **parent or child** — and that's what decides which question the table
                 answers. */
              <MenuOpt
                key={o.value}
                on={sel}
                off={!sel && full}
                onPick={() => toggle(o.value)}
                title={sel ? `المستوى ${at + 1}` : full ? `الحد الأقصى ${max} مستويات` : 'أضف مستوى'}
                mark={sel ? at + 1 : ''}
                markClass="num"
              >
                {o.label}
              </MenuOpt>
            )
          })}
        </MenuPanel>
      )}
    </div>
  )
}
