import { useEffect, type RefObject } from 'react'

interface Options {
  /** المدى بالبكسل اللي العنصر يبدأ يحسّ فيه بالماوس */
  reach?: number
  /** لو اتحدد، التأثير بيتطبّق على العناصر المطابقة جوّه الحاوية */
  selector?: string
}

/**
 * تفاعل من بعيد: العنصر بيحسّ بالماوس قبل ما توصله فيرتفع ويلمع،
 * والضوء بيتبع مكان المؤشر.
 *
 * المسافة محسوبة أفقيًا ورأسيًا عشان في صف كروت يبقى الكارت الأقرب
 * هو اللي يتأثر أكتر، مش كلهم مع بعض.
 *
 * بيكتب على كل عنصر: `--near` (0→1) و`--mx`/`--my`.
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
