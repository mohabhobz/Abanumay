import { forwardRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { icons } from './icons'
import { GrowthSpot, Trail } from '@/components/soul/motifs'
import { nf, readDate } from '@/lib/format'
import type { Tone } from '@/types/domain'

/* Surfaces */

export type GlassProps = HTMLAttributes<HTMLDivElement>

/** The base surface: glass with a hairline border, no drawn borders */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { children, className = '', ...rest },
  ref,
) {
  return (
    <div className={`glass ${className}`} ref={ref} {...rest}>
      {children}
    </div>
  )
})

export function Head({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <div className="hd">
      <h3>{title}</h3>
      {meta && <span className="meta">{meta}</span>}
    </div>
  )
}

/* Text and numbers */

export function Tag({ tone = '', children }: { tone?: Tone | ''; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function Num({ children }: { children: number | string }) {
  return <span className="num">{typeof children === 'number' ? nf.format(children) : children}</span>
}

/** Saudi riyal symbol U+20C1, from the bundled official font */
export function Riyal({ style }: { style?: CSSProperties }) {
  return (
    <span className="rs" style={style} role="img" aria-label="ريال سعودي">
      {'\u20C1'}
    </span>
  )
}

/**
 * Amount in riyal · **the only shape for any amount in the system**.
 *
 * In Arabic the symbol comes **to the left of the number**, and this used to break in half the
 * places for one reason: the container was `.num`, and `.num` has `direction:ltr` so digits read
 * correctly. That put both the number and the symbol inside an English flow, and the symbol ended
 * up on the right.
 *
 * The fix is to move the isolation one level down: `.num` applies to **the digits alone**, and the
 * container stays Arabic — so the DOM order (number then symbol) renders on screen as a number on
 * the right and a symbol on the left. Without a single component, this bug comes back every time
 * someone writes a new amount.
 */
export function Money({ children, sm }: { children: number | string; sm?: boolean }) {
  const digits = typeof children === 'number' ? nf.format(children) : children
  return (
    <span className="amt">
      <span className="num">{digits}</span>
      {sm ? <small><Riyal /></small> : <Riyal />}
    </span>
  )
}

/**
 * Empty-value cell · **one single marker** for the system. It used to be "·" (a separator dot
 * leaking in as a value), "&nbsp;", or a plain space; now it's an en dash colored `--t3`, and
 * screen readers announce "no value."
 */
export function Nil() {
  return <span className="nil" aria-label="لا قيمة">–</span>
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>
}

/**
 * Reference number plus copy button.
 *
 * Warning: **the reference number is meant to be copied, not typed.** `REQ-2026-947141` is fourteen
 * characters, and the entity needs it when contacting the foundation — without a copy button next
 * to it, it gets copied by eye, and mistakes come with that.
 *
 * Warning: **and the button confirms it actually copied** — the mark switches to a checkmark for
 * two seconds; without it the user clicks again not knowing whether it worked.
 */
export function CopyId({ children }: { children: string }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(children).then(() => {
      setDone(true)
      window.setTimeout(() => setDone(false), 2000)
    }).catch(() => {})
  }
  return (
    <span className="cpid">
      <span className="mono">{children}</span>
      <button
        type="button"
        className="iact iact-sm"
        onClick={copy}
        title={done ? 'نُسخ الرقم المرجعي' : 'انسخ الرقم المرجعي'}
        aria-label={done ? 'نُسخ الرقم المرجعي' : 'انسخ الرقم المرجعي'}
      >
        <Icon name={done ? icons.check : icons.copy} size="sm" />
      </button>
    </span>
  )
}

/**
 * Readable date · **the only entry point for dates in the UI**.
 *
 * === Two mistakes that kept recurring together ===
 *
 * 1 · **The raw date.** `2026-04-12` is a storage format, not a display one — the user reads "12
 * April 2026." The `readDate` function has existed for a while, and **13 places** were still
 * rendering the raw value next to it.
 *
 * 2 · **And `.mono` used to flip it.** That class carries `direction:ltr` (correct for code like
 * `prj-2026-00013`), so an Arabic date inside it visually flips. Meaning both of the "correct"
 * places had a second bug in them.
 *
 * The component fixes both: it formats with `readDate` and isolates the date with `.date`
 * (isolation with no `direction`). Warning: it used to wear `.num`, and `.num` later became `ltr`,
 * so the date flipped back to "July 2026 17" across 10 screens.
 */
export function DateText({ children }: { children: string | undefined | null }) {
  if (!children) return null
  return <span className="date">{readDate(children)}</span>
}

/* Field widths */

export interface KVRow {
  k: ReactNode
  v: ReactNode
}

export function KV({ rows }: { rows: KVRow[] }) {
  return (
    <dl className="kv">
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* In-page navigation */

export interface TabItem {
  slug: string
  label: string
  /** Counter next to the name · shows only if passed */
  count?: number
}

/**
 * Tab · **the only shape for choosing one of several in the system**.
 *
 * There used to be two implementations: `Tabs` (project, entity, and reports tabs) and `Segments`
 * (status chips with a counter in lists). Both do the same thing — choosing one of several and
 * swapping what's below it — and both declared `role="tablist"`, but with two different classes
 * (`.tab` and `.fseg`), so they ended up with two different corner styles on the same screen.
 *
 * `Segments` now renders the same classes, and the only difference is that it passes a `count`. One
 * shape, because it's one action.
 */
export function Tabs({
  items,
  active,
  onChange,
}: {
  items: readonly TabItem[]
  active: string
  onChange: (slug: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.slug}
          role="tab"
          aria-selected={t.slug === active}
          className={`tab ${t.slug === active ? 'on' : ''}`}
          onClick={() => onChange(t.slug)}
        >
          <span>{t.label}</span>
          {t.count !== undefined && <b className="num">{t.count}</b>}
        </button>
      ))}
    </div>
  )
}

/* Timeline */

const DOT: Record<string, string> = {
  teal: 'var(--teal)',
  lime: 'var(--lime)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  ret: 'var(--ret)',
  no: 'var(--no)',
  mute: 'rgba(var(--edgeC),.4)',
}

export interface TimelineEvent {
  title: ReactNode
  by?: ReactNode
  foot?: ReactNode
  tone?: Tone
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="tl">
      {events.map((e, i) => (
        <div className="ev" key={i}>
          <span className="dt" style={{ background: DOT[e.tone ?? 'mute'] ?? DOT.mute }} />
          <div>
            <div className="tx">{e.title}</div>
            {e.by && <div className="by">{e.by}</div>}
            {e.foot && (
              <div className="sub mt-1">
                {e.foot}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* Back navigation */

/**
 * Back button · **replaces the breadcrumb**.
 *
 * There used to be a `.crumb` above every screen: "Projects -> 2026 cycle -> project
 * prj-2026-20852." That gives three pieces of information the user already knows (they clicked to
 * get there), takes up a line above every page, and repeats the page title right below it exactly.
 *
 * What the user actually needs from that line is one thing: **go back**. So it's now a single
 * button carrying the name of the place it returns to.
 *
 * It shows only on **sub-pages**. The top-level pages (projects, entities, budget, reports, today)
 * have no "above" to return to — the timeline is the navigation between them.
 */
export function BackTo({ to, label, onClick }: {
  /** Parent path */
  to?: string
  /** Name of the place it returns to */
  label: string
  onClick?: () => void
}) {
  const body = (
    <>
      {/* In RTL "forward" is left, so back points right */}
      <Icon name={icons.chevronBack} size="sm" />
      {label}
    </>
  )
  /* Layer B (the spirit · motion 2): an m6 line under the back arrow with two leaves at its end ·
     the wrapper takes only 4px, and the shape is static */
  return (
    <div className="waypoint">
      {onClick
        ? <button type="button" className="backto" onClick={onClick}>{body}</button>
        : <Link className="backto" to={to ?? '..'}>{body}</Link>}
      <Trail />
    </div>
  )
}

/**
 * "Previous · Next" · **the arrow follows direction, not the screen**.
 *
 * Warning: in RTL "forward" is left: next points left and sits at the end of the button (left
 * side), and previous points right and sits at its start (right side). The action indicators page
 * used to draw both by hand: previous with `chevron` (left) and next with `chevron` rotated 180
 * degrees (right), so both arrows pointed opposite to their direction. This component is now the
 * only entry point for any next/previous button between sequential items.
 */
export function StepLink({ to, dir, children, className = 'btn btn-2' }: {
  to: string
  dir: 'prev' | 'next'
  children: ReactNode
  className?: string
}) {
  const icon = <Icon name={dir === 'prev' ? icons.chevronBack : icons.chevron} size="sm" />
  return (
    <Link to={to} className={className} rel={dir}>
      {dir === 'prev' && icon}
      {children}
      {dir === 'next' && icon}
    </Link>
  )
}

/* Empty states and stats */

/**
 * Empty state · **one component, two sizes**.
 *
 * Warning: this used to be two shapes for the same role: two lines in a well (`.well.empty`) and an
 * empty-channel poster (badge + bold title + paragraph) hardcoded inside `Thread` alone at a fixed
 * 230px height, which left the entity portal with a ~100px gap before the input box. Now `icon` is
 * what switches it to the poster, and the height comes from its content.
 */
export function Empty({
  title,
  note,
  actions,
  icon,
  art,
}: {
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
  /**
   * Growth-stage illustration (the spirit · motion 3) · **for the first-time empty state only**
   * ("this stage hasn't been reached yet"): the number of completed blades. Not shown for
   * empty-after-filter, loading, or "blocked by a rule" — and the positions are limited (<=13).
   */
  art?: { done: number; total?: number }
  /** The poster · for places where the empty state is the main view (a channel with no messages) */
  icon?: (typeof icons)[keyof typeof icons]
}) {
  if (icon) {
    return (
      <div className="empty-b">
        <div className="aishut-c">
          <span className="badge badge-44"><Icon name={icon} size="md" /></span>
          <h2 className="aishut-t">{title}</h2>
          {note && <p className="aishut-p">{note}</p>}
          {actions && <div className="emptyact">{actions}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className={`well empty${art ? ' has-art' : ''}`}>
      {art && <div className="empty-art"><GrowthSpot done={art.done} total={art.total} /></div>}
      <div className="t">{title}</div>
      {note && <div className="sub mt-1">{note}</div>}
      {actions && <div className="emptyact">{actions}</div>}
    </div>
  )
}

export interface StatBar {
  w: string
  c: string
}

export function Stat({
  label,
  value,
  unit,
  note,
  bar,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  note?: ReactNode
  bar?: StatBar
}) {
  return (
    <div className="glass stat">
      <div className="lb">{label}</div>
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {/* The bar **takes up its space whether it's shown or not**. The four stats in one row are
          equal height (a grid), so the one without a bar was left with all its empty space at the
          bottom: 16.8 on top and 29.2 below in the same row. The reserved slot gives all four the
          same layout, so the spacing above and below matches without the rows shifting against each
          other. */}
      <div className="bar" aria-hidden={!bar} data-empty={bar ? undefined : ''}>
        {bar && <i style={{ width: bar.w, background: bar.c }} />}
      </div>
      {note && (
        <div
          className="mut trim1 mt-2"
          title={typeof note === 'string' ? note : undefined}
        >
          {note}
        </div>
      )}
    </div>
  )
}
