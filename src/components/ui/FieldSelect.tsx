import { useEffect, useId, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { optLabel, optValue, type SelectOption } from './filters'
import { Icon } from './Icon'
import { icons } from './icons'

/* ═══════════════════════════════════════════════════════════
   قائمة الاختيار **جوّه الفورم**.

   ⚠️ **القاعدة كانت متكتوبة في مكان وناقصة في التاني.** `Select`
   اللي في شريط الأدوات اتشالت منها `<select>` الأصلية من زمان،
   والتعليق اللي فوقها بيشرح ليه: قايمتها بيرسمها **نظام
   التشغيل** · خطّها وخلفيتها وسلوكها برّه السيستم، وفي الثيم
   الغامق بتفتح صندوقًا رماديًّا بخطّ لاتيني وسط واجهة زجاج
   عربية. لكن **الفورمات ما اتغيّرتش** · فضل فيها ١١ `<select>`
   أصلية في تسجيل الجهة والمشروع الجديد والاتفاقية والميزانية.

   يعني نفس السيستم بيفتح للمستخدم قايمتين مختلفتين حسب هو واقف
   فين · ودي بالظبط اللي العميل شافها في تسجيل الجهة.

   **قاعدة مكتوبة في مكان واحد ما بتحرسش المكان التاني** · فاللوحة
   هنا هي **نفس** `.fmenu one` و`.fopt`، واللي بيتغيّر هو الزرار
   بس: في الشريط بيلبس `.fsel-b` (شكل الشريحة)، وهنا بيلبس `.fld`
   (شكل الحقل) عشان يقف جنب الحقول اللي حواليه بنفس الارتفاع
   ونفس الحافة ونفس حلقة التركيز.
   ═══════════════════════════════════════════════════════════ */

export interface FieldSelectProps {
  value: string
  options: readonly SelectOption[]
  onChange: (v: string) => void
  /** النص اللي يبان لما مفيش اختيار · بيتلوّن `--t3` زي `::placeholder` */
  placeholder?: string
  disabled?: boolean
  /** اسم الحقل للقارئ الشاشي · الليبل فوق بيبقى منفصل عن الزرار */
  label?: string
  /** فوق العدد ده بيظهر صندوق بحث جوّه اللوحة · المدن ٤٠+ */
  searchAt?: number
  /** يخلّي اللوحة تتعلّق بالنهاية · للحقل الأخير في السطر */
  end?: boolean
}

export function FieldSelect({
  value, options, onChange, placeholder = 'اختر', disabled, label, searchAt = 9, end,
}: FieldSelectProps) {
  const { open, setOpen, box } = useMenu<HTMLSpanElement>()
  const [needle, setNeedle] = useState('')
  const id = useId()

  useEffect(() => { if (!open) setNeedle('') }, [open])

  const current = options.find((o) => optValue(o) === value)
  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  return (
    <span className={`fldsel${end ? ' end' : ''}`} ref={box}>
      <button
        type="button"
        id={`${id}-b`}
        className={`fld fldsel-b${disabled ? ' off' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((x) => !x)}
      >
        <span className={`fldsel-t${current ? '' : ' ph'}`}>
          {current ? optLabel(current) : placeholder}
        </span>
        <Icon name={icons.chevronDown} size={15} />
      </button>

      {open && (
        <div className="fmenu one">
          {options.length > searchAt && (
            <label className="fmenu-q">
              <Icon name={icons.search} size={14} />
              <input
                autoFocus
                value={needle}
                onChange={(e) => setNeedle(e.target.value)}
                placeholder="ابحث…"
                aria-label="ابحث في الخيارات"
              />
            </label>
          )}

          <div className="fmenu-l" role="listbox">
            {shown.length === 0 && <div className="fmenu-e sub">لا نتائج</div>}
            {shown.map((o) => {
              const val = optValue(o)
              const sel = val === value
              return (
                <button
                  type="button"
                  key={val}
                  role="option"
                  aria-selected={sel}
                  className={`fopt${sel ? ' on' : ''}`}
                  onClick={() => { onChange(val); setOpen(false) }}
                >
                  <span className="fopt-x" aria-hidden="true">
                    {sel && <Icon name={icons.check} size={12} />}
                  </span>
                  <span className="fopt-t">{optLabel(o)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
