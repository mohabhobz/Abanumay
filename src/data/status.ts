import type { ProjectRow, ProjectStatusGroup } from '@/types/domain'
import { stageMeta } from '@/data/mock/taxonomy'

/* v3 · the project status dictionary (0.status.1–12) · one reading of a project's main status and
   its sub-status, live from the record.

   The status used to be a value written next to the stage by every store that moved a project, so
   five stores held five copies of the same rule and «معتمد» never existed: an approval jumped to the
   agreement's stage, read «في التشغيل», and waited for a confirmation step v3 removed. Now the status
   is a getter on the row, computed from what the record already says:

   - the stage gives the family (study · pre-execution · execution · closing · an end);
   - the approval itself makes it «معتمد» the moment the decision is recorded (0.status.3), until the
     agreement work starts (0.status.4);
   - a project in execution whose required plan isn't approved yet is still completing its
     pre-execution requirements · only «تحت التنفيذ» pays (0.status.5);
   - a completed project reads «مغلق بوفر» when a saving was left, and «أعيد توجيه الدعم» after a
     formal redirection (0.status.8 · 0.status.9).

   The agreements and plans stores hand their readers in at load (they import the project rows, so
   this file can't import them back). */

type Gate = (projectId: string) => string

/** '' while no agreement work exists for the project · otherwise its state, for the sub-status */
let agreementGate: Gate = () => ''
/** '' when the plan isn't required or is approved · otherwise its state */
let planGate: Gate = () => ''
export const setAgreementStatusGate = (f: Gate): void => { agreementGate = f }
export const setPlanStatusGate = (f: Gate): void => { planGate = f }
/** v3 · what the approval path adds to the study's level · a return from the executive (5.2.11), a
    body's decision waiting for its financial cover (6.4.3) · '' when nothing */
let studyNote: Gate = () => ''
export const setStudyNoteGate = (f: Gate): void => { studyNote = f }

const PRE = 'استكمال متطلبات ما قبل التنفيذ'

export function statusOf(p: Pick<ProjectRow, 'id' | 'stage' | 'supportStatus' | 'closeSavings' | 'redirect' | 'type'>): ProjectStatusGroup {
  const g = stageMeta(p.stage)?.group ?? 'قيد الدراسة'
  if (p.redirect) return 'أعيد توجيه الدعم'
  switch (g) {
    case 'قيد الدراسة':
      /* An approval recorded under the old confirmation seat reads approved at once */
      return p.supportStatus === 'معتمد' ? 'معتمد' : g
    case PRE:
      return agreementGate(p.id) ? PRE : 'معتمد'
    case 'تحت التنفيذ':
      return planGate(p.id) ? PRE : g
    case 'مكتمل':
      return p.closeSavings && p.closeSavings.amount > 0 ? 'مغلق بوفر' : g
    default:
      return g
  }
}

/** Under study · the level it stands at (0.status.2 · 3.4.19) · the institution reads it, the entity
    reads the main status alone */
export const STUDY_LEVEL: Record<string, string> = {
  supervisor: 'مراجعة مشرف المنح',
  manager: 'مدير المنح',
  exec: 'المدير التنفيذي',
  committee: 'اللجنة التنفيذية',
  board: 'مجلس الأمناء',
}

/** The sub-status · '' where the dictionary gives none */
export function subStatusOf(p: Pick<ProjectRow, 'id' | 'stage' | 'holder' | 'supportStatus' | 'closeSavings' | 'redirect' | 'type' | 'refusedBy'>): string {
  const s = statusOf(p)
  if (s === 'قيد الدراسة') {
    if (p.stage === 'استكمال بيانات المشروع') return 'استكمال الجهة'
    const lvl = STUDY_LEVEL[p.holder ?? 'supervisor'] ?? STUDY_LEVEL.supervisor!
    const n = studyNote(p.id)
    return n ? `${lvl} · ${n}` : lvl
  }
  if (s === PRE) {
    /* 0.status.4 · the agreement's state and the plan's, each on its own */
    const a = agreementGate(p.id)
    const pl = planGate(p.id)
    return [a && `الاتفاقية: ${a}`, pl && `الخطة: ${pl}`].filter(Boolean).join(' · ')
  }
  if (s === 'مرفوض') return p.refusedBy ? `صدر عن ${p.refusedBy}` : refusedFromStage(p.stage)
  return ''
}

const refusedFromStage = (stage: string): string =>
  stage === 'مرفوض - اللجنة التنفيذية' ? 'صدر عن اللجنة التنفيذية' : stage === 'مرفوض - مجلس الأمناء' ? 'صدر عن مجلس الأمناء' : ''

/** The main status and, for the institution, its sub-status · one line */
export const statusLine = (p: Parameters<typeof subStatusOf>[0], asEntity = false): string => {
  const s = statusOf(p)
  const sub = asEntity ? '' : subStatusOf(p)
  return sub ? `${s} · ${sub}` : s
}

/* The families · the readers ask «is it open», «is it done», never a list of words */
export const STUDY: readonly ProjectStatusGroup[] = ['قيد الدراسة']
/** Approved and not ended · from the decision to the closing's end */
export const LIVE: readonly ProjectStatusGroup[] = ['معتمد', PRE, 'تحت التنفيذ', 'قيد الإغلاق']
/** Ended well · the work was done */
export const DONE: readonly ProjectStatusGroup[] = ['مكتمل', 'مغلق بوفر', 'أعيد توجيه الدعم']
/** Ended without the work · refused or cancelled */
export const DROPPED: readonly ProjectStatusGroup[] = ['مرفوض', 'ملغى']
/** Closed for good · nothing more is done on it */
export const ENDED: readonly ProjectStatusGroup[] = [...DONE, ...DROPPED]
/** Counted against the entity's open cap and the active work · under study, live, or stalled */
export const OPEN: readonly ProjectStatusGroup[] = [...STUDY, ...LIVE, 'متعثر']

export const isStudy = (s: string): boolean => s === 'قيد الدراسة'
export const isLive = (s: string): boolean => (LIVE as readonly string[]).includes(s)
export const isDone = (s: string): boolean => (DONE as readonly string[]).includes(s)
export const isDropped = (s: string): boolean => (DROPPED as readonly string[]).includes(s)
export const isEnded = (s: string): boolean => (ENDED as readonly string[]).includes(s)
/** Granted money that is spent or will be · live, stalled or ended well */
export const isFunded = (s: string): boolean => isLive(s) || isDone(s) || s === 'متعثر'

/** The status becomes a live reading on each row · a write to it is ignored (the stage is the record) */
export function installStatus(rows: ProjectRow[] | ProjectRow): void {
  for (const r of Array.isArray(rows) ? rows : [rows]) {
    if (r.type === 'محفظة') continue
    Object.defineProperty(r, 'statusGroup', {
      get(this: ProjectRow) { return statusOf(this) },
      set() { /* derived */ },
      enumerable: true,
      configurable: true,
    })
  }
}
