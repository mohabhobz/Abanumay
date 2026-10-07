import { CFG, hydrate, persist, readJson } from '@/lib/config'

/* Escalation rules · one mechanism for the thirteen procedures (cross · «التصعيد: متأخر ومتعثر»).

   The document writes the same clause in every procedure: a stage has a number of days from
   settings; past it the request reads «متأخر» and the parties get one alert; past a further margin
   it reads «متعثر» and the alert repeats every day until someone acts; a report lists both; and
   the mechanism is the system admin's to configure directly, with no approval path.

   This file holds the rules only and imports nothing from the modules, so every module's own heat
   function (payments, agreements, closing…) can read the stall margin from here without a cycle.
   The list of what is late across the modules lives in `escalation.ts`, which imports them. */

export type EscProc =
  | 'budget' | 'registration' | 'study' | 'approval' | 'agreement' | 'payment' | 'closing' | 'plan' | 'ehsan' | 'portfolio'

export const ESC_PROCS: { key: EscProc; label: string; bpd: string }[] = [
  { key: 'budget', label: 'الميزانية والمناقلات', bpd: 'BPD-001' },
  { key: 'registration', label: 'تسجيل الجهات وتحديث بياناتها', bpd: 'BPD-002' },
  { key: 'study', label: 'دراسة المشروع', bpd: 'BPD-003' },
  { key: 'approval', label: 'مسار الاعتماد', bpd: 'BPD-004–007' },
  { key: 'agreement', label: 'الاتفاقيات', bpd: 'BPD-008' },
  { key: 'payment', label: 'صرف الدفعات', bpd: 'BPD-009' },
  { key: 'closing', label: 'إغلاق المشروع', bpd: 'BPD-010' },
  { key: 'plan', label: 'خطط المشاريع', bpd: 'BPD-012' },
  { key: 'ehsan', label: 'مشاريع إحسان', bpd: 'BPD-011' },
  { key: 'portfolio', label: 'المحافظ', bpd: 'BPD-013' },
]
export const procLabel = (k: EscProc): string => ESC_PROCS.find((p) => p.key === k)?.label ?? k

/** Who an alert reaches · the stage's owner is whoever holds it now (a person, a desk or the entity) */
export type EscRecipient = 'owner' | 'manager' | 'ceo' | 'admin' | 'entity'
export const RECIPIENT_SAY: Record<EscRecipient, string> = {
  owner: 'المسؤول عن المرحلة',
  manager: 'مدير المنح',
  ceo: 'المدير التنفيذي',
  admin: 'مدير النظام',
  entity: 'الجهة صاحبة الطلب',
}
export type EscChannel = 'app' | 'email' | 'sms'
export const CHANNEL_SAY: Record<EscChannel, string> = { app: 'داخل النظام', email: 'البريد الإلكتروني', sms: 'رسالة نصية' }

export interface EscLevel { to: EscRecipient[]; channels: EscChannel[] }
export interface EscRules {
  /** Days past the stage's limit before «متأخر» becomes «متعثر» · `null` = the stage's own limit again (twice the limit) */
  stuck: Record<EscProc, number | null>
  /** The first level · fires once, on the day the request crosses its limit */
  late: EscLevel
  /** The second level · fires every day while the request stays stalled */
  stalled: EscLevel
  /** The last time the admin saved, and who */
  savedBy?: string
  savedAt?: string
}

const DEFAULT: EscRules = {
  stuck: {
    budget: 5, registration: 7, study: null, approval: 10, agreement: null, payment: null,
    closing: 15, plan: 30, ehsan: 5, portfolio: 10,
  },
  late: { to: ['owner'], channels: ['app', 'email'] },
  stalled: { to: ['owner', 'manager', 'ceo'], channels: ['app', 'email', 'sms'] },
}

export const ESC_RULES: EscRules = readJson(CFG.escalation, DEFAULT)
/* `readJson` merges one level · a saved file from before a procedure existed still gets its default */
ESC_RULES.stuck = { ...DEFAULT.stuck, ...ESC_RULES.stuck }
export const ESC_DEFAULT = DEFAULT

export const saveEscRules = (next: EscRules, by: string): void => {
  Object.assign(ESC_RULES, next, { savedBy: by, savedAt: new Date().toISOString().slice(0, 10) })
  persist(CFG.escalation, ESC_RULES)
}

/** Stage limits (hours) of the procedures that had none in code · edited on the escalation settings page */
export const ESC_LIMITS: Record<string, number> = hydrate(CFG.escLimits, {
  'budget.submitted': 72,
  'budget.finance': 72,
  'budget.exec': 72,
  'registration.review': 120,
  'registration.completion': 240,
  'registration.update': 72,
  'approval.manager': 120,
  'approval.exec': 120,
  'approval.committee': 336,
  'approval.board': 504,
  'approval.confirm': 72,
  'ehsan.review': 72,
  'portfolio.supervisor': 168,
  'portfolio.manager': 96,
  'portfolio.ceo': 96,
  'portfolio.committee': 336,
  'portfolio.board': 504,
  'portfolio.returned': 240,
  'portfolio.subs': 120,
  'portfolio.finance': 72,
})

export type Heat = 'ok' | 'late' | 'stuck'

/** One rule for every procedure · late past the limit, stalled past the limit and the margin */
export function heatOf(hours: number, limitHours: number, proc: EscProc): Heat {
  if (!limitHours || limitHours <= 0) return 'ok'
  if (hours <= limitHours) return 'ok'
  const extra = ESC_RULES.stuck[proc]
  const margin = extra === null || extra === undefined ? limitHours : extra * 24
  return hours > limitHours + margin ? 'stuck' : 'late'
}

/** The margin as a sentence · «ضعف مدة المرحلة» or «بعد 5 أيام إضافية» */
export const stuckSay = (proc: EscProc): string => {
  const n = ESC_RULES.stuck[proc]
  return n === null || n === undefined ? 'عند ضعف مدة المرحلة' : `بعد ${n} ${n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? 'أيام' : 'يومًا'} إضافية`
}
