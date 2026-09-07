import { useCallback, useState, type RefObject } from 'react'

export interface ScrollEdges {
  /** في محتوى مخفي فوق */
  top: boolean
  /** في محتوى مخفي تحت */
  bottom: boolean
}

/**
 * بيقول إذا كان في محتوى مخفي فوق أو تحت منطقة تمرير.
 * بيستخدم في تدرّجات الحواف بدل الخطوط الفاصلة الثابتة.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState<ScrollEdges>({ top: false, bottom: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const more = el.scrollHeight - el.clientHeight
    setEdges({
      top: el.scrollTop > 6,
      bottom: more > 6 && el.scrollTop < more - 6,
    })
  }, [ref])

  return { edges, measure }
}
