import { useMemo, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { Icon } from './Icon'
import { icons } from './icons'

/* ═══════════════════════════════════════════════════════════
   حقل التاريخ · تقويم السيستم لا تقويم المتصفّح.

   ⚠️ **`<input type="date">` بيفتح تقويمًا بيرسمه المتصفّح** ·
   نفس مشكلة `<select>` الأصلية بالظبط، ومسجَّلة في نفس المكان:
   خطّ لاتيني، وأسماء أيام إنجليزية، وأول اليوم الأحد أو الاثنين
   حسب لغة النظام لا حسب البلد، وشكل تالت خالص في الويندوز ·
   وسط واجهة زجاج عربية. والأسوأ إن الخانة الفاضية بتكتب
   `dd/mm/yyyy` بالإنجليزي في حقل عربي · والعميل شافها (١٨ سبتمبر).

   فالتقويم هنا مرسوم: نفس لوحة `.fmenu`، ونفس الحبر، والأسبوع
   بيبدأ **الأحد** لأن ده أول أيام العمل في السعودية، والجمعة
   والسبت بيتعلّموا عطلة.

   ⚠️ **والأرقام لاتينية وبس** · قاعدة السيستم كلها: `--fd` وخانة
   `.num`. تقويم بأرقام هندية جنب مبلغ بأرقام لاتينية بيخلّي
   الشاشة بلغتين.

   ⚠️ **والقيمة بتفضل `YYYY-MM-DD`** زي `type="date"` بالظبط ·
   الشاشات اللي بتستعمله ما تعرفش إن التحكّم اتغيّر، والمقارنات
   والفرز في `plans.ts` و`registration.ts` بتشتغل زي ما هي.
   ═══════════════════════════════════════════════════════════ */

/* ⚠️ **حرف واحد لا تلاتة.** «إثن» و«ثلا» و«خمي» مش اختصارات
   عربية، دي قصّ لكلمة في نصّها · والاختصار المتعارف عليه في
   التقاويم العربية حرف واحد. والترتيب من الأحد لأنه أول أيام
   العمل في السعودية. */
const DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const DAY_SAY = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** «2026-09-18» → «18 سبتمبر 2026» · والفاضي بيرجع فاضي */
const say = (v: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return ''
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export interface DateFieldProps {
  value: string
  onChange: (v: string) => void
  label?: string
  disabled?: boolean
  /** أقدم تاريخ مسموح · `YYYY-MM-DD` */
  min?: string
  /** أحدث تاريخ مسموح */
  max?: string
  /** يتعلّق بنهاية الحقل · للعمود الأخير في السطر */
  end?: boolean
}

export function DateField({ value, onChange, label, disabled, min, max, end }: DateFieldProps) {
  const { open, setOpen, box } = useMenu<HTMLSpanElement>()

  /* الشهر المعروض · بيفتح على الشهر بتاع القيمة، وعلى اليوم
     لو الحقل فاضي */
  const now = new Date()
  const [at, setAt] = useState(() => {
    const m = /^(\d{4})-(\d{2})/.exec(value)
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1 }
      : { y: now.getFullYear(), m: now.getMonth() }
  })

  const today = iso(now.getFullYear(), now.getMonth(), now.getDate())

  const grid = useMemo(() => {
    const first = new Date(at.y, at.m, 1)
    /* `getDay()` بيرجع ٠ للأحد · وهو أول العمود عندنا فمفيش إزاحة */
    const lead = first.getDay()
    const days = new Date(at.y, at.m + 1, 0).getDate()
    const cells: (number | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d += 1) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [at])

  const step = (by: number) => setAt((x) => {
    const m = x.m + by
    if (m < 0) return { y: x.y - 1, m: 11 }
    if (m > 11) return { y: x.y + 1, m: 0 }
    return { y: x.y, m }
  })

  const off = (d: number) => {
    const v = iso(at.y, at.m, d)
    return (min !== undefined && v < min) || (max !== undefined && v > max)
  }

  const pick = (d: number) => { onChange(iso(at.y, at.m, d)); setOpen(false) }

  return (
    <span className={`fldsel${end ? ' end' : ''}`} ref={box}>
      <button
        type="button"
        className={`fld fldsel-b${disabled ? ' off' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((x) => !x)}
      >
        {/* ⚠️ النصّ البديل عربي · `dd/mm/yyyy` اللاتيني بتاع
            المتصفّح كان بيبان في حقل عربي جنب حقول نصّها عربي */}
        <span className={`fldsel-t${value ? '' : ' ph'}`}>
          {value ? say(value) : 'اختر التاريخ'}
        </span>
        <Icon name={icons.date} size={15} />
      </button>

      {open && (
        <div className="fmenu cal" role="dialog" aria-label={label ?? 'التقويم'}>
          <div className="cal-h">
            {/* ⚠️ السهم بيمشي مع اتجاه القراءة: «السابق» على اليمين
                في العربي · السهم اللي بيروح لورا في تقويم المتصفّح
                كان بيمشي بالعكس لأنه متسمّر على اللاتيني */}
            <button type="button" className="cal-n" aria-label="الشهر السابق" onClick={() => step(-1)}>
              <Icon name={icons.chevronBack} size={16} />
            </button>
            <span className="cal-t">
              {MONTHS[at.m]} <span className="num">{at.y}</span>
            </span>
            <button type="button" className="cal-n" aria-label="الشهر التالي" onClick={() => step(1)}>
              <Icon name={icons.chevron} size={16} />
            </button>
          </div>

          <div className="cal-w" aria-hidden="true">
            {DAYS.map((d, i) => <span key={d} title={DAY_SAY[i]}>{d}</span>)}
          </div>

          <div className="cal-g" role="grid">
            {grid.map((d, i) => {
              if (d === null) return <span key={`e${i}`} className="cal-d off" />
              const v = iso(at.y, at.m, d)
              return (
                <button
                  type="button"
                  key={v}
                  role="gridcell"
                  aria-selected={v === value}
                  disabled={off(d)}
                  className={`cal-d num${v === value ? ' on' : ''}${v === today ? ' now' : ''}`}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="fmenu-f cal-f">
            <button type="button" className="fclear" onClick={() => { onChange(today); setOpen(false) }}>
              اليوم
            </button>
            {value && (
              <button type="button" className="fclear" onClick={() => { onChange(''); setOpen(false) }}>
                مسح
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
