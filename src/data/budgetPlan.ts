/**
 * خطة الميزانية — **شجرة التخصيص الحقيقية لدورة 2026 · المؤسسة**.
 *
 * المصدر: `control/struct_section` (شاشة «المجالات والأهداف»، وهي
 * محرّر التخصيص) و`control/reports1_1` (شاشة القراءة). قراءة مباشرة،
 * كل الطلبات `GET`، ولم يُرسل فورم ولم يُضغط زر حفظ.
 *
 * ⚠️ **الأرقام هنا حقيقية** — المخصص وخطة الإنجاز والمحجوز والمنصرف
 * لكل بند من الـ48 هدفًا. اللي مولَّد هو **أسماء الملّاك** فقط، من
 * قائمة النموذج، لأن الريبو عام.
 *
 * ═══ ليه الموديول ده موجود ═══
 *
 * النظام العامل بيخزّن الشجرة دي في أربع شاشات متتالية: تفتح السنة،
 * تضغط «عرض» فتروح لصفحة المسار، وهكذا. وكل صفحة بتطبع **مجموع
 * أبنائها** في آخر صف — لكن **مخصص الأب مكتوب في الصفحة اللي قبلها**.
 * فالرقمان ما بيتشافوش مع بعض أبدًا.
 *
 * ولما جمعناهم طلع إن **عشرة بنود من أربعتاشر مجموع أبنائها لا يساوي
 * مخصصها**، أكبرها فرق 736,000 ريال. مش خطأ قراءة — ده اللي في
 * النظام. فالموديول ده أول حاجة بيعملها إنه يحطّ الرقمين جنب بعض.
 */

/**
 * عقدة في شجرة التخصيص — **بكل حقول `struct_section`**، لا المبلغ وحده.
 * الحقول اللي في المحرّر: الاسم · المبلغ المخصص (`money`) · خطة الإنجاز
 * (`num`) · الترتيب (`weight`) · مخفي (`hidden`) · الصلاحية (`spPerm`)
 * · المستخدم (`spPerm_uid`). وكلها هنا عشان الجرد يفضل كاملًا.
 */
export interface PlanNode {
  id: string
  label: string
  /** المبلغ المخصص لهذا البند — `money` */
  alloc: number
  /** خطة الإنجاز % — `num`. بتدخل في «نسبة الإنجاز من الخطة الإستراتيجية» */
  plan: number
  /** الترتيب في العرض — `weight`. النظام بيرتّب بيه لا بالاسم */
  order: number
  /** مخفي عن قوائم الاختيار — `hidden`. كلهم مطفيّون في الدورة المفعَّلة */
  hidden?: boolean
  /** الصلاحية — `spPerm`. القائمة فيها خيار واحد بس: «عام» */
  perm?: 'عام'
  /** مالك البند — `spPerm_uid` (الاسم مولَّد، والتوزيع حقيقي) */
  owner?: string
  /** المعتمد — من `reports1_1`، مش موجود في المحرّر */
  approved?: number
  /** المحجوز — طلبات تحت الدراسة على هذا البند */
  reserved?: number
  /** المنصرف فعلًا */
  spent?: number
  children?: PlanNode[]
}

/* ── الأهداف: [الاسم, المخصص, المحجوز, المنصرف] ── */
type G = [string, number, number, number]

const g = (rows: G[], owner: string): PlanNode[] =>
  rows.map(([label, alloc, reserved, spent], i) => ({
    id: `${owner}-${i}-${label}`,
    label, alloc, plan: 100, order: i, hidden: false, perm: 'عام' as const,
    owner, reserved, spent,
  }))

/**
 * الملّاك — من قائمة النموذج لا من النظام.
 * التوزيع الحقيقي أربعة ملّاك على اتناشر مجالًا، فالشكل محفوظ
 * والأسماء مستبدَلة.
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
      /* هدف مفعَّل بمخصص صفر — موجود في القايمة ومحدش يقدر يصرف عليه */
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
    /* خطة الإنجاز صفر — البند مستثنى من حساب الإنجاز الإستراتيجي */
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
    /* خطة الإنجاز صفر — زي «الدعوة» */
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

/** شجرة دورة 2026 · المؤسسة — مسارَان، اتناشر مجالًا، تمانية وأربعون هدفًا */
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
 * الدورات الخمس.
 *
 * كل دورة = **سنة × مصدر تمويل**، وميزانيتها مستقلة تمامًا. المؤسسة
 * والوقف ما بيتجمّعوش، وده تأكيد من فلتر السنة نفسه في النظام.
 * شجرة التخصيص الكاملة متاحة لـ2026 (الدورة المفعَّلة)؛ الباقي
 * إجمالياته من `reports1_1`.
 */
export interface Cycle {
  id: string
  label: string
  alloc: number
  approved: number
  reserved: number
  spent: number
  /** الشجرة كاملة — للدورة المفعَّلة فقط */
  tree?: PlanNode
  /** `active` — الدورة المفعَّلة **للمؤسسة** */
  active: boolean
  /** `active2` — الدورة المفعَّلة **للوقف**. علمان مستقلّان في نفس الصف */
  activeWaqf: boolean
}

export const CYCLES: Cycle[] = [
  { id: '2026-f', label: '2026 · المؤسسة', alloc: 73_600_000, approved: 64_154_182, reserved: 19_503_581, spent: 44_650_601, tree: plan2026, active: true, activeWaqf: false },
  { id: '2025-f', label: '2025 · المؤسسة', alloc: 55_800_000, approved: 58_639_800, reserved: 896_000, spent: 57_743_800, active: false, activeWaqf: false },
  { id: '2024-f', label: '2024 · المؤسسة', alloc: 47_200_000, approved: 47_475_359, reserved: 60_000, spent: 47_415_359, active: false, activeWaqf: false },
  { id: '2023-f', label: '2023 · المؤسسة', alloc: 2_849_573, approved: 847_479, reserved: 0, spent: 847_479, active: false, activeWaqf: false },
  /* 🔴 دورة الوقف المفعَّلة هي 2023 — `active2` متعلَّم على الصف ده وحده.
     يعني الوقف واقف على دورة عمرها تلات سنين، مليون ريال ما اتصرف
     منها ولا ريال. المؤسسة على 2026 والوقف على 2023 في نفس الجدول. */
  { id: '2023-w', label: '2023 · الوقف', alloc: 1_000_000, approved: 0, reserved: 0, spent: 0, active: false, activeWaqf: true },
]

export const cycleById = (id: string): Cycle =>
  CYCLES.find((c) => c.id === id) ?? CYCLES[0]

/* ═══════════════════ فحص التوازن ═══════════════════ */

export interface Imbalance {
  /** مسار العقدة من الجذر — للتنقّل */
  path: string[]
  label: string
  /** مستوى العقدة: 0 سنة · 1 مسار · 2 مجال */
  level: number
  alloc: number
  childSum: number
  /** موجب = الأبناء أكتر من الأب */
  gap: number
}

export const childSum = (n: PlanNode): number =>
  (n.children ?? []).reduce((s, c) => s + c.alloc, 0)

/**
 * كل بند مجموع أبنائه لا يساوي مخصصه.
 *
 * ده **الفحص اللي مش موجود في النظام العامل**: هناك الرقمان في
 * صفحتين مختلفتين، فالفرق ما بيتشافش. هنا بيتحسب على الشجرة كلها
 * مرة واحدة.
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

/** عدد البنود اللي ليها أبناء — مقام نسبة التوازن */
export function parentCount(root: PlanNode): number {
  let n = 0
  const walk = (x: PlanNode) => {
    if (x.children?.length) { n += 1; x.children.forEach(walk) }
  }
  walk(root)
  return n
}

/** كل الأهداف مسطَّحة — لأسئلة زي «مين البنود المخنوقة» */
export function leaves(root: PlanNode): PlanNode[] {
  const out: PlanNode[] = []
  const walk = (n: PlanNode) => {
    if (n.children?.length) n.children.forEach(walk)
    else out.push(n)
  }
  walk(root)
  return out
}

/** يلاقي عقدة بمسار معرّفاتها */
export function nodeAt(root: PlanNode, path: string[]): PlanNode | undefined {
  let cur: PlanNode | undefined = root
  for (const id of path) {
    cur = cur?.children?.find((c) => c.id === id)
    if (!cur) return undefined
  }
  return cur
}

/** سلسلة العُقد من الجذر لآخر المسار — لمسار الفتات */
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

/** أسماء المستويات بالترتيب */
export const PLAN_LEVELS = ['الدورة', 'المسار', 'المجال', 'الهدف'] as const
