import { BANKS } from './registration'
import type { PayRequest, PayState } from '@/types/domain'

/* Disbursement · what the entity sees, whether a receipt is
   mandatory, and the bank account. */

/* v3 · 9.2.2 · the entity raises its payment's requirements · the supervisor creates the permit once
   they're approved (9.2.10) · the older «permit first» direction is gone */
/* What the entity sees.

   The payment report shows only two states: paid and unpaid — while the real cycle has seven
   internal stages.

   The fix isn't showing the entity all seven. States like "pending grants manager" or "pending
   finance" tell the entity who's holding things up on our side, which isn't theirs and they can't
   act on — so it becomes worry, not information.

   The five shown here are the ones the entity can act on: continue, wait, or done. */
export type EntityPayState = 'draft' | 'review' | 'inflight' | 'complete' | 'paid' | 'rejected'

export interface EntityStateDef {
  key: EntityPayState
  label: string
  /**
   * What the entity should do now · empty means no action is required.
   *
   * "No action" doesn't always mean "wait": paid and rejected are both final — labeling a final
   * state as "wait" tells the entity something more is coming, when nothing is.
   */
  act: string
  /** Still in progress · but this is the one labeled "wait" */
  waiting?: boolean
  tone: 'mute' | 'ret' | 'warn' | 'ok' | 'no' | 'teal'
  /** The internal states grouped under this */
  inner: string
}

export const ENTITY_STATES: EntityStateDef[] = [
  {
    key: 'draft', label: 'مسودة', act: 'أكمل المتطلبات وارفعها',
    tone: 'mute', inner: 'لم تُرفع بعد · لدى الجهة',
  },
  {
    key: 'review', label: 'متطلبات قيد المراجعة', act: '', waiting: true,
    tone: 'teal', inner: 'مشرف المنح يراجع المتطلبات',
  },
  {
    key: 'inflight', label: 'مؤهلة للصرف · تحت إجراء الدفع', act: '', waiting: true,
    tone: 'teal', inner: 'اعتُمدت المتطلبات · إذن الصرف عند مشرف المنح ثم مدير المنح ثم الإدارة المالية',
  },
  {
    key: 'complete', label: 'لاستكمال المتطلبات', act: 'ارفع الناقص وأعد رفع المتطلبات',
    tone: 'warn', inner: 'أعادها مشرف المنح',
  },
  { key: 'paid', label: 'مدفوع', act: '', tone: 'ok', inner: 'حُوّل المبلغ' },
  { key: 'rejected', label: 'مرفوض', act: '', tone: 'no', inner: 'رفض نهائي' },
]

/**
 * Internal status → what the entity sees.
 *
 * Three internal states collapse into one. "Officer review", "pending grants manager", and "pending
 * finance" all show to the entity as "payment in progress" — the entity can't act on any of the
 * three, and the distinction between them is internal, not theirs.
 */
export const entityStateOf = (s: PayState): EntityStateDef => {
  const k: EntityPayState =
    s === 'returned' ? 'complete'
      : s === 'supervisor' ? 'review'
      : s === 'paid' ? 'paid'
        : s === 'closed' ? 'rejected'
          : 'inflight'
  return ENTITY_STATES.find((x) => x.key === k) ?? ENTITY_STATES[1]
}

/* Receipt.

   The payment leaves the accountant's hands with proof it was transferred — but whether the other
   side actually received it is a separate question, present but not central.

   So the two documents aren't the same kind:
   Transfer proof — from us · mandatory · closes our step
   Receipt · from the entity · optional · closes the loop on their end

   Mixing them together as "payment documents" made both look equally weighted and as if the same
   person was responsible for both — they aren't. */
export interface PayProof {
  key: 'transfer' | 'receipt'
  label: string
  by: string
  required: boolean
  why: string
}

export const PAY_PROOFS: PayProof[] = [
  {
    key: 'transfer',
    label: 'إثبات التحويل',
    by: 'الإدارة المالية',
    required: true,
    why: 'به تتحول حالة الطلب إلى «مدفوع» · ولا تُغلق الدفعة دونه',
  },
  {
    key: 'receipt',
    label: 'سند القبض',
    by: 'الجهة المستفيدة',
    required: false,
    why: 'خطاب بترويسة الجهة أو إشعار البنك · يُغلق الحلقة لدى الجهة لا لدى المؤسسة',
  },
]

/* The bank account.

   · An entity can have more than one account, and can add accounts at registration and afterward.
   · A project is tied to a single account from the start, based on the account's designated cause
   (an organization may have one account per cause: memorization, iftar, sacrifices, hajj).
   · A payment is never split across more than one account.
   · Changing the account at payment time is a grants officer/manager permission, not finance
   staff's — finance is expected to receive everything ready to execute, with no direct contact with
   entities. */
export interface EntityBank {
  id: string
  bank: string
  /** The cause the account is designated for — the reason accounts can be multiple */
  purpose: string
  iban: string
  active: boolean
}

/** Entity accounts · generated from its number so they stay stable per entity */
export const banksOf = (entityId: string): EntityBank[] => {
  const seed = Number(entityId) || 1
  const purposes = ['الحساب العام', 'تحفيظ القرآن', 'تفطير الصائمين', 'الأضاحي', 'كفالة الأيتام']
  const n = 2 + (seed % 3)
  return Array.from({ length: n }, (_, i) => ({
    id: `${entityId}-${i + 1}`,
    bank: BANKS[(seed + i) % BANKS.length],
    purpose: purposes[i % purposes.length],
    /* A fully obfuscated IBAN · this is a mock, no need for a number resembling a real one in a
       file readable in an open repo */
    iban: `SA•• •••• •••• ${String(1000 + ((seed * (i + 7)) % 9000))}`,
    active: i !== n - 1 || n === 2,
  }))
}

/** Who has permission to change the payment account */
export const BANK_CHANGE_ROLES = ['مشرف المنح', 'مدير المنح']
export const BANK_CHANGE_DENIED = 'موظف المالية'

export interface BankIssue { say: string; rule: string }

export const bankIssues = (r: PayRequest, chosen: EntityBank | undefined): BankIssue[] => {
  const out: BankIssue[] = []
  if (!chosen) {
    out.push({ say: 'لم يُحدَّد حساب للدفعة.', rule: 'ح-5' })
    return out
  }
  if (!chosen.active) {
    out.push({
      say: `حساب «${chosen.purpose}» غير مفعَّل · وهو السبب الوحيد المحدد لإعادة إذن الصرف.`,
      rule: 'النظام العامل',
    })
  }
  if (!r.bank.active) {
    out.push({ say: 'الحساب المعتمد على الطلب غير مفعَّل.', rule: 'المخرج 2' })
  }
  return out
}
