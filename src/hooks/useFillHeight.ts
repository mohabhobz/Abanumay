import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/**
 * The assistant's column on a record page · client 25 Nov · the final rule.
 *
 * Measures three numbers from the live screen and writes them; the CSS block «the record page's two
 * columns» (index.css) does the rest. Nothing else in the code sizes this column.
 *
 *   line         · the top of whatever floats at the screen's foot (the decision bar, «اسأل أبانمي»,
 *                  the chat button) minus one gap · nothing ends below it
 *   --ai-reserve · on the screen · its foot up to that line · the screen keeps it as bottom padding,
 *                  so the last thing on any tab scrolls up clear of the bar
 *   --ai-room    · on the screen · from where the column sticks (under the pinned tabs) to that line ·
 *                  the main column's floor, so both columns end on the line and the tabs never move
 *   --ai-h       · on the column · from where it sits right now to that line · it grows as the page
 *                  scrolls until it sticks, and is never taller than the room (its content scrolls)
 *   --ai-now     · the same number on the screen · the main column's floor, so its last card (an
 *                  empty one above all) grows and shrinks with the assistant beside it
 *
 * `capSelector` (the reports board) also stops the column at the bottom of that content.
 */
export function useFillHeight(
  ref: RefObject<HTMLElement | null>,
  {
    /** Content whose bottom the column doesn't pass (the reports board) */
    capSelector,
    /** The smallest the column gets · 0 by default: never under the bar, even on a short screen */
    min = 0,
  }: {
    capSelector?: string
    min?: number
  } = {},
): void {
  /* the column can leave and come back (a tab without it, the plan's activities) · the measuring
     follows the element itself, so a column that returns is measured again, not left stale */
  const [el, setEl] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => { if (ref.current !== el) setEl(ref.current) })
  useEffect(() => {
    if (!el) return
    const screen = el.closest<HTMLElement>('.screen')
    /* what floats at the screen's foot · the bar itself, not the dock's tall box around it */
    const floats = '.decdock .decbar, .askfab, .chatfab'

    let raf = 0
    const measure = () => {
      raf = 0
      const vh = window.innerHeight
      const sr = screen?.getBoundingClientRect() ?? { top: 0, bottom: vh }
      const gap = parseFloat(getComputedStyle(el.parentElement ?? el).rowGap) || 16
      /* the line · the highest top among what floats in the screen's lower half */
      const tops = [...document.querySelectorAll<HTMLElement>(floats)]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.width > 0 && r.top > vh / 2)
        .map((r) => r.top)
      const line = Math.min(sr.bottom, ...tops) - gap
      /* where the column sits once stuck · sticky counts from the screen's content box */
      const pt = screen ? parseFloat(getComputedStyle(screen).paddingTop) || 0 : 0
      const stuck = sr.top + pt + (parseFloat(getComputedStyle(el).top) || 0)
      const top = Math.max(el.getBoundingClientRect().top, stuck)

      const room = Math.max(min, Math.round(line - stuck))
      let h = Math.max(min, Math.round(line - top))
      if (capSelector) {
        const cap = document.querySelector<HTMLElement>(capSelector)
        if (cap) {
          /* the content's end, or the main column's when it holds more than the content */
          const main = el.previousElementSibling as HTMLElement | null
          const end = Math.max(cap.getBoundingClientRect().bottom, main?.getBoundingClientRect().bottom ?? 0)
          h = Math.max(min, Math.min(h, Math.round(end - top)))
        }
      }
      if (screen) {
        screen.style.setProperty('--ai-room', `${room}px`)
        screen.style.setProperty('--ai-reserve', `${Math.max(0, Math.round(sr.bottom - line))}px`)
      }
      el.style.setProperty('--ai-h', `${h}px`)
      /* the main column follows the assistant's height as it grows (client 25 Nov) */
      screen?.style.setProperty('--ai-now', `${h}px`)
    }

    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    /* Scrolling happens inside `.screen`, not on the window, so both are listened to. */
    const scroller = screen ?? window
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    if (el.previousElementSibling) ro.observe(el.previousElementSibling)
    document.querySelectorAll<HTMLElement>(floats).forEach((f) => ro.observe(f))

    return () => {
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      /* the screen keeps its two numbers · a tab without the column still holds the tabs where they are */
      el.style.removeProperty('--ai-h')
    }
  }, [el, capSelector, min])
}
