import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { icons } from './icons'

/* ═══════════════════════════════════════════════════════════
   لوحة القائمة · **مرسومة مرّة واحدة**.

   ⚠️ **دي كانت مكتوبة تلات مرّات بالنسخ** · في `Select` وفي
   `MultiSelect` وفي `FieldSelect` · والتلاتة بيرسموا نفس
   `.fmenu` ونفس صندوق البحث ونفس `.fopt` ونفس «لا نتائج».
   الـCSS كان واحدًا فعلًا، فتغيير اللون بيوصل · **لكن أي تغيير
   في البنية أو السلوك كان لازم يتعمل تلات مرّات**، واللي بينسى
   واحدة بيسيب قائمة بتتصرّف غير أخواتها. وده بالظبط اللي حصل
   في `<select>` الأصلية: قاعدة اتظبطت في مكان وفضلت غلط في
   الباقي لأن الباقي نسخة لا استعمال.

   فاللوحة بقت مكوّنًا: `MenuPanel` هي الصندوق (بحث + قائمة +
   ذيل)، و`MenuOpt` هو السطر (الخانة + الوش + الاسم). أي تغيير
   في الشكل أو السلوك بيتعمل هنا وبس · و`tools/onemenu.mjs`
   بيمنع رسم `.fmenu` أو `.fopt` بره الملف ده.

   ⚠️ **وخانة العلامة أول عنصر في الـDOM · وآخر واحدة في العين.**
   `.fopt-x` بتاخد `order` في الـCSS فبتروح آخر الصفّ (طلب
   العميل: العلامة على الشمال والكلام من أوّل الصفّ)، والترتيب
   في الشجرة بيفضل زي ما هو عشان قارئ الشاشة يسمع الحالة
   قبل الاسم.
   ═══════════════════════════════════════════════════════════ */

export interface MenuPanelProps {
  /** `one` = اختيار واحد (علامة على المختار) · وغيابها = متعدد (مربّعات) */
  one?: boolean
  /** تفتح لفوق · للقوائم اللي في آخر الصفحة */
  up?: boolean
  /** تتعلّق بنهاية الحقل بدل بدايته · للعمود الأخير */
  end?: boolean
  /** يظهر صندوق البحث · بيتحدّد من عدد الخيارات عند المنادي */
  search?: boolean
  needle?: string
  onNeedle?: (v: string) => void
  /** مفيش نتيجة للبحث · النصّ بيتغيّر حسب القائمة */
  empty?: boolean
  emptyText?: string
  /** ذيل اللوحة · «مسح الاختيار» وخلافه */
  foot?: ReactNode
  /** صنف زيادة للوحة · `psize-m` مثلًا */
  extra?: string
  children: ReactNode
}

export function MenuPanel({
  one, up, end, search, needle = '', onNeedle, empty, emptyText = 'لا نتائج', foot, extra, children,
}: MenuPanelProps) {
  return (
    <div className={`fmenu${one ? ' one' : ''}${up ? ' up' : ''}${end ? ' flip' : ''}${extra ? ` ${extra}` : ''}`}>
      {search && onNeedle && (
        <label className="fmenu-q">
          <Icon name={icons.search} size={14} />
          <input
            autoFocus
            value={needle}
            onChange={(e) => onNeedle(e.target.value)}
            placeholder="ابحث…"
            aria-label="ابحث في الخيارات"
          />
        </label>
      )}

      <div className="fmenu-l" role="listbox" aria-multiselectable={one ? undefined : true}>
        {empty && <div className="fmenu-e sub">{emptyText}</div>}
        {children}
      </div>

      {foot && <div className="fmenu-f">{foot}</div>}
    </div>
  )
}

export interface MenuOptProps {
  on: boolean
  onPick: () => void
  /** وش الشخص أو أي عنصر قبل الاسم · بيفضل في أول الصفّ */
  lead?: ReactNode
  /** بدل علامة الصحّ · الرقم في منتقي التجميع مثلًا */
  mark?: ReactNode
  /** الصفّ معروض لا قابل للضغط · «مثبَّت» في الفلاتر */
  fix?: boolean
  off?: boolean
  title?: string
  /** صنف زيادة على الخانة · `num` للرقم بدل العلامة */
  markClass?: string
  /** صنف زيادة على الاسم · `num` للأرقام اللاتينية */
  textClass?: string
  children: ReactNode
}

export function MenuOpt({
  on, onPick, lead, mark, fix, off, title, markClass, textClass, children,
}: MenuOptProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      disabled={off}
      title={title}
      className={`fopt${on ? ' on' : ''}${fix ? ' fix' : ''}`}
      onClick={fix ? undefined : onPick}
    >
      {/* ⚠️ الخانة بتتكتب حتى وهي فاضية · مساحتها محجوزة عشان
          الأسماء ما تزحلقش لما الاختيار يتغيّر */}
      <span className={`fopt-x${markClass ? ` ${markClass}` : ''}`} aria-hidden="true">
        {mark ?? (on && <Icon name={icons.check} size={12} />)}
      </span>
      {lead}
      <span className={`fopt-t${textClass ? ` ${textClass}` : ''}`}>{children}</span>
    </button>
  )
}

/** بحث اللوحة · نفس منطق الفلترة والتصفير عند القفل في كل قائمة */
export function useMenuSearch(open: boolean, at: number, count: number) {
  const [needle, setNeedle] = useState('')
  useEffect(() => { if (!open) setNeedle('') }, [open])
  return { needle, setNeedle, search: count > at }
}
