import { Link } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { useMenu } from '@/hooks/useMenu'

/* ═══════════════════════════════════════════════════════════
   الباث · ك-3 و ك-4 · والبريف الكامل في NAVIGATION_PATH_BRIEF.md

   ⚠️ **هرم لا تاريخ.** ده اللي اتحسم في الميتنج بمثال الفولدرات،
   واللي البحث بيقوله كأول قاعدة. والسبب العملي عندنا تحديدًا:
   **نصّ الدخول للنظام بييجي من إشعار أو رابط متبعوت** (قاعدة 20
   بتلزم إشعارًا لكل انتقال)، واللي جاي من برّه **مالوش هيستوري
   أصلًا** · فباث الهيستوري كان هيطلع فاضي في أكتر حالة بنتصمّم لها.

   والهيستوري موجود خلاص: زرار الرجوع في البراوزر. ده سلوك براوزر
   لا سلوك تطبيق.

   ⚠️ **والمسار بيتكتب في الصفحة، ما بيتشتقّش من الـURL.** الاشتقاق
   بيدّي «entities ← 755 ← banks»: أرقام وسلاجات مش أسماء. والصفحة
   هي الوحيدة اللي بتعرف إن `755` اسمها «جمعية البناء العلمي».

   ⚠️ **وآخر عنصر مش رابط.** رابط بيودّي لنفس الشاشة اللي إنت فيها
   بيكسر التوقّع: المستخدم بيدوس وما بيحصلش حاجة، فيفتكر إن الشاشة
   علّقت. وهو كمان اللي بيخلّي `aria-current="page"` صادقة.

   ⚠️ **وسطر واحد أبدًا.** الباث اللي بيلفّ سطرين بيفقد كونه باثًا
   ويبقى قايمة كلمات. الزيادة بتتطوي في «…» بقايمة، ما بتنزلش تحت.
   ═══════════════════════════════════════════════════════════ */

export interface Crumb {
  label: string
  /** غيابه معناه إن العنصر ده هو الصفحة الحالية */
  to?: string
}

export interface CrumbsProps {
  /** من الجذر للصفحة الحالية · آخر عنصر هو مكانك */
  items: Crumb[]
}

/**
 * فوق العدد ده بتتطوي الأوساط في «…».
 *
 * ⚠️ **أربعة مش رقم مخترَع:** أعمق باث في السيستم أربع مستويات
 * (الصرف ← الطلب ← أمر الصرف · والمشاريع ← المشروع ← تاب ← فرع)،
 * فالطيّ بيشتغل لمّا نعدّي العمق ده لا قبله · يعني القايمة ما
 * بتظهرش في الحالة العادية خالص.
 */
const FLAT = 4

export function Crumbs({ items }: CrumbsProps) {
  const { open, setOpen, box } = useMenu<HTMLSpanElement>()

  /* قاعدة ٥ في البريف: مفيش باث في الشاشة المسطّحة · مستوى واحد
     يعني مفيش هرم يتعرض، وعنصر واحد في `nav` بيبقى ضوضاء. */
  if (items.length < 2) return null

  const deep = items.length > FLAT
  /* الجذر وآخر اتنين بيفضلوا ظاهرين · الأوساط هي اللي بتتطوي،
     لأن الجذر بيقول «إنت في أنهي موديول» والآخر بيقول «إنت فين». */
  const head = deep ? items[0] : undefined
  const folded = deep ? items.slice(1, items.length - 2) : []
  const tail = deep ? items.slice(items.length - 2) : items

  const link = (c: Crumb, i: number) =>
    c.to ? (
      <Link key={`${c.label}-${i}`} className="crumb" to={c.to} title={c.label}>
        {c.label}
      </Link>
    ) : (
      <span key={`${c.label}-${i}`} className="crumb now" aria-current="page" title={c.label}>
        {c.label}
      </span>
    )

  const sep = (k: string) => (
    <Icon key={`s-${k}`} name={icons.chevron} size={14} className="crumb-s" />
  )

  return (
    <nav className="crumbs" aria-label="مسار الصفحة">
      {/* `ol` لأن الترتيب معنى: الأول أب والآخر ابن · وقارئ الشاشة
          بيقول «عنصر ٢ من ٤» فبيدّي العمق بلا بصر */}
      <ol>
        {head && (
          <li>
            {link(head, 0)}
            {sep('h')}
          </li>
        )}

        {folded.length > 0 && (
          <li>
            <span className="crumb-f" ref={box}>
              <button
                type="button"
                className="crumb crumb-b"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${folded.length} مستويات مطويّة`}
                title="المستويات اللي في النصّ"
                onClick={() => setOpen((x) => !x)}
              >
                …
              </button>
              {open && (
                <div className="fmenu crumb-m">
                  <div className="fmenu-l" role="menu">
                    {folded.map((c, i) =>
                      c.to ? (
                        <Link
                          key={`${c.label}-${i}`}
                          role="menuitem"
                          className="fopt"
                          to={c.to}
                          onClick={() => setOpen(false)}
                        >
                          <span className="fopt-t">{c.label}</span>
                        </Link>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </span>
            {sep('f')}
          </li>
        )}

        {tail.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {link(c, i)}
            {i < tail.length - 1 && sep(String(i))}
          </li>
        ))}
      </ol>
    </nav>
  )
}
