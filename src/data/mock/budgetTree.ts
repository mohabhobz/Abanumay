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
  /* Defined ahead · a year can carry a budget, and commitments, before it starts (1.4.48) */
  { id: 'fy-2027', name: '2027', from: '2027-01-01', to: '2027-12-31' },
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

/** A share of a whole carried by one funding source (1.2.5 · 1.4.4) */
export interface SourceShare {
  code: string
  amount: number
}

/** Two periods overlap · one fiscal year per period (1.4.1) */
export const yearOverlap = (
  years: FiscalYear[], from: string, to: string, exceptId?: string,
): FiscalYear | undefined =>
  years.find((y) => y.id !== exceptId && from <= y.to && to >= y.from)

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
  /** An inactive item stays in the tree · its figures and past holds stay, new projects can't use it
      (1.4.37 · 1.4.38) */
  active: boolean
  /** Turned off because this ancestor was · reactivating the ancestor brings it back (1.4.39) */
  offBy?: string
  /** The line's split across the budget's funding sources · sums to `allocated` (1.2.5) */
  sources?: SourceShare[]
  /** The grants supervisors responsible for this domain · feed intake distribution (1.1.input-7) */
  owners?: string[]
  /** The strategic direction this line serves (1.1.input-1) */
  directionId?: string
  /** Future-year shares of multi-year projects recorded on this line · not holds (1.4.48) */
  committed?: number
}

/** The figures shown per line · allocated, held, committed, paid, available (1.4.5) */
export interface LineMoney {
  allocated: number
  held: number
  /** Future commitments recorded against the line · multi-year shares not yet held */
  committed: number
  paid: number
  /** allocated − held − committed − paid */
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
  if (!n) return { allocated: 0, held: 0, committed: 0, paid: 0, available: 0 }
  /* An inactive line keeps what was already held and paid on it (1.4.38) · it only stops taking new
     projects, so its history still sums into its parents */
  const kids = nodes.filter((x) => x.parentId === id)
  let held = 0
  let paid = 0
  let committed = 0
  if (kids.length) {
    for (const k of kids) {
      const m = moneyOf(nodes, k.id)
      held += m.held
      paid += m.paid
      committed += m.committed
    }
  } else {
    held = n.held ?? 0
    committed = n.committed ?? 0
    paid = n.paid ?? Math.max(0, n.allocated - n.available - held)
  }
  return { allocated: n.allocated, held, committed, paid, available: n.allocated - held - committed - paid }
}

/** Pin a leaf's derived paid figure before its allocation or holds move · `paid` is derived from
    `available` on generated leaves, and changing either would rewrite history */
export function freezeLine(n: BudgetNode): void {
  if (n.paid === undefined) n.paid = Math.max(0, n.allocated - n.available - (n.held ?? 0))
  if (n.held === undefined) n.held = 0
}

/** Keep the stored available figure in step after a change */
export const restate = (n: BudgetNode): void => {
  n.available = n.allocated - (n.held ?? 0) - (n.paid ?? 0)
}

/** A line new projects may use · active, and every line above it active (1.4.26 · 1.4.39) */
export function lineUsable(nodes: BudgetNode[], id: string): boolean {
  let cur = nodes.find((x) => x.id === id)
  while (cur) {
    if (!cur.active) return false
    const up: string | null = cur.parentId
    cur = up ? nodes.find((x) => x.id === up) : undefined
  }
  return true
}

/** Turn a line on or off · off carries down to every active line beneath it and remembers why, on
    brings back only the lines this one turned off (1.4.39). Returns the ids that changed. */
export function cascadeActive(nodes: BudgetNode[], id: string, on: boolean): string[] {
  const self = nodes.find((x) => x.id === id)
  if (!self) return []
  const changed: string[] = []
  const below = (pid: string): BudgetNode[] => nodes.filter((x) => x.parentId === pid).flatMap((k) => [k, ...below(k.id)])
  if (!on) {
    if (self.active) { self.active = false; self.offBy = undefined; changed.push(id) }
    for (const k of below(id)) {
      if (k.active) { k.active = false; k.offBy = id; changed.push(k.id) }
    }
  } else {
    if (!self.active) { self.active = true; self.offBy = undefined; changed.push(id) }
    for (const k of below(id)) {
      if (!k.active && k.offBy === id) { k.active = true; k.offBy = undefined; changed.push(k.id) }
    }
  }
  return changed
}

/* The budget's path to use (1.2.8–1.2.12 · 1.7.1) · prepared, then the grants manager, finance and
   the executive director in turn; each one approves forward or returns one step back. Only an
   approved budget is active: projects link to it and hold against it (1.4.25). `submitted` is the
   grants manager's step · the name stays because older screens read it. */
export type BudgetState = 'draft' | 'returned' | 'submitted' | 'finance' | 'exec' | 'approved'

export const BUDGET_STATE_SAY: Record<BudgetState, string> = {
  draft: 'مسودة',
  returned: 'معادة للمُعِدّ',
  submitted: 'لدى مدير المنح',
  finance: 'لدى الإدارة المالية',
  exec: 'لدى المدير التنفيذي',
  approved: 'معتمدة · مفعّلة',
}

export const budgetTone = (s: BudgetState): 'ok' | 'warn' | 'ret' | 'mute' =>
  s === 'approved' ? 'ok' : s === 'returned' ? 'ret' : s === 'draft' ? 'mute' : 'warn'

/** Structure can change only before it's sent, or after a return */
export const budgetEditable = (s: BudgetState): boolean => s === 'draft' || s === 'returned'

export interface BudgetDoc {
  id: string
  /** Its own name and description (1.4.4) · the title falls back to year and source */
  name?: string
  description?: string
  yearId: string
  /** The first source · kept for older readers; `sources` holds the whole split */
  sourceCode: string
  /** One or more funding sources with the amount each carries · sums to `total` (1.4.4) */
  sources?: SourceShare[]
  /** The strategic directions the budget is built on (1.1.input-1) */
  directionIds?: string[]
  from: string
  to: string
  total: number
  state: BudgetState
  nodes: BudgetNode[]
}

/** The budget's sources · a budget saved before the split had one, carrying the whole total */
export const docSources = (d: Pick<BudgetDoc, 'sources' | 'sourceCode' | 'total'>): SourceShare[] =>
  d.sources?.length ? d.sources : d.sourceCode ? [{ code: d.sourceCode, amount: d.total }] : []

/** Linking and holding read approved budgets only (1.2.12 · 1.4.25) */
export const isLiveBudget = (d: BudgetDoc): boolean => d.state === 'approved'

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

/** Sum of children's allocation · what's supposed to equal the parent's allocation.
    An inactive child still counts: turning a line off stops new use, it doesn't move its money
    (1.4.38) · freeing it is a reduction or a transfer. */
export const sumChildren = (nodes: BudgetNode[], id: string): number =>
  childrenOf(nodes, id).reduce((s, n) => s + n.allocated, 0)

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
  for (const n of nodes) {
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

  /* 8 · every active line carries an amount (1.4.21) · an inactive line may sit at zero, like the
     document's «Ramadan iftar track» */
  for (const n of live) {
    if (n.parentId === null) continue
    if (!(n.allocated > 0)) {
      out.push({
        nodeId: n.id,
        text: `«${n.label}» بلا مبلغ مخصص · المبلغ إلزامي لكل بند نشط`,
        why: 'إلزامية المبلغ لكل بند',
      })
    }
  }

  /* 9 · funding sources (1.2.5 · 1.2.7) · the budget's sources sum to its total, a line's split sums
     to its allocation, and below any line with a split no source is spent past what that line holds
     from it */
  out.push(...sourceIssues(doc))

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

/** Independent budgets in one year are allowed (1.4.3) · what can't repeat is the name, so two
    budgets of the same year still read apart in every list and report */
export const nameTaken = (
  docs: BudgetDoc[],
  yearId: string,
  name: string,
  exceptId?: string,
): BudgetDoc | undefined =>
  name.trim()
    ? docs.find((d) => d.id !== exceptId && d.yearId === yearId && docTitle(d) === name.trim())
    : undefined

/* ── Funding sources on lines (1.2.5 · 1.2.7) ──

   A line may split its allocation across the budget's sources. A line without a split takes it from
   below (the sum of its children's) or from above (the one source of the nearest split over it),
   and a budget with a single source needs no split at all. */

const addShares = (a: SourceShare[], b: SourceShare[]): SourceShare[] => {
  const m = new Map(a.map((x) => [x.code, x.amount]))
  for (const x of b) m.set(x.code, (m.get(x.code) ?? 0) + x.amount)
  return [...m].map(([code, amount]) => ({ code, amount }))
}

/** A funding source's balance in a budget · its amount less what the lines hold, commit and paid,
    each line's money attributed to the sources by the line's own split (1.2.5 · 1.4.4).
    Batch 5 · funding#1 · the link checks this beside the line's own balance. The attribution is by
    the split until the ledger records the source of each hold and payment (backend) */
export function sourceBalance(doc: BudgetDoc, code: string): number {
  const total = docSources(doc).find((x) => x.code === code)?.amount ?? 0
  let used = 0
  for (const leaf of doc.nodes.filter((x) => !doc.nodes.some((y) => y.parentId === x.id))) {
    const split = splitOf(doc, leaf.id)
    const share = split?.find((x) => x.code === code)?.amount ?? 0
    if (!share || !leaf.allocated) continue
    const m = moneyOf(doc.nodes, leaf.id)
    used += (m.held + m.committed + m.paid) * share / leaf.allocated
  }
  return Math.round(total - used)
}

/** The split a line carries · `null` when it can't be told */
export function splitOf(doc: BudgetDoc, id: string): SourceShare[] | null {
  const n = doc.nodes.find((x) => x.id === id)
  if (!n) return null
  if (n.parentId === null) return docSources(doc)
  if (n.sources?.length) return n.sources
  const kids = childrenOf(doc.nodes, id)
  if (kids.length) {
    let acc: SourceShare[] = []
    for (const k of kids) {
      const s = splitOf(doc, k.id)
      if (!s) return null
      acc = addShares(acc, s)
    }
    return acc
  }
  const all = docSources(doc)
  if (all.length === 1) return [{ code: all[0].code, amount: n.allocated }]
  /* The nearest split above with a single source decides */
  let up = n.parentId ? doc.nodes.find((x) => x.id === n.parentId) : undefined
  while (up && up.parentId !== null) {
    if (up.sources?.length) return up.sources.length === 1 ? [{ code: up.sources[0].code, amount: n.allocated }] : null
    const pid: string | null = up.parentId
    up = pid ? doc.nodes.find((x) => x.id === pid) : undefined
  }
  return null
}

function sourceIssues(doc: BudgetDoc): TreeIssue[] {
  const out: TreeIssue[] = []
  const all = docSources(doc)
  const name = (c: string) => sourceByCode(c)?.name ?? c
  const sum = all.reduce((a, x) => a + x.amount, 0)
  if (all.length > 1 && sum !== doc.total) {
    out.push({
      text: `مجموع مبالغ مصادر التمويل ${nf.format(sum)} ومبلغ الميزانية ${nf.format(doc.total)}`,
      why: 'مجموع المصادر = مبلغ الميزانية',
    })
  }
  const codes = new Set(all.map((x) => x.code))
  for (const n of doc.nodes) {
    if (!n.sources?.length) continue
    const s = n.sources.reduce((a, x) => a + x.amount, 0)
    if (s !== n.allocated) {
      out.push({
        nodeId: n.id,
        text: `توزيع «${n.label}» على المصادر ${nf.format(s)} ومخصصه ${nf.format(n.allocated)}`,
        why: 'توزيع البند على المصادر = مخصصه',
      })
    }
    for (const x of n.sources) {
      if (!codes.has(x.code)) {
        out.push({ nodeId: n.id, text: `«${n.label}» موزَّع على «${name(x.code)}» وهو ليس من مصادر الميزانية`, why: 'مصادر البند من مصادر الميزانية' })
      }
    }
  }
  /* Below a split, no source goes past what the line holds from it */
  for (const p of doc.nodes) {
    const own = p.parentId === null ? all : p.sources
    if (!own?.length) continue
    const kids = childrenOf(doc.nodes, p.id)
    if (!kids.length) continue
    let acc: SourceShare[] = []
    let known = true
    for (const k of kids) {
      const s = splitOf(doc, k.id)
      if (!s) { known = false; continue }
      acc = addShares(acc, s)
    }
    if (!known) continue
    for (const x of acc) {
      const cap = own.find((o) => o.code === x.code)?.amount ?? 0
      if (x.amount > cap) {
        out.push({
          nodeId: p.id,
          text: `بنود «${p.label}» من «${name(x.code)}» ${nf.format(x.amount)} ومخصصه من المصدر ${nf.format(cap)}`,
          why: 'لا يتجاوز البند مخصص مصدر التمويل',
        })
      }
    }
  }
  /* With several sources, every line where money is spent must say where it comes from */
  if (all.length > 1) {
    for (const n of leavesOf(doc.nodes.filter((x) => x.active))) {
      if (n.parentId === null || !(n.allocated > 0)) continue
      if (!splitOf(doc, n.id)) {
        out.push({ nodeId: n.id, text: `«${n.label}» لم يُوزَّع على مصادر التمويل · للميزانية أكثر من مصدر`, why: 'لكل بند مصدر تمويله' })
      }
    }
  }
  return out
}

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
    name: 'ميزانية المنح 2025',
    description: /* doc 1.7.2 */ 'المثال التوضيحي في الوثيقة · ثلاثة مسارات ومسار رابع موقوف بلا مبالغ',
    yearId: 'fy-2025',
    sourceCode: 'SA',
    directionIds: ['dir-edu', 'dir-health', 'dir-community'],
    from: '2025-01-01',
    to: '2025-12-31',
    total: 30_000_000,
    state: 'approved',
    /* Held and paid are set on the leaves so that held + paid = allocated − the document's
       available. Two figures in the document broke that identity and are corrected here: the root
       showed 30M available with 2.1M consumed beneath it (now 27.9M), and "awareness campaigns" showed
       more available than allocated (2.3M of 2.2M, now 2.2M, which carries into its area and track). */
    nodes: [
      n('b0', 'ميزانية المنح - 2025', 'base', null, 30_000_000, 27_900_000),

      { ...n('t1', 'مسار التعليم', 'main', 'b0', 12_000_000, 11_200_000), directionId: 'dir-edu' },
      n('f11', 'مجال التعليم العام', 'main', 't1', 6_000_000, 5_400_000),
      leaf('g111', 'هدف تطوير المدارس', 'f11', 3_500_000, 150_000, 250_000),
      leaf('g112', 'هدف دعم الطلاب', 'f11', 2_500_000, 80_000, 120_000),
      n('f12', 'مجال التعليم العالي', 'main', 't1', 6_000_000, 5_800_000),
      leaf('g121', 'هدف المنح الدراسية', 'f12', 4_000_000, 100_000, 0),
      leaf('g122', 'هدف البحث العلمي', 'f12', 2_000_000, 40_000, 60_000),

      { ...n('t2', 'مسار الصحة', 'main', 'b0', 10_000_000, 9_000_000), directionId: 'dir-health' },
      n('f21', 'مجال الرعاية الصحية', 'main', 't2', 6_000_000, 5_000_000),
      leaf('g211', 'هدف دعم المستشفيات', 'f21', 3_500_000, 200_000, 400_000),
      leaf('g212', 'هدف الأجهزة الطبية', 'f21', 2_500_000, 150_000, 250_000),
      n('f22', 'مجال التوعية الصحية', 'main', 't2', 4_000_000, 4_000_000),
      leaf('g221', 'هدف حملات التوعية', 'f22', 2_200_000, 0, 0),
      leaf('g222', 'هدف البرامج الوقائية', 'f22', 1_800_000, 0, 0),

      { ...n('t3', 'مسار التنمية المجتمعية', 'main', 'b0', 8_000_000, 7_700_000), directionId: 'dir-community' },
      { ...n('f31', 'مجال تمكين الأفراد', 'main', 't3', 4_000_000, 3_800_000), held: 50_000, paid: 150_000 },
      { ...n('f32', 'مجال دعم المجتمع', 'main', 't3', 4_000_000, 3_900_000), held: 100_000, paid: 0 },

      /* Warning: inactive and with no amounts · exists in the tree and doesn't enter the totals */
      n('t4', 'مسار تفطير الصائمين', 'main', 'b0', 0, 0, false),
    ],
  },
  /* A second, independent budget in 2026 from the same source (1.4.3), funded by two sources and
     split on its lines (1.2.5) · waiting on the grants manager, so the approval path has a case */
  {
    id: 'BG-2026-SA-2',
    name: 'ميزانية المبادرات الطارئة 2026',
    description: 'استجابة للاحتياجات الطارئة خارج الخطة السنوية · تُدار مستقلة عن ميزانية المنح',
    yearId: 'fy-2026',
    sourceCode: 'SA',
    sources: [{ code: 'SA', amount: 2_000_000 }, { code: 'MM', amount: 1_000_000 }],
    directionIds: ['dir-community'],
    from: '2026-07-01',
    to: '2026-12-31',
    total: 3_000_000,
    state: 'submitted',
    nodes: [
      n('e0', 'ميزانية المبادرات الطارئة 2026', 'base', null, 3_000_000, 3_000_000),
      { ...n('e1', 'مسار الإغاثة', 'main', 'e0', 1_800_000, 1_800_000), sources: [{ code: 'SA', amount: 1_200_000 }, { code: 'MM', amount: 600_000 }] },
      { ...n('e11', 'مجال الإيواء العاجل', 'main', 'e1', 1_800_000, 1_800_000), owners: ['عمر قاسم'] },
      { ...leaf('e111', 'هدف السكن المؤقت', 'e11', 1_000_000, 0, 0), sources: [{ code: 'SA', amount: 700_000 }, { code: 'MM', amount: 300_000 }] },
      { ...leaf('e112', 'هدف الاحتياجات الأساسية', 'e11', 800_000, 0, 0), sources: [{ code: 'SA', amount: 500_000 }, { code: 'MM', amount: 300_000 }] },
      { ...n('e2', 'مسار الدعم الصحي العاجل', 'main', 'e0', 1_200_000, 1_200_000), sources: [{ code: 'SA', amount: 800_000 }, { code: 'MM', amount: 400_000 }] },
      { ...n('e21', 'مجال الأدوية والمستلزمات', 'main', 'e2', 1_200_000, 1_200_000), owners: ['حصة النملة'] },
      { ...leaf('e211', 'هدف توفير الأدوية', 'e21', 1_200_000, 0, 0), sources: [{ code: 'SA', amount: 800_000 }, { code: 'MM', amount: 400_000 }] },
    ],
  },
  /* Batch 5 · 8 Oct (funding#1) · an approved budget funded by two sources with its lines split
     between them, so the link screen has a live line whose sources it reads · the other two-source
     budget waits on the grants manager and takes no link. The second source is mostly spent on the
     paid line, so its balance is the tighter one */
  {
    id: 'BG-2026-SP',
    name: 'ميزانية الشراكات المجتمعية 2026',
    description: 'مشاريع مشتركة يموّلها الوقفان معًا · لكل بند حصّته من كل مصدر',
    yearId: 'fy-2026',
    sourceCode: 'SA',
    sources: [{ code: 'SA', amount: 400_000 }, { code: 'MM', amount: 200_000 }],
    directionIds: ['dir-community'],
    from: '2026-01-01',
    to: '2026-12-31',
    total: 600_000,
    state: 'approved',
    nodes: [
      n('w0', 'ميزانية الشراكات المجتمعية 2026', 'base', null, 600_000, 420_000),
      { ...n('w1', 'مسار الشراكات', 'main', 'w0', 600_000, 420_000), sources: [{ code: 'SA', amount: 400_000 }, { code: 'MM', amount: 200_000 }] },
      { ...n('w11', 'مجال المبادرات المشتركة', 'main', 'w1', 600_000, 420_000), owners: ['عمر قاسم', 'عزام الخريف'] },
      { ...leaf('w111', 'هدف المبادرات الأسرية المشتركة', 'w11', 400_000, 0, 0), sources: [{ code: 'SA', amount: 300_000 }, { code: 'MM', amount: 100_000 }] },
      { ...leaf('w112', 'هدف المبادرات الشبابية المشتركة', 'w11', 200_000, 0, 180_000), sources: [{ code: 'SA', amount: 100_000 }, { code: 'MM', amount: 100_000 }] },
    ],
  },
  /* Next year's budget, approved ahead · future commitments of multi-year projects land on its
     lines before the year starts, and the annual hold takes them on 1 January (1.4.48 · 1.4.49) */
  {
    id: 'BG-2027-SA',
    name: 'ميزانية المنح 2027',
    yearId: 'fy-2027',
    sourceCode: 'SA',
    directionIds: ['dir-edu', 'dir-health'],
    from: '2027-01-01',
    to: '2027-12-31',
    total: 12_000_000,
    state: 'approved',
    nodes: [
      n('y0', 'ميزانية المنح 2027', 'base', null, 12_000_000, 12_000_000),
      { ...n('y1', 'مسار التعليم', 'main', 'y0', 7_000_000, 7_000_000), directionId: 'dir-edu' },
      n('y11', 'مجال التعليم العام', 'main', 'y1', 7_000_000, 7_000_000),
      leaf('y111', 'هدف تطوير المدارس', 'y11', 4_000_000, 0, 0),
      leaf('y112', 'هدف دعم الطلاب', 'y11', 3_000_000, 0, 0),
      { ...n('y2', 'مسار الصحة', 'main', 'y0', 5_000_000, 5_000_000), directionId: 'dir-health' },
      n('y21', 'مجال الرعاية الصحية', 'main', 'y2', 5_000_000, 5_000_000),
      leaf('y211', 'هدف دعم المستشفيات', 'y21', 5_000_000, 0, 0),
    ],
  },
  {
    id: 'BG-2026-MM',
    name: 'ميزانية وقف موضي المسفر 2026',
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

/** The displayed budget name · its own name when given (1.4.4), otherwise year and source */
export const docTitle = (d: BudgetDoc): string => {
  if (d.name?.trim()) return d.name.trim()
  const src = docSources(d).map((x) => sourceByCode(x.code)?.name ?? x.code)
  return `ميزانية ${yearById(d.yearId)?.name ?? ''} · ${src.length ? src.join(' و') : d.sourceCode}`
}
