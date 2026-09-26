import { useEffect, useRef } from 'react'
import { useProximity } from '@/hooks/useProximity'
import { useMatchHeight } from '@/hooks/useMatchHeight'
import { AbLeaf } from '@/components/soul'

/**
 * "Ask Abanumay" — the floating button fixed across the system.
 * It used to be an item at the end of the nav bar: a fine spot for navigation, a wrong one for a
 * question. Two things got lost there: it **read as a page** next to Home, Projects, and Reports
 * when it isn't one, and it sat **far from the point of decision** — a user looks at the decision
 * bar at the bottom of the screen and asks their question right there, not by glancing back up to
 * the top corner.
 * So it floats in the same dock as the decision bar, on the side, fixed on every screen. When a
 * decision bar is present, that bar takes the full width minus the button's space — the two sit in
 * one row, neither stacked over the other.
 * It's the same button either way: opens the same panel, responds to the keyboard shortcut. The
 * shortcut **isn't printed on it** — this spot is for the decision, not for teaching a shortcut;
 * it's in the button's tooltip for anyone looking for it.
 * And it responds to the mouse exactly like the decision bar — same range, same height, same light
 * that follows the cursor — so the two move as one piece, not as a button beside a bar.
 */
export interface AskDockProps {
  open: boolean
  onToggle: () => void
  /** Shrinks the button on narrow screens and turns it into an icon-only button. */
  compact?: boolean
}

export function AskDock({ open, onToggle, compact }: AskDockProps) {
  const fab = useRef<HTMLButtonElement>(null)
  useProximity(fab)
  /* Matches the decision bar's height exactly. A fixed number worked until the bar wrapped to a
     second line at a narrower width, changing its height while the button stayed the same. */
  useMatchHeight(fab, '.decdock .chrome', '--ask-h')

  /* Width comes from the content, and the dock reads it from there. It used to be a fixed width,
     leaving empty space next to the text on screens with a narrower font. Now the button takes its
     content's width and writes it to `:root` so the decision bar reserves exactly that much space —
     the relationship runs backward (the button states it, the dock listens) because the text, not
     the layout, decides the width here. */
  useEffect(() => {
    const el = fab.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(([e]) => {
      root.style.setProperty('--ask-w', `${Math.ceil(e.target.getBoundingClientRect().width)}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--ask-w')
    }
  }, [])

  return (
    <button
      ref={fab}
      type="button"
      className={`askfab${open ? ' on' : ''}${compact ? ' mini' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label="اسأل أبانمي"
      title="اسأل أبانمي · ⌘K"
    >
      {/* The spark stands bare — it used to sit inside a badge element, and this box is already a
          container drawn with its own background, border, and radius, meaning a box inside a box;
          the button itself is the container. */}
      <AbLeaf />
      {!compact && <span className="askfab-t">اسأل أبانمي</span>}
    </button>
  )
}
