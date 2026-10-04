import { CFG, persist, readJson } from '@/lib/config'
import { FIELDS_BY_TRACK, OWNERS } from '@/data/mock/taxonomy'

/* The intake cycle · procedure 3 (receiving projects and the supervisor's study).

   One record holds everything the authority sets before the portal opens, because the document
   ties them together: a domain can't open without a supervisor (3.4.1 · 3.4.5), the portal shows
   only the domains open in the period (3.4.6), and each new request is assigned to that domain's
   supervisor by the domain's distribution rule (3.4.3 · 3.4.10). Kept in one place so the settings
   page, the request form and the assignment read the same values.

   Saved from the settings tab «دورة الاستقبال»; the defaults below are the prototype's sample. */

export type Distribution = 'manual' | 'even' | 'load' | 'specialty'

export const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  manual: 'يدوي · يُسنده مدير المنح',
  even: 'بالتساوي بين مشرفي المجال',
  load: 'حسب عبء العمل الحالي',
  specialty: 'حسب تخصص المشرف في الهدف',
}

export interface DomainSetup {
  /** Supervisors of this domain · one or more (3.2.2 · 3.4.2) */
  supervisors: string[]
  distribution: Distribution
  /** Open for requests in this cycle · only possible with at least one supervisor */
  open: boolean
}

export interface CycleSetup {
  name: string
  /** Fiscal year the cycle belongs to · ties prospects and budgets to it */
  year: string
  /** Submission period · yyyy-mm-dd */
  from: string
  to: string
  /** Supervisors chosen for this cycle (3.2.1) · a domain picks from these */
  supervisors: string[]
  /** Domain name → its setup · keyed by the field name from the taxonomy */
  domains: Record<string, DomainSetup>
  /** Goals each supervisor specialises in · read by the «specialty» rule */
  specialties: Record<string, string[]>
  /** Calendar for execution durations (3.4.30) · weekday numbers 0 = Sunday … 6 = Saturday */
  weekend: number[]
  holidays: { date: string; name: string }[]
}

export const ALL_FIELDS: string[] = Object.values(FIELDS_BY_TRACK).flat()

const sup = (...xs: string[]) => xs

/* Sample: most domains open with a supervisor, two closed (one has no supervisor yet, so it can't
   open — the case the rule exists for). */
const DEFAULT: CycleSetup = {
  name: 'دورة المنح 2026 · الثانية',
  year: '2026',
  from: '2026-09-01',
  to: '2026-11-30',
  supervisors: [...OWNERS],
  domains: Object.fromEntries(ALL_FIELDS.map((f, i): [string, DomainSetup] => {
    const owners = [...OWNERS]
    const a = owners[i % owners.length]!
    const b = owners[(i + 2) % owners.length]!
    const noneYet = f === 'المشاريع الخارجية' || f === 'مجال المساهمة في المنصات الوطنية'
    return [f, {
      supervisors: noneYet ? [] : i % 3 === 0 ? sup(a, b) : sup(a),
      distribution: i % 4 === 0 ? 'load' : i % 4 === 1 ? 'even' : i % 4 === 2 ? 'specialty' : 'manual',
      open: !noneYet && f !== 'الحج ورمضان',
    }]
  })),
  specialties: {
    'عمر قاسم': ['المحفظة التعليمية المتنوعة', 'دروس التقوية الإلكترونية', 'المنح الدراسية الجامعية'],
    'سعود البريكان': ['الدعم التشغيلي للجمعيات المتميزة', 'تأسيس الجمعيات الأهلية'],
    'عزام الخريف': ['تطوير معلمي القرآن الكريم', 'الدورات القرآنية الموسمية', 'البناء العلمي الشرعي'],
    'أحمد العبداللطيف': ['السلال الغذائية', 'كفالة الأيتام والأرامل'],
    'حصة النملة': ['علاج مرضى الكلى', 'عمارة المساجد', 'تأسيس المراكز الصحية'],
  },
  weekend: [5, 6],
  holidays: [
    { date: '2026-09-23', name: 'اليوم الوطني' },
    { date: '2027-02-22', name: 'يوم التأسيس' },
    { date: '2027-03-20', name: 'عيد الفطر' },
    { date: '2027-03-21', name: 'عيد الفطر' },
    { date: '2027-03-22', name: 'عيد الفطر' },
  ],
}

/** The live cycle · mutated in place on save so every reader sees the new values */
export const CYCLE: CycleSetup = readJson(CFG.cycle, DEFAULT)

/* A domain added to the taxonomy after the cycle was saved still gets a (closed) row */
for (const f of ALL_FIELDS) {
  if (!CYCLE.domains[f]) CYCLE.domains[f] = { supervisors: [], distribution: 'manual', open: false }
}

export const saveCycle = (next: CycleSetup): void => {
  /* A domain with no supervisor is closed, whatever the draft said (3.4.1 · 3.4.5) */
  for (const d of Object.values(next.domains)) if (d.supervisors.length === 0) d.open = false
  Object.assign(CYCLE, structuredClone(next))
  persist(CFG.cycle, CYCLE)
}

export const domainOf = (field: string): DomainSetup | undefined => CYCLE.domains[field]

/** Why a domain can't open · empty when it can */
export const openBlock = (field: string): string =>
  (CYCLE.domains[field]?.supervisors.length ?? 0) === 0 ? 'لا يُفتح مجال قبل ربطه بمشرف منح واحد على الأقل' : ''

/** Today in the prototype · the same reference date the inbox and plans use */
export const TODAY = '2026-10-03'

export const inPeriod = (date = TODAY): boolean => date >= CYCLE.from && date <= CYCLE.to

/** Domains a requester may pick right now (3.4.6) · open, with a supervisor, inside the period */
export const openFields = (date = TODAY): string[] =>
  inPeriod(date)
    ? ALL_FIELDS.filter((f) => CYCLE.domains[f]?.open && (CYCLE.domains[f]?.supervisors.length ?? 0) > 0)
    : []

/* ── Working-day calendar (3.4.13 · 3.4.30) ──
   Execution durations count working days: the weekend and official holidays are skipped. */

const iso = (d: Date) => d.toISOString().slice(0, 10)

export const isWorkingDay = (date: string): boolean => {
  const d = new Date(`${date}T00:00:00Z`)
  return !CYCLE.weekend.includes(d.getUTCDay()) && !CYCLE.holidays.some((h) => h.date === date)
}

/** End date after `days` working days from `start` (the start counts as day 1 when it is one) */
export const addWorkingDays = (start: string, days: number): string => {
  if (!start || days <= 0) return start
  const d = new Date(`${start}T00:00:00Z`)
  let left = days
  for (;;) {
    if (isWorkingDay(iso(d))) left--
    if (left <= 0) return iso(d)
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

/** Working days between two dates, both ends included */
export const workingDaysBetween = (from: string, to: string): number => {
  if (!from || !to || to < from) return 0
  const d = new Date(`${from}T00:00:00Z`)
  let n = 0
  while (iso(d) <= to) {
    if (isWorkingDay(iso(d))) n++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return n
}

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const
