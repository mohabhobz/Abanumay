import { useEffect, type RefObject } from 'react'

/**
 * بيقيس ارتفاع مربع الكتابة العايم وبيكتبه كمتغيّر CSS على العمود.
 *
 * المسافة تحت آخر رسالة كانت رقمًا مكتوبًا بالإيد، ورقم واحد ما ينفعش:
 * المربع بيكبر مع النص، والتنبيه تحته بيلف على سطرين في الشاشات
 * الضيقة، فالمحتوى بيتخبّى تحته. القياس بيخلّي المسافة تتبع الارتفاع
 * الحقيقي مهما اتغيّر.
 */
export function useDockHeight(
  colRef: RefObject<HTMLElement | null>,
  selector = '.composer.docked',
): void {
  useEffect(() => {
    const col = colRef.current
    if (!col) return

    const apply = (h: number) => col.style.setProperty('--dock', `${Math.round(h)}px`)

    /* المربع بيتحط ويتشال مع أول سؤال، فبنراقب العمود نفسه كمان
       عشان نلقط ظهوره لا تغيّر حجمه بس. */
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
