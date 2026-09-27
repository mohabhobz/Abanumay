import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFloat } from '@/hooks/useFloat'
import { Icon } from './Icon'
import { icons } from './icons'

/* Menu panel · **drawn once**.

   Warning: **this used to be written three times over, by copying** — in `Select`, in
   `MultiSelect`, and in `FieldSelect` — and all three render the same `.fmenu`, the same search
   box, the same `.fopt`, and the same "no results." The CSS really was shared, so a color change
   would reach everywhere — **but any change to structure or behavior had to be made three times**,
   and forgetting one left a list that behaved differently from its siblings. That's exactly what
   happened with the native `<select>`: a rule got fixed in one place and stayed wrong everywhere
   else because the rest were copies, not usages.

   So the panel is now a component: `MenuPanel` is the box (search + list + footer), and `MenuOpt`
   is the row (checkbox + face + name). Any change to look or behavior happens here, and only here.

   Warning: **and the checkbox is the first element in the DOM, and the last one to the eye.**
   `.fopt-x` takes an `order` in the CSS so it goes to the end of the row (checkbox on the left,
   text starting from the beginning of the row), while the order in the tree stays as-is so a screen
   reader announces the status before the name. */

export interface MenuPanelProps {
  /** `one` = single choice (a mark on the selection) · its absence = multi-select (checkboxes) */
  one?: boolean
  /** Opens upward · for menus near the bottom of the page */
  up?: boolean
  /** Anchors to the end of the field instead of the start · for the last column */
  end?: boolean
  /** Shows the search box · decided by the option count at the call site */
  search?: boolean
  needle?: string
  onNeedle?: (v: string) => void
  /** No search results · the text changes per list */
  empty?: boolean
  emptyText?: string
  /** Panel footer · "clear selection" and similar */
  foot?: ReactNode
  /** Extra class on the panel · e.g. `psize-m` */
  extra?: string
  /**
   * Renders the panel in `body`, fixed to the anchor, instead of inside it. Use it for any menu
   * that can sit inside a scrolling or clipped container (a table, a card with `overflow`), where
   * an in-place panel gets cut off. `pop` is the same ref `useMenu` returns, so clicks inside the
   * portaled panel still count as inside the menu.
   */
  float?: { anchor: RefObject<HTMLElement | null>; pop: RefObject<HTMLDivElement | null> }
  children: ReactNode
}

export function MenuPanel(props: MenuPanelProps) {
  return props.float ? <FloatPanel {...props} float={props.float} /> : <PanelBody {...props} />
}

function FloatPanel(props: MenuPanelProps & { float: NonNullable<MenuPanelProps['float']> }) {
  useFloat(true, props.float.anchor, props.float.pop, props.end)
  return createPortal(<PanelBody {...props} />, document.body)
}

function PanelBody({
  one, up, end, search, needle = '', onNeedle, empty, emptyText = 'لا نتائج', foot, extra, float, children,
}: MenuPanelProps) {
  return (
    <div
      ref={float?.pop}
      className={`fmenu${one ? ' one' : ''}${up ? ' up' : ''}${end && !float ? ' flip' : ''}${float ? ' float' : ''}${extra ? ` ${extra}` : ''}`}
    >
      {search && onNeedle && (
        <label className="fmenu-q">
          <Icon name={icons.search} size="sm" />
          <input
            autoFocus
            value={needle}
            onChange={(e) => onNeedle(e.target.value)}
            placeholder="ابحث…"
            aria-label="ابحث في الخيارات"
          />
        </label>
      )}

      <div className="fmenu-l" role="listbox" aria-multiselectable={one ? undefined : true}>
        {empty && <div className="fmenu-e sub">{emptyText}</div>}
        {children}
      </div>

      {foot && <div className="fmenu-f">{foot}</div>}
    </div>
  )
}

export interface MenuOptProps {
  on: boolean
  onPick: () => void
  /** The person's face, or any element before the name · stays at the start of the row */
  lead?: ReactNode
  /** Replaces the checkmark · e.g. the number in the grouping picker */
  mark?: ReactNode
  /** Row is shown, not clickable · "pinned" in filters */
  fix?: boolean
  off?: boolean
  title?: string
  /** Extra class on the checkbox slot · `num` for a number instead of the mark */
  markClass?: string
  /** Extra class on the name · `num` for Latin digits */
  textClass?: string
  children: ReactNode
}

export function MenuOpt({
  on, onPick, lead, mark, fix, off, title, markClass, textClass, children,
}: MenuOptProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      disabled={off}
      title={title}
      className={`fopt${on ? ' on' : ''}${fix ? ' fix' : ''}`}
      onClick={fix ? undefined : onPick}
    >
      {/* Warning: the slot is rendered even when empty · its space is reserved so names don't shift
          when the selection changes */}
      <span className={`fopt-x${markClass ? ` ${markClass}` : ''}`} aria-hidden="true">
        {mark ?? (on && <Icon name={icons.check} size="sm" />)}
      </span>
      {lead}
      <span className={`fopt-t${textClass ? ` ${textClass}` : ''}`}>{children}</span>
    </button>
  )
}

/** Panel search · same filtering and reset-on-close logic in every list */
export function useMenuSearch(open: boolean, at: number, count: number) {
  const [needle, setNeedle] = useState('')
  useEffect(() => { if (!open) setNeedle('') }, [open])
  return { needle, setNeedle, search: count > at }
}
