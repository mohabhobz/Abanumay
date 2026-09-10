import { useEffect, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

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
          <Icon path={icons.export} size={15} />
          تصدير
          {count ? <b className="num">{count}</b> : null}
        </button>

        {open && (
          <div className="fmenu fexp-m" role="menu">
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
