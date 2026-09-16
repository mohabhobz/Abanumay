/**
 * الميزانية · الإعدادات وشجرة البنود
 *
 * **المصدران:** ميتنج مظفر · 15 سبتمبر 2026 · وجدول «شجرة
 * الميزانية (مثال توضيحي)» في الوثيقة.
 *
 * ⚠️ **الميزانية مش رقم، هي شجرة.** الشاشة القديمة كانت بتعرض
 * المخصص والمحجوز والمصروف لسنة كاملة — أرقام صحيحة، لكنها
 * **نتيجة** الشجرة لا الشجرة نفسها. واللي بيشتغل عليه المستخدم
 * فعلًا هو البناء: مسار جوّاه مجال جوّاه هدف، وكل أب مجموع أبنائه.
 *
 * ═══ توفيق بين المصدرين ═══
 *
 * مظفر وصف **تلات أنواع**: أساسي · رئيسي · فرعي — وقال صراحةً إن
 * المسمّيات للشرح وممكن تتغيّر. وجدول الوثيقة بيعرض **نوعين**
 * (رئيسي · فرعي) ومعاهم **رقم المستوى**: «رئيسي - 0» للجذر،
 * «رئيسي - 1» للمسار، «رئيسي - 2» للمجال، «فرعي - 3» للهدف.
 *
 * فالمبنيّ هنا هو شكل الوثيقة: **نوعان ورقم مستوى محسوب**، و«البند
 * الأساسي» اللي مظفر قصده هو **الرئيسي عند المستوى صفر** — واحد
 * يونيك ومالوش أب. كده الاتنين متوفّقين والمستخدم بيشوف المسمّى
 * اللي في وثيقته.
 *
 * ═══ والفرق اللي بيقلب الواجهة ═══
 *
 * **الحجز والدفع بيحصلوا على الورقة وحدها** (البند اللي مالوش
 * أبناء) · واللي فوقها **للتقارير**. يعني بند في نص الشجرة رقمه
 * صحيح ومع ذلك ما ينفعش تحجز عليه ولا تصرف منه · وده مش تفصيلة
 * تقنية، ده اللي بيخلّي المستخدم يفهم ليه الزرار مقفول.
 */
import { nf } from '@/lib/format'

/* ═══════════════════════════════════════════════════════════
   الإعدادات · قبل أي ميزانية

   ⚠️ **السنة المالية كيان مستقل، مش خانة في فورم الميزانية.**
   «أي سيستم في الدنيا فيه فلوس لازم يعرف الفلوس دي اتصرفت في أنهي
   سنة» — ولو السنة اتكتبت جوّه الميزانية، كل حركة مالية تانية في
   السيستم هتحتاج تكتبها من تاني وتوفّق بينهم بالإيد.
   ═══════════════════════════════════════════════════════════ */

export interface FiscalYear {
  id: string
  /** اسم السنة زي ما المستخدم بيكتبه · 2026 */
  name: string
  from: string
  to: string
}

export const fiscalYears: FiscalYear[] = [
  { id: 'fy-2026', name: '2026', from: '2026-01-01', to: '2026-12-31' },
  { id: 'fy-2025', name: '2025', from: '2025-01-01', to: '2025-12-31' },
  { id: 'fy-2024', name: '2024', from: '2024-01-01', to: '2024-12-31' },
  { id: 'fy-2023', name: '2023', from: '2023-01-01', to: '2023-12-31' },
]

/**
 * مصادر التمويل.
 *
 * ⚠️ **الرمز مش زينة.** المؤسسة بتدير أوقافها وأوقاف تانية (وقف
 * موضي المسفر أوقاف زوجة المؤسِّس، بتُدار عن طريق المؤسسة)، وكل
 * مصدر ميزانيته منفصلة تمامًا. والرمز هو اللي بيربط الحركة المالية
 * بمصدرها لما الانتجريشن يجي · الاسم بيتغيّر، الرمز لأ.
 */
export interface FundSource {
  code: string
  name: string
}

export const fundSources: FundSource[] = [
  { code: 'SA', name: 'وقف سليمان أبانمي' },
  { code: 'MM', name: 'وقف موضي المسفر' },
]

/* ═══════════════════════════════════════════════════════════
   شجرة البنود
   ═══════════════════════════════════════════════════════════ */

/**
 * نوع البند · زي جدول الوثيقة.
 *
 * ⚠️ **النوع اختيار المستخدم، مش استنتاج من المكان.** ممكن
 * نستنتجه من العمق ونريّح نفسنا، لكن ساعتها المستخدم ما بيتعلّمش
 * الهيكل — بيحطّ حاجة ويلاقي اسمها اتغيّر لوحده. فهو بيختار،
 * والقواعد بتقول له غلط فين وليه · نفس منطق قاعدة 4 في التسجيل:
 * القائمة قبل الزرار لا الرسالة بعده.
 */
export type LineKind = 'main' | 'sub'

export const KIND_SAY: Record<LineKind, string> = {
  main: 'رئيسي',
  sub: 'فرعي',
}

export const KIND_NOTE: Record<LineKind, string> = {
  main: 'بند تحته بنود · مسار أو مجال',
  sub: 'هدف · آخر الشجرة، وعليه يتم الحجز والصرف',
}

export interface BudgetNode {
  id: string
  label: string
  kind: LineKind
  /** `null` لجذر الشجرة وحده · وهو «رئيسي - 0» في الوثيقة */
  parentId: string | null
  /** المبلغ المخصص */
  allocated: number
  /**
   * المبلغ المتاح · المخصص ناقص المحجوز والمصروف.
   * ⚠️ **رقم مستقل لا محسوب من الأبناء**: الأب ممكن يكون متاحه
   * أقل من مجموع متاح أبنائه لأن الحجز بيحصل على الورقة، والفرق
   * بيطلع من التقرير لا من الجمع.
   */
  available: number
  /** غير النشط بيفضل في الشجرة بلا مبالغ · زي «مسار تفطير الصائمين» */
  active: boolean
}

export type BudgetState = 'draft' | 'submitted'

export interface BudgetDoc {
  id: string
  yearId: string
  sourceCode: string
  from: string
  to: string
  total: number
  state: BudgetState
  nodes: BudgetNode[]
}

/* ═══ قراءات الشجرة ═══ */

export const childrenOf = (nodes: BudgetNode[], id: string | null): BudgetNode[] =>
  nodes.filter((n) => n.parentId === id)

export const hasChildren = (nodes: BudgetNode[], id: string): boolean =>
  nodes.some((n) => n.parentId === id)

export const rootOf = (nodes: BudgetNode[]): BudgetNode | undefined =>
  nodes.find((n) => n.parentId === null)

/** مجموع مخصص الأبناء · القيمة اللي المفروض تساوي مخصص الأب */
export const sumChildren = (nodes: BudgetNode[], id: string): number =>
  childrenOf(nodes, id).filter((n) => n.active).reduce((s, n) => s + n.allocated, 0)

/** رقم المستوى · الجذر صفر، زي عمود «مستوى البند» في الوثيقة */
export function levelOf(nodes: BudgetNode[], id: string): number {
  let d = 0
  let cur = nodes.find((n) => n.id === id)
  while (cur?.parentId) {
    d += 1
    cur = nodes.find((x) => x.id === cur!.parentId)
  }
  return d
}

/**
 * الترقيم الهرمي · 1 · 1.1 · 1.1.2 — زي عمود «البند» في الوثيقة.
 *
 * ⚠️ **الرقم محسوب لا مكتوب.** لو اتكتب في الداتا، أول ما بند
 * يتشال أو يتحرّك يبقى كل اللي بعده بيكدب · والترقيم هو اللي
 * المستخدم بيقرا بيه الشجرة، فكذبه بيكسر القراءة كلها. والجذر
 * مالوش رقم لأنه الميزانية نفسها.
 */
export function outlineOf(nodes: BudgetNode[], id: string): string {
  const parts: number[] = []
  let cur = nodes.find((n) => n.id === id)
  while (cur?.parentId) {
    const sibs = childrenOf(nodes, cur.parentId)
    parts.push(sibs.findIndex((s) => s.id === cur!.id) + 1)
    cur = nodes.find((x) => x.id === cur!.parentId)
  }
  return parts.reverse().join('.')
}

/**
 * المسار الكامل للبند.
 *
 * ⚠️ **الأب اسم واحد ما بيكفيش.** لما المستخدم يختار «فرعي»
 * ويفتح قائمة الآباء، «مجال التعليم» لوحدها مش عنوان: ممكن تكون
 * تحت مسار التعليم وممكن تحت مسار آخر. المسار الكامل هو اللي
 * بيخلّي الاختيار قرارًا لا تخمينًا.
 */
export function pathOf(nodes: BudgetNode[], id: string): string {
  const parts: string[] = []
  let cur = nodes.find((n) => n.id === id)
  while (cur) {
    parts.push(cur.label)
    cur = cur.parentId ? nodes.find((x) => x.id === cur!.parentId) : undefined
  }
  return parts.reverse().join(' — ')
}

/** البنود اللي عليها الحجز والصرف · الورق وحده */
export const leavesOf = (nodes: BudgetNode[]): BudgetNode[] =>
  nodes.filter((n) => !hasChildren(nodes, n.id))

/** ترتيب العرض · أب ثم أبناؤه · وبيحترم المطويّ */
export function flatten(
  nodes: BudgetNode[],
  parentId: string | null = null,
  shut?: Set<string>,
): BudgetNode[] {
  const out: BudgetNode[] = []
  for (const n of childrenOf(nodes, parentId)) {
    out.push(n)
    if (!shut?.has(n.id)) out.push(...flatten(nodes, n.id, shut))
  }
  return out
}

/* ═══════════════════════════════════════════════════════════
   القواعد · كلها **تُعرَض** قبل ما تُفرَض

   المستخدم بيختار اللي هو عايزه، والقايمة بتقول الغلط فين وليه ·
   ولا واحدة من دول بتمنع كتابة، كلها بتمنع **الإرسال**.
   ═══════════════════════════════════════════════════════════ */

export interface TreeIssue {
  /** البند اللي عليه الملاحظة · فاضي يعني الشجرة كلها */
  nodeId?: string
  text: string
  /** مصدر القاعدة · بيتكتب جنب الملاحظة */
  why: string
}

export function treeIssues(doc: BudgetDoc): TreeIssue[] {
  const out: TreeIssue[] = []
  const { nodes, total } = doc
  const live = nodes.filter((n) => n.active)

  /* 1 · جذر واحد، ولا صفر ولا اتنين */
  const roots = nodes.filter((n) => n.parentId === null)
  if (roots.length === 0) {
    out.push({
      text: 'الشجرة مفيهاش بند جذر · أول بند في أي ميزانية هو الرئيسي عند المستوى صفر',
      why: 'الجذر هو الميزانية نفسها',
    })
  } else if (roots.length > 1) {
    out.push({
      text: `في ${roots.length} بنود بلا أب · الميزانية ليها جذر واحد`,
      why: 'الجذر يونيك',
    })
  }

  /* 2 · الجذر بياخد كامل مبلغ الميزانية */
  const root = roots[0]
  if (root && root.allocated !== total) {
    out.push({
      nodeId: root.id,
      text: `الجذر ${nf.format(root.allocated)} والميزانية ${nf.format(total)}`,
      why: 'الجذر بياخد كامل المبلغ',
    })
  }

  /* 3 · الفرعي ما يكونش جذرًا */
  for (const n of nodes) {
    if (n.kind === 'sub' && !n.parentId) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» فرعي بلا بند أعلى · الفرعي لازم يتبع بندًا`,
        why: 'الفرعي آخر الشجرة',
      })
    }
  }

  /* 4 ⚠️ **الفرعي ما يكونش تحته بنود.** «فرعي» في الوثيقة يعني
     هدف، والهدف هو آخر الشجرة · اللي تحته بنود بيبقى رئيسيًا
     مهما كان اسمه، وإلا الحجز بيتوزّع على مستويين. */
  for (const n of nodes) {
    if (n.kind === 'sub' && hasChildren(nodes, n.id)) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» فرعي وتحته بنود · اللي تحته بنود بيبقى رئيسيًا`,
        why: 'الفرعي آخر الشجرة',
      })
    }
  }

  /* 5 · مجموع الأبناء = مخصص الأب */
  for (const n of live) {
    if (!hasChildren(nodes, n.id)) continue
    const s = sumChildren(nodes, n.id)
    if (s !== n.allocated) {
      out.push({
        nodeId: n.id,
        text: `أبناء «${n.label}» مجموعهم ${nf.format(s)} ومخصصه ${nf.format(n.allocated)}`,
        why: 'مجموع الأبناء = مخصص الأب',
      })
    }
  }

  /* 6 ⚠️ **أبناء البند الواحد من نوع واحد.**
     ده اللي مظفر وصفه بـ«ما ينفعش تسجّل هدف على مسار له مجالات» ·
     البند اللي تحته مجالات، أهدافه بتتسجّل على المجالات لا عليه.
     ولولا القاعدة دي، نفس المبلغ بيتحجز مرتين: مرة على الهدف
     المباشر ومرة داخل المجال. */
  for (const n of nodes) {
    const kids = childrenOf(nodes, n.id)
    if (kids.length < 2) continue
    if (new Set(kids.map((k) => k.kind)).size > 1) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» تحته بنود رئيسية وفرعية مع بعض · الأهداف بتتسجّل على البنود اللي تحته لا عليه`,
        why: 'أبناء البند من نوع واحد',
      })
    }
  }

  /* 7 · الشجرة لازم توصل لورقة، وإلا مفيش حاجة يتصرف منها */
  const leaves = leavesOf(live)
  if (root && (leaves.length === 0 || (leaves.length === 1 && leaves[0]?.id === root.id))) {
    out.push({
      text: 'الشجرة بند واحد · محتاجة على الأقل بندًا رئيسيًا وبندًا فرعيًا يتصرف منه',
      why: 'الصرف بيحصل على آخر الشجرة',
    })
  }

  return out
}

/** (سنة + مصدر) ما يتكرروش · قاعدة الميزانية الوحيدة على الترويسة */
export const yearSourceTaken = (
  docs: BudgetDoc[],
  yearId: string,
  sourceCode: string,
  exceptId?: string,
): BudgetDoc | undefined =>
  docs.find((d) => d.id !== exceptId && d.yearId === yearId && d.sourceCode === sourceCode)

/* ═══════════════════════════════════════════════════════════
   ميزانية تجريبية · **منقولة من جدول الوثيقة حرفيًا**

   الأرقام والمسمّيات والمستويات زي «شجرة الميزانية (مثال توضيحي)»
   بالظبط، ومعاها «مسار تفطير الصائمين» **غير النشط بلا مبالغ** ·
   لأن الحالة دي هي اللي بتوضّح إن غير النشط بيفضل في الشجرة ولا
   بيدخل في المجاميع.
   ═══════════════════════════════════════════════════════════ */

const n = (
  id: string,
  label: string,
  kind: LineKind,
  parentId: string | null,
  allocated: number,
  available: number,
  active = true,
): BudgetNode => ({ id, label, kind, parentId, allocated, available, active })

export const budgetDocs: BudgetDoc[] = [
  {
    id: 'BG-2025-SA',
    yearId: 'fy-2025',
    sourceCode: 'SA',
    from: '2025-01-01',
    to: '2025-12-31',
    total: 30_000_000,
    state: 'submitted',
    nodes: [
      n('b0', 'ميزانية المنح - 2025', 'main', null, 30_000_000, 30_000_000),

      n('t1', 'مسار التعليم', 'main', 'b0', 12_000_000, 11_200_000),
      n('f11', 'مجال التعليم العام', 'main', 't1', 6_000_000, 5_400_000),
      n('g111', 'هدف تطوير المدارس', 'sub', 'f11', 3_500_000, 3_100_000),
      n('g112', 'هدف دعم الطلاب', 'sub', 'f11', 2_500_000, 2_300_000),
      n('f12', 'مجال التعليم العالي', 'main', 't1', 6_000_000, 5_800_000),
      n('g121', 'هدف المنح الدراسية', 'sub', 'f12', 4_000_000, 3_900_000),
      n('g122', 'هدف البحث العلمي', 'sub', 'f12', 2_000_000, 1_900_000),

      n('t2', 'مسار الصحة', 'main', 'b0', 10_000_000, 9_100_000),
      n('f21', 'مجال الرعاية الصحية', 'main', 't2', 6_000_000, 5_000_000),
      n('g211', 'هدف دعم المستشفيات', 'sub', 'f21', 3_500_000, 2_900_000),
      n('g212', 'هدف الأجهزة الطبية', 'sub', 'f21', 2_500_000, 2_100_000),
      n('f22', 'مجال التوعية الصحية', 'main', 't2', 4_000_000, 4_100_000),
      n('g221', 'هدف حملات التوعية', 'sub', 'f22', 2_200_000, 2_300_000),
      n('g222', 'هدف البرامج الوقائية', 'sub', 'f22', 1_800_000, 1_800_000),

      n('t3', 'مسار التنمية المجتمعية', 'main', 'b0', 8_000_000, 7_700_000),
      n('f31', 'مجال تمكين الأفراد', 'main', 't3', 4_000_000, 3_800_000),
      n('f32', 'مجال دعم المجتمع', 'main', 't3', 4_000_000, 3_900_000),

      /* ⚠️ غير نشط وبلا مبالغ · موجود في الشجرة وما بيدخلش المجاميع */
      n('t4', 'مسار تفطير الصائمين', 'main', 'b0', 0, 0, false),
    ],
  },
  {
    id: 'BG-2026-MM',
    yearId: 'fy-2026',
    sourceCode: 'MM',
    from: '2026-01-01',
    to: '2026-12-31',
    total: 4_200_000,
    state: 'draft',
    nodes: [
      n('m0', 'ميزانية وقف موضي المسفر - 2026', 'main', null, 4_200_000, 4_200_000),
      n('mt1', 'مسار المساهمات العامة', 'main', 'm0', 4_200_000, 4_200_000),
      n('mg1', 'هدف المحفظة المتنوعة', 'sub', 'mt1', 4_200_000, 4_200_000),
    ],
  },
]

export const budgetDocById = (id: string): BudgetDoc | undefined =>
  budgetDocs.find((d) => d.id === id)

export const yearById = (id: string): FiscalYear | undefined =>
  fiscalYears.find((y) => y.id === id)

export const sourceByCode = (code: string): FundSource | undefined =>
  fundSources.find((s) => s.code === code)

/** اسم الميزانية المعروض · مبني من السنة والمصدر لا مكتوب */
export const docTitle = (d: BudgetDoc): string =>
  `ميزانية ${yearById(d.yearId)?.name ?? ''} · ${sourceByCode(d.sourceCode)?.name ?? d.sourceCode}`
