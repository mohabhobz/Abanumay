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
  { id: '860', name: 'منصة إحسان', note: 'منصة حكومية تدعم الجهات الخيرية · لا تدخل النظام' },
  { id: '861', name: 'المحافظ الخيرية', note: 'الترتيب نفسه · إدارة داخلية كاملة' },
]

export const isImplementer = (entityId: string): boolean =>
  IMPLEMENTERS.some((x) => x.id === entityId)

/** Entity partnership type · arriving via the portal it's a beneficiary; these are implementers */
export const partnerOf = (entityId: string): PartnerKind =>
  isImplementer(entityId) ? 'implementer' : 'beneficiary'

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

/* Portfolio */
export interface PortfolioItem {
  id: string
  name: string
  region: string
  amount: number
  spent: number
  status: 'مكتمل' | 'تحت التنفيذ' | 'لم يبدأ'
}

export interface Portfolio {
  id: string
  name: string
  entityId: string
  /** Total agreed amount for the whole portfolio */
  total: number
  year: string
  openedAt: string
  items: PortfolioItem[]
}

export const portfolios: Portfolio[] = [
  {
    id: 'PF-2026-001',
    name: 'محفظة إحسان · الإغاثة والكفالات',
    entityId: '860',
    total: 6_000_000,
    year: '2026',
    openedAt: '2026-02-10',
    items: [
      { id: 'PF-1', name: 'كفالة الأيتام · الربع الأول', region: 'عموم المملكة', amount: 2_000_000, spent: 2_000_000, status: 'مكتمل' },
      { id: 'PF-2', name: 'السلال الغذائية في رمضان', region: 'عموم المملكة', amount: 1_800_000, spent: 1_240_000, status: 'تحت التنفيذ' },
      { id: 'PF-3', name: 'تهيئة السكن للأسر المحتاجة', region: 'مكة المكرمة', amount: 1_400_000, spent: 300_000, status: 'تحت التنفيذ' },
      { id: 'PF-4', name: 'كسوة الشتاء', region: 'تبوك', amount: 800_000, spent: 0, status: 'لم يبدأ' },
    ],
  },
]

export const portfolioById = (id: string): Portfolio | undefined =>
  portfolios.find((p) => p.id === id)

export const itemsTotal = (p: Portfolio): number =>
  p.items.reduce((a, x) => a + x.amount, 0)

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
