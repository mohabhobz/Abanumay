import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { icons } from './icons'

/* ═══════════════════════════════════════════════════════════
   عناصر القوائم — بحث وفلاتر وشرائح وترقيم.

   القاعدة اللي بنمشي عليها: الفلاتر الأربعتاشر بتاعة النظام
   ما تتعرضش كلها في وش المستخدم. اللي بيفلتر بيه فعلًا كل يوم
   (الحالة · المالك · التأخير) بيبقى شرائح فوق، والباقي بيتطوي
   خلف «فلاتر متقدمة» ومعاه عدّاد بيقول كام فلتر شغّال.
   ═══════════════════════════════════════════════════════════ */

export function SearchBox({
  value,
  onChange,
  placeholder = 'ابحث…',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="srch">
      <Icon path={icons.search} size={17} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button className="srch-x" onClick={() => onChange('')} aria-label="مسح البحث">
          <Icon path={icons.close} size={15} />
        </button>
      )}
    </label>
  )
}

export interface SelectProps {
  label: string
  value?: string
  options: readonly string[]
  onChange: (v: string | undefined) => void
  /** النص اللي يظهر لما مفيش اختيار */
  all?: string
  disabled?: boolean
}

/** قائمة اختيار بمظهر النظام — الحافة شعرية والخلفية زجاج */
export function Select({ label, value, options, onChange, all = 'الكل', disabled }: SelectProps) {
  return (
    <label className={`fsel${value ? ' on' : ''}${disabled ? ' off' : ''}`}>
      <span className="fsel-l">{label}</span>
      <span className="fsel-b">
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{all}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <Icon path={icons.chevronDown} size={15} />
      </span>
    </label>
  )
}

/** شريحة تبديل — فلتر منطقي واحد بضغطة */
export function Toggle({
  label,
  on,
  onChange,
  count,
}: {
  label: ReactNode
  on: boolean
  onChange: (v: boolean) => void
  count?: number
}) {
  return (
    <button className={`fchip${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
      {label}
      {count !== undefined && <b className="num">{count}</b>}
    </button>
  )
}

export interface SegItem {
  key: string
  label: string
  count?: number
}

/** شرائح الحالة — بديل التبويبات لما العدد بيهم */
export function Segments({
  items,
  active,
  onChange,
}: {
  items: SegItem[]
  active?: string
  onChange: (key: string | undefined) => void
}) {
  return (
    <div className="fsegs" role="tablist">
      {items.map((it) => {
        const on = (active ?? '') === it.key
        return (
          <button
            key={it.key || 'all'}
            role="tab"
            aria-selected={on}
            className={`fseg${on ? ' on' : ''}`}
            onClick={() => onChange(it.key || undefined)}
          >
            <span>{it.label}</span>
            {it.count !== undefined && <b className="num">{it.count}</b>}
          </button>
        )
      })}
    </div>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="pager">
      <span className="sub">
        <span className="num">{from}</span>–<span className="num">{to}</span> من{' '}
        <span className="num">{total}</span>
      </span>
      <div className="pager-b">
        <button className="btn btn-2 btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          السابق
        </button>
        <span className="sub">
          صفحة <span className="num">{page}</span> من <span className="num">{pages}</span>
        </span>
        <button
          className="btn btn-2 btn-sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  )
}

/** تبديل بين عرض الكروت والجدول */
export function ViewToggle({
  view,
  onChange,
}: {
  view: 'cards' | 'table'
  onChange: (v: 'cards' | 'table') => void
}) {
  return (
    <div className="vtog" role="group" aria-label="طريقة العرض">
      <button
        className={view === 'cards' ? 'on' : ''}
        onClick={() => onChange('cards')}
        aria-pressed={view === 'cards'}
        title="كروت"
      >
        <Icon path={icons.grid} size={16} />
      </button>
      <button
        className={view === 'table' ? 'on' : ''}
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        title="جدول"
      >
        <Icon path={icons.rows} size={16} />
      </button>
    </div>
  )
}
