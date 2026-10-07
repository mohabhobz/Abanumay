import { entityRows } from './entities'
import type { PartnerKind } from './registration'

/* Implementing partner and portfolio · scenario: a partner such as a government platform that
   supports charitable entities and never accesses our platform at all. The grant officer adds it as
   an entity, creates the project, manages it entirely internally, can assign a single project or a
   portfolio, and handles payments — with no agreement in place.

   This is not an edge case, it's a different kind of counterpart: the other party simply doesn't
   exist in the platform, so anything assuming their presence — the portal, signing, agreements,
   entity justifications — breaks down.

   A portfolio is not a large project. It is a parent entity containing projects, each with its own
   amount and status. The portfolio itself does not appear in the project list as a row, since it
   isn't a project — only its children do.

   Open question: what exactly does "portfolio" mean on screen — a parent project containing
   sub-projects? What's built here is that assumption, flagged on screen as an assumption. */

/** Implementing partners · populated internally by the system, per a fixed platform rule */
export const IMPLEMENTERS: { id: string; name: string; note: string }[] = [
  { id: '860', name: 'منصة إحسان', note: 'منصة حكومية تدعم الجهات الخيرية · شريك استراتيجي يدير محفظته' },
  { id: '861', name: 'المحافظ الخيرية', note: 'الترتيب نفسه · إدارة داخلية كاملة' },
]

export const isImplementer = (entityId: string): boolean =>
  IMPLEMENTERS.some((x) => x.id === entityId)

/** Portfolio managers with their own login (meeting 1 Oct · the strategic-partner persona) */
const STRATEGIC = new Set(['860'])

/** Entity partnership type · arriving via the portal it's a beneficiary; these are implementers */
export const partnerOf = (entityId: string): PartnerKind =>
  STRATEGIC.has(entityId) ? 'strategic' : isImplementer(entityId) ? 'implementer' : 'beneficiary'

export const implementerName = (entityId: string): string =>
  IMPLEMENTERS.find((x) => x.id === entityId)?.name ??
  entityRows.find((e) => e.id === entityId)?.name ??
  ''

/* What changes when a partner becomes an implementer

   Written here once and read by every screen that touches this status, so no screen keeps its own
   half-remembered copy. */
export interface KindDiff { on: string; off: string }

export const IMPLEMENTER_DIFF: KindDiff[] = [
  { on: 'يُنشأ المشروع داخل النظام', off: 'تتقدم الجهة عبر بوابة المنح' },
  { on: 'لا توجد اتفاقية · تُسجَّل الدفعات مباشرة', off: 'الاتفاقية إلزامية قبل أي صرف' },
  { on: 'لا ترفع الجهة مسوغات · يرفعها مشرف المنح', off: 'ترفع الجهة مسوغات كل دفعة' },
  { on: 'قد يكون مشروعًا واحدًا أو محفظة', off: 'مشروع واحد في كل مرة' },
]

/* Portfolio · the fixture the partners store starts from (BPD-013).

   A portfolio is approved once as a whole: its total is held on the budget in one go, and the
   values of its sub-projects are an internal split of that total, not new holds (13.2.19). The
   sub-projects arrive gradually after the portfolio, its plan and its agreement are approved
   (13.2.10), each with its own approval (13.2.16). */
export type SubState = 'draft' | 'pending' | 'approved' | 'rejected'
export interface PortfolioItem {
  id: string
  name: string
  region: string
  amount: number
  /** Paid through Ehsan on this sub-project · the confirmed payments in the fixture */
  spent: number
  status: 'مكتمل' | 'تحت التنفيذ' | 'لم يبدأ'
  /** Approval state · approved unless the fixture says otherwise */
  state?: SubState
  reason?: string
  /** Targets the partner submitted · and what it reported */
  beneficiaries?: number
  outputs?: string
  progress?: number
  reached?: number
  results?: string
}

export type PortfolioStage = 'draft' | 'supervisor' | 'manager' | 'ceo' | 'returned' | 'approved' | 'rejected' | 'closing' | 'closed'
export interface Portfolio {
  id: string
  name: string
  entityId: string
  /** Total agreed amount for the whole portfolio */
  total: number
  year: string
  openedAt: string
  items: PortfolioItem[]
  /** Coverage shown in the projects list row. */
  region?: string
  /** Grant officer managing the portfolio. */
  owner?: string
  /** The approved track and field · the sub-projects inherit them (13.1.input-3 · 13.4.9) */
  track?: string
  field?: string
  goals?: string
  /** Ehsan executes the payments itself · otherwise the portfolio requests them (13.2.23) */
  channel?: 'ehsan' | 'direct'
  stage?: PortfolioStage
  plan?: 'none' | 'draft' | 'review' | 'approved'
  agreement?: 'none' | 'draft' | 'manager' | 'partner' | 'signed'
  /** The budget line the fixture holds it on */
  line?: string
  origin?: 'internal' | 'partner'
}

/** The seeded payments' references · the budget store marks the same ones paid */
export const seedPayRef = (pfId: string, subId: string) => `EH-${pfId.slice(-3)}-${subId}`

export const portfolios: Portfolio[] = [
  {
    id: 'PF-2026-001',
    name: 'محفظة إحسان · الإغاثة والكفالات',
    entityId: '860',
    total: 6_000_000,
    year: '2026',
    openedAt: '2026-02-10',
    owner: 'عمر قاسم',
    track: 'المنح الانتشاري', field: 'الإغاثة', goals: 'كفالة الأيتام والأسر · الإغاثة الموسمية في رمضان والشتاء',
    channel: 'ehsan', stage: 'approved', plan: 'approved', agreement: 'signed', line: 'tPg1', origin: 'internal',
    items: [
      { id: 'PF-1', name: 'كفالة الأيتام · الربع الأول', region: 'عموم المملكة', amount: 2_000_000, spent: 2_000_000, status: 'مكتمل', beneficiaries: 800, outputs: 'كفالة 800 يتيم لثلاثة أشهر', progress: 100, reached: 812, results: 'صُرفت الكفالات كاملةً عبر المنصة · 812 يتيمًا' },
      { id: 'PF-2', name: 'السلال الغذائية في رمضان', region: 'عموم المملكة', amount: 1_800_000, spent: 1_240_000, status: 'تحت التنفيذ', beneficiaries: 6_000, outputs: '6,000 سلة غذائية', progress: 70, reached: 4_100 },
      { id: 'PF-3', name: 'تهيئة السكن للأسر المحتاجة', region: 'مكة المكرمة', amount: 1_400_000, spent: 300_000, status: 'تحت التنفيذ', beneficiaries: 120, outputs: 'تهيئة 120 منزلًا', progress: 25, reached: 30 },
      { id: 'PF-4', name: 'كسوة الشتاء', region: 'تبوك', amount: 800_000, spent: 0, status: 'لم يبدأ', beneficiaries: 3_000, outputs: '3,000 كسوة', progress: 0 },
    ],
  },
  {
    id: 'PF-2026-002',
    name: 'محفظة إحسان · التعليم والتدريب',
    entityId: '860',
    total: 3_200_000,
    year: '2026',
    openedAt: '2026-04-02',
    owner: 'سعود البريكان',
    track: 'المنح النوعي', field: 'التعليم', goals: 'تمكين الطلاب المتفوقين وتأهيل المعلمين',
    channel: 'ehsan', stage: 'approved', plan: 'approved', agreement: 'signed', line: 'tPg1', origin: 'internal',
    items: [
      { id: 'PF-5', name: 'منح دراسية للطلاب المتفوقين', region: 'الرياض', amount: 1_500_000, spent: 900_000, status: 'تحت التنفيذ', beneficiaries: 150, outputs: '150 منحة دراسية', progress: 60, reached: 90 },
      { id: 'PF-6', name: 'تدريب المعلمين على المناهج الرقمية', region: 'القصيم', amount: 1_100_000, spent: 1_100_000, status: 'مكتمل', beneficiaries: 400, outputs: 'تدريب 400 معلم', progress: 100, reached: 436, results: 'اكتمل التدريب · 436 معلمًا بشهادات' },
      { id: 'PF-7', name: 'تجهيز معامل الحاسب', region: 'حائل', amount: 600_000, spent: 0, status: 'لم يبدأ', state: 'pending', beneficiaries: 2_400, outputs: 'تجهيز 12 معملًا' },
      { id: 'PF-7B', name: 'حقائب تعليمية للمرحلة الابتدائية', region: 'جيزان', amount: 400_000, spent: 0, status: 'لم يبدأ', state: 'rejected', reason: 'مكرّر مع مشروع قائم للجهة نفسها في المنطقة', beneficiaries: 1_000, outputs: '1,000 حقيبة' },
    ],
  },
  {
    id: 'PF-2026-003',
    name: 'المحافظ الخيرية · الصحة المجتمعية',
    entityId: '861',
    total: 2_400_000,
    year: '2026',
    openedAt: '2026-05-18',
    region: 'المنطقة الشرقية',
    owner: 'حصة النملة',
    track: 'المنح النوعي', field: 'الصحة', goals: 'رعاية صحية أولية للقرى والهجر',
    /* Plan under review, agreement drafted · the sub-projects wait (13.2.10) */
    channel: 'direct', stage: 'approved', plan: 'review', agreement: 'draft', line: 'tPg2', origin: 'internal',
    items: [],
  },
  {
    id: 'PF-2026-004',
    name: 'محفظة إحسان · السقيا والمياه',
    entityId: '860',
    total: 2_500_000,
    year: '2026',
    openedAt: '2026-09-21',
    owner: 'عمر قاسم',
    track: 'المنح الانتشاري', field: 'الإغاثة', goals: 'آبار وخزانات وسقيا للقرى النائية',
    /* Requested by the partner from its portal · with the supervisor for study (13.2.3 · 13.2.6) */
    channel: 'ehsan', stage: 'supervisor', plan: 'none', agreement: 'none', origin: 'partner',
    items: [],
  },
]

/** An approved portfolio's paid fixture · per sub-project, by reference */
export const seededPays = (p: Portfolio) =>
  p.stage === 'approved' ? p.items.filter((x) => x.spent > 0).map((x) => ({ subId: x.id, amount: x.spent, ref: seedPayRef(p.id, x.id) })) : []

/* Projects supported through Ehsan as a project of their own, not a portfolio (BPD-011) · the
   fixture's line and paid amount; the partners store owns the rest */
export const EHSAN_SEED: { projectId: string; line: string; paid: { amount: number; ref: string }[] }[] = [
  { projectId: '21060', line: 'tPg1', paid: [{ amount: 400_000, ref: 'EH-21060-1' }] },
]

export const portfolioById = (id: string): Portfolio | undefined =>
  portfolios.find((p) => p.id === id)

export const itemsTotal = (p: Portfolio): number =>
  p.items.filter((x) => (x.state ?? 'approved') === 'approved').reduce((a, x) => a + x.amount, 0)

export const itemsSpent = (p: Portfolio): number =>
  p.items.reduce((a, x) => a + x.spent, 0)

/* Portfolio validation

   Same discipline as the budget tree and payment schedule: the sum of children must equal the
   parent amount — a portfolio that only summarizes hides errors. Spending must not exceed the
   allocation, in the portfolio or in any project within it. */
export interface PfIssue { key: string; say: string; rule: string }

export const portfolioIssues = (p: Portfolio): PfIssue[] => {
  const out: PfIssue[] = []
  const sum = itemsTotal(p)

  if (sum !== p.total) {
    const gap = p.total - sum
    out.push({
      key: 'sum',
      say: gap > 0
        ? `مجموع مشاريع المحفظة أقل من مبلغها بـ${gap.toLocaleString('en-US')}.`
        : `مجموع مشاريع المحفظة أكثر من مبلغها بـ${Math.abs(gap).toLocaleString('en-US')}.`,
      rule: 'مجموع المشاريع يساوي مبلغ المحفظة',
    })
  }

  const over = p.items.filter((x) => x.spent > x.amount)
  if (over.length) {
    out.push({
      key: 'over',
      say: `المصروف على «${over[0].name}» يتجاوز مخصصه.`,
      rule: 'الصرف في حدود المخصص',
    })
  }

  return out
}
