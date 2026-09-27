import { useLayoutEffect, type RefObject } from 'react'

/**
 * A floating panel positioned outside any clipping context.
 *
 * The calendar in the payments table used to open with `absolute`
 * positioning inside a cell clipped by `overflow: hidden` inside
 * `.tblwrap`'s horizontal scroll — so it was entirely clipped (528 of
 * 528 points below the rows). `fixed` alone isn't enough either: the
 * glass card has `backdrop-filter`, which creates a containing block for
 * any `fixed` element inside it. So the panel renders into `body` (a
 * portal), and its position is computed from the trigger button.
 *
 * Position is written as two variables (`--fx`, `--fy`) on the panel
 * itself rather than inline styles, with the rule living in
 * `.fmenu.float`. It opens below if there's room, otherwise above — and
 * to the right of the button in RTL (line start), or its left if `end`.
 */
export function useFloat(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  pop: RefObject<HTMLElement | null>,
  end = false,
) {
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchor.current; const p = pop.current
      if (!a || !p) return
      const r = a.getBoundingClientRect()
      /* The anchor's width, so a field's panel is at least as wide as the field. */
      p.style.setProperty('--fw', `${Math.round(r.width)}px`)
      const w = p.offsetWidth; const h = p.offsetHeight
      const gap = parseFloat(getComputedStyle(p).getPropertyValue('--float-gap')) || 0
      const rtl = getComputedStyle(a).direction === 'rtl'
      const startAligned = rtl ? r.right - w : r.left
      const endAligned = rtl ? r.left : r.right - w
      const x = Math.max(gap, Math.min(innerWidth - w - gap, end ? endAligned : startAligned))
      const below = r.bottom + gap
      const y = below + h <= innerHeight - gap ? below : Math.max(gap, r.top - gap - h)
      p.style.setProperty('--fx', `${Math.round(x)}px`)
      p.style.setProperty('--fy', `${Math.round(y)}px`)
    }
    place()
    addEventListener('scroll', place, true)
    addEventListener('resize', place)
    return () => {
      removeEventListener('scroll', place, true)
      removeEventListener('resize', place)
    }
  })
}
