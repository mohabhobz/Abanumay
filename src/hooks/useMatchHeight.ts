import { useEffect, type RefObject } from 'react'

/**
 * Makes one element match another element's height on the page, even
 * when they're not in the same container.
 *
 * Why not CSS: both elements would need to be in the same flex context
 * for `stretch` to work. The "Ask Abanumay" button floats in the app
 * shell, while the decision bar sits inside the page — two different
 * containers, each built in a different part of the tree. A fixed
 * number for both works until the bar wraps to a second line on a
 * narrower screen, at which point it becomes 108 while the button stays 63.
 *
 * So the button measures the bar and follows it: a `ResizeObserver` for
 * size changes, and a `MutationObserver` for it appearing and
 * disappearing (navigating between pages, or the bulk action bar that
 * appears with a selection). If there's no bar, the value is cleared
 * and the element returns to its natural height.
 */
export function useMatchHeight(
  ref: RefObject<HTMLElement | null>,
  selector: string,
  /** The variable the height gets written to. */
  varName = '--match-h',
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let ro: ResizeObserver | null = null

    const apply = (h: number | null) => {
      if (h && h > 0) el.style.setProperty(varName, `${Math.round(h)}px`)
      else el.style.removeProperty(varName)
    }

    const attach = () => {
      ro?.disconnect()
      const target = document.querySelector<HTMLElement>(selector)
      if (!target) {
        apply(null)
        ro = null
        return
      }
      apply(target.getBoundingClientRect().height)
      ro = new ResizeObserver(([e]) => apply(e.contentRect.height + borders(target)))
      ro.observe(target)
    }

    /* `contentRect` returns the content without padding, and the padding
       here is half the height — so it's added back manually. */
    const borders = (t: HTMLElement) => {
      const cs = getComputedStyle(t)
      return (
        parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      )
    }

    attach()
    const mo = new MutationObserver(attach)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      ro?.disconnect()
    }
  }, [ref, selector, varName])
}
