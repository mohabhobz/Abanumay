import { useEffect, type RefObject } from 'react'

/**
 * Makes an element fill the remaining space from its position down to
 * the bottom of the screen.
 *
 * The problem this solves: a sticky card with `height: 100dvh - ...` is
 * only correct after it actually becomes sticky. Before that, it starts
 * below the header and tabs (563px on the project page), so it would
 * extend 430px below the bottom of the screen and its middle content
 * would fall outside the viewport — opening the page would show an
 * empty card with its button below the fold.
 *
 * So the height is recomputed from its actual position at every moment:
 * screen height minus its offset from the top minus the space reserved
 * below (the decision bar). Before it's sticky it stays short with its
 * content visible, and it grows as you scroll down until it becomes
 * sticky and fills the screen — exactly "max-height = sticky-top minus
 * remaining space below."
 *
 * A second cap: the neighboring column. The formula above measures
 * against the screen only, which is correct when the content is taller
 * than the screen (project and entity pages). But on the reports
 * dashboard the cards are shorter than the screen, so the sticky card
 * would extend below the last card and leave an empty trailing gap.
 * `capSelector` measures the bottom of that content and stops the
 * column from passing it — "max-height aligned with the end of the last card."
 */
export function useFillHeight(
  ref: RefObject<HTMLElement | null>,
  {
    /** The variable the height gets written to. */
    varName = '--fill-h',
    /** Element reserved below (the decision bar) — measured if present. */
    reserveSelector,
    /** Content whose bottom the column shouldn't go past — if present. */
    capSelector,
    /** Minimum height so the card doesn't get squeezed on a short screen. */
    min = 320,
    /** Gap between the card and whatever's below it. */
    gap = 12,
  }: {
    varName?: string
    reserveSelector?: string
    capSelector?: string
    min?: number
    gap?: number
  } = {},
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    const measure = () => {
      raf = 0
      /* Stickiness has a cap: a sticky element releases its position once its
         container runs out (end of the page), so `top` goes negative and the
         formula would produce a height taller than the screen — the card
         would stretch and its middle content would rise above the viewport,
         leaving an empty gap. The floor here is the sticky offset itself, so
         the height never exceeds the screen's own dimension. */
      const stick = parseFloat(getComputedStyle(el).top) || 0
      const top = Math.max(el.getBoundingClientRect().top, stick)
      const dock = reserveSelector
        ? document.querySelector<HTMLElement>(reserveSelector)
        : null
      /* Reserved space below = the bar's height + the gap beneath it to the screen edge. */
      const reserve = dock
        ? window.innerHeight - dock.getBoundingClientRect().top + gap
        : gap

      let h = window.innerHeight - top - reserve

      /* Content cap: the neighboring column's bottom minus our position = the
         tallest height that lets both columns end together. Computed from the
         bounding rect so it stays correct through stickiness and scrolling. */
      if (capSelector) {
        const cap = document.querySelector<HTMLElement>(capSelector)
        if (cap) h = Math.min(h, cap.getBoundingClientRect().bottom - top)
      }

      el.style.setProperty(varName, `${Math.max(min, Math.round(h))}px`)
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    measure()
    /* Scrolling happens inside `.screen`, not on the window, so both are listened to. */
    const scroller = el.closest('.screen') ?? window
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    /* The cards can grow taller without the page body growing (the screen
       is taller than they are), so the content itself is also observed. */
    if (capSelector) {
      const cap = document.querySelector<HTMLElement>(capSelector)
      if (cap) ro.observe(cap)
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      el.style.removeProperty(varName)
    }
  }, [ref, varName, reserveSelector, capSelector, min, gap])
}
