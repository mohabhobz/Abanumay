import { CFG, persist, readJson } from '@/lib/config'
import { logSettings, diffOf } from './settingsLog'

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
  /** entities#8 · the status of an entity whose update request waits · the live system's «محدث» or
      the document's «غير نشطة» (2.3.upd-16) */
  updateStatus: 'محدث' | 'غير نشطة'
  /** payments#6 · the next payment opens once the one before is requested, or only once it is paid */
  payNext: 'requested' | 'paid'
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
  /** intake#15 · when an official holiday is added or removed, the end dates of projects not yet
      closed are computed again */
  holidayRederive: boolean
}

const DEFAULT: Decisions = {
  updateStatus: 'محدث',
  payNext: 'requested',
  ehsanEntities: 'any',
  priority: 'manual',
  typeFloor: { regular: null, independent: null, portfolio: null },
  impactBasis: 'similar',
  archivedInReports: false,
  holidayRederive: false,
}

export const DECISIONS: Decisions = readJson(CFG.decisions, DEFAULT)
DECISIONS.typeFloor = { ...DEFAULT.typeFloor, ...DECISIONS.typeFloor }
export const DECISIONS_DEFAULT = DEFAULT

export const LEVEL_SAY: Record<Level, string> = { manager: 'مدير المنح', exec: 'المدير التنفيذي', committee: 'اللجنة التنفيذية', board: 'مجلس الأمناء' }
export const LEVEL_RANK: Record<Level, number> = { manager: 0, exec: 1, committee: 2, board: 3 }
export const KIND_SAY: Record<ProjectKind, string> = { regular: 'مشروع عادي', independent: 'مشروع مستقل (شريك)', portfolio: 'محفظة' }

const LABEL: Record<keyof Decisions, string> = {
  updateStatus: 'حالة الجهة أثناء طلب التحديث', payNext: 'فتح الدفعة التالية', ehsanEntities: 'الجهات الموجّهة عبر إحسان',
  priority: 'أولوية الطلب', typeFloor: 'نوع المشروع في مسار الاعتماد', impactBasis: 'أساس الأثر المتوقع',
  archivedInReports: 'مشاريع الجهات المؤرشفة في التقارير', holidayRederive: 'إعادة حساب النهاية عند تغيّر الإجازات',
}

export function saveDecisions(next: Decisions, by: string): void {
  const before = structuredClone(DECISIONS)
  Object.assign(DECISIONS, structuredClone(next))
  persist(CFG.decisions, DECISIONS)
  logSettings('قرارات المؤسسة', '/settings/decisions', by, diffOf(
    before as unknown as Record<string, unknown>, DECISIONS as unknown as Record<string, unknown>,
    (k) => LABEL[k as keyof Decisions] ?? k,
    (v) => typeof v === 'boolean' ? (v ? 'مفعّل' : 'موقوف') : typeof v === 'object' && v ? Object.entries(v).map(([a, b]) => `${KIND_SAY[a as ProjectKind] ?? a}: ${b ? LEVEL_SAY[b as Level] : 'بالمبلغ'}`).join('، ') : String(v),
  ))
}

/** The entity status as shown · the stored value stays «محدث», the label follows the decision */
export const activationSay = (a: string): string => (a === 'محدث' ? DECISIONS.updateStatus === 'محدث' ? 'محدث' : 'غير نشطة · بانتظار التحديث' : a)

/** A project's kind for the approval path */
export const kindOf = (p: { partnerType?: string }): ProjectKind =>
  p.partnerType === 'محفظة' ? 'portfolio' : p.partnerType === 'مستقل' ? 'independent' : 'regular'

/** The lowest level allowed to approve this project by its type · `null` when the type adds nothing */
export const floorOf = (p: { partnerType?: string }): Level | null => DECISIONS.typeFloor[kindOf(p)]

/** Does the type stop `level` from approving? · the message, or '' */
export function typeFloorBlock(p: { partnerType?: string }, level: Level): string {
  const f = floorOf(p)
  if (!f || LEVEL_RANK[level] >= LEVEL_RANK[f]) return ''
  return `نوع المشروع «${KIND_SAY[kindOf(p)]}» يُعتمد من ${LEVEL_SAY[f]} فأعلى (قرار المؤسسة · 5.4.25)`
}

/** The higher of two levels */
export const maxLevel = (a: Level, b: Level | null): Level => (b && LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a)
