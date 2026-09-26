import { agreements } from './agreements'
import { projectRows } from './projects'
import type { AgreementKind, AgreementPayment, ProjectRow } from '@/types/domain'

/* Creating an agreement

   Warning: **an agreement isn't created from the inbox — it's created for a project.** So its entry
   point is the "agreement" tab on the project page, not a button in the inbox header — the inbox
   answers "what's waiting on me" (this is documented in `AgreementsPage` so no one adds a button
   there "for consistency").

   === Rules that shape the screen ===

   **Rule 1 · no agreement before the project's approval is fully complete** and its allocation is
   still held — so the project list isn't every project, it's the **eligible** ones.
   Warning: an ineligible project **stays shown, with its reason**, rather than disappearing — the
   same lesson as elsewhere: disappearing makes the user go looking for a project they can't find.

   **Rule 2 · exactly one project** — a single field, not a multi-select list.

   **Rule 3 · the type is set at creation and doesn't change** except via a new version — so the
   screen treats this as a decision made once, not something to revisit.

   **Step 11 · the agreement value = the amount held in the budget** — a mismatch blocks submission.

   **Rule 7 · the disbursement schedule is part of the agreement before it's sent**, not an
   attachment to it — so it's edited inside this screen, not on a separate page.

   **Rule 8 · disbursements must sum to the grant, with percentages totaling 100%** — and this is
   **a validation, not a summary**: the total row says "matches" or "off by X." */

/* Approved templates · rule 4
   Ten in the live system, and the name itself states the selection rule: funding source x grant
   size x publicity exposure. */
export const TEMPLATES = [
  'اتفاقية منحة عامة',
  'اتفاقية منحة كبرى (فوق مليون)',
  'اتفاقية منحة تشغيلية',
  'اتفاقية منحة بظهور إعلامي',
  'اتفاقية منحة متعددة السنوات',
  'اتفاقية شراكة استراتيجية',
] as const

export const KINDS: { key: AgreementKind; label: string; note: string }[] = [
  {
    key: 'إلكترونية',
    label: 'إلكترونية',
    note: 'تُبنى على نموذج معتمد مسبقًا، وتوقّعها الجهة من بوابة المنح (قاعدة 4)',
  },
  {
    key: 'ورقية',
    label: 'ورقية',
    note: 'يلزم إرفاق النسخة الموقّعة قبل التفعيل، وهو شرط إضافي للتفعيل (قاعدة 16)',
  },
]

/* Eligible projects · rule 1 */
export interface ProjectOption {
  id: string
  name: string
  entityName: string
  amount: number
  /** The reason it's blocked · empty means eligible */
  blocked: string
}

/**
 * A project that already has an agreement doesn't get another · rule 2.
 *
 * Warning: a cancelled one doesn't count — rule 26 says cancellation doesn't move the project back
 * to "in progress," meaning the project becomes eligible for a new agreement again — otherwise a
 * project whose agreement was cancelled would stay closed forever.
 */
const hasAgreement = (id: string) =>
  agreements.some((a) => a.projectId === id && a.stage !== 'cancelled')

export const projectOptions = (): ProjectOption[] =>
  projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    entityName: p.entityName,
    amount: p.amountGranted,
    blocked:
      hasAgreement(p.id) ? 'له اتفاقية قائمة'
        : p.amountGranted <= 0 ? 'لم يُحجز له مخصص'
          : p.statusGroup === 'في الدراسة' ? 'ما زال في الدراسة، ولم يكتمل اعتماده'
            : p.statusGroup === 'معتذر عنه' ? 'معتذر عنه'
              : '',
  }))

export const projectById = (id: string): ProjectRow | undefined =>
  projectRows.find((p) => p.id === id)

/* Disbursement schedule · editor

   Warning: **amount and percentage are one thing, not two.** If the user typed both by hand, they'd
   end up contradicting each other — a disbursement marked 40% with an amount equal to a quarter of
   the grant — and the screen would show that as wrong and still let it through. So the percentage
   is **always computed** from the amount, and shown as read-only. */

export interface DraftPay {
  no: number
  amount: number
  dueAt: string
  requirement: string
}

/** A starting schedule · two even disbursements · a starting point to edit, not a final value */
export const seedSchedule = (amount: number, from: string): DraftPay[] => {
  const half = Math.round(amount / 2)
  const later = (d: string, days: number) => {
    const t = new Date(d || new Date().toISOString().slice(0, 10))
    t.setDate(t.getDate() + days)
    return t.toISOString().slice(0, 10)
  }
  return [
    { no: 1, amount: half, dueAt: later(from, 14), requirement: 'توقيع الاتفاقية' },
    { no: 2, amount: amount - half, dueAt: later(from, 120), requirement: 'التقرير الختامي ومخرجات المشروع' },
  ]
}

export const scheduleTotal = (rows: DraftPay[]): number =>
  rows.reduce((a, r) => a + (r.amount || 0), 0)

/** The disbursement's share of the grant · computed, not typed */
export const shareOf = (amount: number, total: number): number =>
  total > 0 ? Math.round((amount / total) * 1000) / 10 : 0

export const toPayments = (rows: DraftPay[], amount: number): AgreementPayment[] =>
  rows.map((r) => ({
    no: r.no,
    amount: r.amount,
    share: shareOf(r.amount, amount),
    dueAt: r.dueAt,
    requirement: r.requirement || undefined,
  }))

/* Validation · the rules stated before submission */
export interface AgIssue { key: string; say: string; rule: string }

export const agreementIssues = (v: {
  projectId: string
  template: string
  kind: AgreementKind | ''
  signerName: string
  signerTitle: string
  rows: DraftPay[]
  amount: number
  reserved: number
}): AgIssue[] => {
  const out: AgIssue[] = []

  const opt = projectOptions().find((p) => p.id === v.projectId)
  if (opt?.blocked) {
    out.push({ key: 'project', say: `«${opt.name}» ${opt.blocked}.`, rule: 'قاعدة 1' })
  }

  /* Step 11 · the value must equal the held amount · a mismatch blocks submission */
  if (v.projectId && v.amount !== v.reserved) {
    out.push({
      key: 'reserved',
      say: `قيمة الاتفاقية ${v.amount.toLocaleString('en-US')} ⃁، والمبلغ المحجوز في الميزانية ${v.reserved.toLocaleString('en-US')} ⃁. يلزم أن يتطابقا.`,
      rule: 'خطوة 11',
    })
  }

  /* Rule 8 · the total must equal the grant · a validation, not a summary */
  const total = scheduleTotal(v.rows)
  if (v.rows.length > 0 && v.amount > 0 && total !== v.amount) {
    const gap = v.amount - total
    out.push({
      key: 'sum',
      say: gap > 0
        ? `مجموع الدفعات أقل من قيمة المنحة بـ${gap.toLocaleString('en-US')} ⃁.`
        : `مجموع الدفعات يزيد على قيمة المنحة بـ${Math.abs(gap).toLocaleString('en-US')} ⃁.`,
      rule: 'قاعدة 8',
    })
  }

  if (v.rows.length === 0) {
    out.push({ key: 'empty', say: 'لا يوجد أي دفعة. أضف دفعة واحدة على الأقل، فالجدول جزء من الاتفاقية لا ملحق بها.', rule: 'قاعدة 7' })
  }

  /* A disbursement with no eligibility condition · output 4 says disbursements are "tied to
     eligibility and progress conditions," so a disbursement with no condition would release funds
     for no reason */
  const noReq = v.rows.filter((r) => !r.requirement.trim()).map((r) => r.no)
  if (noReq.length) {
    out.push({
      key: 'req',
      say: `الدفعة ${noReq.join('، ')} بلا شرط استحقاق. حدّد شرط استحقاقها.`,
      rule: 'المخرج 4',
    })
  }

  /* Dates must be ascending · a later disbursement dated before an earlier one turns the schedule
     from a plan into a plain list */
  for (let i = 1; i < v.rows.length; i++) {
    const a = v.rows[i - 1], b = v.rows[i]
    if (a.dueAt && b.dueAt && b.dueAt < a.dueAt) {
      out.push({
        key: 'order',
        say: `تاريخ الدفعة ${b.no} يسبق تاريخ الدفعة ${a.no}. رتّب التواريخ تصاعديًا.`,
        rule: 'ترتيب الجدول',
      })
      break
    }
  }

  if (!v.template) out.push({ key: 'template', say: 'اختر نموذج الاتفاقية.', rule: 'قاعدة 4' })
  if (!v.kind) out.push({ key: 'kind', say: 'حدّد نوع الاتفاقية.', rule: 'قاعدة 3' })
  if (!v.signerName.trim() || !v.signerTitle.trim()) {
    out.push({ key: 'signer', say: 'أدخل اسم ممثل الجهة المخوّل بالتوقيع وصفته.', rule: 'المدخل 3' })
  }

  return out
}
