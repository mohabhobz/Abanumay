import { useEffect, type RefObject } from 'react'

/**
 * Measures the height of the floating input box and writes it as a CSS
 * variable on the column.
 *
 * The space below the last message used to be a hardcoded number, and a
 * single fixed number doesn't work: the box grows with the text, and the
 * notice under it wraps to two lines on narrow screens, so content ends
 * up hidden behind it. Measuring keeps the spacing matching the real
 * height no matter how it changes.
 */
export function useDockHeight(
  colRef: RefObject<HTMLElement | null>,
  selector = '.composer.docked',
): void {
  useEffect(() => {
    const col = colRef.current
    if (!col) return

    const apply = (h: number) => col.style.setProperty('--dock', `${Math.round(h)}px`)

    /* The box mounts and unmounts with the first question, so the column
       itself is also observed to catch it appearing, not just resizing. */
    let ro: ResizeObserver | null = null
    const attach = () => {
      const dock = col.querySelector<HTMLElement>(selector)
      ro?.disconnect()
      if (!dock) { apply(0); return }
      apply(dock.getBoundingClientRect().height)
      if (typeof ResizeObserver !== 'function') return
      ro = new ResizeObserver(([e]) => apply(e.contentRect.height))
      ro.observe(dock)
    }

    attach()
    const mo = new MutationObserver(attach)
    mo.observe(col, { childList: true, subtree: false })

    return () => {
      ro?.disconnect()
      mo.disconnect()
    }
  }, [colRef, selector])
}
