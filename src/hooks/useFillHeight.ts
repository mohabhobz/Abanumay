import { useEffect, type RefObject } from 'react'

/**
 * يخلّي العنصر يملا المساحة الباقية من مكانه لحدّ آخر الشاشة.
 *
 * **المشكلة اللي بيحلّها:** الكارت اللازق `height:100dvh - ...` بيبقى
 * صح **بعد** ما يلزق بس. قبل كده هو بيبدأ تحت الترويسة والتبويبات
 * (٥٦٣px في صفحة المشروع)، فبيمتدّ ٤٣٠px تحت حافة الشاشة والمحتوى
 * المتوسّط فيه بيقع برّه المنظر — أول ما تفتح الصفحة تلاقي كارتًا
 * فاضيًا وزراره تحت.
 *
 * فالارتفاع بيتحسب من **مكانه الفعلي** كل لحظة: ارتفاع الشاشة ناقص
 * موضعه من فوق ناقص المساحة المحجوزة تحت (رصيف القرار). قبل اللزق
 * بيبقى قصيرًا ومحتواه ظاهر، وكل ما تنزل بيكبر لحد ما يلزق فيملا
 * الشاشة. ده بالظبط «الماكسيمام هايت = الاستيك اون توب ناقص المساحة
 * الباقية لتحت».
 */
export function useFillHeight(
  ref: RefObject<HTMLElement | null>,
  {
    /** المتغيّر اللي بيتكتب عليه الارتفاع */
    varName = '--fill-h',
    /** عنصر محجوز تحت (شريط القرار) — بيتقاس لو موجود */
    reserveSelector,
    /** الحدّ الأدنى عشان الكارت ما يتخنقش على شاشة قصيرة */
    min = 320,
    /** فراغ بين الكارت واللي تحته */
    gap = 12,
  }: {
    varName?: string
    reserveSelector?: string
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
      /* التثبيت له سقف: العنصر اللازق بيسيب مكانه لما حاويته تخلص
         (آخر الصفحة)، فـ`top` بيبقى بالسالب والمعادلة بتدّي ارتفاعًا
         أكبر من الشاشة — الكارت بيتمدّ ومحتواه المتوسّط بيطلع فوق
         حافة المنظر ويسيب زجاجًا فاضيًا. القاع هنا هو موضع اللزق
         نفسه، فالارتفاع ما يزيدش عن خانة الشاشة أبدًا. */
      const stick = parseFloat(getComputedStyle(el).top) || 0
      const top = Math.max(el.getBoundingClientRect().top, stick)
      const dock = reserveSelector
        ? document.querySelector<HTMLElement>(reserveSelector)
        : null
      /* المحجوز تحت = ارتفاع الشريط + المسافة اللي تحته لحافة الشاشة */
      const reserve = dock
        ? window.innerHeight - dock.getBoundingClientRect().top + gap
        : gap
      el.style.setProperty(
        varName,
        `${Math.max(min, Math.round(window.innerHeight - top - reserve))}px`,
      )
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    measure()
    /* التمرير جوّه `.screen` مش على الويندو، فبنسمع للاتنين */
    const scroller = el.closest('.screen') ?? window
    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      el.style.removeProperty(varName)
    }
  }, [ref, varName, reserveSelector, min, gap])
}
