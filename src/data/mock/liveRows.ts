/**
 * صفوف دومي لكل شاشة في كتالوج التقارير.
 *
 * القاعدة: **الأعمدة حقيقية والقيم مولَّدة**. الشاشة لازم تورّي
 * الشكل النهائي · عرض العمود، شكل المبلغ، النص اللي بيتقصّ، التاريخ،
 * المرفق · من غير ما نحطّ داتا حد فيها.
 *
 * والتوليد **محدَّد بالبذرة**: نفس المفتاح بيدّي نفس الصفوف في كل
 * تحميل. غير كده الديمو بيتغيّر تحت إيد العميل وهو بيقلّب، وده
 * بيخلّيه يشك في كل رقم يشوفه.
 *
 * والقيم مش عشوائية على طول · بتتبع الشكل اللي قِسناه في النظام:
 * أغلب المشاريع معتذر عنها، ونص «المعرفة» أغلبه نقطة واحدة، والمدة
 * الفعلية بتطول عن المخططة.
 */
import type { LiveCol, LiveSpec } from '@/data/liveReports'
import { projectRows } from './projects'
import { entityRows } from './entities'
import { OWNERS, REGIONS, STAGES, YEARS } from './taxonomy'
import { LIVE_DEPTS, LIVE_FIELDS, LIVE_GOALS, LIVE_TAGS, LIVE_TRACKS } from './taxonomyLive'

export type LiveRow = Record<string, string | number>

/** مولّد خطّي بسيط · نفس البذرة، نفس السلسلة */
function rng(seed: string) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1))
/** مبلغ بأرقام مدوّرة زي اللي في النظام (آلاف، مش كسور) */
const money = (r: () => number, a: number, b: number) => int(r, a / 1000, b / 1000) * 1000

const date = (r: () => number) => {
  const d = int(r, 1, 28)
  const m = int(r, 1, 9)
  return `${d}/${m}/2026`
}

/**
 * نصّ المعرفة · بنفس التوزيع اللي قِسناه على الـ٩٤٦ صفًّا:
 * ٤٦٪ ثلاثة أحرف أو أقل · ٣٤٪ أقل من أربعين حرفًا · ٢٠٪ درس فعلي.
 * التوزيع ده **هو الرسالة**، فما ينفعش نولّد نصوصًا حلوة كلها.
 */
const KNOW_REAL = [
  'الجهة نفّذت المشروع بلا اجتماع تمهيدي، فاتأخر الاستلام شهرين وطلع فرق في المخرجات عن المتفق عليه.',
  'المستفيدون الفعليون أقل من المقدَّر بالنص لأن التقدير اتبنى على قوائم قديمة عند الجهة.',
  'اتفق على دفعتين وطلعت تلاتة بسبب تأخر سند القبض، وده أخّر الإغلاق.',
  'المشروع اتعمل في موسم غير مناسب فالإقبال قلّ، يتحدَّد الموسم في الاتفاقية المرة الجاية.',
  'الجهة ما رفعتش التقرير المرحلي إلا بعد طلبين، والمتابعة اتعملت بالتليفون لا بالنظام.',
]
const KNOW_SHORT = ['تم بحمد الله', 'لا يوجد', 'مكتمل', 'تم التنفيذ', 'جيد', 'لا ملاحظات']

function knowledgeText(r: () => number): string {
  const x = r()
  if (x < 0.46) return '.'
  if (x < 0.8) return pick(r, KNOW_SHORT)
  return pick(r, KNOW_REAL)
}

const OUTPUTS = [
  '1 - تدريب المستفيدين على المهارات المستهدفة.\n2 - إصدار دليل تشغيلي للجهة.\n3 - قياس الأثر بعد ستة أشهر.',
  '1 - تجهيز القاعات وتشغيلها.\n2 - تخريج الدفعة الأولى.\n3 - اتفاقية استمرار مع الجهة.',
  '1 - تسليم الأجهزة للأسر المستفيدة.\n2 - توثيق التسليم بالصور.\n3 - زيارة ميدانية للتحقق.',
]

/** قيمة خلية واحدة حسب نوع العمود واسمه */
function cell(col: LiveCol, r: () => number, i: number): string | number {
  const p = projectRows[i % projectRows.length]
  const e = entityRows[i % entityRows.length]

  switch (col.key) {
    case 'no': case 'projNo': return 20000 + i * 7 + int(r, 1, 6)
    case 'proj': return p.name
    case 'entity': return e.name
    case 'licensor': return e.licensor
    case 'type': return e.type
    case 'city': return e.city
    case 'region': return pick(r, REGIONS)
    case 'year': return pick(r, YEARS).label
    case 'track': return pick(r, LIVE_TRACKS)
    case 'field': return pick(r, LIVE_FIELDS)
    case 'goal': return pick(r, LIVE_GOALS)
    case 'tag': return pick(r, LIVE_TAGS)
    case 'owner': return pick(r, OWNERS)
    case 'stage': return pick(r, STAGES).stage
    case 'dept': return LIVE_DEPTS[i % LIVE_DEPTS.length]
    case 'status': return pick(r, ['معتذر عنه', 'معتذر عنه', 'في التشغيل', 'مكتمل', 'في الدراسة', 'متعثر'])
    case 'method': return pick(r, ['بحث واستجابة', 'ابتكار وإنضاج'])
    case 'share': case 'ads': case 'impact': return pick(r, ['لا', 'لا', 'نعم'])
    case 'state': return pick(r, ['مدفوع', 'مدفوع', 'غير مدفوع'])
    case 'kind': return r() < 0.87 ? 'دروس مستفادة' : 'رفض'
    case 'text': return knowledgeText(r)
    case 'outputs': return pick(r, OUTPUTS)
    case 'notes': return r() < 0.7 ? '' : 'تم التمديد بموافقة مدير المنح.'
    case 'attTitle': return pick(r, ['رفع التقرير المرحلي', 'رفع التقرير الختامي'])
    case 'extra': return '-'
    default: break
  }

  switch (col.kind) {
    case 'id': return 20000 + i
    case 'num': return int(r, 0, 400)
    case 'money': return money(r, 30_000, 1_800_000)
    case 'pct': return `${int(r, 1, 96)}%`
    case 'date': return date(r)
    case 'file': return 'الملف المرفق'
    case 'link': return 'رابط'
    case 'long': return 'نصّ تجريبي في هذا العمود.'
    default: return ' '
  }
}

/**
 * صفوف شاشة واحدة.
 *
 * `n` عدد الصفوف المعروضة في النموذج، لا عدد صفوف النظام: الشاشة
 * بتقول العدد الحقيقي في ترويستها، والجدول بيعرض عيّنة منه.
 */
export function liveRows(spec: LiveSpec, n = 24): LiveRow[] {
  if (spec.cols.length === 0) return []
  const out: LiveRow[] = []
  for (let i = 0; i < n; i++) {
    const r = rng(`${spec.key}:${i}`)
    const row: LiveRow = {}
    for (const c of spec.cols) row[c.key] = cell(c, r, i)
    out.push(row)
  }
  /* الأداء: الوارد = المنجَز + القائم، عشان الصف يجمع صح */
  if (spec.key === 'perfUser' || spec.key === 'perfDept') {
    for (const row of out) {
      const done = Number(row.done), open = Number(row.open)
      row.inbox = done + open
      row.maxDays = Number(row.avgDays) + Math.max(3, Math.round(Number(row.avgDays) * 1.8))
    }
  }
  return out
}

/* ═══════════════════ شجرة الميزانية ═══════════════════ */

export interface BudgetNode {
  id: string
  label: string
  budget: number
  approved: number
  reserved: number
  spent: number
  /** المتبقي = الميزانية − المعتمد. بيطلع بالسالب لما يتعتمد فوق السقف. */
  left: number
  leftPct: number
  children?: BudgetNode[]
}

const node = (
  id: string, label: string,
  budget: number, approved: number, reserved: number, spent: number,
  children?: BudgetNode[],
): BudgetNode => ({
  id, label, budget, approved, reserved, spent,
  left: budget - approved,
  leftPct: budget ? Math.round(((budget - approved) / budget) * 10000) / 100 : 0,
  children,
})

/** يوزّع مبلغًا على n بنود بنِسب ثابتة مشتقة من الاسم */
function split(total: number, keys: readonly string[], seed: string): number[] {
  const r = rng(seed)
  const w = keys.map(() => 0.6 + r() * 0.8)
  const s = w.reduce((a, b) => a + b, 0)
  const out = w.map((x) => Math.round((total * x) / s / 1000) * 1000)
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0)
  return out
}

/**
 * يوزّع **المستهلَك** على بنود ميزانيتها معروفة، من غير ما يقلب
 * الإشارة.
 *
 * الغلطة اللي كانت هنا: الميزانية والمعتمد كانوا بيتوزّعوا بوزنين
 * مستقلّين، فبند ياخد ٥٪ من الميزانية و٢٠٪ من المعتمد ويطلع «فوق
 * السقف» وأبوه لسه عنده فايض. الإشارة السالبة دي **معلومة خطيرة**
 * (اعتماد فوق الميزانية) وما ينفعش تظهر من قسمة عشوائية.
 *
 * فالتوزيع هنا بيمشي على نسبة الاستهلاك: كل بند بياخد نسبة قريبة من
 * نسبة أبوه بتفاوت محدود، وبعدين تتعاير عشان المجموع يطابق. ولو
 * الأب تحت السقف، مفيش ابن بيعدّي سقفه · الزيادة بتترحّل للي عنده
 * فايض. ولو الأب فوق السقف (٢٠٢٤ و٢٠٢٥ فعلًا)، السالب بيتوزّع
 * وبيفضل ظاهرًا.
 */
function splitUsed(
  budgets: number[], total: number, seed: string,
): number[] {
  const B = budgets.reduce((a, b) => a + b, 0)
  if (B <= 0) return budgets.map(() => 0)
  const r = rng(seed)
  const ratio = total / B
  /* نسبة قريبة من نسبة الأب ±١٥٪ */
  let out = budgets.map((b) => b * ratio * (0.85 + r() * 0.3))
  const scale = total / (out.reduce((a, b) => a + b, 0) || 1)
  out = out.map((v) => v * scale)

  /* الأب تحت السقف ⇒ محدش من الأبناء يعدّي سقفه */
  if (ratio <= 1) {
    for (let pass = 0; pass < 4; pass++) {
      let over = 0
      out = out.map((v, i) => {
        if (v > budgets[i]) { over += v - budgets[i]; return budgets[i] }
        return v
      })
      if (over < 1) break
      const room = out.reduce((a, v, i) => a + Math.max(0, budgets[i] - v), 0)
      if (room < 1) break
      out = out.map((v, i) => v + (over * Math.max(0, budgets[i] - v)) / room)
    }
  }

  /* التقريب لأقرب ألف بيسيب باقيًا، والباقي ده لازم يروح للبند اللي
     عنده فايض · لو راح للأول ممكن يعدّي سقفه ويرجّع نفس الغلطة اللي
     الدالة دي موجودة عشانها. */
  const rounded = out.map((v) => Math.round(v / 1000) * 1000)
  let rest = total - rounded.reduce((a, b) => a + b, 0)
  for (let pass = 0; pass < 8 && rest !== 0; pass++) {
    const room = rounded.map((v, i) =>
      ratio <= 1 ? (rest > 0 ? budgets[i] - v : v) : Number.MAX_SAFE_INTEGER)
    let best = 0
    for (let i = 1; i < rounded.length; i++) if (room[i] > room[best]) best = i
    if (room[best] <= 0) { rounded[best] += rest; rest = 0; break }
    const step = rest > 0 ? Math.min(rest, room[best]) : Math.max(rest, -room[best])
    rounded[best] += step
    rest -= step
  }
  return rounded
}

/** المجالات تحت كل مسار، وأهدافها · من الشجرة الحقيقية */
const GOALS_OF: Record<string, string[]> = {
  التعليم: ['المنح الدراسية الجامعية', 'دروس التقوية الإلكترونية', 'روضات التبيان', 'المحفظة التعليمية المتنوعة'],
  التطوير: ['الاستدامة المالية للجمعيات الأهلية', 'الدعم التشغيلي للجمعيات المتميزة', 'تأسيس الجمعيات الأهلية', 'احتضان الجمعيات'],
  القرآن: ['الدورات القرآنية الموسمية', 'تطوير معلمي القرآن الكريم', 'تعليم القرآن للأشبال', 'المحفظة القرآنية المتنوعة'],
  'العلم الشرعي': ['البناء العلمي الشرعي', 'المحفظة الشرعية المتنوعة'],
  القيم: ['الأندية الصيفية القيمية', 'الرحلات التطويرية للجمعيات الشبابية', 'المبادرات القيمية في البيئات التعليمية', 'المحفظة القيمية المتنوعة'],
  الصحة: ['علاج مرضى الكلى', 'تأسيس المراكز الصحية', 'علاج مرضى السرطان', 'المحفظة الصحية المتنوعة'],
  الإغاثة: ['السلال الغذائية', 'الأجهزة الكهربائية', 'كفالة الأيتام والأرامل', 'تهيئة السكن للمحتاجين', 'المحفظة الإغاثية المتنوعة'],
  الدعوة: ['الدعوة الإلكترونية', 'البرامج الثقافية لضيوف المملكة', 'المحفظة الدعوية المتنوعة'],
  المساجد: ['عمارة المساجد', 'قرة الأعين', 'المحفظة المتنوعة للمساجد'],
  'الحج ورمضان': ['محفظة مشاريع موسم الحج', 'محفظة مشاريع موسم رمضان'],
}

function goalLevel(field: string, budget: number, approved: number, reserved: number, spent: number): BudgetNode[] {
  const goals = GOALS_OF[field] ?? ['المحفظة المتنوعة']
  const b = split(budget, goals, `b:${field}`)
  const a = splitUsed(b, approved, `a:${field}`)
  const v = splitUsed(b, reserved, `v:${field}`)
  const p = splitUsed(b, spent, `p:${field}`)
  return goals.map((g, i) => node(`${field}:${g}`, g, b[i], a[i], v[i], p[i]))
}

const QUALITY = ['التعليم', 'التطوير', 'القرآن', 'العلم الشرعي', 'القيم', 'الصحة']
const SPREAD = ['الإغاثة', 'الدعوة', 'المساجد', 'الحج ورمضان']

/**
 * الدورات الخمس بأرقامها **الحقيقية** من `reports1_1`.
 *
 * ⚠️ دي الأرقام الوحيدة الحقيقية في الشجرة: الإجماليات لكل دورة.
 * التوزيع تحتها على المسار والمجال والهدف مولَّد بنِسب ثابتة، لأن
 * قراءة الشجرة كاملة معناها ٥ × ٢ × ٦ × ٤ صفحة.
 *
 * والسالب في ٢٠٢٤ و٢٠٢٥ **حقيقي**: اعتماد فوق الميزانية.
 */
const CYCLES = [
  { id: '2026-f', label: '2026 · المؤسسة', budget: 73_600_000, approved: 64_154_182, reserved: 19_503_581, spent: 44_650_601 },
  { id: '2025-f', label: '2025 · المؤسسة', budget: 55_800_000, approved: 58_639_800, reserved: 896_000, spent: 57_743_800 },
  { id: '2024-f', label: '2024 · المؤسسة', budget: 47_200_000, approved: 47_475_359, reserved: 60_000, spent: 47_415_359 },
  { id: '2023-f', label: '2023 · المؤسسة', budget: 2_849_573, approved: 847_479, reserved: 0, spent: 847_479 },
  { id: '2023-w', label: '2023 · الوقف', budget: 1_000_000, approved: 0, reserved: 0, spent: 0 },
] as const

function trackLevel(c: (typeof CYCLES)[number]): BudgetNode[] {
  const tracks = ['المنح النوعي', 'المنح الانتشاري']
  const b = split(c.budget, tracks, `tb:${c.id}`)
  const a = splitUsed(b, c.approved, `ta:${c.id}`)
  const v = splitUsed(b, c.reserved, `tv:${c.id}`)
  const p = splitUsed(b, c.spent, `tp:${c.id}`)
  return tracks.map((t, i) => {
    const fields = i === 0 ? QUALITY : SPREAD
    const fb = split(b[i], fields, `fb:${c.id}:${t}`)
    const fa = splitUsed(fb, a[i], `fa:${c.id}:${t}`)
    const fv = splitUsed(fb, v[i], `fv:${c.id}:${t}`)
    const fp = splitUsed(fb, p[i], `fp:${c.id}:${t}`)
    return node(`${c.id}:${t}`, t, b[i], a[i], v[i], p[i],
      fields.map((f, j) => node(`${c.id}:${f}`, f, fb[j], fa[j], fv[j], fp[j],
        goalLevel(f, fb[j], fa[j], fv[j], fp[j]))))
  })
}

/** جذر الشجرة · الدورات الخمس */
export const budgetTree: BudgetNode[] = CYCLES.map((c) =>
  node(c.id, c.label, c.budget, c.approved, c.reserved, c.spent, trackLevel(c)))

/** يلاقي عقدة بمسار معرّفاتها */
export function nodeAt(path: string[]): BudgetNode | undefined {
  let list: BudgetNode[] | undefined = budgetTree
  let found: BudgetNode | undefined
  for (const id of path) {
    found = list?.find((n) => n.id === id)
    if (!found) return undefined
    list = found.children
  }
  return found
}
