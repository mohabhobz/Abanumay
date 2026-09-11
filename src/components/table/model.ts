import type { ReactNode } from 'react'

/* ═══════════════════════════════════════════════════════════
   نموذج الجدول · عام لأي كيان.

   الكلاينت طلب إن **كل الجداول** في السيستم تمشي بنفس الطريقة:
   نفس اختيار عدد الصفوف، نفس التجميع، نفس منتقي الأعمدة، نفس
   التصدير. نسخ الجدول لكل موديول معناه إن أي تحسين لازم يتعمل
   خمس مرات، وإن الفروق بينهم هتزيد مع الوقت بدل ما تقل.

   فالتعريف هنا عام على `T`، وكل موديول بيكتب أعمدته بس.
   ═══════════════════════════════════════════════════════════ */

/** طريقة تلخيص العمود في صف الإجماليات */
export type Agg = 'sum' | 'avg'

export interface Col<T> {
  key: string
  label: string
  /** عمود رقمي · بيتحاذي لليسار وبياخد أرقامًا جدولية */
  n?: boolean
  /** ما يتشالش من المنتقي: بدونه الصف بيفقد هويته */
  fixed?: boolean
  /** ظاهر افتراضيًا */
  def?: boolean
  cell: (r: T) => ReactNode
  /** نص صافٍ للتصدير والصورة */
  text: (r: T) => string
  /** الرقم اللي بيتجمّع · غيابه معناه خانة فاضية في الإجماليات */
  value?: (r: T) => number
  agg?: Agg
  /** الإجمالي بالريال */
  money?: boolean
  /**
   * العرض الافتراضي بالبكسل.
   *
   * الجدول `table-layout:fixed` عشان القصّ يشتغل: في التخطيط
   * التلقائي العمود بيتمدّد لأطول محتوى فيه، فمفيش «أضيق من
   * المحتوى» أصلًا ولا حاجة تتقصّ. والثمن إن الأعمدة بتتقسم
   * بالتساوي لو ما حدّش قال عرضها · فالكود بياخد نفس عرض اسم
   * المشروع. فكل عمود بيقول عرضه هنا، والمتصفح بيقسّم الزيادة أو
   * النقصان عليهم بالتناسب.
   */
  w?: number
}

const sumOf = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0)

/** إجمالي العمود على مجموعة صفوف · `null` يعني العمود ما يتلخّصش */
export const aggregate = <T,>(col: Col<T>, rows: T[]): number | null => {
  if (!col.value || !col.agg || rows.length === 0) return null
  const total = sumOf(rows, col.value)
  return col.agg === 'avg' ? Math.round(total / rows.length) : total
}

export const defaultCols = <T,>(cols: Col<T>[]): string[] =>
  cols.filter((c) => c.fixed || c.def).map((c) => c.key)

/** الأعمدة بالترتيب المعرَّف في الموديول لا بترتيب الاختيار */
export const orderCols = <T,>(cols: Col<T>[], keys: string[]): Col<T>[] =>
  cols.filter((c) => keys.includes(c.key))

/* ═══════════════════ تفضيل الأعمدة ═══════════════════ */

/**
 * الأعمدة المختارة تفضيل شخصي لا فلتر.
 *
 * فمكانها التخزين المحلي مش الـURL: الرابط اللي بيتبعت لمدير المنح
 * المفروض ينقل **السؤال** (الفلتر والتجميع)، مش شكل جدول المرسِل.
 * والمفتاح فيه اسم الجدول عشان المشاريع والجهات ما يدوسوش على بعض.
 */
export const readCols = <T,>(table: string, cols: Col<T>[]): string[] => {
  const fallback = defaultCols(cols)
  try {
    const raw = localStorage.getItem(`ab-cols-${table}`)
    if (!raw) return fallback
    const keys = JSON.parse(raw) as unknown
    if (!Array.isArray(keys)) return fallback
    const valid = keys.filter((k): k is string => typeof k === 'string' && cols.some((c) => c.key === k))
    /* الثوابت بترجع حتى لو التخزين قديم وما فيهوش */
    const fixed = cols.filter((c) => c.fixed).map((c) => c.key)
    return valid.length ? [...new Set([...fixed, ...valid])] : fallback
  } catch {
    return fallback
  }
}

export const writeCols = (table: string, keys: string[]): void => {
  try {
    localStorage.setItem(`ab-cols-${table}`, JSON.stringify(keys))
  } catch {
    /* التخزين ممكن يكون مقفول · الاختيار يفضل للجلسة دي */
  }
}

/* ═══════════════════ عرض الأعمدة ═══════════════════ */

/** عرض بالبكسل لكل عمود المستخدم سحبه · الباقي على عرضه الافتراضي */
export type ColWidths = Record<string, number>

/** أضيق عرض مسموح: تحته العمود بيبقى شريطًا ما بيبيّنش حاجة */
export const MIN_COL_W = 56

/** العروض تفضيل شخصي زي اختيار الأعمدة، فبتتخزّن جنبه بنفس المنطق */
export const readWidths = (table: string): ColWidths => {
  try {
    const raw = localStorage.getItem(`ab-colw-${table}`)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: ColWidths = {}
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n >= MIN_COL_W) out[k] = Math.round(n)
    }
    return out
  } catch {
    return {}
  }
}

export const writeWidths = (table: string, w: ColWidths): void => {
  try {
    localStorage.setItem(`ab-colw-${table}`, JSON.stringify(w))
  } catch {
    /* التخزين مقفول · العروض تفضل للجلسة دي */
  }
}

/* ═══════════════════ التجميع ═══════════════════ */

export interface GroupBy<T> {
  key: string
  label: string
  of: (r: T) => string
}

export interface Group<T> {
  key: string
  rows: T[]
}

/**
 * تقسيم الصفوف لمجموعات، مرتّبة بالأكبر أولًا.
 *
 * الترتيب بالحجم لا بالأبجدية: اللي بيجمّع حسب المنطقة بيسأل «فين
 * تركّز المنح؟»، والإجابة هي أول مجموعة.
 */
export const splitGroups = <T,>(rows: T[], by: GroupBy<T>): Group<T>[] => {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = by.of(r) || 'بلا قيمة'
    const bucket = map.get(k)
    if (bucket) bucket.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()]
    .map(([key, rs]) => ({ key, rows: rs }))
    .sort((a, b) => b.rows.length - a.rows.length)
}
