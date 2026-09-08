/* eslint-disable react-refresh/only-export-components --
   الملف ده بيانات لا كومبوننتس: `COLS` جدول تعريف، وخلاياه دوال
   بترجّع JSX. القاعدة بتحذّر لأن الملف `.tsx` وبيصدّر ثوابت، وتقسيمه
   لملفين (بيانات + خلايا) بيفصل العمود عن تعريفه — وده بالظبط اللي
   الملف موجود عشان يمنعه. */
import { Link } from 'react-router-dom'
import { Mono, Riyal, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf, projectCode } from '@/lib/format'
import { days, groupTone } from '@/lib/tone'
import { stagePressure } from '@/data/repository'
import type { ProjectRow } from '@/types/domain'
import type { ReactNode } from 'react'

/* ═══════════════════════════════════════════════════════════
   تعريف أعمدة جدول المشاريع — مصدر واحد لأربع حاجات.

   الجدول والإجماليات والتصدير والتجميع كلهم بيقرأوا من هنا. لو كل
   واحد فيهم عرّف أعمدته لوحده، أول عمود يتزوّد هيظهر في واحد ويغيب
   عن التلاتة، والتصدير هيطلع مختلفًا عن اللي على الشاشة — وده أسوأ
   من غياب التصدير أصلًا.

   ولكل عمود `text` جنب `cell`: الخلية فيها روابط وشارات، والملف
   المصدَّر محتاج نصًّا صافيًا. الاتنين جنب بعض عشان ما يفرقوش.
   ═══════════════════════════════════════════════════════════ */

/** طريقة تلخيص العمود في صف الإجماليات */
export type Agg = 'sum' | 'avg'

export interface Col {
  key: string
  label: string
  /** عمود رقمي — بيتحاذي لليسار وبياخد أرقامًا جدولية */
  n?: boolean
  /** ما يتشالش من المنتقي: بدونه الصف بيفقد هويته */
  fixed?: boolean
  /** ظاهر افتراضيًا */
  def?: boolean
  cell: (r: ProjectRow) => ReactNode
  /** نص صافٍ للتصدير والصورة */
  text: (r: ProjectRow) => string
  /** الرقم اللي بيتجمّع — غيابه معناه خانة فاضية في الإجماليات */
  value?: (r: ProjectRow) => number
  agg?: Agg
  /** الإجمالي بالريال */
  money?: boolean
}

const sum = (rows: ProjectRow[], f: (r: ProjectRow) => number) => rows.reduce((s, r) => s + f(r), 0)

/** إجمالي العمود على مجموعة صفوف — `null` يعني العمود ما يتلخّصش */
export const aggregate = (col: Col, rows: ProjectRow[]): number | null => {
  if (!col.value || !col.agg || rows.length === 0) return null
  const total = sum(rows, col.value)
  return col.agg === 'avg' ? Math.round(total / rows.length) : total
}

export const COLS: Col[] = [
  {
    key: 'code',
    label: 'الكود',
    fixed: true,
    cell: (r) => <Mono>{projectCode(r.id, r.year)}</Mono>,
    text: (r) => projectCode(r.id, r.year),
  },
  {
    key: 'name',
    label: 'المشروع',
    fixed: true,
    cell: (r) => <Link to={ROUTES.project(r.id)} className="tlink">{r.name}</Link>,
    text: (r) => r.name,
  },
  {
    key: 'entity',
    label: 'الجهة',
    def: true,
    cell: (r) => <Link to={ROUTES.entity(r.entityId)} className="tlink sub">{r.entityName}</Link>,
    text: (r) => r.entityName,
  },
  { key: 'region', label: 'المنطقة', def: true, cell: (r) => <span className="sub">{r.region}</span>, text: (r) => r.region },
  { key: 'city', label: 'المدينة', cell: (r) => <span className="sub">{r.city}</span>, text: (r) => r.city },
  { key: 'track', label: 'المسار', cell: (r) => r.track, text: (r) => r.track },
  { key: 'field', label: 'المجال', cell: (r) => r.field, text: (r) => r.field },
  { key: 'goal', label: 'الهدف', cell: (r) => <span className="sub">{r.goal}</span>, text: (r) => r.goal },
  { key: 'stage', label: 'القسم الإجرائي', def: true, cell: (r) => r.stage, text: (r) => r.stage },
  {
    key: 'dur',
    label: 'المدة',
    def: true,
    n: true,
    /* النقطة جنب الرقم هي كل الفرق: من غيرها المستخدم لازم يحسب
       المكوث مقابل الحدّ في دماغه لكل صف. */
    cell: (r) => (
      <>
        {r.stageLimit > 0 ? days(r.hoursInStage) : '—'}
        {stagePressure(r) > 1 && <span className="dotmark" title="فوق الحدّ" />}
      </>
    ),
    text: (r) => (r.stageLimit > 0 ? String(Math.round(r.hoursInStage / 24)) : '—'),
    value: (r) => Math.round(r.hoursInStage / 24),
    agg: 'avg',
  },
  {
    key: 'requested',
    label: 'المبلغ المطلوب',
    def: true,
    n: true,
    cell: (r) => <>{nf.format(r.amountRequested)} <Riyal /></>,
    text: (r) => String(r.amountRequested),
    value: (r) => r.amountRequested,
    agg: 'sum',
    money: true,
  },
  {
    key: 'granted',
    label: 'المعتمد',
    def: true,
    n: true,
    cell: (r) => (r.amountGranted > 0 ? <>{nf.format(r.amountGranted)} <Riyal /></> : <span className="sub">—</span>),
    text: (r) => (r.amountGranted > 0 ? String(r.amountGranted) : ''),
    value: (r) => r.amountGranted,
    agg: 'sum',
    money: true,
  },
  {
    key: 'spent',
    label: 'المصروف',
    n: true,
    cell: (r) => (r.amountSpent > 0 ? <>{nf.format(r.amountSpent)} <Riyal /></> : <span className="sub">—</span>),
    text: (r) => (r.amountSpent > 0 ? String(r.amountSpent) : ''),
    value: (r) => r.amountSpent,
    agg: 'sum',
    money: true,
  },
  { key: 'weight', label: 'الوزن', def: true, n: true, cell: (r) => r.weight, text: (r) => String(r.weight), value: (r) => r.weight, agg: 'avg' },
  { key: 'score', label: 'التقييم', n: true, cell: (r) => r.score, text: (r) => String(r.score), value: (r) => r.score, agg: 'avg' },
  {
    key: 'benef',
    label: 'المستفيدون',
    n: true,
    cell: (r) => nf.format(r.beneficiaries),
    text: (r) => String(r.beneficiaries),
    value: (r) => r.beneficiaries,
    agg: 'sum',
  },
  { key: 'owner', label: 'المالك', def: true, cell: (r) => <span className="sub">{r.owner ?? '—'}</span>, text: (r) => r.owner ?? '' },
  {
    key: 'status',
    label: 'الحالة',
    def: true,
    cell: (r) => <Tag tone={groupTone(r.statusGroup)}>{r.statusGroup}</Tag>,
    text: (r) => r.statusGroup,
  },
  { key: 'method', label: 'أسلوب المنح', cell: (r) => <span className="sub">{r.grantMethod}</span>, text: (r) => r.grantMethod },
  { key: 'support', label: 'حالة الدعم', cell: (r) => r.supportStatus ?? <span className="sub">—</span>, text: (r) => r.supportStatus ?? '' },
  { key: 'submitted', label: 'تاريخ التقديم', cell: (r) => <span className="sub num">{r.submittedAt}</span>, text: (r) => r.submittedAt },
  { key: 'year', label: 'السنة والمصدر', cell: (r) => <span className="sub num">{r.year}</span>, text: (r) => r.year },
]

export const colByKey = (key: string): Col | undefined => COLS.find((c) => c.key === key)

export const DEFAULT_COLS: string[] = COLS.filter((c) => c.fixed || c.def).map((c) => c.key)

/**
 * الأعمدة المختارة تفضيل شخصي لا فلتر.
 *
 * فالمكان بتاعها التخزين المحلي مش الـURL: الرابط اللي بيتبعت لمدير
 * المنح المفروض ينقل **السؤال** (الفلتر والتجميع)، مش شكل جدول
 * المرسِل. ولو حصل إن العميل طلب مشاركة العرض كمان، المفتاح ده
 * بيتحوّل لبارامتر واحد من غير ما يتغيّر أي حاجة تانية.
 */
const COLS_KEY = 'ab-cols-projects'

export const readCols = (): string[] => {
  try {
    const raw = localStorage.getItem(COLS_KEY)
    if (!raw) return DEFAULT_COLS
    const keys = JSON.parse(raw) as unknown
    if (!Array.isArray(keys)) return DEFAULT_COLS
    const valid = keys.filter((k): k is string => typeof k === 'string' && Boolean(colByKey(k)))
    /* الثوابت بتترجع حتى لو التخزين قديم وما فيهوش — العمود الثابت
       جزء من هوية الصف لا اختيار. */
    const fixed = COLS.filter((c) => c.fixed).map((c) => c.key)
    return valid.length ? [...new Set([...fixed, ...valid])] : DEFAULT_COLS
  } catch {
    return DEFAULT_COLS
  }
}

export const writeCols = (keys: string[]): void => {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify(keys))
  } catch {
    /* التخزين ممكن يكون مقفول — الاختيار يفضل للجلسة دي */
  }
}

/** الأعمدة بالترتيب المعرَّف هنا لا بترتيب الاختيار */
export const orderCols = (keys: string[]): Col[] => COLS.filter((c) => keys.includes(c.key))

/* ═══════════════════ التجميع ═══════════════════ */

export interface GroupBy {
  key: string
  label: string
  of: (r: ProjectRow) => string
}

export const GROUPS: GroupBy[] = [
  { key: 'region', label: 'المنطقة', of: (r) => r.region },
  { key: 'city', label: 'المدينة', of: (r) => r.city },
  { key: 'track', label: 'المسار', of: (r) => r.track },
  { key: 'field', label: 'المجال', of: (r) => r.field },
  { key: 'stage', label: 'القسم الإجرائي', of: (r) => r.stage },
  { key: 'status', label: 'الحالة', of: (r) => r.statusGroup },
  { key: 'owner', label: 'المالك', of: (r) => r.owner ?? 'بلا مالك' },
  { key: 'entity', label: 'الجهة', of: (r) => r.entityName },
  { key: 'year', label: 'السنة والمصدر', of: (r) => r.year },
]

export const groupByKey = (key: string | undefined): GroupBy | undefined =>
  GROUPS.find((g) => g.key === key)

export interface Group {
  key: string
  rows: ProjectRow[]
}

/**
 * تقسيم الصفوف لمجموعات، مرتّبة بالأكبر أولًا.
 *
 * الترتيب بالحجم لا بالأبجدية: المستخدم اللي بيجمّع حسب المنطقة
 * بيسأل «فين تركّز المنح؟»، والإجابة هي أول مجموعة.
 */
export const splitGroups = (rows: ProjectRow[], by: GroupBy): Group[] => {
  const map = new Map<string, ProjectRow[]>()
  for (const r of rows) {
    const k = by.of(r) || '—'
    const bucket = map.get(k)
    if (bucket) bucket.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()]
    .map(([key, rs]) => ({ key, rows: rs }))
    .sort((a, b) => b.rows.length - a.rows.length)
}
