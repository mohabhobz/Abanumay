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
  /**
   * الرقم اللي بيتجمّع · غياب الخاصية معناه خانة فاضية في الإجماليات.
   *
   * ⚠️ **و`null` معناها «الصفّ ده مالوش قيمة» لا «قيمته صفر».**
   * عمود «مدة المراجعة» فيه صفوف «لم تُغلق» وعمود «درجة الحوكمة»
   * فيه «لم تُقيَّم» · وكانوا بيرجّعوا `0`، فالمتوسّط بيقسم على
   * صفوف مالهاش قيمة أصلًا ويطلع أقلّ من الحقيقة. «٦ أيام» في
   * كارت المؤشّر و«٣ وسطي» في نفس الشاشة، والاتنين بيقولوا نفس
   * الحاجة. الصفر رقم، وغياب الرقم مش صفر.
   */
  value?: (r: T) => number | null
  agg?: Agg
  /**
   * كلمة صغيرة جنب رقم الإجمالي · **إلزامية لمّا الإجمالي بيلخّص
   * كميّة غير اللي الخلية بتعرضها**.
   *
   * ⚠️ **العميل شاف رقمًا معلّقًا في الهوا.** عمود «ملف المستندات»
   * خلاياه بتقول «١ من ٢» و«٢ من ٢»، وتحتيه في صفّ الإجماليات
   * رقم أسود عريان: **5**. الرقم صح (خمس مستندات ناقصة في الصندوق
   * كله) لكن الخلايا فوقه بتعدّ **المكتمل** والإجمالي بيعدّ
   * **الناقص** · فالقارئ ما يقدرش يوصل الرقم بأي حاجة شايفها.
   *
   * القاعدة: **الإجمالي لازم يقول إجمالي إيه لمّا الخلية مش رقمًا
   * صافيًا.** العمود اللي خليته رقم وإجماليه مجموعه ما يحتاجش
   * كلمة · واللي خليته نسبة أو وسم يحتاج.
   *
   * (`avg` بياخد «وسطي» تلقائيًّا لو ما اتقالش غيرها.)
   */
  aggSay?: string
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

/**
 * إجمالي العمود على مجموعة صفوف · `null` يعني العمود ما يتلخّصش.
 *
 * ⚠️ الصفوف اللي قيمتها `null` **بتتشال من الحسبة كلها**: المجموع
 * ما بيتغيّرش بيها، والمتوسّط بيقسم على اللي له قيمة وحده. وشيلها
 * من المقام هو الفرق بين «وسطي المدة» و«وسطي المدة لو كل اللي
 * ما اتقفلش بصفر».
 */
export const aggregate = <T,>(col: Col<T>, rows: T[]): number | null => {
  if (!col.value || !col.agg || rows.length === 0) return null
  const read = col.value
  const vals: number[] = []
  for (const r of rows) {
    const v = read(r)
    if (v !== null && v !== undefined && Number.isFinite(v)) vals.push(v)
  }
  if (vals.length === 0) return null
  const total = vals.reduce((a, b) => a + b, 0)
  return col.agg === 'avg' ? Math.round(total / vals.length) : total
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

/* ═══════════════════════════════════════════════════════════
   ي-1 و ي-2 · التجميع المتداخل

   مظفر في أودو: «سيلز بيرسون ← عميل ← طريقة الدفع» · تلات أبعاد
   متداخلة لا واحد.

   ⚠️ **والترتيب مش تفصيلة، هو السؤال نفسه (ي-2).**
     منطقة ← جهة  بيقول: «في الرياض، مين بياخد؟»
     جهة ← منطقة  بيقول: «جمعية البناء العلمي، بتشتغل فين؟»
   نفس البُعدين ونفس الصفوف، وسؤالان مختلفان تمامًا. فالاختيار
   **بترتيب الضغط** لا بترتيب القايمة، والواجهة بتعرض الرقم جنب كل
   بُعد عشان الترتيب يتقرا لا يتخمّن.

   ⚠️ **وثلاثة سقف مقصود.** كل مستوى بيضرب عدد السطور، والرابع
   بيدّي مجموعات فيها صفّ واحد · يعني شجرة بحجم الجدول وما بتلخّصش
   حاجة.
   ═══════════════════════════════════════════════════════════ */
export const MAX_GROUP_DEPTH = 3

export interface GroupNode<T> {
  /** قيمة البُعد في المستوى ده */
  key: string
  /** مفتاح فريد عبر المستويات · حالة الفتح متخزّنة عليه */
  path: string
  level: number
  by: GroupBy<T>
  rows: T[]
  /** فاضية عند آخر مستوى · وساعتها الجدول هو اللي بينفتح */
  kids: GroupNode<T>[]
}

export const groupTree = <T,>(
  rows: T[],
  bys: GroupBy<T>[],
  level = 0,
  parent = '',
): GroupNode<T>[] => {
  const by = bys[level]
  if (!by) return []
  return splitGroups(rows, by).map((g) => {
    const path = parent ? `${parent}␟${g.key}` : g.key
    return {
      key: g.key,
      path,
      level,
      by,
      rows: g.rows,
      kids: groupTree(g.rows, bys, level + 1, path),
    }
  })
}

/** كل المسارات في الشجرة · «افتح الكل» بيحتاج المستويات كلها */
export const allPaths = <T,>(nodes: GroupNode<T>[]): string[] =>
  nodes.flatMap((n) => [n.path, ...allPaths(n.kids)])

/** عدد المجموعات في أول مستوى · ده اللي بيتقال للمستخدم */
export const countLeaves = <T,>(nodes: GroupNode<T>[]): number =>
  nodes.reduce((s, n) => s + (n.kids.length ? countLeaves(n.kids) : 1), 0)

/**
 * قراية سلسلة التجميع من الرابط.
 *
 * ⚠️ **التنظيف هنا مش تزويق.** الرابط بيتبعت ويتحفظ ويتكتب بالإيد،
 * فممكن ييجي فيه مفتاح ما بقاش موجود، أو نفس المفتاح مرتين (اللي
 * بيدّي شجرة كل عقدة فيها ابن واحد بنفس اسمها)، أو عشر مستويات.
 * التلاتة بيرسموا شاشة غلط من غير ما يرموا خطأ.
 */
export const groupChain = <T,>(value: string | undefined, all: GroupBy<T>[]): GroupBy<T>[] => {
  const seen = new Set<string>()
  const out: GroupBy<T>[] = []
  for (const k of (value ?? '').split(',')) {
    if (!k || seen.has(k)) continue
    const by = all.find((g) => g.key === k)
    if (!by) continue
    seen.add(k)
    out.push(by)
    if (out.length === MAX_GROUP_DEPTH) break
  }
  return out
}

/* ═══════════════════════════════════════════════════════════
   ي-5 · الإكسبورت بنفس شكل الفيو

   مظفر: «الإكسبورت لازم يطلع زي ما أنا شايفه، بالتجميع والمجاميع».

   ⚠️ **والمقصود مش أعمدة التجميع في أول الصفّ.** المقصود إن الملف
   يكون **نفس الورقة**: صفوف المجموعة، وتحتها سطر مجاميعها، وبعدها
   المجموعة اللي بعدها · وفي الآخر الإجمالي الكلي. لو الملف طلع
   صفوفًا سايبة وإجمالي واحد تحت، المستخدم اللي صدّر عشان يبعت
   «تقرير في ثانية» بيقعد يعمل الجمع تاني في إكسل.

   ⚠️ **وبتتكتب مرة واحدة هنا.** خمس شاشات كانت بتبني الورقة
   بإيدها بنفس التلات سطور، ونسخة منهم اتنسيت وراء التجميع الجديد
   هي **خمس ملفات مختلفة عن خمس شاشات**.
   ═══════════════════════════════════════════════════════════ */
export interface SheetParts {
  headers: string[]
  rows: string[][]
  totals: string[]
}

/**
 * سطر مجاميع.
 *
 * ⚠️ العمود الأول بياخد **علامة** لا رقمًا: «إجمالي الرياض» أو
 * «٦ مشاريع». سطر مجاميع بلا علامة في ملف إكسل بيتقرا صفَّ بيانات،
 * والمستخدم بيجمعه مع الصفوف اللي فوقه.
 */
const totalsRow = <T,>(cols: Col<T>[], rows: T[], lead: string[], mark: string): string[] => [
  ...lead,
  ...cols.map((c, i) => {
    const t = aggregate(c, rows)
    if (t !== null) return String(t)
    return i === 0 ? mark : ''
  }),
]

/** ملء الخانات الفاضية عشان كل صفّ في الملف يبقى بنفس عدد الأعمدة */
const pad = (xs: string[], n: number): string[] =>
  xs.length >= n ? xs.slice(0, n) : [...xs, ...Array<string>(n - xs.length).fill('')]

export const sheetOf = <T,>(
  rows: T[], cols: Col<T>[], bys: GroupBy<T>[], count: (n: number) => string,
): SheetParts => {
  const headers = [...bys.map((b) => b.label), ...cols.map((c) => c.label)]

  if (bys.length === 0) {
    return {
      headers,
      rows: rows.map((r) => cols.map((c) => c.text(r))),
      totals: totalsRow(cols, rows, [], count(rows.length)),
    }
  }

  const out: string[][] = []
  const walk = (nodes: GroupNode<T>[], trail: string[]) => {
    for (const n of nodes) {
      const path = [...trail, n.key]
      if (n.kids.length) walk(n.kids, path)
      else {
        for (const r of n.rows) out.push([...pad(path, bys.length), ...cols.map((c) => c.text(r))])
      }
      /* سطر مجاميع المجموعة · بعد صفوفها زي ما هو تحتها في الشاشة */
      out.push(totalsRow(cols, n.rows, pad(path, bys.length), `إجمالي ${n.key} · ${count(n.rows.length)}`))
    }
  }
  walk(groupTree(rows, bys), [])

  return {
    headers,
    rows: out,
    totals: totalsRow(cols, rows, pad(['الإجمالي الكلي'], bys.length), count(rows.length)),
  }
}
