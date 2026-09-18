import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { MenuOpt, MenuPanel, useMenuSearch } from './menu'
import { Tabs } from './primitives'
import { Face } from './Person'
import { Icon } from './Icon'
import { icons } from './icons'

/* ═══════════════════════════════════════════════════════════
   عناصر القوائم · بحث وفلاتر وشرائح وترقيم.

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
   القائمة المنسدلة · **سلوك واحد مكتوب مرة واحدة**.

   قبل كده كان في نمطان في السيستم: `Select` بـ`<select>` أصلية،
   و`MultiSelect` بلوحة مرسومة. يعني في **نفس شريط الأدوات**،
   المستخدم بيضغط حقلين شكلهم واحد فبيفتحوا حاجتين مختلفين:
   واحدة قايمة النظام (خطّ النظام ولونه وسلوكه · وفي الويندوز
   شكل تالت خالص)، وواحدة لوحة زجاج بحافة شعرية.

   الهوك ده هو السلوك المشترك: يقفل بالضغط برّه أو بـEsc.
   والاتنين دلوقتي بيرسموا `.fsel-b` و`.fmenu` نفسهم.
   ═══════════════════════════════════════════════════════════ */

/** خيار القائمة · نص بسيط، أو قيمة وعنوان لما العنوان يحمل عدّادًا */
export type SelectOption = string | { value: string; label: string }

export const optValue = (o: SelectOption): string => (typeof o === 'string' ? o : o.value)
export const optLabel = (o: SelectOption): string => (typeof o === 'string' ? o : o.label)

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
  /** أيقونة جوّه الحقل · بتغني عن عنوان فوقه في شريط الأدوات */
  icon?: LucideIcon
  /** الفلتر بيحتاج «الكل»؛ المبدّل اللي قيمته إلزامية لأ */
  allowEmpty?: boolean
  /** فوق العدد ده بيظهر صندوق بحث جوّه اللوحة */
  searchAt?: number
  /**
   * خيارات الفلتر دي **أشخاص** · كل خيار بياخد وشّه.
   *
   * ⚠️ **خاصية لا استنتاج.** الإغراء إن الكمبوننت يشوف إن الخيار
   * اسم شخص ويحطّ وشًّا لوحده — والغلط إن «الرياض» و«أحمد» نصّان
   * لا فرق بينهم برّه السياق، والاستنتاج بيغلط في الطرفين: مدينة
   * بتاخد أفاتار، وشخص جديد بلا سجلّ ما بياخدش. الشاشة اللي
   * بتعرف إن العمود ده مالك هي اللي بتقول.
   */
  people?: boolean
}

/**
 * قائمة اختيار واحد.
 *
 * كانت `<select>` أصلية. المشكلة مش شكلها بس: قايمتها بترسمها
 * **نظام التشغيل** · خطّها وخلفيتها وطريقة فتحها كلها برّه
 * السيستم، وفي الثيم الغامق بتفتح صندوقًا رماديًّا بخطّ لاتيني
 * وسط واجهة زجاج عربية. وبتتصرّف مختلف على كل نظام.
 *
 * دلوقتي هي `MultiSelect` بقيد واحد: خيار واحد، والضغط بيقفل.
 * فالحقلين في شريط الأدوات بيفتحوا **نفس اللوحة**.
 *
 * `all` لسّه موجود لأن الفلتر محتاج «الكل»؛ لو `allowEmpty`
 * قفلت، الخيار الفاضي ما بيظهرش · ده حال مبدّل الدورة في
 * الميزانية: الدورة **دايمًا** مختارة.
 */
export function Select({
  label, value, options, onChange, all = 'الكل', disabled, wide, icon,
  allowEmpty = true, searchAt = 9, people,
}: SelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

  const current = options.find((o) => optValue(o) === value)
  const summary = current ? optLabel(current) : all
  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  const pick = (v: string | undefined) => { onChange(v); setOpen(false) }

  return (
    /* ⚠️ **الحالة المفعَّلة = المستخدم اختار، مش الحقل له قيمة.**
       كانت `value ? 'on' : ''`، والترتيب بيتبعتله قيمة افتراضية
       دايمًا (`v.sort ?? 'waiting'`) · فالحقل كان **دايمًا مفعَّلًا**
       وياخد حافة `--edge-i` الخضرا، وجنبه «كل الحالات» بحافة
       `--fld-line` المحايدة. حافتان مختلفتان في صفّ واحد لنفس
       الكمبوننت، وواحدة منهم بتقول «فيه فلتر شغّال» وهي كدّابة.

       و`current` هو المعيار الصح: القيمة الافتراضية مش من
       `options` (هي نصّ `all`)، فـ`current` بتبقى `undefined`
       والحقل بيفضل محايدًا · زي `MultiSelect` بالظبط اللي بيقيس
       `values.length > 0`.

       ⚠️ **و`allowEmpty` شرط تاني، وده اللي كان ناقص.** الحقل اللي
       `allowEmpty={false}` (دورة الميزانية · فترة التقرير) **عمره
       ما بيفضى** — فـ`current` دايمًا موجودة وكان بيتعلّم مفعَّلًا
       طول الوقت. و«مفعَّل» معناها «المستخدم ضيّق النتيجة»، وهي
       كدّابة على حقل مالوش حالة فاضية أصلًا. العميل شافها: خلفية
       الترتيب مختلفة عن جيرانها في نفس الصفّ. */
    <div className={`fsel${current && allowEmpty ? ' on' : ''}${disabled ? ' off' : ''}${wide ? ' wide' : ''}`} ref={box}>
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
        {/* ⚠️ **الوش بيحلّ محلّ الأيقونة، ما بيزوّدش عليها.** أيقونة
            «مستخدمين» بتقول «الفلتر ده أشخاص»، والوش بيقول **مين** —
            فوجودهم سوا بيكرّر نصف المعلومة. والخانة بعرض ثابت عشان
            اختيار شخص ما يزحزحش شريط الأدوات كله. */}
        {people
          ? <span className="fsel-face">{current ? <Face name={optValue(current)} /> : icon && <Icon name={icon} size={15} />}</span>
          : icon && <Icon name={icon} size={15} />}
        {/* The ghosts reserve the widest option's width, so picking
            a value never resizes the control (see `.fsel-sz`). */}
        <span className="fmulti-s fsel-sz">
          <span>{summary}</span>
          {allowEmpty && <span aria-hidden="true">{all}</span>}
          {options.map((o) => (
            <span key={`sz-${optValue(o)}`} aria-hidden="true">{optLabel(o)}</span>
          ))}
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
          <>
            {allowEmpty && !needle && (
              <MenuOpt
                on={!value}
                onPick={() => pick(undefined)}
                /* ⚠️ «الكل» مش شخص فمالوش وش — **لكن له خانته**.
                   من غير الفراغ ده اسمه بيبدأ ٢٨px يمين باقي
                   الأسماء، فالقايمة بتتقرا مسنّنة. */
                lead={people ? <span className="prs-gap" aria-hidden="true" /> : undefined}
              >
                {all}
              </MenuOpt>
            )}
            {shown.map((o) => {
              const val = optValue(o)
              return (
                <MenuOpt
                  key={val}
                  on={val === value}
                  onPick={() => pick(val)}
                  lead={people ? <Face name={val} /> : undefined}
                >
                  {optLabel(o)}
                </MenuOpt>
              )
            })}
          </>
        </MenuPanel>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   قائمة متعددة الاختيار.

   `<select multiple>` الأصلية مرفوضة هنا: بتاخد ارتفاع صفوفها كله
   في الشبكة، وبتطلب Ctrl+كليك عشان تختار اتنين · سلوك نص المستخدمين
   ما يعرفوش. البديل زرار بيفتح لوحة فيها صندوق لكل خيار: الاختيار
   بضغطة، والمختار بيفضل باين في عنوان الزرار.

   والقائمة بتقفل بالضغط برّه أو بـEsc، مش بزرار «تم» · الفلتر بيسري
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
  /**
   * خيارات الفلتر دي **أشخاص** · كل خيار بياخد وشّه.
   *
   * ⚠️ **خاصية لا استنتاج.** الإغراء إن الكمبوننت يشوف إن الخيار
   * اسم شخص ويحطّ وشًّا لوحده — والغلط إن «الرياض» و«أحمد» نصّان
   * لا فرق بينهم برّه السياق، والاستنتاج بيغلط في الطرفين: مدينة
   * بتاخد أفاتار، وشخص جديد بلا سجلّ ما بياخدش. الشاشة اللي
   * بتعرف إن العمود ده مالك هي اللي بتقول.
   */
  people?: boolean
}

export function MultiSelect({
  label, values, options, onChange, all = 'الكل', disabled, wide, icon, searchAt = 9, people,
}: MultiSelectProps) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

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
        {/* ⚠️ **الوش بيتبع الاسم المعروض، مش عدد المختارين.** كان
            شرطه `values.length === 1`، فلمّا تختار اتنين العنوان
            بيقول «عمر قاسم +1» والخانة جنبه **بتفضل فاضية** — فراغ
            ٢٨px في وش المستخدم بلا سبب. العنوان بيعرض أول اسم في
            الحالتين، فالوش بيعرض وشّه في الحالتين. */}
        {people
          ? <span className="fsel-face">{values.length ? <Face name={values[0]} /> : icon && <Icon name={icon} size={15} />}</span>
          : icon && <Icon name={icon} size={15} />}
        {/* Same ghosts as `Select`: the widest label the button can
            ever show, so toggling a value never resizes the row.
            `+N` is measured on the widest label, since that is the
            longest form the summary takes. */}
        <span className="fmulti-s fsel-sz">
          <span>{summary}</span>
          <span aria-hidden="true">{all}</span>
          {options.map((o) => (
            <span key={`sz-${optValue(o)}`} aria-hidden="true">
              {optLabel(o)}{options.length > 1 ? ` +${options.length - 1}` : ''}
            </span>
          ))}
        </span>
        <Icon name={icons.chevronDown} size={15} />
      </button>

      {open && (
        <MenuPanel
          search={search}
          needle={needle}
          onNeedle={setNeedle}
          empty={shown.length === 0}
          foot={on ? (
            <button type="button" className="fclear" onClick={() => onChange([])}>
              مسح الاختيار
            </button>
          ) : undefined}
        >
          {shown.map((o) => {
            const val = optValue(o)
            return (
              <MenuOpt
                key={val}
                on={values.includes(val)}
                onPick={() => toggle(val)}
                lead={people ? <Face name={val} /> : undefined}
              >
                {optLabel(o)}
              </MenuOpt>
            )
          })}
        </MenuPanel>
      )}
    </div>
  )
}

/** شريحة تبديل · فلتر منطقي واحد بضغطة */
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

/**
 * شرائح الحالة · **هي `Tabs` بعدّاد، مش نوع تاني**.
 *
 * كانت بتعلن `role="tablist"` زي التبويب بالظبط، وبترسم `.fseg`
 * بدل `.tab` · فنفس الفعل طلع بشكلين على نفس الشاشة. الفرق
 * الحقيقي الوحيد إن مفتاحها ممكن يكون فاضي («الكل»)، وده فرق في
 * الداتا لا في الشكل.
 */
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
    <Tabs
      items={items.map((it) => ({ slug: it.key, label: it.label, count: it.count }))}
      active={active ?? ''}
      onChange={(slug) => onChange(slug || undefined)}
    />
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

        {/* نفس صفّ الخيار في أي قائمة تانية: علامة على المختار
            ومساحة محجوزة على الباقي. كانت الأرقام متراكزة بلا
            علامة · شكل رابع لنفس الصفّ. */}
        {open && (
          <MenuPanel one up extra="psize-m">
            {options.map((n) => (
              <MenuOpt
                key={n}
                on={n === value}
                onPick={() => { setOpen(false); if (n !== value) onChange(n) }}
                textClass="num"
              >
                {n}
              </MenuOpt>
            ))}
          </MenuPanel>
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
          دوسة واحدة والموضع بيتقري من الرقم المضيء · والسهمان
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

/* ═══════════════════════════════════════════════════════════
   منتقي التجميع · ي-1 و ي-2

   ⚠️ **ليه مش `MultiSelect`؟** لأن `MultiSelect` بيقول «إيه
   المختار»، والتجميع بيحتاج «إيه المختار **وبأي ترتيب**». الترتيب
   هنا مش تفضيل عرض، هو **السؤال نفسه**:

     منطقة ← جهة   «في الرياض، مين بياخد؟»
     جهة ← منطقة   «جمعية البناء العلمي، بتشتغل فين؟»

   نفس البُعدين ونفس الصفوف وسؤالان مختلفان · فـ«المنطقة +1» في
   عنوان `MultiSelect` كان هيخفي اللي المستخدم محتاج يشوفه بالظبط.

   عشان كده: الرقم بيحلّ محلّ علامة الصحّ في القايمة (١ · ٢ · ٣)،
   والعنوان بيعرض السلسلة بسهم، والاختيار **بترتيب الضغط** لا
   بترتيب القايمة.
   ═══════════════════════════════════════════════════════════ */
export function GroupPicker({
  value, options, onChange, max = 3, icon,
}: {
  /** المفاتيح مفصولة بفاصلة · بترتيب الهرم */
  value: string | undefined
  options: { value: string; label: string }[]
  onChange: (v: string | undefined) => void
  /** سقف مستويات التداخل */
  max?: number
  icon?: LucideIcon
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const id = useId()

  const chain = (value ?? '').split(',').filter(Boolean)
    .filter((k) => options.some((o) => o.value === k))
    .slice(0, max)

  const labelOf = (k: string) => options.find((o) => o.value === k)?.label ?? k
  const full = chain.length >= max

  const emit = (next: string[]) => onChange(next.length ? next.join(',') : undefined)

  const toggle = (k: string) => {
    if (chain.includes(k)) emit(chain.filter((x) => x !== k))
    else if (!full) emit([...chain, k])
  }

  return (
    <div className={`fsel fgrp${chain.length ? ' on' : ''}`} ref={box}>
      <button
        type="button"
        className="fsel-b"
        aria-haspopup="listbox"
        aria-expanded={open}
        id={`${id}-b`}
        onClick={() => setOpen((x) => !x)}
      >
        {icon && <Icon name={icon} size={15} />}
        <span className="fgrp-s">
          {chain.length === 0
            ? 'بلا تجميع'
            : chain.map((k, i) => (
                <span key={k} className="fgrp-p">
                  {i > 0 && <Icon name={icons.chevron} size={12} />}
                  {labelOf(k)}
                </span>
              ))}
        </span>
        <Icon name={icons.chevronDown} size={15} />
      </button>

      {open && (
        <MenuPanel
          foot={
            <>
              {full && <span className="sub">السقف <span className="num">{max}</span> مستويات · تحتها المجموعة بتبقى صفًّا</span>}
              {chain.length > 0 && (
                <button type="button" className="fclear" onClick={() => onChange(undefined)}>
                  إلغاء التجميع
                </button>
              )}
            </>
          }
        >
          {options.map((o) => {
            const at = chain.indexOf(o.value)
            const sel = at >= 0
            return (
              /* ⚠️ **رقم لا علامة صحّ.** علامة الصحّ بتقول «مختار»،
                 والمستخدم محتاج يعرف **أب ولا ابن** · وده اللي
                 بيحدّد السؤال اللي الجدول بيجاوبه. */
              <MenuOpt
                key={o.value}
                on={sel}
                off={!sel && full}
                onPick={() => toggle(o.value)}
                title={sel ? `المستوى ${at + 1}` : full ? `السقف ${max} مستويات` : 'أضف مستوى'}
                mark={sel ? at + 1 : ''}
                markClass="num"
              >
                {o.label}
              </MenuOpt>
            )
          })}
        </MenuPanel>
      )}
    </div>
  )
}
