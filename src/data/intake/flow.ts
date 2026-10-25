import { done } from '@/data/feedback'
import { actsAs } from '@/data/behalf'
import { asOf } from '@/data/clock'
import { liveClock } from '@/data/stageClock'
import { useSyncExternalStore } from 'react'
import type { ProjectRow } from '@/types/domain'
import type { LogEvent, LogField } from '@/data/mock/log'
import { SOURCE_OF } from '@/data/mock/log'
import { projectRows } from '@/data/mock/projects'
import { stageMeta, FIELDS_BY_TRACK } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { replayLateRelinks } from '@/data/entities/store'
import { CYCLE, TODAY, addWorkingDays, calendarDaysBetween, endAfterDays, workDaysOf, type Distribution } from './cycle'
import { CRITERIA, studyScore } from './criteria'
import { excludedBy, type ExclusionAnswer } from './exclusion'
import { nextSeq, type Stamped } from '@/data/opclock'
import { liveDay, localDayOf, stampNow, timeOf } from '@/data/clock'
import { CONSULTANTS, consultantByKey } from './consultants'
import { isEnded } from '@/data/status'
import { installStatus } from '@/data/status'
import { domainBudget } from './insight'
import { OTHER, reasonSay } from './reasons'

/* Receiving projects and the supervisor's study · the actions (procedure 3).

   Every decision on a project under study goes through here, so each one has the effect the
   document gives it — the state moves, the timeline records it, the next person is notified —
   and none of them is an approval: the supervisor recommends, the grants manager decides
   (3.4.18 · 3.4.24). The bulk «توصية بالموافقة» in the list and the bar on the project page run
   the same function.

   State is an ordered list of operations kept in the browser and replayed at load, so a reload,
   a second tab or a switch of profile lands on the same state without a backend (settings has a
   reset for the demo); in production each operation is a
   POST and the state comes from the server. */

/* ── Documents of a request (3.1.input-4 · 3.4.32) ── */

export type DocAudience = 'entity' | 'internal'

export interface DocKind {
  key: string
  label: string
  audience: DocAudience
  required: boolean
}

/** What a request carries · the entity's documents are seen by the entity; the internal ones never */
export const REQUEST_DOCS: DocKind[] = [
  { key: 'budget', label: 'ملف الموازنة التفصيلية', audience: 'entity', required: true },
  { key: 'study', label: 'دراسة المشروع', audience: 'entity', required: true },
  { key: 'letter', label: 'خطاب طلب الدعم', audience: 'entity', required: true },
  { key: 'plan', label: 'الخطة التنفيذية', audience: 'entity', required: true },
  { key: 'prev', label: 'تقرير عن المشروع إن سبق تنفيذه', audience: 'entity', required: false },
  { key: 'more', label: 'مرفقات أخرى تعزّز قيمة المشروع', audience: 'entity', required: false },
  { key: 'memo', label: 'مذكرة الدراسة الداخلية', audience: 'internal', required: false },
  { key: 'visit', label: 'محضر زيارة ميدانية', audience: 'internal', required: false },
  { key: 'advice', label: 'رأي المستشار', audience: 'internal', required: false },
]

export interface DocFile { kind: string; name: string; by: string; at: string }

/** Client 21 Oct (#32) · «مرفقات أخرى» · any number of files at once, beside the named attachments ·
    each keeps who added it and when, and its uploader may remove it while the request is still open */
export interface ExtraDoc { id: string; name: string; size: number; by: string; at: string; internal?: boolean }

/* A seeded example so the section reads with content on a demo project */
const SEED_EXTRAS: Record<string, ExtraDoc[]> = {
  '20852': [
    { id: 'x-20852-1', name: 'صور زيارة مركز الغسيل.jpg', size: 1_840_000, by: 'جمعية البر بالأحساء', at: '2026-06-14' },
    { id: 'x-20852-2', name: 'خطاب تأييد وزارة الصحة.pdf', size: 420_000, by: 'جمعية البر بالأحساء', at: '2026-06-14' },
  ],
}

/* ── Study (3.2.11–16 · 3.4.25) ── */

export type Recommendation = 'approve' | 'reject'

export interface Study {
  scores: Record<string, number>
  technical: string
  admin: string
  recommendation: Recommendation | ''
  /** Amount the supervisor recommends · up to the requested amount */
  amount: number
  justification: string
  /** v3 · 3.2.19 · 3.4.25 · a recommendation to reject names its reason from the settings list, or «أخرى» with text */
  rejectReason?: string
  rejectOther?: string
  /** v3 · 3.2.17 · the supervisor classifies the project · a portfolio takes its path after the approval */
  classification?: 'مشروع عادي' | 'مشروع لجهة خارجية' | 'محفظة'
  /** Meeting 20 Oct · the consultant is an option of the study, not a fixed block */
  needsConsultant?: boolean
  /** Client 21 Oct · the exclusion criteria as answered · the questions' text is kept with the study */
  exclusions?: ExclusionAnswer[]
  /** Client 21 Oct · the study's notes in one place · `technical` and `admin` are read into it for
      studies saved before */
  notes?: string
  by: string
  at: string
  /** Each save of a forwarded study after a return is a new version (3.4.26) */
  version: number
  /** Kept when the project moves to another domain (3.4.21) */
  field: string
}

export interface Referral {
  consultant: string
  by: string
  at: string
  expiresAt: string
  opinion?: string
  verdict?: 'مؤيّد' | 'مؤيّد بتحفّظ' | 'غير مؤيّد'
  opinionAt?: string
  /** Batch 1 · the access code sent with the link · drawn at random when the referral is made */
  code?: string
}

export interface VersionSnap { amount: number; days: number; reach: number; objectives: number; docs: number; startAt?: string }
const snapOf = (p: ProjectRow, f: { objectives: string[]; docs: { kind: string }[] }): VersionSnap => ({
  amount: p.amountRequested, days: p.durationDays ?? 0, reach: p.beneficiaries ?? 0, objectives: f.objectives.length, docs: f.docs.length, startAt: p.startAt,
})
export interface FlowNote { id: string; to: string; title: string; context: string; at: string; projectId: string }

/** v3 · 0.def.14 · 0.def.15 · an output with its indicator and target value */
export interface Output { text: string; indicator: string; target: string }

/** The outputs the request carries · a JSON list in the form's value */
/* Client sheet 24 Oct (#92) · the execution stages the entity gives with its request · each its name,
   description and expected dates inside the project's duration · kept as sent in the request's values */
export interface ExecStage { name: string; desc: string; from: string; to: string }
export const stagesOf = (v?: string): ExecStage[] => {
  if (!v) return []
  try {
    const x = JSON.parse(v) as ExecStage[]
    return Array.isArray(x) ? x.map((y) => ({ name: String(y.name ?? ''), desc: String(y.desc ?? ''), from: String(y.from ?? ''), to: String(y.to ?? '') })) : []
  } catch { return [] }
}

export const parseOutputs = (v?: string): Output[] => {
  if (!v) return []
  try {
    const x = JSON.parse(v) as unknown
    return Array.isArray(x) ? x.filter((o): o is Output => Boolean(o && typeof o === 'object' && typeof (o as Output).text === 'string')).map((o) => ({ text: o.text, indicator: o.indicator ?? '', target: o.target ?? '' })) : []
  } catch { return [] }
}
export const outputLine = (o: Output): string => [o.text, o.indicator && `المؤشر: ${o.indicator}`, o.target && `المستهدف: ${o.target}`].filter(Boolean).join(' · ')

export interface ProjectFlow {
  createdAt?: string
  /** v3 · 3.4.23 · the domain, track and goal as the entity chose them · kept when the project moves */
  original?: { track: string; field: string; goal: string }
  /** v3 · 0.def.14 · the entity's outputs as sent · never edited */
  entityOutputs?: Output[]
  /** v3 · 0.def.15 · 3.2.13 · 3.4.44 · the foundation's copy · made when the study starts, edited by the
      supervisor or the manager · the reference for the approval, the agreement and the evaluation */
  orgOutputs?: Output[]
  sentAt?: string
  /** Every version sent · with what it carried, so an earlier one reads in full after a resubmission (3.4.31) */
  versions: { no: number; at: string; by: string; say: string; snap?: VersionSnap; /** The request as sent */ values?: Record<string, string>; /** Batch 7 · the attachments at that version */ docs?: string[] }[]
  objectives: string[]
  docs: DocFile[]
  /** #32 · «مرفقات أخرى» */
  extras?: ExtraDoc[]
  study?: Study
  /** Earlier studies · a transfer or a return keeps them on record */
  pastStudies: Study[]
  referral?: Referral
  completionNote?: string
  returnNote?: string
  /** The study was updated after the return · the version counts once per return */
  returnStudied?: boolean
  /** v3 · 4.2.5 · the study amount the last forward put on the approval path · a re-send that didn't
      change it leaves a level's later change standing (6.4.12) */
  appliedAmount?: number
  closed?: { kind: 'cancel' | 'archive'; reason: string; by: string; at: string }
  /** v3 · 3.2.10 · the request as the entity corrected it after a return · the next version carries it */
  amended?: Record<string, string>
  events: LogEvent[]
}

/* ── Store ── */

type Op = Stamped & (
  | { op: 'submit'; id: string; values: Record<string, string>; by: string; asEntity: boolean; docs: string[] }
  | { op: 'doc'; id: string; kind: string; name: string; by: string }
  /* Client 21 Oct (#32) · several «other» files in one pick · and the uploader's removal */
  | { op: 'docMore'; id: string; files: { name: string; size: number }[]; by: string; internal?: boolean }
  | { op: 'docDrop'; id: string; doc: string; by: string }
  /* Client 24 Oct · an «other» attachment replaced in place · the old file stays in the log */
  | { op: 'docSwap'; id: string; doc: string; name: string; size: number; by: string }
  | { op: 'study'; id: string; study: Omit<Study, 'at' | 'version' | 'field'> }
  | { op: 'recommend'; id: string; by: string }
  | { op: 'complete'; id: string; note: string; by: string }
  | { op: 'resubmit'; id: string; by: string }
  | { op: 'transfer'; id: string; field: string; owner: string; reason: string; by: string; track?: string; goal?: string }
  | { op: 'outputs'; id: string; list: Output[]; by: string }
  /* v3 · 3.2.10 · the entity corrects its returned request · the values it may change */
  | { op: 'amend'; id: string; values: Record<string, string>; by: string }
  | { op: 'return'; id: string; note: string; by: string }
  | { op: 'refer'; id: string; consultant: string; by: string; code?: string }
  | { op: 'opinion'; id: string; opinion: string; verdict: NonNullable<Referral['verdict']>; by: string }
  | { op: 'close'; id: string; kind: 'cancel' | 'archive'; reason: string; by: string }
  | { op: 'assign'; id: string; owner: string; by: string; from?: string; reason?: string }
  /* Batch 6 · 8 Oct · the start moves · the end follows from the duration (3.4.input · the calculated end) */
  | { op: 'reschedule'; id: string; startAt: string; reason: string; by: string; source?: StartSource }
  /* Batch 8 · intake#15 · the official holidays changed · each open project's end is computed again */
  | { op: 'rederive'; id: string; ids: string[]; reason: string; by: string }
)

const KEY = 'ab-intake-ops'
const FLOWS = new Map<string, ProjectFlow>()
export const FLOW_NOTES: FlowNote[] = []
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()

const emit = () => {
  version++
  subs.forEach((f) => f())
}

export function useFlow(): number {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f) } },
    () => version,
  )
}

export const flowOf = (id: string): ProjectFlow => {
  let f = FLOWS.get(id)
  if (!f) {
    const r0 = row(id)
    f = {
      versions: r0 ? [{ no: 1, at: r0.submittedAt, by: r0.entityName, say: 'أرسلته الجهة من البوابة' }] : [],
      objectives: [], docs: seedDocs(id), extras: (SEED_EXTRAS[id] ?? []).map((x) => ({ ...x })), pastStudies: [], events: [],
    }
    const seeded = SEED_STUDY[id]
    if (seeded) f.study = { ...seeded, field: row(id)?.field ?? seeded.field }
    if (SEED_REFERRAL[id]) f.referral = { ...SEED_REFERRAL[id]! }
    FLOWS.set(id, f)
  }
  return f
}

const row = (id: string) => projectRows.find((p) => p.id === id)

/* The running op's stamp · the dates an action writes are its own, the same on every replay */
let OP_AT: string | undefined
const opDay = () => localDayOf(OP_AT ?? stampNow())
const NOW_TIME = () => {
  return timeOf(OP_AT)
}

let evSeq = 0
const event = (id: string, e: { action: string; by: string; actor?: LogEvent['actor']; fields?: LogField[]; tone?: LogEvent['tone']; dept?: string; files?: string[] }) => {
  const p = row(id)
  const actor = e.actor ?? 'staff'
  flowOf(id).events.unshift({
    id: `fl-${id}-${evSeq++}`,
    action: e.action,
    dept: e.dept ?? p?.stage ?? 'دراسة المشروع',
    by: e.by,
    actor,
    at: opDay(),
    time: NOW_TIME(),
    days: 0,
    hours: 0,
    limit: 900,
    fields: e.fields ?? [],
    files: e.files,
    tone: e.tone ?? 'mute',
    source: SOURCE_OF[actor],
  })
}

const note = (projectId: string, to: string, title: string, context: string) => {
  FLOW_NOTES.unshift({ id: `fn-${projectId}-${FLOW_NOTES.length}`, to, title, context, at: opDay(), projectId })
}

const moveTo = (p: ProjectRow, stage: string) => {
  const meta = stageMeta(stage)
  p.stage = stage
  p.statusGroup = meta?.group ?? p.statusGroup
  p.stageLimit = meta?.limit ?? 0
  p.hoursInStage = 0
}

/* ── Seeds · the prototype's sample projects under study carry a study, so the card, the score and
   the guard read real values. One deliberately has none, to show the guard. ── */

const seedScores = (n: number) => Object.fromEntries(CRITERIA.list.map((c, i) => [c.key, Math.max(2, Math.min(5, n - (i % 3)))]))

const SEED_REFERRAL: Record<string, Referral> = {
  /* The demo's open referral · its access runs a week past the day it's opened, so the advice screen
     stays reachable as real days pass (the expiry itself is live, batch 5) */
  '20940': { consultant: 'c1', by: 'عمر قاسم', at: '2026-09-29', expiresAt: (() => { const d = new Date(`${liveDay()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) })() },
}

const SEED_STUDY: Record<string, Study> = {
  '20940': {
    scores: seedScores(4), technical: 'المخرجات (كتاب ومؤشرات) واضحة، والجدول الزمني يتجاوز السنة المالية.', admin: 'الموازنة المرفوعة صورة لا تُقرأ آليًا · طُلب استبدالها.',
    recommendation: 'approve', amount: 450_000, justification: 'يسدّ فجوة في محتوى التربية العلمية الشرعية، ويحتاج تقديرًا واقعيًا للمستفيدين قبل الاعتماد.',
    by: 'عمر قاسم', at: '2026-09-28', version: 1, field: 'العلم الشرعي',
  },
  '20968': {
    scores: seedScores(5), technical: 'خطة تأهيل واضحة بثلاث مراحل ومخرجات قابلة للقياس.', admin: 'الجهة نفّذت مشروعين مماثلين ضمن المدة.',
    recommendation: 'approve', amount: 260_000, justification: 'يتوافق مع هدف تطوير معلمي القرآن وتكلفة المعلّم معقولة مقارنة بالمسار.',
    by: 'عزام الخريف', at: '2026-09-21', version: 1, field: 'القرآن',
  },
  '20971': {
    scores: seedScores(4), technical: 'المخرجات واضحة والجدول الزمني واقعي.', admin: 'وثائق الجهة سارية.',
    recommendation: 'approve', amount: 700_000, justification: 'أثر مرتفع في منطقة لم تُدعم في المجال هذا العام.',
    by: 'حصة النملة', at: '2026-09-15', version: 1, field: 'الصحة',
  },
}

const seedDocs = (id: string): DocFile[] => {
  const p = row(id)
  if (!p) return []
  const at = p.submittedAt || TODAY
  const by = p.entityName
  /* A project returned for completion is missing the detailed budget · that's what it was returned for */
  const missing = p.stage === 'استكمال بيانات المشروع' ? ['budget'] : []
  return REQUEST_DOCS.filter((d) => d.audience === 'entity' && d.required && !missing.includes(d.key))
    .map((d) => ({ kind: d.key, name: `${d.label}.pdf`, by, at }))
}

/* ── Assignment (3.4.3 · 3.4.10) ── */

const studyLoad = (owner: string) =>
  projectRows.filter((p) => p.owner === owner && p.statusGroup === 'قيد الدراسة').length

/** The supervisor a new request goes to, by the domain's rule · `null` = manual (the manager assigns) */
export const pickSupervisor = (field: string, goal: string): string | null => {
  const d = CYCLE.domains[field]
  if (!d || d.supervisors.length === 0) return null
  const rule: Distribution = d.distribution
  /* Client sheet 24 Oct (#89) · the domain's named supervisor */
  if (rule === 'fixed') return d.lead && d.supervisors.includes(d.lead) ? d.lead : d.supervisors[0]!
  if (rule === 'manual') return d.supervisors.length === 1 ? d.supervisors[0]! : null
  if (rule === 'specialty') {
    const hit = d.supervisors.find((s) => (CYCLE.specialties[s] ?? []).includes(goal))
    if (hit) return hit
  }
  if (rule === 'even') {
    const inDomain = (s: string) => projectRows.filter((p) => p.owner === s && p.field === field).length
    return [...d.supervisors].sort((a, b) => inDomain(a) - inDomain(b))[0]!
  }
  return [...d.supervisors].sort((a, b) => studyLoad(a) - studyLoad(b))[0]!
}

/* ── Guards ── */

/* Re-audit 17 Oct · v3 · 11.2.2 · 11.4.3 · a project created by the simplified external form carries the
   form's attachments, not a regular request's four · the partners store hands in what its form asks
   (it imports this store, so not back) */
let extMissing: (id: string) => string[] | null = () => null
export const setExtMissingDocs = (f: (id: string) => string[] | null): void => { extMissing = f }
export const missingDocs = (id: string): string[] => {
  const ext = row(id)?.externalId ? extMissing(id) : null
  if (ext) return ext
  const f = flowOf(id)
  return REQUEST_DOCS.filter((d) => d.required && !f.docs.some((x) => x.kind === d.key)).map((d) => d.label)
}

/* The approvals store keeps the amount's trail · it imports this store, so it hands its writer in */
let amountHook: (projectId: string, from: number, to: number, by: string, at: string) => void = () => undefined
export const setSupervisorAmountHook = (f: typeof amountHook): void => { amountHook = f }

/* The budget store hands in what the project already holds · it imports this store, so not back */
let ownHold: (projectId: string) => number = () => 0
export const setOwnHold = (f: (projectId: string) => number): void => { ownHold = f }

/** What stands between the study and forwarding to the grants manager (3.4.22) · empty = can forward */
export const forwardBlockers = (id: string): string[] => {
  const p = row(id)
  const f = flowOf(id)
  const out: string[] = []
  if (!p) return ['المشروع غير موجود']
  if (p.stage === 'استكمال بيانات المشروع') out.push('المشروع بانتظار استكمال الجهة · لا تُستأنف الدراسة قبل إعادة إرساله')
  if (!f.study) out.push('لم تُسجَّل الدراسة بعد')
  else {
    const unscored = CRITERIA.list.filter((c) => !f.study!.scores[c.key])
    if (unscored.length) out.push(`${unscored.length} من معايير التقييم بلا درجة`)
    if (!f.study.recommendation) out.push('لم تُحدَّد التوصية')
    if (!f.study.justification.trim()) out.push('مبررات التوصية فارغة')
    /* v3 · 3.2.19 · 3.4.25 */
    if (f.study.recommendation === 'reject' && !f.study.rejectReason) out.push('اختر سبب التوصية بالرفض من القائمة أو «أخرى»')
    if (f.study.recommendation === 'reject' && f.study.rejectReason === OTHER && !f.study.rejectOther?.trim()) out.push('اكتب سبب التوصية بالرفض')
    /* Client 21 Oct (#20) · a project an exclusion criterion applies to isn't recommended for approval */
    const ex = excludedBy(f.study.exclusions)
    if (f.study.recommendation === 'approve' && ex.length) out.push(`معيار استبعاد منطبق: ${ex[0].label} · لا توصية بالموافقة`)
  }
  const docs = missingDocs(id)
  if (docs.length) out.push(`مرفقات إلزامية ناقصة: ${docs.join('، ')}`)
  /* v3 · 3.2.21 · 3.2.22 · a recommendation to approve needs the balance in the request's line · the
     goal's line under the domain, else the domain's · the project's own hold on it counts back */
  if (f.study?.recommendation === 'approve') {
    const asked = f.study.amount || p.amountRequested
    const b = domainBudget(p)
    const line = b?.goal ?? (b ? { label: b.label, money: b.money } : undefined)
    if (!line) out.push(`لا بند لمجال «${p.field}» في الميزانية المعتمدة · لا توصية بالموافقة بلا رصيد`)
    else if (asked > line.money.available + ownHold(p.id)) out.push(`الرصيد المتاح في بند «${line.label}» (${Math.max(0, line.money.available).toLocaleString('en-US')}) لا يكفي المبلغ ${asked.toLocaleString('en-US')} · لا توصية بالموافقة`)
  }
  if (CONSULTANTS.waitForOpinion && f.referral && !f.referral.opinion && f.referral.expiresAt >= liveDay()) {
    out.push('بانتظار رأي المستشار · الإعداد يشترط وصوله قبل الإحالة')
  }
  return out
}

/* ── Apply ── */

const nextId = () => String(21_900 + projectRows.filter((p) => Number(p.id) >= 21_900).length + 1)

const trackOf = (field: string) => Object.entries(FIELDS_BY_TRACK).find(([, fs]) => fs.includes(field))?.[0] ?? ''

function apply(o: Op) { OP_AT = o.at; try { asOf(o.at, () => applyOp(o)) } finally { OP_AT = undefined } }
function applyOp(o: Op) {
  if (o.op === 'rederive') { applyRederive(o.ids, o.reason, o.by); return }
  const p = o.op === 'submit' ? undefined : row(o.id)
  if (o.op !== 'submit' && !p) return

  switch (o.op) {
    case 'submit': {
      const v = o.values
      const e = entityById(v.entityId)
      /* Client sheet 24 Oct (#93) · a supervisor filing the request inside the system owns it · the
         domain's rule (#89) assigns the rest */
      const owner = !o.asEntity && v.filedBySupervisor ? v.filedBySupervisor : pickSupervisor(v.field, v.goal)
      const amount = Number(v.amountRequested) || 0
      /* Client 21 Oct (#28) · the entity gives the start and the end · the duration is the calendar days
         between them · a request saved before carried a duration in working days and keeps its end */
      const byDates = Boolean(v.startAt && v.endAt)
      const days = byDates ? calendarDaysBetween(v.startAt, v.endAt) : Number(v.workDays) || 0
      projectRows.unshift({
        id: o.id, name: v.name, entityId: v.entityId, entityName: e?.name ?? v.externalName ?? '',
        track: v.track, field: v.field, goal: v.goal, region: v.region, city: v.city,
        stage: 'دراسة المشروع', statusGroup: 'قيد الدراسة', stageLimit: stageMeta('دراسة المشروع')?.limit ?? 900,
        hoursInStage: 0, amountRequested: amount, amountGranted: 0, amountSpent: 0, weight: 50, score: 0,
        owner, year: '2026-f', funding: 'foundation', tags: [], grantMethod: 'بحث واستجابة', shared: false,
        impact: false, supportStatus: null, submittedAt: opDay(), durationDays: days,
        beneficiaries: Number(v.reach) || 0, hasInterimReport: false, hasFinalReport: false,
        hasKnowledgeProduct: false, fieldVisit: false, type: 'مشروع عادي', holder: 'supervisor',
        source: o.asEntity ? 'portal' : 'staff',
        createdAt: `${opDay()}T${NOW_TIME()}`, startAt: v.startAt, execDays: workDaysOf(v.execDays), endAt: byDates ? v.endAt : v.startAt && days ? addWorkingDays(v.startAt, days, workDaysOf(v.execDays)) : v.endAt,
      })
      liveClock(projectRows[0], 'hoursInStage', true)
      /* v3 · 11.2.2 · 11.2.3 · created by the authority through the simplified form · supported through the
         external party, classified as such from its creation · no portal, no plan */
      if (v.external) Object.assign(projectRows[0]!, { platform: v.externalName ?? 'جهة خارجية', externalId: v.external, partnerType: 'مستقل', source: 'staff', type: 'مشروع خارجي' })
      /* v3 · the status reads from the record (data/status.ts) */
      installStatus(projectRows[0]!)
      /* v3 · 2.4.10 · a move to another entity recorded on this project waits for it */
      replayLateRelinks(o.id)
      const f = flowOf(o.id)
      /* Re-audit 7 Oct · a request saved as a draft first keeps the draft's date as its creation */
      f.sentAt = `${opDay()} ${NOW_TIME()}`
      f.createdAt = v.draftAt ? `${v.draftAt.slice(0, 10)} ${v.draftAt.slice(11, 16)}` : f.sentAt
      f.objectives = (v.objectives ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
      f.entityOutputs = parseOutputs(v.outputs)
      f.original = { track: v.track, field: v.field, goal: v.goal }
      f.docs = o.docs.map((k) => ({ kind: k, name: `${REQUEST_DOCS.find((d) => d.key === k)?.label ?? k}.pdf`, by: o.asEntity ? e?.name ?? o.by : o.by, at: opDay() }))
      /* Re-audit 7 Oct · the version keeps the request's full content, not only its figures */
      f.versions = [{ no: 1, at: opDay(), by: o.by, say: o.asEntity ? 'أرسلته الجهة من البوابة' : 'أدخله مشرف المنح نيابةً عن الجهة', snap: snapOf(projectRows[0], f), values: { ...v }, docs: f.docs.map((d) => d.name) }]
      event(o.id, {
        action: 'تقديم طلب المشروع', by: o.asEntity ? e?.name ?? o.by : o.by, actor: o.asEntity ? 'entity' : 'staff', dept: 'تقديم الطلب',
        fields: [
          { k: 'المبلغ المطلوب', v: amount.toLocaleString('en-US') },
          { k: 'المجال', v: v.field },
          { k: 'الإسناد', v: owner ? `${owner} · ${!o.asEntity && v.filedBySupervisor ? 'سجّله مشرف المنح فهو مالكه' : CYCLE.domains[v.field]?.distribution === 'fixed' ? 'المشرف المحدّد للمجال' : CYCLE.domains[v.field]?.distribution === 'manual' ? 'المشرف الوحيد للمجال' : 'تلقائي حسب قاعدة المجال'}` : 'بانتظار إسناد مدير المنح', strong: true },
          ...(stagesOf(v.stages).length ? [{ k: 'مراحل التنفيذ', v: `${stagesOf(v.stages).length}` }] : []),
        ],
      })
      if (owner && owner !== o.by) note(o.id, owner, `طلب جديد · ${v.name}`, `أُسند إليك تلقائيًا في مجال ${v.field}`)
      else note(o.id, 'مدير المنح', `طلب بلا مشرف · ${v.name}`, `مجال ${v.field} توزيعه يدوي · يحتاج إسنادًا`)
      break
    }
    case 'reschedule': {
      if (!o.startAt || isEnded(p!.statusGroup)) break
      /* Client 21 Oct (#26 · #28) · the actual start is its own record · the expected start the entity gave
         stays · the project keeps its length in calendar days, so the end moves with the start · an op saved
         before carried a duration in working days, the calendar length of its dates is what it lasts */
      const from0 = p!.actualStartAt ?? p!.startAt
      const days = from0 && p!.endAt ? calendarDaysBetween(from0, p!.endAt) || (p!.durationDays ?? 0) : (p!.durationDays ?? 0)
      if (!days) break
      const was = { start: from0, end: p!.endAt }
      p!.actualStartAt = o.startAt
      p!.durationDays = days
      p!.endAt = endAfterDays(o.startAt, days)
      const why = o.source === 'agreement' ? 'توقيع الاتفاقية' : o.source === 'approval' ? 'اكتمال الاعتماد · مشروع خارجي بلا اتفاقية' : ''
      event(o.id, { action: why ? `بداية التنفيذ الفعلي مع ${why}` : 'تعديل بداية التنفيذ الفعلي · أُعيدت النهاية', by: o.by, tone: why ? 'ok' : 'warn', fields: [
        { k: 'بداية التنفيذ الفعلي', v: `${was.start ?? '—'} ← ${o.startAt}`, strong: true },
        { k: 'البداية المتوقعة في الطلب', v: p!.startAt ?? '—' },
        { k: 'نهاية التنفيذ', v: `${was.end ?? '—'} ← ${p!.endAt}` },
        { k: 'المدة', v: `${days} يومًا من البداية إلى النهاية` },
        { k: why ? 'المصدر' : 'السبب', v: why || o.reason },
      ] })
      note(o.id, p!.entityName, `تغيّرت مدة تنفيذ مشروعك · ${p!.name}`, `يبدأ ${o.startAt} وينتهي ${p!.endAt}`)
      break
    }
    case 'assign': {
      p!.owner = o.owner
      /* Client 24 Oct (#90) · a project that already had a supervisor is a change, logged before → after
         with its reason · a first assignment stays a plain assignment */
      if (o.from && o.from !== o.owner) event(o.id, { action: 'تعديل مشرف المنح', by: o.by, fields: [{ k: 'المشرف', v: `${o.from} ← ${o.owner}`, strong: true }, ...(o.reason ? [{ k: 'السبب', v: o.reason }] : [])] })
      else event(o.id, { action: 'إسناد المشروع لمشرف', by: o.by, fields: [{ k: 'المشرف', v: o.owner, strong: true }] })
      note(o.id, o.owner, `أُسند إليك · ${p!.name}`, `من ${o.by}`)
      break
    }
    case 'docMore': {
      const f = flowOf(o.id)
      const list = (f.extras ??= [])
      const at = opDay()
      o.files.forEach((x, i) => list.push({ id: `x-${o.id}-${o.seq ?? at}-${list.length}-${i}`, name: x.name, size: x.size, by: o.by, at, internal: o.internal }))
      event(o.id, { action: 'رفع مرفقات أخرى', by: o.by, actor: o.by === p!.entityName ? 'entity' : 'staff', fields: [{ k: 'العدد', v: String(o.files.length) }, { k: 'الاطلاع', v: o.internal ? 'داخلي · لا تراه الجهة' : 'الجهة والفريق' }], files: o.files.map((x) => x.name) })
      break
    }
    case 'docDrop': {
      const f = flowOf(o.id)
      const was = (f.extras ?? []).find((x) => x.id === o.doc)
      if (!was || was.by !== o.by) break
      f.extras = (f.extras ?? []).filter((x) => x.id !== o.doc)
      event(o.id, { action: 'حذف مرفق', by: o.by, actor: o.by === p!.entityName ? 'entity' : 'staff', fields: [{ k: 'المرفق', v: was.name }] })
      break
    }
    case 'docSwap': {
      const f = flowOf(o.id)
      const was = (f.extras ?? []).find((x) => x.id === o.doc)
      if (!was) break
      const old = was.name
      was.name = o.name; was.size = o.size; was.at = opDay(); was.by = o.by
      event(o.id, { action: 'استبدال مرفق', by: o.by, actor: o.by === p!.entityName ? 'entity' : 'staff', fields: [{ k: 'الملف السابق', v: old }, { k: 'الملف الجديد', v: o.name }], files: [o.name] })
      break
    }
    case 'doc': {
      const f = flowOf(o.id)
      /* Batch 8 · 3.4.37 · a replacement reads as one, with the file it replaced */
      const was = f.docs.find((d) => d.kind === o.kind)
      f.docs = f.docs.filter((d) => d.kind !== o.kind)
      f.docs.push({ kind: o.kind, name: o.name, by: o.by, at: opDay() })
      const k = REQUEST_DOCS.find((d) => d.key === o.kind)
      event(o.id, { action: was ? 'استبدال مرفق' : 'رفع مرفق', by: o.by, actor: k?.audience === 'entity' && o.by === p!.entityName ? 'entity' : 'staff', fields: [{ k: 'المرفق', v: k?.label ?? o.kind }, ...(was ? [{ k: 'الملف السابق', v: was.name }, { k: 'الملف الجديد', v: o.name }] : []), { k: 'الاطلاع', v: k?.audience === 'internal' ? 'داخلي · لا تراه الجهة' : 'الجهة والفريق' }], files: [o.name] })
      break
    }
    case 'study': {
      const f = flowOf(o.id)
      const prev = f.study
      /* Re-audit 7 Oct · the return note stays until the supervisor sends the project back, so the
         «أعد الإرسال لمدير المنح» action survives saving the updated study */
      f.study = { ...o.study, at: opDay(), version: prev ? prev.version + (f.returnNote && !f.returnStudied ? 1 : 0) : 1, field: p!.field }
      /* v3 · 3.2.13 · the study starts · the foundation's outputs begin as a copy of the entity's */
      if (!f.orgOutputs) f.orgOutputs = structuredClone(f.entityOutputs ?? [])
      if (f.returnNote) f.returnStudied = true
      event(o.id, {
        action: prev ? 'تحديث دراسة المشروع' : 'تسجيل دراسة المشروع', by: o.study.by,
        fields: [
          { k: 'الدرجة', v: `${studyScore(o.study.scores)} من 100` },
          { k: 'التوصية', v: o.study.recommendation === 'approve' ? 'الموافقة' : o.study.recommendation === 'reject' ? 'الرفض' : 'لم تُحدَّد', strong: true },
          ...(o.study.recommendation === 'reject' && o.study.rejectReason ? [{ k: 'سبب التوصية بالرفض', v: reasonSay(o.study.rejectReason, o.study.rejectOther) }] : []),
          ...(excludedBy(o.study.exclusions).length ? [{ k: 'معايير الاستبعاد المنطبقة', v: excludedBy(o.study.exclusions).map((x) => x.label).join('، ') }] : []),
          ...(o.study.classification ? [{ k: 'تصنيف المشروع', v: o.study.classification }] : []),
          ...(o.study.recommendation === 'approve' ? [{ k: 'المبلغ الموصى به', v: o.study.amount.toLocaleString('en-US') }] : []),
        ],
      })
      break
    }
    case 'recommend': {
      const f = flowOf(o.id)
      const s = f.study
      f.returnNote = undefined
      f.returnStudied = undefined
      p!.holder = 'manager'
      p!.hoursInStage = 0
      /* v3 · 4.2.5 · the supervisor's recommended amount is where the approval path starts · on a re-send
         it moves the path's amount only when the supervisor changed it in the study (6.4.12) */
      if (s?.recommendation === 'approve' && s.amount > 0 && (p!.amountSupport === undefined || s.amount !== f.appliedAmount)) {
        const from = p!.amountSupport
        p!.amountSupport = s.amount
        if (from !== undefined && from !== s.amount) amountHook(o.id, from, s.amount, o.by, opDay())
      }
      if (s?.recommendation === 'approve' && s.amount > 0) f.appliedAmount = s.amount
      event(o.id, {
        action: s?.recommendation === 'reject' ? 'توصية بالرفض وإحالة لمدير المنح' : 'توصية بالموافقة وإحالة لمدير المنح',
        by: o.by, tone: 'ok',
        fields: [
          { k: 'التوصية', v: s?.recommendation === 'reject' ? 'الرفض' : 'الموافقة', strong: true },
          ...(s?.recommendation === 'reject' && s.rejectReason ? [{ k: 'سبب التوصية بالرفض', v: reasonSay(s.rejectReason, s.rejectOther), strong: true }] : []),
          { k: 'المبررات', v: s?.justification ?? '' },
          { k: 'أثرها', v: 'توصية استشارية · لا اعتماد ولا صرف' },
        ],
      })
      note(o.id, 'مدير المنح', `توصية بانتظار قرارك · ${p!.name}`, `${o.by} · ${s?.recommendation === 'reject' ? 'اعتذار' : 'موافقة'}`)
      break
    }
    case 'complete': {
      const f = flowOf(o.id)
      f.completionNote = o.note
      moveTo(p!, 'استكمال بيانات المشروع')
      p!.holder = undefined
      event(o.id, { action: 'طلب استكمال من الجهة', by: o.by, tone: 'warn', dept: 'دراسة المشروع', fields: [{ k: 'المطلوب', v: o.note, strong: true }] })
      note(o.id, p!.entityName, `طلب استكمال · ${p!.name}`, o.note)
      break
    }
    case 'resubmit': {
      const f = flowOf(o.id)
      moveTo(p!, 'دراسة المشروع')
      p!.holder = 'supervisor'
      /* Batch 7 · intake#14 · a resubmission keeps the request as it stands and its attachments, like V1,
         so a version can be read whole and against the one before it */
      const prevValues = [...f.versions].reverse().find((v) => v.values)?.values
      f.versions.push({ no: f.versions.length + 1, at: opDay(), by: o.by, say: `أعادت الجهة الإرسال بعد الاستكمال${f.completionNote ? ` · ${f.completionNote}` : ''}`, snap: snapOf(p!, f),
        values: { ...(prevValues ?? {}), ...(f.amended ?? {}), amount: String(p!.amountRequested), days: String(p!.durationDays ?? ''), beneficiaries: String(p!.beneficiaries ?? ''), ...(p!.startAt ? { startAt: p!.startAt } : {}) },
        docs: f.docs.map((d) => d.name) })
      f.completionNote = undefined
      f.amended = undefined
      event(o.id, { action: 'إعادة إرسال الطلب بعد الاستكمال', by: o.by, actor: 'entity', dept: 'استكمال بيانات المشروع' })
      if (p!.owner) note(o.id, p!.owner, `أعادت الجهة الإرسال · ${p!.name}`, 'استؤنفت الدراسة')
      break
    }
    case 'transfer': {
      const f = flowOf(o.id)
      const from = { field: p!.field, owner: p!.owner, track: p!.track, goal: p!.goal }
      f.original ??= { track: p!.track, field: p!.field, goal: p!.goal }
      if (f.study) { f.pastStudies.unshift(f.study); f.study = undefined }
      p!.field = o.field
      /* v3 · 3.4.23 · the track and the goal move with the domain · picked, not left behind */
      const t = o.track ?? trackOf(o.field)
      if (t) p!.track = t
      if (o.goal) p!.goal = o.goal
      p!.owner = o.owner
      p!.holder = 'supervisor'
      p!.hoursInStage = 0
      event(o.id, {
        action: 'تحويل المشروع إلى مجال آخر', by: o.by, tone: 'warn',
        fields: [
          { k: 'من', v: `${from.track} · ${from.field} · ${from.goal} · ${from.owner ?? 'بلا مشرف'}` },
          { k: 'إلى', v: `${p!.track} · ${o.field} · ${p!.goal} · ${o.owner}`, strong: true },
          { k: 'السبب', v: o.reason },
          { k: 'الدراسة السابقة', v: 'محفوظة في السجل' },
        ],
      })
      note(o.id, o.owner, `حُوّل إليك · ${p!.name}`, `من مجال ${from.field} · ${o.reason}`)
      break
    }
    case 'outputs': {
      /* v3 · 3.4.44 · every change to the foundation's outputs is logged · the entity's stay as sent */
      const f = flowOf(o.id)
      const before = f.orgOutputs ?? f.entityOutputs ?? []
      const key = (x: Output) => outputLine(x)
      const added = o.list.filter((x) => !before.some((y) => key(y) === key(x)))
      const removed = before.filter((x) => !o.list.some((y) => key(y) === key(x)))
      f.orgOutputs = structuredClone(o.list)
      event(o.id, {
        action: 'تعديل مخرجات المؤسسة', by: o.by, dept: p!.holder === 'manager' ? 'مدير المنح' : 'دراسة المشروع',
        fields: [
          ...added.map((x) => ({ k: 'أُضيف', v: outputLine(x) })),
          ...removed.map((x) => ({ k: 'حُذف أو عُدِّل', v: outputLine(x) })),
          { k: 'عدد المخرجات', v: String(o.list.length) },
        ],
      })
      break
    }
    case 'amend': {
      /* v3 · 3.2.10 · the entity edits its returned request · the figures and the text it sent */
      if (p!.stage !== 'استكمال بيانات المشروع') break
      const f = flowOf(o.id)
      const v = o.values
      const changed: LogField[] = []
      const set = <K extends keyof ProjectRow>(k: K, val: ProjectRow[K], label: string) => {
        if (p![k] !== val) { changed.push({ k: label, v: `${String(p![k] ?? '—')} ← ${String(val ?? '—')}` }); p![k] = val }
      }
      if (v.name?.trim()) set('name', v.name.trim(), 'اسم المشروع')
      if (v.amountRequested) set('amountRequested', Number(v.amountRequested) || p!.amountRequested, 'المبلغ المطلوب')
      if (v.reach) set('beneficiaries', Number(v.reach) || p!.beneficiaries, 'عدد المستفيدين')
      if (v.startAt) set('startAt', v.startAt, 'تاريخ بدء التنفيذ المتوقع')
      if (v.execDays !== undefined) p!.execDays = workDaysOf(v.execDays)
      if (v.endAt) {
        /* Client 21 Oct (#28) · the end is typed · the duration follows the two dates */
        set('endAt', v.endAt, 'تاريخ انتهاء التنفيذ المتوقع')
        if (p!.startAt) set('durationDays', calendarDaysBetween(p!.actualStartAt ?? p!.startAt, v.endAt), 'المدة بالأيام')
      } else {
        /* an amendment saved before carried the duration in working days */
        if (v.workDays) set('durationDays', Number(v.workDays) || p!.durationDays, 'مدة التنفيذ')
        if (p!.startAt && p!.durationDays) p!.endAt = addWorkingDays(p!.actualStartAt ?? p!.startAt, p!.durationDays, p!.execDays)
      }
      if (v.objectives !== undefined) {
        const list = v.objectives.split('\n').map((x) => x.trim()).filter(Boolean)
        if (list.join('|') !== f.objectives.join('|')) { changed.push({ k: 'الأهداف التفصيلية', v: `${list.length} هدف` }); f.objectives = list }
      }
      if (v.outputs !== undefined) {
        const list = parseOutputs(v.outputs)
        if (JSON.stringify(list) !== JSON.stringify(f.entityOutputs ?? [])) { changed.push({ k: 'مخرجات الجهة', v: `${list.length} مخرج` }); f.entityOutputs = list }
      }
      const last = [...f.versions].reverse().find((x) => x.values)?.values ?? {}
      f.amended = { ...last, ...v }
      event(o.id, { action: 'تعديل الجهة بيانات الطلب المُعاد', by: o.by, actor: 'entity', dept: 'استكمال بيانات المشروع', fields: changed.length ? changed : [{ k: 'التغيير', v: 'بلا تغيير في البيانات' }] })
      break
    }
    case 'return': {
      const f = flowOf(o.id)
      f.returnNote = o.note
      f.returnStudied = undefined
      p!.holder = 'supervisor'
      p!.hoursInStage = 0
      event(o.id, { action: 'إعادة المشروع لمشرف المنح', by: o.by, tone: 'warn', fields: [{ k: 'الملاحظات', v: o.note, strong: true }] })
      if (p!.owner) note(o.id, p!.owner, `أعاده مدير المنح · ${p!.name}`, o.note)
      break
    }
    case 'refer': {
      const c = consultantByKey(o.consultant)
      const f = flowOf(o.id)
      const exp = new Date(`${opDay()}T00:00:00Z`)
      exp.setUTCDate(exp.getUTCDate() + (c?.accessDays ?? 7))
      f.referral = { consultant: o.consultant, by: o.by, at: opDay(), expiresAt: exp.toISOString().slice(0, 10), code: o.code }
      event(o.id, { action: 'إحالة إلى مستشار', by: o.by, fields: [{ k: 'المستشار', v: c?.name ?? o.consultant, strong: true }, { k: 'وصول حتى', v: f.referral.expiresAt }, { k: 'الرأي', v: 'استشاري غير ملزم' }] })
      if (c) note(o.id, c.name, `طلب رأي · ${p!.name}`, `من ${o.by} · حتى ${f.referral.expiresAt}`)
      break
    }
    case 'opinion': {
      const f = flowOf(o.id)
      if (!f.referral) return
      f.referral.opinion = o.opinion
      f.referral.verdict = o.verdict
      f.referral.opinionAt = opDay()
      event(o.id, { action: 'رأي المستشار', by: o.by, fields: [{ k: 'الرأي', v: o.verdict, strong: true }, { k: 'الملاحظات', v: o.opinion }, { k: 'الإلزام', v: 'غير ملزم' }] })
      if (p!.owner) note(o.id, p!.owner, `وصل رأي المستشار · ${p!.name}`, o.verdict)
      break
    }
    case 'close': {
      const f = flowOf(o.id)
      f.closed = { kind: o.kind, reason: o.reason, by: o.by, at: opDay() }
      if (o.kind === 'cancel') moveTo(p!, 'مشروع ملغي')
      else p!.archived = true
      p!.holder = undefined
      event(o.id, { action: o.kind === 'cancel' ? 'إلغاء الطلب' : 'أرشفة الطلب', by: o.by, tone: 'no', fields: [{ k: 'السبب', v: o.reason, strong: true }, { k: 'الحذف', v: 'لا يُحذف · يبقى في السجل' }] })
      break
    }
  }
}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ }
}

/** Run one operation · recorded, applied, broadcast */
const run = (o: Op) => {
  o.seq = nextSeq()
  o.at ??= stampNow()
  ops.push(o)
  apply(o)
  save()
  emit()
  done(o.op, 'المشاريع')
}

/* Replay at load · together with the approval path's log, in clock order (see opclock.ts). The
   approvals store replays both when it loads; if it never loads, this log replays on its own. */
try {
  const raw = localStorage.getItem(KEY)
  ops = raw ? (JSON.parse(raw) as Op[]) : []
} catch {
  ops = []
}
let replayed = false
/** The intake log for a joint replay · hands it over once */
export function intakeLog(): { ops: Op[]; apply: (o: Op) => void } | null {
  if (replayed) return null
  replayed = true
  return { ops, apply }
}
queueMicrotask(() => {
  const l = intakeLog()
  if (l) { for (const o of l.ops) apply(o); emit() }
})

/* ── Public actions ── */

export const submitRequest = (values: Record<string, string>, docs: string[], by: string, asEntity: boolean): string => {
  const id = nextId()
  run({ op: 'submit', id, values, by, asEntity, docs })
  return id
}
export const assignSupervisor = (id: string, owner: string, by: string, from?: string, reason?: string) => run({ op: 'assign', id, owner, by, from, reason })
/** Batch 6 · move the execution's start · the calculated end follows from the duration in working days */
export const rescheduleStart = (id: string, startAt: string, reason: string, by: string): string[] => {
  const p = projectRows.find((x) => x.id === id)
  if (!p) return ['المشروع غير موجود']
  if (!p.durationDays && !(p.startAt && p.endAt)) return ['لا مدة تنفيذ للمشروع · تُحسب النهاية من المدة']
  if (isEnded(p.statusGroup)) return ['المشروع مغلق']
  if (!reason.trim()) return ['اكتب سبب التعديل']
  if (!startAt) return ['حدّد تاريخ البداية']
  run({ op: 'reschedule', id, startAt, reason: reason.trim(), by, source: 'manual' })
  return []
}
/** Where an actual start came from · the agreement's signature, the approval of an external project
    (it has no agreement), or a documented edit by the supervisor or the grants manager */
export type StartSource = 'agreement' | 'approval' | 'manual'
/** Client 21 Oct (#26) · the actual start is set by the event that starts the work · the agreement's
    signature, or the approval of an external project that has none · it follows that event's own record
    (replayed with it, never saved twice) · the expected start the entity gave is never overwritten, and a
    start already recorded (a documented edit) is left alone */
export const startFromEvent = (id: string, startAt: string, source: Exclude<StartSource, 'manual'>, by: string): void => {
  const p = projectRows.find((x) => x.id === id)
  if (!p || !startAt || p.actualStartAt || isEnded(p.statusGroup)) return
  const from0 = p.startAt
  const days = from0 && p.endAt ? calendarDaysBetween(from0, p.endAt) || (p.durationDays ?? 0) : (p.durationDays ?? 0)
  p.actualStartAt = startAt
  if (days) { p.durationDays = days; p.endAt = endAfterDays(startAt, days) }
  event(id, { action: `بداية التنفيذ الفعلي مع ${source === 'agreement' ? 'توقيع الاتفاقية' : 'اكتمال الاعتماد · مشروع خارجي بلا اتفاقية'}`, by, tone: 'ok', fields: [
    { k: 'بداية التنفيذ الفعلي', v: startAt, strong: true },
    { k: 'البداية المتوقعة في الطلب', v: from0 ?? '—' },
    ...(days ? [{ k: 'نهاية التنفيذ', v: p.endAt ?? '—' }, { k: 'المدة', v: `${days} يومًا من البداية إلى النهاية` }] : []),
  ] })
}

/** Client 21 Oct (#28) · durations are calendar days · the working-days rule below is kept for records written before */
const CALENDAR_DURATION = true
/** v3 · 3.4.34 · the calendar a duration was computed with · the week, the holidays and the policy */
export type CalendarSnap = Pick<typeof CYCLE, 'weekend' | 'holidays' | 'countWeekend' | 'countHolidays'>
export const calendarSnap = (): CalendarSnap => structuredClone({ weekend: CYCLE.weekend, holidays: CYCLE.holidays, countWeekend: CYCLE.countWeekend, countHolidays: CYCLE.countHolidays })
/** Batch 8 · intake#15 · v3 · 3.4.34 · open projects whose end was computed from the calendar before
    the change (`before`) and no longer matches it · a seeded end typed by hand is left alone */
export function endsToRederive(before: CalendarSnap): string[] {
  /* Client 21 Oct (#28) · a project's start and end are dates the entity gives, its duration the calendar
     days between them · a change to the week or the holidays no longer moves any end · the operation
     stays so a change recorded before still replays */
  if (CALENDAR_DURATION) return []
  const now = calendarSnap()
  const open = projectRows.filter((p) => (p.actualStartAt ?? p.startAt) && p.durationDays && !isEnded(p.statusGroup))
  Object.assign(CYCLE, structuredClone(before))
  const derived = open.filter((p) => p.endAt === addWorkingDays((p.actualStartAt ?? p.startAt)!, p.durationDays!, p.execDays))
  Object.assign(CYCLE, now)
  return derived.filter((p) => p.endAt !== addWorkingDays((p.actualStartAt ?? p.startAt)!, p.durationDays!, p.execDays)).map((p) => p.id)
}
function applyRederive(ids: string[], reason: string, by: string) {
  for (const id of ids) {
    const p = row(id)
    const from = p?.actualStartAt ?? p?.startAt
    if (!p || !from || !p.durationDays) continue
    const was = p.endAt
    p.endAt = addWorkingDays(from, p.durationDays, p.execDays)
    if (was === p.endAt) continue
    event(p.id, { action: 'أُعيد حساب نهاية التنفيذ · تغيّر تقويم المدد', by, tone: 'warn', fields: [
      { k: 'النهاية المحسوبة', v: `${was ?? '—'} ← ${p.endAt}`, strong: true }, { k: 'السبب', v: reason },
    ] })
    note(p.id, p.entityName, `تغيّر تاريخ نهاية مشروعك · ${p.name}`, `ينتهي ${p.endAt} بعد تحديث تقويم المدد`)
  }
}
/** Called after the holidays are saved · records one operation listing the projects it moved */
export const rederiveEnds = (before: CalendarSnap, reason: string, by: string): number => {
  const ids = endsToRederive(before)
  if (ids.length) run({ op: 'rederive', id: '', ids, reason, by })
  return ids.length
}
export const uploadDoc = (id: string, kind: string, name: string, by: string) => run({ op: 'doc', id, kind, name, by })
/** #32 · the project's «other» attachments · the seeded or uploaded files, oldest first */
export const extrasOf = (id: string): ExtraDoc[] => flowOf(id).extras ?? []
export const uploadMore = (id: string, files: { name: string; size: number }[], by: string, internal = false) => {
  if (files.length) run({ op: 'docMore', id, files, by, internal })
}
/** Only the person who added a file removes it · refused (returns why) otherwise */
export const replaceMore = (id: string, doc: string, file: { name: string; size: number }, by: string) => run({ op: 'docSwap', id, doc, name: file.name, size: file.size, by })
export const dropMore = (id: string, doc: string, by: string): string[] => {
  const x = extrasOf(id).find((d) => d.id === doc)
  if (!x) return ['المرفق غير موجود']
  if (x.by !== by) return ['يحذف المرفق من رفعه فقط']
  run({ op: 'docDrop', id, doc, by })
  return []
}
export const saveStudy = (id: string, study: Omit<Study, 'at' | 'version' | 'field'>) => run({ op: 'study', id, study })

/** Forward with the recorded recommendation · refused (returns the reasons) when a guard fails */
/** Client 21 Oct (#24) · what the budget does when the supervisor forwards · a recommendation to
    refuse holds nothing · set by the approvals store (no import cycle) */
let recommendHook: (id: string, rec: Study['recommendation'] | undefined, by: string) => void = () => {}
export const setRecommendHook = (f: typeof recommendHook): void => { recommendHook = f }
export const recommend = (id: string, by: string): string[] => {
  const b = forwardBlockers(id)
  if (b.length) return b
  run({ op: 'recommend', id, by })
  recommendHook(id, flowOf(id).study?.recommendation, by)
  return []
}
export const requestCompletion = (id: string, note: string, by: string) => run({ op: 'complete', id, note, by })
export const resubmit = (id: string, by: string) => run({ op: 'resubmit', id, by })
export const transferProject = (id: string, field: string, owner: string, reason: string, by: string, track?: string, goal?: string) =>
  run({ op: 'transfer', id, field, owner, reason, by, track, goal })

/** v3 · 3.4.44 · the supervisor or the grants manager edits the foundation's outputs */
export function saveOrgOutputs(id: string, list: Output[], by: string, role: string): string[] {
  if (role !== 'supervisor' && role !== 'grants-manager') return ['يعدّل مخرجات المؤسسة مشرف المنح أو مدير المنح']
  /* Re-audit 17 Oct · the station too, not the role alone · the supervisor at his seat, the grants
     manager while the project is with him */
  const p = row(id)
  const at = p && p.stage === 'دراسة المشروع' ? p.holder ?? 'supervisor' : ''
  if (role === 'supervisor' && at !== 'supervisor') return ['المشروع ليس عند مشرف المنح']
  if (role === 'grants-manager' && at !== 'manager') return ['المشروع ليس عند مدير المنح']
  const clean = list.map((o) => ({ text: o.text.trim(), indicator: o.indicator.trim(), target: o.target.trim() })).filter((o) => o.text)
  if (!clean.length) return ['مخرج واحد على الأقل']
  run({ op: 'outputs', id, list: clean, by })
  return []
}
/** The foundation's outputs · its copy once the study started, the entity's before · re-audit 17 Oct ·
    callers that title them «مخرجات المؤسسة» should tell which (`orgOutputsAreEntity`) */
export const orgOutputsOf = (id: string): Output[] => flowOf(id).orgOutputs ?? flowOf(id).entityOutputs ?? []
/** No foundation copy yet · the list `orgOutputsOf` gives is the entity's own */
export const orgOutputsAreEntity = (id: string): boolean => !flowOf(id).orgOutputs

/** v3 · 3.2.10 · the entity corrects its returned request before sending it again */
export function amendRequest(id: string, values: Record<string, string>, by: string): string[] {
  const p = row(id)
  if (!p || p.stage !== 'استكمال بيانات المشروع') return ['الطلب ليس مُعادًا للاستكمال']
  if (values.name !== undefined && !values.name.trim()) return ['اسم المشروع']
  if (values.amountRequested !== undefined && !(Number(values.amountRequested) > 0)) return ['المبلغ المطلوب']
  const start = values.startAt || p.startAt
  if (values.endAt && start && values.endAt < start) return ['تاريخ الانتهاء قبل تاريخ البدء']
  /* a request filed before the outputs field carries none · an empty list stays allowed for it */
  const had = (flowOf(id).entityOutputs ?? []).length > 0
  if (values.outputs !== undefined && had && !parseOutputs(values.outputs).some((o) => o.text.trim())) return ['مخرج واحد على الأقل']
  run({ op: 'amend', id, values, by })
  return []
}
export const returnToSupervisor = (id: string, note: string, by: string) => run({ op: 'return', id, note, by })
/** Six random digits · the code isn't derived from anything on the page */
const drawCode = (): string => {
  const a = new Uint32Array(1)
  try { crypto.getRandomValues(a) } catch { a[0] = Math.floor(Math.random() * 2 ** 32) }
  return String(100000 + (a[0]! % 900000))
}
export const referConsultant = (id: string, consultant: string, by: string) => run({ op: 'refer', id, consultant, by, code: drawCode() })
export const giveOpinion = (id: string, opinion: string, verdict: NonNullable<Referral['verdict']>, by: string) =>
  run({ op: 'opinion', id, opinion, verdict, by })
export const closeRequest = (id: string, kind: 'cancel' | 'archive', reason: string, by: string) =>
  run({ op: 'close', id, kind, reason, by })

/** Is this project at the supervisor's own seat · the reason when not */
function atSupervisorSeat(id: string, by: string): string {
  const p = row(id)
  if (!p || p.stage !== 'دراسة المشروع' || (p.holder && p.holder !== 'supervisor')) return 'ليس عند مشرف المنح'
  if (p.owner !== by && !actsAs(by, 'supervisor')) return 'مسند لمشرف آخر'
  return ''
}

/** Bulk «طلب استكمال» · each project at the supervisor's own seat goes back to its entity with the
    note, a recorded event and a notice · it used to move the stage only, with no record (3.4.15) */
export const completeMany = (ids: readonly string[], note: string, by: string): { done: string[]; held: { id: string; why: string }[] } => {
  const done: string[] = []
  const held: { id: string; why: string }[] = []
  for (const id of ids) {
    const why = !note.trim() ? 'المطلوب من الجهة إلزامي' : atSupervisorSeat(id, by)
    if (why) { held.push({ id, why }); continue }
    const o: Op = { op: 'complete', id, note: note.trim(), by, seq: nextSeq(), at: stampNow() }
    ops.push(o); apply(o); done.push(id)
  }
  save()
  emit()
  return { done, held }
}

/** Bulk «توصية» from the list · forwards each project that passes the guard, reports the rest */
export const recommendMany = (ids: readonly string[], by: string): { done: string[]; held: { id: string; why: string }[] } => {
  const done: string[] = []
  const held: { id: string; why: string }[] = []
  for (const id of ids) {
    /* Re-audit 7 Oct · only a project at its supervisor's seat, and only his own */
    const seat = atSupervisorSeat(id, by)
    const b = seat ? [seat] : forwardBlockers(id)
    if (b.length) held.push({ id, why: b[0]! })
    else { const o: Op = { op: 'recommend', id, by, seq: nextSeq(), at: stampNow() }; ops.push(o); apply(o); recommendHook(id, flowOf(id).study?.recommendation, by); done.push(id) }
  }
  save()
  emit()
  return { done, held }
}

/** Is the consultant's access still open on this project */
export const referralOpen = (r?: Referral): boolean => !!r && !r.opinion && r.expiresAt >= liveDay()

/* Re-audit 7 Oct · the consultant's screen was open to anyone who knew the project number. The
   referral now carries an access code (sent with the link in production); the screen asks for it
   and keeps the consultant in for this tab. */
export function adviceCode(projectId: string, r: Referral): string {
  /* Batch 1 · a referral made in the app carries a random code on its op · a seeded referral draws
     one once and keeps it in this browser · neither is computed from what the page shows (it used
     to be a hash of the project, the consultant and the date, so it could be worked out) */
  if (r.code) return r.code
  const k = `ab-advice-code-${projectId}`
  try {
    const saved = localStorage.getItem(k)
    if (saved) return saved
    const c = drawCode()
    localStorage.setItem(k, c)
    return c
  } catch {
    return drawCode()
  }
}
const ADVICE_KEY = (id: string) => `ab-advice-${id}`
export const adviceUnlocked = (id: string): boolean => {
  try { return sessionStorage.getItem(ADVICE_KEY(id)) === '1' } catch { return false }
}
/* Batch 1 · 8 Oct · wrong codes are counted · five in a row lock the screen for fifteen minutes,
   so the six digits can't be walked through. The count lives in this browser; on the server it
   would be per referral */
const TRIES_KEY = (id: string) => `ab-advice-tries-${id}`
export const ADVICE_MAX_TRIES = 5
export const ADVICE_LOCK_MIN = 15
type Tries = { n: number; until?: number }
const readTries = (id: string): Tries => {
  try { return JSON.parse(localStorage.getItem(TRIES_KEY(id)) ?? '{"n":0}') as Tries } catch { return { n: 0 } }
}
const writeTries = (id: string, t: Tries) => { try { localStorage.setItem(TRIES_KEY(id), JSON.stringify(t)) } catch { /* storage blocked */ } }
/** Minutes left on the lock · 0 when the screen is open to a try */
export function adviceLockLeft(id: string, now = Date.now()): number {
  const t = readTries(id)
  return t.until && t.until > now ? Math.ceil((t.until - now) / 60_000) : 0
}
export type UnlockResult = { ok: true } | { ok: false; left: number; lockedFor: number }
export function unlockAdvice(id: string, code: string, now = Date.now()): UnlockResult {
  const lock = adviceLockLeft(id, now)
  if (lock) return { ok: false, left: 0, lockedFor: lock }
  const r = flowOf(id).referral
  if (!r || code.trim() !== adviceCode(id, r)) {
    const t = readTries(id)
    const n = (t.until && t.until <= now ? 0 : t.n) + 1
    if (n >= ADVICE_MAX_TRIES) {
      writeTries(id, { n: 0, until: now + ADVICE_LOCK_MIN * 60_000 })
      return { ok: false, left: 0, lockedFor: ADVICE_LOCK_MIN }
    }
    writeTries(id, { n })
    return { ok: false, left: ADVICE_MAX_TRIES - n, lockedFor: 0 }
  }
  writeTries(id, { n: 0 })
  try { sessionStorage.setItem(ADVICE_KEY(id), '1') } catch { /* storage blocked · the code is asked again */ }
  return { ok: true }
}

/** For the timeline · events this module recorded on the project, newest first */
export const flowEvents = (id: string): LogEvent[] => flowOf(id).events

/** Reset the demo (from settings) · drops every recorded operation */
export const resetIntake = () => {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}
