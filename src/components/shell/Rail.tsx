import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import LogoLockup from '@/assets/LogoLockup'
import { Icon, icons, type IconName } from '@/components/ui'
import { NAV, ROUTES } from '@/app/routes'
import { AccountMenu } from './AccountMenu'
import { NotificationBell } from './Notifications'
import type { CurrentUser } from '@/types/domain'

export interface RailProps {
  user: CurrentUser
  onSignOut?: () => void
  /**
   * The permission keys the user holds.
   * If none are passed, everything is shown — once the backend returns permissions, the rail
   * filters itself with no change needed here.
   */
  permissions?: string[]
  /**
   * Forced closed — the user doesn't lose their own setting.
   * The assistant takes the full screen, and the rail expanded beside it would compete for reading
   * space and stay open on content that isn't its own. So it closes itself when the assistant
   * opens, and **returns to its own width** when it closes — and that width isn't written to
   * storage while it's forced closed, so the user's own preference isn't erased.
   */
  shut?: boolean
}

/* Rail width — by drag, not a button.
   A button implies two states and hides that the width can actually vary. The edge handle tells the
   truth: grab and drag to whatever width suits you. A click with no drag toggles between the two
   states, so anyone looking for a button finds one.
   The numbers: 80 collapsed (a comfortable icon with no label), 208 expanded, and a max of 272 so
   the rail doesn't take more from the content than it earns. */
/* 60 = a 44px item plus 8px padding on each side — the geometric floor with no clutter (used to be 80). */
const SHUT = 60
const OPEN = 208
const MAX = 272
/** Minimum width where the label shows — below it the rail falls back to icons only. */
const LABEL_AT = 132
/**
 * Minimum width where the **full lockup** shows (the mark plus the name).
 * Not the same threshold as the labels. After the mark became 32px (was 44), the lockup's height
 * became 40.3 and its width roughly 75 (was 103 at 55), so the geometric floor dropped to `75 +
 * rail padding (16) + two margins (2x16)`.
 * **But the geometric floor isn't the number used.** There's a second condition: the name shouldn't
 * appear **before** the nav labels do, otherwise the rail would show a full identity mark with
 * icons that have no names — a reversed order. So the number must stay above the label threshold,
 * with margin to spare.
 */
const LOCK_AT = 148

const RAIL_KEY = 'ab-rail-w'

const clamp = (n: number) => Math.min(MAX, Math.max(SHUT, Math.round(n)))

const readWidth = (): number => {
  try {
    const v = Number(localStorage.getItem(RAIL_KEY))
    return Number.isFinite(v) && v > 0 ? clamp(v) : SHUT
  } catch {
    return SHUT
  }
}

export function Rail({ user, onSignOut, permissions, shut }: RailProps) {
  const allowed = NAV.filter((n) => !n.perm || !permissions || permissions.includes(n.perm))

  const [w, setW] = useState(readWidth)
  /* The width saved before a forced collapse — `null` means it isn't forced closed. */
  const held = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  /* A ref for the state at drag start — the state inside the listener would go stale. */
  const drag = useRef<{ x: number; w: number; moved: boolean } | null>(null)
  const open = w >= LABEL_AT
  /** The full lockup has its own threshold: the name needs more width than a label does. */
  const wide = w >= LOCK_AT

  useEffect(() => {
    setW((cur) => {
      if (shut) {
        if (held.current === null) held.current = cur
        return SHUT
      }
      if (held.current === null) return cur
      const back = held.current
      held.current = null
      return back
    })
  }, [shut])

  useEffect(() => {
    /* While forced closed, this value isn't the user's choice — it isn't saved. */
    if (held.current !== null) return
    try {
      localStorage.setItem(RAIL_KEY, String(w))
    } catch {
      /* Storage may be blocked — the width then only lasts for this session. */
    }
  }, [w])

  /* RTL: the rail sits on the right, so dragging left widens it. */
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = d.x - e.clientX
    if (Math.abs(dx) > 3) d.moved = true
    setW(clamp(d.w + dx))
  }, [])

  const onUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    window.removeEventListener('pointermove', onMove)
    /* A click with no drag toggles the state — anyone looking for a button finds one. */
    if (d && !d.moved) setW((v) => (v >= LABEL_AT ? SHUT : OPEN))
  }, [onMove])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onMove, onUp])

  /* Item tooltip — a "skip delay" pattern. The first tooltip waits before showing, so passing quickly
   across the rail doesn't open a chain of tooltips. Once one appears, the rail enters a "warm"
   state so the next one shows immediately, and for a short window after the mouse leaves — the same
   behavior common tooltip libraries use. */
  const warmT = useRef<number | undefined>(undefined)
  const coolT = useRef<number | undefined>(undefined)
  const [warm, setWarm] = useState(false)
  const tipOver = (e: RPointerEvent<HTMLElement>) => {
    if (!(e.target as Element).closest('.railitem')) return
    window.clearTimeout(coolT.current)
    if (warm) return
    window.clearTimeout(warmT.current)
    warmT.current = window.setTimeout(() => setWarm(true), 500)
  }
  const tipLeave = () => {
    window.clearTimeout(warmT.current)
    coolT.current = window.setTimeout(() => setWarm(false), 300)
  }
  useEffect(() => () => {
    window.clearTimeout(warmT.current)
    window.clearTimeout(coolT.current)
  }, [])

  const grab = (e: RPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w, moved: false }
    setDragging(true)
  }

  return (
    <nav
      className={`rail chrome${open ? ' open' : ''}${wide ? ' lockwide' : ''}${dragging ? ' dragging' : ''}`}
      style={{ '--rail-w': `${w}px` } as React.CSSProperties}
      aria-label="التنقّل الرئيسي"
      data-tipwarm={warm || undefined}
      onPointerOver={tipOver}
      onPointerLeave={tipLeave}
    >
      {/* **Two drawings, not one drawing with something removed**: the mark alone, and the full lockup
   (mark plus wordmark and Latin line) — both kept exactly as supplied.

         They're layered on top of each other in the same box: the lockup's width collapses to zero
         and `overflow:hidden` clips it from the name's side, while the mark shows in its place — so
         the eye reads it as **the name folding into the mark**, not one image swapping for another.
         The icon tree is the exact same size in both drawings, so it never shifts.

         And the lockup only appears once the rail widens enough for it (`LOCK_AT`) — below that the
         name would get clipped or become unreadable, and the mark alone is truer. */}
      <div className="raillock">
        {/* ⚠️ **The mark leads to "Ask Abanumay."** This is the web convention: a logo goes back to the
   start — and the start of this system is the assistant, not "Today". So clicking it opens the
   general assistant from any screen, the same as after login. */}
        <NavLink
          to={ROUTES.assistant}
          className="raillock-b"
          aria-label="اسأل أبانمي · مؤسسة سليمان أبانمي الأهلية"
          title="اسأل أبانمي"
        >
          <LogoLockup className="lock-full" aria-hidden={!wide} />
          <span className="lock-mark" aria-hidden={wide}><Logo /></span>
        </NavLink>

        {/* Collapse button — shows only while the rail is expanded.
           The edge handle still works and is what expands it by dragging, but the handle itself is
           only visible on hover — so anyone who opened the rail by clicking finds no clear way to
           close it. The button sits here, in the row facing the identity mark, which is where it's
           expected. */}
        <button
          type="button"
          className="railshut"
          onClick={() => setW(SHUT)}
          aria-label="طيّ القائمة"
          title="طيّ القائمة"
        >
          <Icon name={icons.panel} size="md" />
        </button>
      </div>

      {allowed.map((item) => {
        return (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/'}
            /* Grouping used to be marked with a margin on each group's first item. That's two competing rhythms
   in a list of a few items, and a gap before just one item at the end reads as "this is separate"
   rather than "here's a group." Removed — the spacing is now uniform. */
            className={({ isActive }) =>
              `railitem${isActive ? ' on' : ''}${item.mob ? '' : ' nomob'}`
            }
          >
            {({ isActive }) => (
              <>
                {/* The active item has a filled icon — outline is the default state, fill marks "here." */}
                <Icon name={icons[item.icon as IconName]} active={isActive} />
                <span className="rail-l">{item.label}</span>
                {/* The tooltip is its own element, not the native `title` attribute: the browser's own tooltip
   delays a full second, and the collapsed rail needs the name immediately. */}
                <span className="rail-tip">{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}

      {/* "Ask Abanumay" moved to the decision dock at the bottom of the screen — it's not a nav item, and
   being close to the point of decision is what gets it used. */}
      <div className="railfoot">
        {/* The bell sits above the account — on every page, and on mobile it's its own slot in the bottom bar. */}
        <NotificationBell user={user} />
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>

      {/* Width handle — a line on the edge that appears on hover. */}
      <div
        className="railgrip"
        onPointerDown={grab}
        role="separator"
        aria-orientation="vertical"
        aria-label="عرض القائمة"
        aria-valuenow={w}
        aria-valuemin={SHUT}
        aria-valuemax={MAX}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setW((v) => clamp(v + 16)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); setW((v) => clamp(v - 16)) }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setW((v) => (v >= LABEL_AT ? SHUT : OPEN))
          }
        }}
      >
        <span className="railgrip-l" />
        <span className="railgrip-b" aria-hidden="true">
          <Icon name={icons.panel} size="sm" />
        </span>
      </div>
    </nav>
  )
}
