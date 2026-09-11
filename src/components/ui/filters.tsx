import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useMenu } from '@/hooks/useMenu'
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
      <Icon name={icons.search} size={17} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button className="srch-x" onClick={() => onChange('')} aria-label="مسح البحث">
          <Icon name={icons.close} size={15} />
        </button>
      )}
    </label>
  )
}

/* ═══════════════════════════════════════════════════════════
   القائمة المنسدلة — **سلوك واحد مكتوب مرة واحدة**.

   قبل كده كان في نمطان في السيستم: `Select` بـ`<select>` أصلية،
   و`MultiSelect` بلوحة مرسومة. يعني في **نفس شريط الأدوات**،
   المستخدم بيضغط حقلين شكلهم واحد فبيفتحوا حاجتين مختلفين:
   واحدة قايمة النظام (خطّ النظام ولونه وسلوكه — وفي الويندوز
   شكل تالت خالص)، وواحدة لوحة زجاج بحافة شعرية.

   الهوك ده هو السلوك المشترك: يقفل بالضغط برّه أو بـEsc.
   والاتنين دلوقتي بيرسموا `.fsel-b` و`.fmenu` نفسهم.
   ═══════════════════════════════════════════════════════════ */

/** خيار القائمة — نص بسيط، أو قيمة وعنوان لما العنوان يحمل عدّادًا */
export type SelectOption = string | { value: string; label: string }

const optValue = (o: SelectOption): string => (typeof o === 'string' ? o : o.value)
const optLabel = (o: SelectOption): string => (typeof o === 'string' ? o : o.label)

export interface SelectProps {
  label?: string
  value?: string
  options: readonly SelectOption[]
  onChange: (v: string | undefined) => void
  /** النص اللي يظهر لما مفيش اختيار */
  all?: string
  disabled?: boolean
  /** يخلّي الحقل واخد عرض السطر كله في الشبكة */
  wide?: boolean
  /** أيقونة جوّه الحقل — بتغني عن عنوان فوقه في شريط الأدوات */
  icon?: LucideIcon
  /** الفلتر بيحتاج «الكل»؛ المبدّل اللي قيمته إلزامية لأ */
  allowEmpty?: boolean
  /** فوق العدد ده بيظهر صندوق بحث جوّه اللوحة */
  searchAt?: number
}

/**
 * قائمة اختيار واحد.
 *
 * كانت `<select>` أصلية. المشكلة مش شكلها بس: قايمتها بترسمها
 * **نظام التشغيل** — خطّها وخلفيتها وطريقة فتحها كلها برّه
 * السيستم، وفي الثيم الغامق بتفتح صندوقًا رماديًّا بخطّ لاتيني
 * وسط واجهة زجاج عربية. وبتتصرّف مختلف على كل نظام.
 *
 * دلوقتي هي `MultiSelect` بقيد واحد: خيار واحد، والضغط بيقفل.
 * فالحقلين في شريط الأدوات بيفتحوا **نفس اللوحة**.
 *
 * `all` لسّه موجود لأن الفلتر محتاج «الكل»؛ لو `allowEmpty`
 * قفلت، الخيار الفاضي ما بيظهرش — ده حال مبدّل الدورة في
 * الميزانية: الدورة **دايمًا** مختارة.
 */
export function Select({
  label, value, options, onChange, all = 'الكل', disabled, wide, icon,
  allowEmpty = true, searchAt = 9,
}: SelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [needle, setNeedle] = useState('')
  const id = useId()

  useEffect(() => { if (!open) setNeedle('') }, [open])

  const current = options.find((o) => optValue(o) === value)
  const summary = current ? optLabel(current) : all
  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  const pick = (v: string | undefined) => { onChange(v); setOpen(false) }

  return (
    <div className={`fsel${value ? ' on' : ''}${disabled ? ' off' : ''}${wide ? ' wide' : ''}`} ref={box}>
      {label && <span className="fsel-l" id={`${id}-l`}>{label}</span>}

      <button
        type="button"
        className="fsel-b"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-b` : undefined}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {icon && <Icon name={icon} size={15} />}
        <span className="fmulti-s">{summary}</span>
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
            {allowEmpty && !needle && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`fopt${!value ? ' on' : ''}`}
                onClick={() => pick(undefined)}
              >
                <span className="fopt-x" aria-hidden="true">
                  {!value && <Icon name={icons.check} size={12} />}
                </span>
                <span className="fopt-t">{all}</span>
              </button>
            )}
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
                  onClick={() => pick(val)}
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
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   قائمة متعددة الاختيار.

   `<select multiple>` الأصلية مرفوضة هنا: بتاخد ارتفاع صفوفها كله
   في الشبكة، وبتطلب Ctrl+كليك عشان تختار اتنين — سلوك نص المستخدمين
   ما يعرفوش. البديل زرار بيفتح لوحة فيها صندوق لكل خيار: الاختيار
   بضغطة، والمختار بيفضل باين في عنوان الزرار.

   والقائمة بتقفل بالضغط برّه أو بـEsc، مش بزرار «تم» — الفلتر بيسري
   لحظة الضغط، فمفيش حاجة تتأكَّد.
   ═══════════════════════════════════════════════════════════ */

export interface MultiSelectProps {
  label?: string
  values: string[]
  options: readonly SelectOption[]
  onChange: (v: string[]) => void
  /** النص اللي يظهر لما مفيش اختيار */
  all?: string
  disabled?: boolean
  wide?: boolean
  icon?: LucideIcon
  /** فوق العدد ده بيظهر صندوق بحث جوّه اللوحة */
  searchAt?: number
}

export function MultiSelect({
  label, values, options, onChange, all = 'الكل', disabled, wide, icon, searchAt = 9,
}: MultiSelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [needle, setNeedle] = useState('')
  const id = useId()

  useEffect(() => { if (!open) setNeedle('') }, [open])

  const on = values.length > 0
  const labelOf = (val: string) =>
    optLabel(options.find((o) => optValue(o) === val) ?? val)

  /* عنوان الزرار: الاسم لو واحد، والاسم و«+2» لو أكتر. عرض الأسماء
     كلها بيمدّ الزرار لحد ما الصفّ يتكسر، وشارة عدد جنبه بتكرّر نفس
     المعلومة مرتين. */
  const summary = !on
    ? all
    : values.length === 1
      ? labelOf(values[0])
      : `${labelOf(values[0])} +${values.length - 1}`

  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((x) => x !== val) : [...values, val])

  return (
    <div className={`fsel fmulti${on ? ' on' : ''}${disabled ? ' off' : ''}${wide ? ' wide' : ''}`} ref={box}>
      {label && <span className="fsel-l" id={`${id}-l`}>{label}</span>}

      <button
        type="button"
        className="fsel-b"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-l ${id}-b` : undefined}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {icon && <Icon name={icon} size={15} />}
        <span className="fmulti-s">{summary}</span>
        <Icon name={icons.chevronDown} size={15} />
      </button>

      {open && (
        <div className="fmenu">
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

          <div className="fmenu-l" role="listbox" aria-multiselectable="true">
            {shown.length === 0 && <div className="fmenu-e sub">لا نتائج</div>}
            {shown.map((o) => {
              const val = optValue(o)
              const sel = values.includes(val)
              return (
                <button
                  type="button"
                  key={val}
                  role="option"
                  aria-selected={sel}
                  className={`fopt${sel ? ' on' : ''}`}
                  onClick={() => toggle(val)}
                >
                  <span className="fopt-x" aria-hidden="true">
                    {sel && <Icon name={icons.check} size={12} />}
                  </span>
                  <span className="fopt-t">{optLabel(o)}</span>
                </button>
              )
            })}
          </div>

          {on && (
            <div className="fmenu-f">
              <button type="button" className="fclear" onClick={() => onChange([])}>
                مسح الاختيار
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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

/* ═══════════════════════════════════════════════════════════
   عدد الصفوف في الصفحة.

   قائمة جاهزة **ومعاها كتابة حرّة**: المستخدم اللي بيراجع دفعة
   معيّنة عارف إنها 63 صفًّا وعايزها في صفحة واحدة، والقائمة المقفولة
   بتخلّيه يقلّب على صفحتين بلا سبب. الرقم بيتقيّد بحدّ أعلى عشان
   كتابة 99999 ما تجمّدش الشاشة.
   ═══════════════════════════════════════════════════════════ */

export const PAGE_SIZES = [25, 50, 75, 100] as const
const SIZE_MAX = 500

export function PageSize({
  value,
  onChange,
  options = PAGE_SIZES,
}: {
  value: number
  onChange: (n: number) => void
  options?: readonly number[]
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  /* التثبيت عند Enter أو الخروج من الحقل، لا مع كل حرف: اللي بيكتب
     «100» بيمرّ على «1» و«10» في الطريق، وإعادة الاستعلام عندهم
     بتقلّب الشاشة مرتين بلا داعٍ. */
  const commit = () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || n < 1) return setDraft(String(value))
    const next = Math.min(SIZE_MAX, n)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <div className="psize" ref={box}>
      <span className="sub">عرض</span>
      <div className="psize-b">
        <input
          value={draft}
          inputMode="numeric"
          className="num"
          aria-label="عدد الصفوف في الصفحة"
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Escape') setDraft(String(value))
          }}
        />
        <button
          type="button"
          className="psize-x"
          aria-label="اختر من القائمة"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={icons.chevronDown} size={14} />
        </button>

        {open && (
          <div className="fmenu one up psize-m" role="listbox">
            {options.map((n) => (
              <button
                type="button"
                key={n}
                role="option"
                aria-selected={n === value}
                className={`fopt${n === value ? ' on' : ''}`}
                onClick={() => { setOpen(false); if (n !== value) onChange(n) }}
              >
                {/* نفس صفّ الخيار في أي قائمة تانية: علامة على
                    المختار ومساحة محجوزة على الباقي. كانت الأرقام
                    متراكزة بلا علامة — شكل رابع لنفس الصفّ. */}
                <span className="fopt-x" aria-hidden="true">
                  {n === value && <Icon name={icons.check} size={12} />}
                </span>
                <span className="fopt-t num">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="sub">صفًّا</span>
    </div>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  /** لما تتبعت، مقياس الصفحة بيظهر جنب الترقيم */
  onPageSize?: (n: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="pager">
      {/* العدّاد ومقياس الصفحة مع بعض: الاتنين بيتكلّموا عن الكمّ،
          وأزرار التنقّل بتتكلّم عن الموضع. */}
      <div className="pager-c">
        <span className="sub">
          <span className="num">{from}</span>–<span className="num">{to}</span> من{' '}
          <span className="num">{total}</span>
        </span>
        {onPageSize && <PageSize value={pageSize} onChange={onPageSize} />}
      </div>
      {/* أرقام لا جملة، وسهمان لا كلمتان.
          «صفحة ١ من ٢» بتقول موضعك بس وما بتوصّلكش: عايز التالتة
          تدوس «التالي» مرتين. الأرقام هي الأزرار نفسها، فالانتقال
          دوسة واحدة والموضع بيتقري من الرقم المضيء — والسهمان
          للخطوة الواحدة، واتجاههما اتجاه القراءة: الرجوع لليمين. */}
      <nav className="pager-b" aria-label="صفحات النتائج">
        <button
          className="pgnav"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="الصفحة السابقة"
          title="السابق"
        >
          <Icon name={icons.chevronBack} size={16} />
        </button>

        <div className="pgnums">
          {pageWindow(page, pages).map((n, i) =>
            n === '…' ? (
              <span className="pggap" key={`gap-${i}`} aria-hidden="true">…</span>
            ) : (
              <button
                key={n}
                className={`pgn num${n === page ? ' on' : ''}`}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`صفحة ${n}`}
                onClick={() => n !== page && onPage(n)}
              >
                {n}
              </button>
            ),
          )}
        </div>

        <button
          className="pgnav"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="الصفحة التالية"
          title="التالي"
        >
          <Icon name={icons.chevron} size={16} />
        </button>
      </nav>
    </div>
  )
}

/**
 * الأرقام اللي تتعرض: الأولى والأخيرة دايمًا، والحالية وجارتيها،
 * والباقي نقط. من غير النافذة دي، قائمة فيها ٤٠ صفحة بتلفّ سطرين
 * وبتاخد مساحة أكتر من النتيجة نفسها.
 */
function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)

  const out: (number | '…')[] = [1]
  const from = Math.max(2, Math.min(page - 1, pages - 3))
  const to = Math.min(pages - 1, Math.max(page + 1, 4))
  if (from > 2) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pages - 1) out.push('…')
  out.push(pages)
  return out
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
        <Icon name={icons.grid} size={16} />
      </button>
      <button
        className={view === 'table' ? 'on' : ''}
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        title="جدول"
      >
        <Icon name={icons.rows} size={16} />
      </button>
    </div>
  )
}
