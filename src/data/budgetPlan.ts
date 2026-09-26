/**
 * Budget plan · **the real allocation tree for the 2026 cycle · the Foundation**.
 *
 * Source: `control/struct_section` (the "Areas and Goals" screen, the allocation editor) and
 * `control/reports1_1` (the reporting screen). A direct read — every request is `GET`, no form was
 * submitted and no save button was clicked.
 *
 * Warning: **the numbers here are real** — allocated, execution plan, held, and spent for each of
 * the 48 goals. What's generated is **owner names** only, drawn from a sample list, because the
 * repo is public.
 *
 * === Why this module exists ===
 *
 * The live system stores this tree across four consecutive screens: open the year, click "view" to
 * go to the track page, and so on. Each page prints the **sum of its children** in the last row —
 * but **the parent's allocation is written on the previous page**. So the two numbers are never
 * seen side by side.
 *
 * Adding them up shows that **ten line items out of fourteen have children summing to something
 * other than their allocation** — the largest gap is 736,000 riyals. Not a reading error — that's
 * what's actually in the system. So the first thing this module does is put the two numbers next to
 * each other.
 */

/**
 * A node in the allocation tree · **carries every `struct_section` field**, not just the amount.
 * The fields in the editor: name, allocated amount (`money`), execution plan (`num`), display order
 * (`weight`), hidden (`hidden`), permission (`spPerm`), user (`spPerm_uid`) — all kept here so the
 * inventory stays complete.
 */
export interface PlanNode {
  id: string
  label: string
  /** Amount allocated to this item · `money` */
  alloc: number
  /** Execution plan % · `num`. Feeds into "progress against the strategic plan" */
  plan: number
  /** Display order · `weight`. The system sorts by this, not by name */
  order: number
  /** Hidden from selection lists · `hidden`. All are off in the active cycle */
  hidden?: boolean
  /** Permission · `spPerm`. The list has only one option: "public" */
  perm?: 'عام'
  /** Item owner · `spPerm_uid` (name is generated; the distribution is real) */
  owner?: string
  /** Approved · from `reports1_1`, not present in the editor */
  approved?: number
  /** Held · requests under review against this item */
  reserved?: number
  /** Actually spent */
  spent?: number
  children?: PlanNode[]
}

/* Goals: [name, allocated, held, spent] */
type G = [string, number, number, number]

const g = (rows: G[], owner: string): PlanNode[] =>
  rows.map(([label, alloc, reserved, spent], i) => ({
    id: `${owner}-${i}-${label}`,
    label, alloc, plan: 100, order: i, hidden: false, perm: 'عام' as const,
    owner, reserved, spent,
  }))

/**
 * Owners · from a sample list, not the live system.
 * The real distribution is four owners across twelve areas, so the shape is kept and the names are
 * substituted.
 */
const O1 = 'عمر قاسم'
const O2 = 'سعود البريكان'
const O3 = 'عزام الخريف'
const O4 = 'أحمد العبداللطيف'

const QUALITY: PlanNode[] = [
  {
    id: 'f-edu', label: 'التعليم', alloc: 5_152_000, plan: 100, owner: O3,
    order: 0, hidden: false, perm: 'عام', approved: 4_098_716,
    reserved: 1_875_688, spent: 2_223_028,
    children: g([
      ['المنح الدراسية الجامعية', 1_264_440, 1_000_000, 104_600],
      ['دروس التقوية الإلكترونية', 1_000_000, 500_000, 0],
      ['روضات التبيان', 1_000_000, 325_000, 651_136],
      ['المحفظة التعليمية المتنوعة', 1_847_560, 50_688, 1_467_292],
    ], O3),
  },
  {
    id: 'f-dev', label: 'التطوير', alloc: 7_500_000, plan: 100, owner: O3,
    order: 1, hidden: false, perm: 'عام', approved: 6_026_501,
    reserved: 977_501, spent: 5_049_000,
    children: g([
      ['الاستدامة المالية للجمعيات الأهلية', 795_600, 233_000, 562_000],
      ['الدعم التشغيلي للجمعيات المتميزة', 3_000_000, 0, 3_000_000],
      ['تطوير منسوبي القطاع غير الربحي', 850_000, 50_000, 675_000],
      ['تأسيس الجمعيات الأهلية', 1_000_000, 252_501, 370_000],
      ['احتضان الجمعيات', 1_500_000, 442_000, 442_000],
    ], O3),
  },
  {
    id: 'f-qur', label: 'القرآن', alloc: 6_500_000, plan: 100, owner: O2,
    order: 2, hidden: false, perm: 'عام', approved: 5_215_370,
    reserved: 738_750, spent: 4_476_620,
    children: g([
      ['الدورات القرآنية الموسمية', 1_500_000, 0, 1_500_000],
      ['تطوير معلمي القرآن الكريم', 1_000_000, 98_750, 392_750],
      ['تعليم القرآن للأشبال', 1_000_000, 40_000, 257_500],
      ['المحفظة القرآنية المتنوعة', 2_940_000, 600_000, 2_326_370],
    ], O2),
  },
  {
    id: 'f-shr', label: 'العلم الشرعي', alloc: 4_500_000, plan: 100, owner: O1,
    order: 3, hidden: false, perm: 'عام', approved: 4_194_274,
    reserved: 805_242, spent: 3_389_032,
    children: g([
      ['البناء العلمي الشرعي', 1_000_000, 100_000, 900_000],
      ['المحفظة الشرعية المتنوعة', 3_372_500, 705_242, 2_489_032],
    ], O1),
  },
  {
    id: 'f-val', label: 'القيم', alloc: 7_748_000, plan: 100, owner: O2,
    order: 4, hidden: false, perm: 'عام', approved: 7_655_180,
    reserved: 730_000, spent: 6_925_180,
    children: g([
      ['الأندية الصيفية القيمية', 1_957_500, 130_000, 1_827_500],
      ['الرحلات التطويرية للجمعيات الشبابية', 890_000, 380_000, 510_000],
      ['المبادرات القيمية في البيئات التعليمية', 1_000_000, 0, 1_000_000],
      ['المحفظة القيمية المتنوعة', 3_900_500, 220_000, 3_587_680],
    ], O2),
  },
  {
    id: 'f-hlt', label: 'الصحة', alloc: 9_040_000, plan: 100, owner: O3,
    order: 5, hidden: false, perm: 'عام', approved: 8_800_000,
    reserved: 4_000_000, spent: 4_800_000,
    children: g([
      ['علاج مرضى الكلى', 1_000_000, 100_000, 900_000],
      ['تأسيس المراكز الصحية', 3_800_000, 3_800_000, 0],
      /* A goal that's active with zero allocation · it's in the list and no one can spend against
         it */
      ['توفير الأجهزة الطبية', 0, 0, 0],
      ['علاج مرضى السرطان', 1_000_000, 100_000, 900_000],
      ['المحفظة الصحية المتنوعة', 3_120_000, 0, 3_000_000],
    ], O3),
  },
]

const SPREAD: PlanNode[] = [
  {
    id: 'f-rel', label: 'الإغاثة', alloc: 7_300_000, plan: 100, owner: O3,
    order: 0, hidden: false, perm: 'عام', approved: 5_750_000,
    reserved: 1_230_000, spent: 4_520_000,
    children: g([
      ['السلال الغذائية', 1_500_000, 0, 1_500_000],
      ['الأجهزة الكهربائية', 1_500_000, 500_000, 1_000_000],
      ['كفالة الأيتام والأرامل', 1_000_000, 0, 1_000_000],
      ['تهيئة السكن للمحتاجين', 1_500_000, 0, 0],
      ['المحفظة الإغاثية المتنوعة', 1_750_000, 730_000, 1_020_000],
    ], O3),
  },
  {
    /* Execution plan is zero · this item is excluded from the strategic-progress calculation */
    id: 'f-daw', label: 'الدعوة', alloc: 6_624_000, plan: 0, owner: O1,
    order: 1, hidden: false, perm: 'عام', approved: 5_867_333,
    reserved: 2_467_000, spent: 3_400_333,
    children: g([
      ['الدعوة الإلكترونية', 3_000_000, 1_575_000, 1_375_000],
      ['البرامج الثقافية لضيوف المملكة', 2_000_000, 892_000, 540_000],
      ['المحفظة الدعوية المتنوعة', 1_561_500, 0, 1_485_333],
    ], O1),
  },
  {
    id: 'f-msq', label: 'المساجد', alloc: 4_700_000, plan: 100, owner: O1,
    order: 2, hidden: false, perm: 'عام', approved: 4_373_700,
    reserved: 2_080_050, spent: 2_293_650,
    children: g([
      ['عمارة المساجد', 2_000_000, 1_500_000, 500_000],
      ['قرة الأعين', 1_000_000, 230_000, 479_460],
      ['المحفظة المتنوعة للمساجد', 1_700_000, 350_050, 1_314_190],
    ], O1),
  },
  {
    /* Execution plan is zero · same as "outreach" */
    id: 'f-haj', label: 'الحج ورمضان', alloc: 3_216_000, plan: 0, owner: O4,
    order: 3, hidden: false, perm: 'عام', approved: 2_982_014,
    reserved: 0, spent: 2_982_014,
    children: g([
      ['محفظة مشاريع موسم الحج', 1_518_964, 0, 1_518_964],
      ['محفظة مشاريع موسم رمضان', 1_697_036, 0, 1_463_050],
    ], O4),
  },
  {
    id: 'f-res', label: 'المصارف المقيدة والخاصة', alloc: 3_960_000, plan: 100, owner: O2,
    order: 4, hidden: false, perm: 'عام', approved: 1_831_500,
    reserved: 1_399_350, spent: 432_150,
    children: g([
      ['المصارف المقيدة والخاصة', 3_224_000, 1_399_350, 432_150],
    ], O2),
  },
  {
    id: 'f-ext', label: 'المشاريع الخارجية', alloc: 7_360_000, plan: 100, owner: O3,
    order: 5, hidden: false, perm: 'عام', approved: 7_359_594,
    reserved: 3_200_000, spent: 4_159_594,
    children: g([
      ['المشاريع الإغاثية خارج المملكة بالشراكة مع مركز الملك سلمان', 7_360_000, 3_200_000, 4_159_594],
    ], O3),
  },
]

/** 2026 cycle tree · the Foundation · two tracks, twelve areas, forty-eight goals */
export const plan2026: PlanNode = {
  id: '2026-f',
  label: '2026 · المؤسسة',
  alloc: 73_600_000,
  plan: 100,
  order: 4,
  approved: 64_154_182,
  reserved: 19_503_581,
  spent: 44_650_601,
  children: [
    {
      id: 't-qual', label: 'المنح النوعي', alloc: 40_400_000, plan: 100,
      order: 0, hidden: false, perm: 'عام',
      approved: 35_990_041, reserved: 9_127_181, spent: 26_862_860, children: QUALITY,
    },
    {
      id: 't-spread', label: 'المنح الانتشاري', alloc: 33_300_000, plan: 100,
      order: 1, hidden: false, perm: 'عام',
      approved: 28_164_141, reserved: 10_376_400, spent: 17_787_741, children: SPREAD,
    },
  ],
}

/**
 * The five cycles.
 *
 * Each cycle is **year x funding source**, with a fully independent budget. The Foundation and the
 * endowment don't get combined, and that's confirmed by the year filter itself in the system. The
 * full allocation tree is available for 2026 (the active cycle); the rest are totals from
 * `reports1_1`.
 */
export interface Cycle {
  id: string
  label: string
  alloc: number
  approved: number
  reserved: number
  spent: number
  /** Full tree · for the active cycle only */
  tree?: PlanNode
  /** `active` · the active cycle **for the Foundation** */
  active: boolean
  /** `active2` · the active cycle **for the endowment**. Two independent flags in the same row */
  activeWaqf: boolean
}

export const CYCLES: Cycle[] = [
  { id: '2026-f', label: '2026 · المؤسسة', alloc: 73_600_000, approved: 64_154_182, reserved: 19_503_581, spent: 44_650_601, tree: plan2026, active: true, activeWaqf: false },
  { id: '2025-f', label: '2025 · المؤسسة', alloc: 55_800_000, approved: 58_639_800, reserved: 896_000, spent: 57_743_800, active: false, activeWaqf: false },
  { id: '2024-f', label: '2024 · المؤسسة', alloc: 47_200_000, approved: 47_475_359, reserved: 60_000, spent: 47_415_359, active: false, activeWaqf: false },
  { id: '2023-f', label: '2023 · المؤسسة', alloc: 2_849_573, approved: 847_479, reserved: 0, spent: 847_479, active: false, activeWaqf: false },
  /* The endowment's active cycle is 2023 · `active2` is flagged on this row alone. So the endowment
     is stuck on a three-year-old cycle, with a million riyals of it never spent. The Foundation is
     on 2026 and the endowment is on 2023 in the same table. */
  { id: '2023-w', label: '2023 · الوقف', alloc: 1_000_000, approved: 0, reserved: 0, spent: 0, active: false, activeWaqf: true },
]

export const cycleById = (id: string): Cycle =>
  CYCLES.find((c) => c.id === id) ?? CYCLES[0]

/* Balance check */

export interface Imbalance {
  /** Node's path from the root · for navigation */
  path: string[]
  label: string
  /** Node level: 0 year · 1 track · 2 area */
  level: number
  alloc: number
  childSum: number
  /** Positive = children exceed the parent */
  gap: number
}

export const childSum = (n: PlanNode): number =>
  (n.children ?? []).reduce((s, c) => s + c.alloc, 0)

/**
 * Every item whose children's sum doesn't equal its allocation.
 *
 * This is **the check missing from the live system**: there, the two numbers sit on different
 * pages, so the gap never gets seen. Here it's computed across the whole tree at once.
 */
export function imbalances(root: PlanNode): Imbalance[] {
  const out: Imbalance[] = []
  const walk = (n: PlanNode, path: string[], level: number) => {
    if (n.children?.length) {
      const sum = childSum(n)
      if (sum !== n.alloc) {
        out.push({ path, label: n.label, level, alloc: n.alloc, childSum: sum, gap: sum - n.alloc })
      }
      for (const c of n.children) walk(c, [...path, c.id], level + 1)
    }
  }
  walk(root, [], 0)
  return out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
}

/** Count of items that have children · the denominator for the balance ratio */
export function parentCount(root: PlanNode): number {
  let n = 0
  const walk = (x: PlanNode) => {
    if (x.children?.length) { n += 1; x.children.forEach(walk) }
  }
  walk(root)
  return n
}

/** All goals flattened · for questions like "which items are underfunded" */
export function leaves(root: PlanNode): PlanNode[] {
  const out: PlanNode[] = []
  const walk = (n: PlanNode) => {
    if (n.children?.length) n.children.forEach(walk)
    else out.push(n)
  }
  walk(root)
  return out
}

/** Finds a node by its path of ids */
export function nodeAt(root: PlanNode, path: string[]): PlanNode | undefined {
  let cur: PlanNode | undefined = root
  for (const id of path) {
    cur = cur?.children?.find((c) => c.id === id)
    if (!cur) return undefined
  }
  return cur
}

/** Chain of nodes from the root to the end of the track · for the breadcrumb */
export function chain(root: PlanNode, path: string[]): PlanNode[] {
  const out: PlanNode[] = []
  let cur: PlanNode | undefined = root
  for (const id of path) {
    cur = cur?.children?.find((c) => c.id === id)
    if (!cur) break
    out.push(cur)
  }
  return out
}

/** Level names, in order */
export const PLAN_LEVELS = ['الدورة', 'المسار', 'المجال', 'الهدف'] as const
