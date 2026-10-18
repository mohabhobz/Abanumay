import { CFG, persist, readJson } from '@/lib/config'
import { logSettings, diffOf } from './settingsLog'
import type { RoleKey } from '@/data/roles'

/* The client's open decisions · batch 8 (9 Oct).

   Each of these was left as «محتاج قرارك» in the audit. Rather than wait, every one is built both
   ways and the choice is one setting here: the foundation decides by picking an option, with no
   code change. The default is what the system did before, so nothing moves until someone chooses.

   Two decisions that already had their own switch stay where they are and are shown on the same
   page: the automatic committee referral (approval rules) and blocking an incomplete entity file
   (entity rules). */

export type Level = 'manager' | 'exec' | 'committee' | 'board'
export type ProjectKind = 'regular' | 'independent' | 'portfolio'

export interface Decisions {
  /** payments#6 · the next payment opens once the one before is requested, or only once it is paid */
  payNext: 'off' | 'requested' | 'paid'
  /** partners · which entities may be routed through Ehsan · any, or approved strategic partners only */
  ehsanEntities: 'any' | 'strategic'
  /** Priority of a request in study · set by the supervisor, or computed from the study */
  priority: 'manual' | 'computed'
  /** approvals#18 (5.4.25) · the lowest level that may approve each project type · `null` = by amount only */
  typeFloor: Record<ProjectKind, Level | null>
  /** The expected impact · from closed similar projects first, or the field's default rate only */
  impactBasis: 'similar' | 'field'
  /** entities#49 · the projects of an archived entity in the impact and reports */
  archivedInReports: boolean
  /** Client 18 Oct · #17 · who may take a closing decision that changes the agreement's value by
      an annex (a raise by annex · a cut) · a system permission, not a fixed seat */
  annexBy: RoleKey[]
  /** Client 18 Oct · #34 · who may cancel an approved portfolio · a system permission */
  portfolioCancelBy: RoleKey[]
  /** Re-audit 17 Oct · 10.9.2 – 10.9.4 · client item 26 (under review) · a stop decision that redirects the
      support · the project reads «أعيد توجيه الدعم» from the decision's approval (v3), or only once its
      closing ends (the behaviour before) */
  redirectStatusAt: 'decision' | 'closing'
  /** Client 18 Oct (sheet V2 · #42 · #48) · distress and recovery are system permissions · who opens a
      distress case (a stop, a cut, a raise) */
  distressBy: RoleKey[]
  /** … and who takes the final decision on a balance not recovered (write-off · scheduling · legal follow-up) */
  recoveryBy: RoleKey[]
}

const DEFAULT: Decisions = {
  /* Client 18 Oct · #19 · the order is kept · each payment still waits for its own conditions */
  payNext: 'requested',
  ehsanEntities: 'any',
  priority: 'manual',
  typeFloor: { regular: null, independent: null, portfolio: null },
  impactBasis: 'similar',
  archivedInReports: false,
  annexBy: ['supervisor'],
  portfolioCancelBy: ['ceo'],
  redirectStatusAt: 'decision',
  distressBy: ['supervisor'],
  recoveryBy: ['ceo'],
}

export const DECISIONS: Decisions = readJson(CFG.decisions, structuredClone(DEFAULT))
DECISIONS.typeFloor = { ...DEFAULT.typeFloor, ...DECISIONS.typeFloor }
/* Re-audit 17 Oct · «holidayRederive» left the dictionary · v3 3.4.34 decided it (the ends always follow
   the calendar, IntakeSettings) · a copy saved before drops it so it isn't counted as a choice */
delete (DECISIONS as unknown as Record<string, unknown>).holidayRederive
export const DECISIONS_DEFAULT = DEFAULT

export const LEVEL_SAY: Record<Level, string> = { manager: 'مدير المنح', exec: 'المدير التنفيذي', committee: 'اللجنة التنفيذية', board: 'مجلس الأمناء' }
export const LEVEL_RANK: Record<Level, number> = { manager: 0, exec: 1, committee: 2, board: 3 }
export const KIND_SAY: Record<ProjectKind, string> = { regular: 'مشروع عادي', independent: 'مشروع مستقل (شريك)', portfolio: 'محفظة' }

const LABEL: Record<keyof Decisions, string> = {
  payNext: 'فتح الدفعة التالية', ehsanEntities: 'الجهات الموجّهة عبر شريك استراتيجي',
  priority: 'أولوية الطلب', typeFloor: 'نوع المشروع في مسار الاعتماد', impactBasis: 'أساس الأثر المتوقع',
  archivedInReports: 'مشاريع الجهات المؤرشفة في التقارير',
  annexBy: 'من يتخذ قرار ملحق القيمة', redirectStatusAt: 'متى تظهر حالة «أعيد توجيه الدعم»', portfolioCancelBy: 'من يلغي المحفظة',
  distressBy: 'من يفتح حالة التعثر', recoveryBy: 'من يقرّر في الرصيد غير المسترد',
}

/** The seats a role permission may be given to · in the decisions page */
export const SEAT_SAY: Partial<Record<RoleKey, string>> = { supervisor: 'مشرف المنح', 'grants-manager': 'مدير المنح', ceo: 'المدير التنفيذي', finance: 'المالية', admin: 'مدير النظام' }
/** Does this seat hold the permission? */
export type SeatKey = 'annexBy' | 'portfolioCancelBy' | 'distressBy' | 'recoveryBy'
export const holds = (k: SeatKey, role: RoleKey): boolean => DECISIONS[k].includes(role)
/** The permission's holders in words · «مشرف المنح أو مدير المنح» */
export const holdersSay = (k: SeatKey): string => DECISIONS[k].map((r) => SEAT_SAY[r] ?? r).join(' أو ') || 'لا أحد'

export function saveDecisions(next: Decisions, by: string): void {
  const before = structuredClone(DECISIONS)
  Object.assign(DECISIONS, structuredClone(next))
  persist(CFG.decisions, DECISIONS)
  logSettings('قرارات المؤسسة', '/settings/decisions', by, diffOf(
    before as unknown as Record<string, unknown>, DECISIONS as unknown as Record<string, unknown>,
    (k) => LABEL[k as keyof Decisions] ?? k,
    (v) => typeof v === 'boolean' ? (v ? 'مفعّل' : 'موقوف') : Array.isArray(v) ? v.map((r) => SEAT_SAY[r as RoleKey] ?? r).join('، ') || 'لا أحد' : typeof v === 'object' && v ? Object.entries(v).map(([a, b]) => `${KIND_SAY[a as ProjectKind] ?? a}: ${b ? LEVEL_SAY[b as Level] : 'بالمبلغ'}`).join('، ') : String(v),
  ))
}

/* v3 · 0.ent.6–9 · the entity account is read in the dictionary's four words · «مؤرشف» on top of
   any of them · the open decision «محدث» or «غير نشطة» (entities#8) is settled by v3: «معلق» */
type AccountLike = { activation: string; archived?: boolean; decision?: string }
/** The account in one word · نشط · معلق · غير نشط · مؤرشف */
export const accountSay = (e: AccountLike): string => (e.archived ? 'مؤرشف' : e.activation)
/** What holds the account where it is · empty for an active one */
export const accountWhy = (e: AccountLike): string =>
  e.archived ? '' : e.activation === 'غير نشط'
    ? e.decision === 'revoked' ? 'بقرار إلغاء الاعتماد' : e.decision === 'suspension' ? 'بقرار تعليق الأهلية' : 'لمستند إلزامي منتهٍ'
    : e.activation === 'معلق' ? 'تحديث جوهري تحت المراجعة' : ''
/** The account with its cause · «غير نشط · بقرار تعليق الأهلية» */
export const accountLine = (e: AccountLike): string => [accountSay(e), accountWhy(e)].filter(Boolean).join(' · ')

/** A project's kind for the approval path */
export const kindOf = (p: { partnerType?: string }): ProjectKind =>
  p.partnerType === 'محفظة' ? 'portfolio' : p.partnerType === 'مستقل' ? 'independent' : 'regular'

/** The lowest level allowed to approve this project by its type · `null` when the type adds nothing */
export const floorOf = (p: { partnerType?: string }): Level | null => DECISIONS.typeFloor[kindOf(p)]

/** Does the type stop `level` from approving? · the message, or '' */
export function typeFloorBlock(p: { partnerType?: string }, level: Level): string {
  const f = floorOf(p)
  if (!f || LEVEL_RANK[level] >= LEVEL_RANK[f]) return ''
  return /* doc 5.4.25 */ `نوع المشروع «${KIND_SAY[kindOf(p)]}» يُعتمد من ${LEVEL_SAY[f]} فأعلى (قرار المؤسسة)`
}

/** The higher of two levels */
export const maxLevel = (a: Level, b: Level | null): Level => (b && LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a)
