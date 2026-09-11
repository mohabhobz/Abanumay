import { useLayoutEffect, useRef, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { exportPng, exportXlsx, printArea, type Sheet } from '@/lib/export'
import { PrintSheet } from './PrintSheet'

/**
 * زرار التصدير — **الشكل الوحيد للتصدير في النظام**.
 *
 * قبل كده كل شاشة كانت بتكتب زرارها بإيدها: قايمة المشاريع والجهات
 * فيهم التلاتة (إكسل · PDF · صورة)، والتقارير فيها إكسل وبس. المستخدم
 * اللي اتعلّم إنه يطلع صورة من قايمة المشاريع بيدوّر عليها في التقرير
 * فما يلاقيهاش — والفرق مالوش سبب، مجرد كود مكرّر اتفرّع.
 *
 * فالمكوّن ده بيمتلك المخارج التلاتة ونسخة الطباعة مع بعض. أي شاشة
 * عندها `Sheet` بتاخد نفس القايمة بسطر واحد، ومفيش طريق تانٍ للتصدير.
 *
 * **ليه التلاتة بالذات؟** كل واحد لسؤال مختلف:
 *   إكسل — «عايز أشتغل على الأرقام» (خلايا حقيقية، فلترة، جمع).
 *   PDF  — «عايز أرفقه في محضر» (ورقة رسمية بترويسة ونطاق مكتوب).
 *   صورة — «عايز أحطه في شريحة أو أبعته في واتساب» (لقطة نضيفة).
 *
 * والتلاتة بيصدّروا **نفس النطاق**: نفس الـ`Sheet` اللي الشاشة
 * بتحسبه — الصفوف المحدَّدة لو فيه تحديد، وإلا نتيجة الفلتر كاملة.
 */
export function ExportMenu({
  sheet,
  /** «الصفوف المحدَّدة · ١٢ مشروعًا» — بيظهر فوق القايمة وفي ترويسة الطباعة */
  note,
  /** عدّاد على الزرار (المحدَّد)، لو فيه تحديد */
  count,
}: {
  sheet: Sheet
  note?: string
  count?: number
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  /** جهة الفتح: `start` بتنمو ناحية بداية السطر، `end` بالعكس */
  const [side, setSide] = useState<'start' | 'end'>('start')
  const menu = useRef<HTMLDivElement>(null)

  /**
   * القايمة بتتقلب لو هتخرج برّه الشاشة.
   *
   * زرار التصدير مكانه آخر شريط الأدوات، وفي RTL آخر الشريط هو
   * **يسار الشاشة**. القايمة مربوطة ببداية الزرار وبتنمو لليسار،
   * فعلى شاشة الميزانية كانت بتبدأ عند −167px وتتقصّ على حافة
   * `.screen` (اللي `overflow:auto`). القياس بيحصل بعد الفتح مرة
   * واحدة، والقلب بيحطّها ناحية الداخل.
   */
  useLayoutEffect(() => {
    if (!open) return
    const el = menu.current
    const anchor = box.current
    if (!el || !anchor) return
    /* الحساب من **مرساة الزرار وعرض القايمة**، لا من موضع القايمة
       الحالي: لو قِسنا الموضع الحالي، القايمة اللي اتقلبت مرة
       بتفضل مقلوبة للأبد لأنها بقت جوّه الشاشة بالقلب. */
    const a = anchor.getBoundingClientRect()
    const w = el.offsetWidth
    const rtl = getComputedStyle(el).direction === 'rtl'
    const left = rtl ? a.right - w : a.left
    const pad = 12
    setSide(left < pad || left + w > window.innerWidth - pad ? 'end' : 'start')
  }, [open, box])

  const pick = (run: () => void) => () => {
    setOpen(false)
    /* تأخير بسيط قبل الطباعة عشان القايمة تتقفل الأول — من غيره
       بتطلع في الورقة. ونفس المهلة للباقي عشان الإحساس واحد. */
    setTimeout(run, 60)
  }

  return (
    <>
      <div className="fexp" ref={box}>
        <button
          className={`fchip${open ? ' on' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={icons.export} size={15} />
          تصدير
          {count ? <b className="num">{count}</b> : null}
        </button>

        {open && (
          <div className={`fmenu fexp-m${side === 'end' ? ' flip' : ''}`} role="menu" ref={menu}>
            {note && <div className="fexp-s sub">{note}</div>}
            <button className="fopt" role="menuitem" onClick={pick(() => exportXlsx(sheet))}>
              <span className="fopt-t">Excel · xlsx</span>
              <span className="fopt-n sub">خلايا حقيقية للفلترة والجمع</span>
            </button>
            <button className="fopt" role="menuitem" onClick={pick(printArea)}>
              <span className="fopt-t">PDF · عبر الطباعة</span>
              <span className="fopt-n sub">ورقة رسمية للإرفاق في محضر</span>
            </button>
            <button className="fopt" role="menuitem" onClick={pick(() => exportPng(sheet))}>
              <span className="fopt-t">صورة · png</span>
              <span className="fopt-n sub">لقطة للشريحة أو المحادثة</span>
            </button>
          </div>
        )}
      </div>

      {/* نسخة الطباعة بورتال على `body`: لو قعدت جوّه `.fexp` هتتخفي
          معاها وقت الطباعة، ولو قعدت جوّه `#root` هتطبع ومعاها الشاشة.
          برّه الاتنين بتبقى هي الورقة الوحيدة. */}
      {createPortal(<PrintSheet sheet={sheet} note={note} />, document.body)}
    </>
  )
}
