import { useId } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { optLabel, optValue, type SelectOption } from './filters'
import { MenuOpt, MenuPanel, useMenuSearch } from './menu'
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
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

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
        <MenuPanel
          one
          search={search}
          needle={needle}
          onNeedle={setNeedle}
          empty={shown.length === 0}
        >
          {shown.map((o) => (
            <MenuOpt
              key={optValue(o)}
              on={optValue(o) === value}
              onPick={() => { onChange(optValue(o)); setOpen(false) }}
            >
              {optLabel(o)}
            </MenuOpt>
          ))}
        </MenuPanel>
      )}
    </span>
  )
}
