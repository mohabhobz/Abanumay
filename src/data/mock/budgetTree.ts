/**
 * Budget · settings and the item tree
 *
 * **Two sources:** the meeting on the budget, and the "budget tree (illustrative example)" table in
 * the document.
 *
 * Warning: **the budget isn't a number, it's a tree.** The old screen showed the allocated, held,
 * and spent amounts for a full year — correct figures, but they're the **result** of the tree, not
 * the tree itself. What the user actually works on is the structure: a track containing an area
 * containing a goal, with every parent equal to the sum of its children.
 *
 * === Reconciling the two sources ===
 *
 * The budget owner described **three types**: basic, primary, secondary — and said explicitly the
 * labels are for explanation and might change. The document's table shows **two types** (primary ·
 * secondary) along with a **level number**: "primary - 0" for the root, "primary - 1" for the
 * track, "primary - 2" for the area, "secondary - 3" for the goal.
 *
 * So what's built here follows the document's shape: **two types plus a computed level number**,
 * and the "basic item" meant is **primary at level zero** — a single unique one with no parent.
 * That reconciles both, and the user sees the label used in their own document.
 *
 * === And the difference that flips the UI ===
 *
 * Holding and spending happen **only on the leaf** (an item with no children) — anything above it
 * is **for reporting only**. So an item in the middle of the tree has a valid number and still
 * can't be held against or spent from — and that's not a technical detail, it's what makes the user
 * understand why the button is disabled.
 */
import { countOf, nf, NOUN } from '@/lib/format'

/* Settings · before any budget

   Warning: **the fiscal year is an independent entity, not a field in the budget form.** Any system
   anywhere that deals with money needs to know which year that money was spent in — and if the year
   were written inside the budget, every other financial transaction in the system would need to
   write it again and be reconciled by hand. */

export interface FiscalYear {
  id: string
  /** The year's name exactly as the user types it · 2026 */
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
 * Funding sources.
 *
 * Warning: **the symbol isn't decoration.** The Foundation manages its own endowments as well as
 * others' (an endowment belonging to the founder's wife, managed through the Foundation), and each
 * source's budget is fully separate. The symbol is what ties a transaction back to its source once
 * integration happens — the name can change, the symbol doesn't.
 */
export interface FundSource {
  code: string
  name: string
}

export const fundSources: FundSource[] = [
  { code: 'SA', name: 'وقف سليمان أبانمي' },
  { code: 'MM', name: 'وقف موضي المسفر' },
]

/* Item tree */

/**
 * Item type · as in the document's table.
 *
 * Warning: **the type is a user choice, not an inference from position.** It could be inferred from
 * depth and save the effort, but then the user never learns the structure — they'd add something
 * and find its name changed on its own. So they choose, and the rules tell them where it's wrong
 * and why — the same logic as rule 4 in registration: the list comes before the button, not a
 * message after it.
 */
/* Warning: **three types, not two — and the order is basic -> primary -> secondary.**

   The old version had two types (primary · secondary), and the root was also "primary" — meaning
   **one type described two different things**: the item that is the whole budget, and an item
   beneath it with goals under it. The result was that the rules could only tell them apart with
   `parentId === null`, which is a condition on **position**, not on **type** — so a tree with two
   roots would need to rely on a separate rule.

   Now the type states the level itself:
     basic     the budget itself, one, with no parent
     primary   a track or area, has items beneath it
     secondary a goal, the end of the tree, and where holding and spending happen */
export type LineKind = 'base' | 'main' | 'sub'

export const KIND_SAY: Record<LineKind, string> = {
  base: 'أساسي',
  main: 'رئيسي',
  sub: 'فرعي',
}

export const KIND_NOTE: Record<LineKind, string> = {
  base: 'الميزانية نفسها · بند واحد في الشجرة، بلا أب، ويأخذ المبلغ كاملًا',
  main: 'بند تحته بنود · مسار أو مجال',
  sub: 'هدف · آخر الشجرة، وعليه يكون الحجز والصرف',
}

/** Order in the hierarchy · the number is rank, not level */
export const KIND_RANK: Record<LineKind, number> = { base: 0, main: 1, sub: 2 }

/* Warning: **rank is not level, and that's the mistake made the first time.**

   The rule written was "every type sits one rank below the one above it," and running it produced
   **6 flags on the document's own tree**: "general education area is primary under primary." That's
   correct per the rule and wrong in reality — the document's own example is literally track -> area
   -> goal, and the first two are both primary.

   So the ordering requested ("first basic, then primary, then secondary") is an ordering of
   **types**, not a count of levels — levels stay open-ended, as the screen itself states: "three or
   five, as long as every item belongs under one above it."

     basic     the root alone, one per tree
     primary   under basic **or under primary**, so it can form track then area
     secondary under primary alone, the end of the tree, nothing beneath it */
export const KIND_UNDER: Record<LineKind, LineKind[]> = {
  base: [],
  main: ['base', 'main'],
  sub: ['main'],
}

export const kindFits = (kind: LineKind, parent: LineKind | undefined): boolean =>
  parent === undefined ? kind === 'base' : KIND_UNDER[kind].includes(parent)

/** Expected child type · offers a shortcut, doesn't block a choice */
export const kindUnder = (parent: LineKind | undefined): LineKind =>
  parent === undefined ? 'base' : parent === 'base' ? 'main' : 'sub'

export interface BudgetNode {
  id: string
  /** Internal item name · the one the Foundation works with */
  label: string
  /**
   * The name shown to users outside the Foundation.
   *
   * Warning: **this isn't a translation of the name, it's a different name for a different
   * purpose.** The internal name is written for accounting ("education grants - qualitative -
   * university"), and an entity reading its report wouldn't understand it, so the alternate name is
   * what shows to them.
   */
  alias?: string
  /**
   * Does the internal item name show externally?
   *
   * Warning: **and when this is `false`, the alternate name becomes required.** Otherwise the item
   * shows externally **with no name at all** — a user who turned off display didn't mean to hide
   * the item, they meant to hide the **internal label**.
   */
  showLabel: boolean
  kind: LineKind
  /** `null` for the tree root alone · that's "primary - 0" in the document */
  parentId: string | null
  /** Allocated amount */
  allocated: number
  /**
   * Available amount · allocated minus held minus spent.
   * Warning: **an independent figure, not computed from children**: a parent's available amount can
   * be less than the sum of its children's available amounts, because holding happens at the leaf —
   * the discrepancy shows up in the report, not from addition.
   */
  available: number
  /** Held on the leaf · requests linked to this line and still under decision */
  held?: number
  /** Paid out from the leaf · disbursed transfers */
  paid?: number
  /** An inactive item stays in the tree with no amounts · like the "Ramadan iftar track" */
  active: boolean
}

/** The four figures shown per line · allocated, held, paid, available */
export interface LineMoney {
  allocated: number
  held: number
  paid: number
  /** allocated − held − paid */
  available: number
}

/**
 * Money on a line, at any level.
 *
 * Holding and paying happen on the leaf only, so a parent's held and paid are the sums of its
 * active children, and available is always derived (allocated − held − paid) rather than read from
 * the stored field. A leaf without explicit held/paid (the generated 2026 tree) reads its whole
 * consumed part (allocated − stored available) as paid.
 */
export function moneyOf(nodes: BudgetNode[], id: string): LineMoney {
  const n = nodes.find((x) => x.id === id)
  if (!n || !n.active) return { allocated: n?.allocated ?? 0, held: 0, paid: 0, available: 0 }
  const kids = nodes.filter((x) => x.parentId === id && x.active)
  let held = 0
  let paid = 0
  if (kids.length) {
    for (const k of kids) {
      const m = moneyOf(nodes, k.id)
      held += m.held
      paid += m.paid
    }
  } else {
    held = n.held ?? 0
    paid = n.paid ?? Math.max(0, n.allocated - n.available - held)
  }
  return { allocated: n.allocated, held, paid, available: n.allocated - held - paid }
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

/* Tree readings */

export const childrenOf = (nodes: BudgetNode[], id: string | null): BudgetNode[] =>
  nodes.filter((n) => n.parentId === id)

export const hasChildren = (nodes: BudgetNode[], id: string): boolean =>
  nodes.some((n) => n.parentId === id)

/**
 * The name shown outside the Foundation.
 *
 * Warning: **one function, because this calculation will repeat across reports, the portal, and
 * export files.** If every screen computed it by hand, the first one that forgets would leak the
 * internal name, and that leak wouldn't show up in a review.
 */
export const publicName = (n: BudgetNode): string =>
  n.showLabel ? n.label : (n.alias?.trim() || '(بلا اسم معلن)')

export const rootOf = (nodes: BudgetNode[]): BudgetNode | undefined =>
  nodes.find((n) => n.parentId === null)

/** Sum of children's allocation · what's supposed to equal the parent's allocation */
export const sumChildren = (nodes: BudgetNode[], id: string): number =>
  childrenOf(nodes, id).filter((n) => n.active).reduce((s, n) => s + n.allocated, 0)

/** Level number · root is zero, matching the document's "item level" column */
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
 * Hierarchical numbering · 1 · 1.1 · 1.1.2 — matching the document's "item" column.
 *
 * Warning: **the number is computed, not stored.** If it were stored, the moment an item is removed
 * or moved, everything after it would be wrong, and this numbering is how the user reads the tree,
 * so a wrong one breaks the whole reading. The root has no number because it is the budget itself.
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
 * The item's full path.
 *
 * Warning: **a single parent name isn't enough.** When the user picks "secondary" and opens the
 * parent list, "education area" alone isn't a clear label — it could sit under the education track
 * or under a different one. The full path is what turns the choice into a decision rather than a
 * guess.
 */
export function pathOf(nodes: BudgetNode[], id: string): string {
  const parts: string[] = []
  let cur = nodes.find((n) => n.id === id)
  while (cur) {
    parts.push(cur.label)
    cur = cur.parentId ? nodes.find((x) => x.id === cur!.parentId) : undefined
  }
  /* Warning: the separator is a middle dot, not an em dash · the em dash is banned across the whole
     system, and the dot is the system's separator everywhere else */
  return parts.reverse().join(' · ')
}

/** Items where holding and spending happen · leaves only */
export const leavesOf = (nodes: BudgetNode[]): BudgetNode[] =>
  nodes.filter((n) => !hasChildren(nodes, n.id))

/** Display order · parent then its children · respects collapsed state */
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

/* Rules · all of them are **shown** before they're enforced

   The user picks what they want, and the list says where it's wrong and why — none of these block
   typing, they all block **submission**. */

export interface TreeIssue {
  /** The item the flag is about · empty means the whole tree */
  nodeId?: string
  text: string
  /** The rule's source · shown next to the flag */
  why: string
}

export function treeIssues(doc: BudgetDoc): TreeIssue[] {
  const out: TreeIssue[] = []
  const { nodes, total } = doc
  const live = nodes.filter((n) => n.active)

  /* 1 · exactly one root, never zero or two */
  const roots = nodes.filter((n) => n.parentId === null)
  if (roots.length === 0) {
    out.push({
      text: 'لا يوجد بند أساسي في الشجرة · أول بند في أي ميزانية أساسي عند المستوى صفر',
      why: 'الأساسي هو الميزانية نفسها',
    })
  } else if (roots.length > 1) {
    out.push({
      text: `يوجد ${countOf(roots.length, NOUN.line)} بلا أب · للميزانية جذر واحد فقط`,
      why: 'الجذر واحد لا يتكرر',
    })
  }

  /* 2 · the root takes the whole budget amount */
  const root = roots[0]
  if (root && root.allocated !== total) {
    out.push({
      nodeId: root.id,
      text: `مخصص الجذر ${nf.format(root.allocated)} ومبلغ الميزانية ${nf.format(total)}`,
      why: 'الجذر يأخذ كامل المبلغ',
    })
  }

  /* 3 · warning: **the type must match its position in the hierarchy.**
     The old version only checked "secondary with no parent" — so a basic item placed under a track,
     or a primary with no parent, passed through. A type that doesn't describe its position lets
     reports lump two levels together. */
  for (const n of nodes) {
    if (n.kind === 'base' && n.parentId) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» أساسي وله أب · الأساسي هو الميزانية نفسها، فلا يعلوه بند`,
        why: 'الأساسي جذر الشجرة',
      })
    }
    if (n.kind !== 'base' && !n.parentId) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» ${KIND_SAY[n.kind]} بلا أب · البند الذي بلا أب نوعه أساسي`,
        why: 'الترتيب: أساسي ثم رئيسي ثم فرعي',
      })
    }
    const up = n.parentId ? nodes.find((x) => x.id === n.parentId) : undefined
    if (up && !kindFits(n.kind, up.kind)) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» ${KIND_SAY[n.kind]} تحت ${KIND_SAY[up.kind]} «${up.label}» · ${KIND_SAY[n.kind]} مكانه تحت ${KIND_UNDER[n.kind].map((k) => KIND_SAY[k]).join(' أو ')}`,
        why: 'الترتيب أساسي ثم رئيسي ثم فرعي',
      })
    }
  }

  /* 3b · warning: **the alternate name is required whenever the internal name is hidden.**
     Otherwise the item shows outside the Foundation **with no name at all** — a user who turned off
     display meant to hide the internal label, not the item. */
  for (const n of nodes) {
    if (!n.showLabel && !n.alias?.trim()) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» اسمه الداخلي مخفي وليس له اسم ظاهر · سيظهر خارج المؤسسة بلا اسم`,
        why: 'البديل إلزامي مع إخفاء الاسم',
      })
    }
  }

  /* 4 · warning: **a secondary item can't have items beneath it.** "Secondary" in the document
     means a goal, and a goal is the end of the tree — anything with items beneath it is primary,
     whatever it's named, otherwise holding gets split across two levels. */
  for (const n of nodes) {
    if (n.kind === 'sub' && hasChildren(nodes, n.id)) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» فرعي وتحته بنود · البند الذي تحته بنود يكون رئيسيًا`,
        why: 'الفرعي آخر الشجرة',
      })
    }
  }

  /* 5 · children's sum = the parent's allocation */
  for (const n of live) {
    if (!hasChildren(nodes, n.id)) continue
    const s = sumChildren(nodes, n.id)
    if (s !== n.allocated) {
      out.push({
        nodeId: n.id,
        text: `مجموع أبناء «${n.label}» ${nf.format(s)} ومخصصه ${nf.format(n.allocated)}`,
        why: 'مجموع الأبناء = مخصص الأب',
      })
    }
  }

  /* 6 · warning: **an item's children must be a single type.**
     This is what the budget owner described as "you can't log a goal against a track that has
     areas" — an item with areas beneath it gets its goals logged against those areas, not against
     it directly. Without this rule the same amount gets held twice: once on the direct goal and
     once inside the area. */
  for (const n of nodes) {
    const kids = childrenOf(nodes, n.id)
    if (kids.length < 2) continue
    if (new Set(kids.map((k) => k.kind)).size > 1) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» تحته بنود رئيسية وفرعية معًا · تُسجَّل الأهداف على البنود التي تحته لا عليه`,
        why: 'أبناء البند من نوع واحد',
      })
    }
  }

  /* 7 · the tree must reach a leaf, or there's nothing to spend against */
  const leaves = leavesOf(live)
  if (root && (leaves.length === 0 || (leaves.length === 1 && leaves[0]?.id === root.id))) {
    out.push({
      text: 'الشجرة بند واحد · تحتاج على الأقل إلى بند رئيسي وبند فرعي يُصرف منه',
      why: 'الصرف يكون على آخر الشجرة',
    })
  }

  return out
}

/** (year + source) can't repeat · the only budget rule shown in the header */
export const yearSourceTaken = (
  docs: BudgetDoc[],
  yearId: string,
  sourceCode: string,
  exceptId?: string,
): BudgetDoc | undefined =>
  docs.find((d) => d.id !== exceptId && d.yearId === yearId && d.sourceCode === sourceCode)

/* A sample budget · **copied verbatim from the document's table**

   Numbers, labels, and levels exactly as in "budget tree (illustrative example)," including the
   "Ramadan iftar track" **inactive with no amounts** — because that case is exactly what shows an
   inactive item stays in the tree without entering the totals. */

const n = (
  id: string,
  label: string,
  kind: LineKind,
  parentId: string | null,
  allocated: number,
  available: number,
  active = true,
  /** Alternate name and display · defaults to the internal name being shown */
  alias?: string,
): BudgetNode => ({
  id, label, kind, parentId, allocated, available, active,
  alias,
  showLabel: alias === undefined,
})

/** A leaf with its held and paid figures · available = allocated − held − paid */
const leaf = (
  id: string, label: string, parentId: string, allocated: number, held: number, paid: number,
): BudgetNode => ({ ...n(id, label, 'sub', parentId, allocated, allocated - held - paid), held, paid })

export const budgetDocs: BudgetDoc[] = [
  {
    id: 'BG-2025-SA',
    yearId: 'fy-2025',
    sourceCode: 'SA',
    from: '2025-01-01',
    to: '2025-12-31',
    total: 30_000_000,
    state: 'submitted',
    /* Held and paid are set on the leaves so that held + paid = allocated − the document's
       available. Two figures in the document broke that identity and are corrected here: the root
       showed 30M available with 2.1M consumed beneath it (now 27.9M), and "awareness campaigns" showed
       more available than allocated (2.3M of 2.2M, now 2.2M, which carries into its area and track). */
    nodes: [
      n('b0', 'ميزانية المنح - 2025', 'base', null, 30_000_000, 27_900_000),

      n('t1', 'مسار التعليم', 'main', 'b0', 12_000_000, 11_200_000),
      n('f11', 'مجال التعليم العام', 'main', 't1', 6_000_000, 5_400_000),
      leaf('g111', 'هدف تطوير المدارس', 'f11', 3_500_000, 150_000, 250_000),
      leaf('g112', 'هدف دعم الطلاب', 'f11', 2_500_000, 80_000, 120_000),
      n('f12', 'مجال التعليم العالي', 'main', 't1', 6_000_000, 5_800_000),
      leaf('g121', 'هدف المنح الدراسية', 'f12', 4_000_000, 100_000, 0),
      leaf('g122', 'هدف البحث العلمي', 'f12', 2_000_000, 40_000, 60_000),

      n('t2', 'مسار الصحة', 'main', 'b0', 10_000_000, 9_000_000),
      n('f21', 'مجال الرعاية الصحية', 'main', 't2', 6_000_000, 5_000_000),
      leaf('g211', 'هدف دعم المستشفيات', 'f21', 3_500_000, 200_000, 400_000),
      leaf('g212', 'هدف الأجهزة الطبية', 'f21', 2_500_000, 150_000, 250_000),
      n('f22', 'مجال التوعية الصحية', 'main', 't2', 4_000_000, 4_000_000),
      leaf('g221', 'هدف حملات التوعية', 'f22', 2_200_000, 0, 0),
      leaf('g222', 'هدف البرامج الوقائية', 'f22', 1_800_000, 0, 0),

      n('t3', 'مسار التنمية المجتمعية', 'main', 'b0', 8_000_000, 7_700_000),
      { ...n('f31', 'مجال تمكين الأفراد', 'main', 't3', 4_000_000, 3_800_000), held: 50_000, paid: 150_000 },
      { ...n('f32', 'مجال دعم المجتمع', 'main', 't3', 4_000_000, 3_900_000), held: 100_000, paid: 0 },

      /* Warning: inactive and with no amounts · exists in the tree and doesn't enter the totals */
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

/** The displayed budget name · built from the year and source, not typed */
export const docTitle = (d: BudgetDoc): string =>
  `ميزانية ${yearById(d.yearId)?.name ?? ''} · ${sourceByCode(d.sourceCode)?.name ?? d.sourceCode}`
