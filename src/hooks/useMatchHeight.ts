import { useEffect, type RefObject } from 'react'

/**
 * يخلّي عنصرًا بارتفاع عنصر تاني في الصفحة، حتى لو مش في نفس الحاوية.
 *
 * **ليه مش CSS:** الاتنين لازم يبقوا في نفس الفليكس عشان `stretch`
 * تشتغل. زرار «اسأل أبانمي» عايم في القشرة، وشريط القرار جوّه
 * الصفحة · حاويتان مختلفتان، وكل واحدة بتتبني في مكان تاني من الشجرة.
 * حطّ رقم ثابت للاتنين بيشتغل لحد ما الشريط يلفّ سطرًا تاني على شاشة
 * أضيق، وساعتها بيبقى ١٠٨ والزرار ٦٣.
 *
 * فالزرار بيقيس الشريط ويتبعه: `ResizeObserver` للتغيّر في المقاس،
 * و`MutationObserver` لظهوره واختفائه (تنقّل بين الصفحات، أو شريط
 * الإجراء المجمّع اللي بيطلع مع التحديد). ولو مفيش شريط، القيمة
 * بتترفع والعنصر بيرجع لارتفاعه الطبيعي.
 */
export function useMatchHeight(
  ref: RefObject<HTMLElement | null>,
  selector: string,
  /** المتغيّر اللي بيتكتب عليه الارتفاع */
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

    /* `contentRect` بيرجّع المحتوى بلا الحشو، والحشو هنا هو نص
       الارتفاع · فبنزوّده بنفسنا. */
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
