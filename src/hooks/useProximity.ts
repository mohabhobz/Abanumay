import { useEffect, type RefObject } from 'react'

interface Options {
  /** Pixel radius at which the element starts sensing the cursor. */
  reach?: number
  /** If set, the effect applies to matching elements inside the container. */
  selector?: string
}

/**
 * Proximity interaction: the element senses the cursor before it's
 * touched, lifting and glowing, with the highlight following the cursor
 * position. Distance is measured both horizontally and vertically so
 * that in a row of cards, the nearest one is affected most rather than
 * all of them equally.
 *
 * Writes onto each element: `--near` (0→1) and `--mx`/`--my`.
 */
export function useProximity(
  rootRef: RefObject<HTMLElement | null>,
  { reach = 260, selector }: Options = {},
): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const targets = (): HTMLElement[] =>
      selector ? Array.from(root.querySelectorAll<HTMLElement>(selector)) : [root]

    const onMove = (e: PointerEvent) => {
      for (const el of targets()) {
        const r = el.getBoundingClientRect()
        const dy = Math.max(0, r.top - e.clientY, e.clientY - r.bottom)
        const dx = Math.max(0, r.left - e.clientX, e.clientX - r.right)
        const near = Math.max(0, 1 - Math.hypot(dx, dy) / reach)
        el.style.setProperty('--near', near.toFixed(3))
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
    }
    const onLeave = () => targets().forEach((el) => el.style.setProperty('--near', '0'))

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [rootRef, reach, selector])
}
