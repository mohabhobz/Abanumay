import { useEffect, useState, type RefObject } from 'react'

/** بيرجّع true أول ما العنصر يبان في الشاشة، وبيفضل true بعدها */
export function useOnScreen(ref: RefObject<HTMLElement | null>, rootMargin = '-40px'): boolean {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver !== 'function') { setSeen(true); return }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) { setSeen(true); io.disconnect() }
      },
      { rootMargin, threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, rootMargin])

  return seen
}
