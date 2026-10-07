import { useSyncExternalStore } from 'react'
import type { ProjectRow } from '@/types/domain'
import type { LogEvent, LogField } from '@/data/mock/log'
import { SOURCE_OF } from '@/data/mock/log'
import { projectRows } from '@/data/mock/projects'
import { stageMeta, FIELDS_BY_TRACK } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { CYCLE, TODAY, addWorkingDays, type Distribution } from './cycle'
import { CRITERIA, studyScore } from './criteria'
import { CONSULTANTS, consultantByKey } from './consultants'

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
}

export interface VersionSnap { amount: number; days: number; reach: number; objectives: number; docs: number; startAt?: string }
const snapOf = (p: ProjectRow, f: { objectives: string[]; docs: { kind: string }[] }): VersionSnap => ({
  amount: p.amountRequested, days: p.durationDays ?? 0, reach: p.beneficiaries ?? 0, objectives: f.objectives.length, docs: f.docs.length, startAt: p.startAt,
})
export interface FlowNote { id: string; to: string; title: string; context: string; at: string; projectId: string }

export interface ProjectFlow {
  createdAt?: string
  sentAt?: string
  /** Every version sent · with what it carried, so an earlier one reads in full after a resubmission (3.4.31) */
  versions: { no: number; at: string; by: string; say: string; snap?: VersionSnap }[]
  objectives: string[]
  docs: DocFile[]
  study?: Study
  /** Earlier studies · a transfer or a return keeps them on record */
  pastStudies: Study[]
  referral?: Referral
  completionNote?: string
  returnNote?: string
  closed?: { kind: 'cancel' | 'archive'; reason: string; by: string; at: string }
  events: LogEvent[]
}

/* ── Store ── */

type Op =
  | { op: 'submit'; id: string; values: Record<string, string>; by: string; asEntity: boolean; docs: string[] }
  | { op: 'doc'; id: string; kind: string; name: string; by: string }
  | { op: 'study'; id: string; study: Omit<Study, 'at' | 'version' | 'field'> }
  | { op: 'recommend'; id: string; by: string }
  | { op: 'complete'; id: string; note: string; by: string }
  | { op: 'resubmit'; id: string; by: string }
  | { op: 'transfer'; id: string; field: string; owner: string; reason: string; by: string }
  | { op: 'return'; id: string; note: string; by: string }
  | { op: 'refer'; id: string; consultant: string; by: string }
  | { op: 'opinion'; id: string; opinion: string; verdict: NonNullable<Referral['verdict']>; by: string }
  | { op: 'close'; id: string; kind: 'cancel' | 'archive'; reason: string; by: string }
  | { op: 'assign'; id: string; owner: string; by: string }

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
      objectives: [], docs: seedDocs(id), pastStudies: [], events: [],
    }
    const seeded = SEED_STUDY[id]
    if (seeded) f.study = { ...seeded, field: row(id)?.field ?? seeded.field }
    if (SEED_REFERRAL[id]) f.referral = { ...SEED_REFERRAL[id]! }
    FLOWS.set(id, f)
  }
  return f
}

const row = (id: string) => projectRows.find((p) => p.id === id)

const NOW_TIME = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    at: TODAY,
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
  FLOW_NOTES.unshift({ id: `fn-${projectId}-${FLOW_NOTES.length}`, to, title, context, at: TODAY, projectId })
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
  '20940': { consultant: 'c1', by: 'عمر قاسم', at: '2026-09-29', expiresAt: '2026-10-09' },
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
  projectRows.filter((p) => p.owner === owner && p.statusGroup === 'في الدراسة').length

/** The supervisor a new request goes to, by the domain's rule · `null` = manual (the manager assigns) */
export const pickSupervisor = (field: string, goal: string): string | null => {
  const d = CYCLE.domains[field]
  if (!d || d.supervisors.length === 0) return null
  const rule: Distribution = d.distribution
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

export const missingDocs = (id: string): string[] => {
  const f = flowOf(id)
  return REQUEST_DOCS.filter((d) => d.required && !f.docs.some((x) => x.kind === d.key)).map((d) => d.label)
}

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
  }
  const docs = missingDocs(id)
  if (docs.length) out.push(`مرفقات إلزامية ناقصة: ${docs.join('، ')}`)
  if (CONSULTANTS.waitForOpinion && f.referral && !f.referral.opinion && f.referral.expiresAt >= TODAY) {
    out.push('بانتظار رأي المستشار · الإعداد يشترط وصوله قبل الإحالة')
  }
  return out
}

/* ── Apply ── */

const nextId = () => String(21_900 + projectRows.filter((p) => Number(p.id) >= 21_900).length + 1)

const trackOf = (field: string) => Object.entries(FIELDS_BY_TRACK).find(([, fs]) => fs.includes(field))?.[0] ?? ''

function apply(o: Op) {
  const p = o.op === 'submit' ? undefined : row(o.id)
  if (o.op !== 'submit' && !p) return

  switch (o.op) {
    case 'submit': {
      const v = o.values
      const e = entityById(v.entityId)
      const owner = pickSupervisor(v.field, v.goal)
      const amount = Number(v.amountRequested) || 0
      const days = Number(v.workDays) || 0
      projectRows.unshift({
        id: o.id, name: v.name, entityId: v.entityId, entityName: e?.name ?? '',
        track: v.track, field: v.field, goal: v.goal, region: v.region, city: v.city,
        stage: 'دراسة المشروع', statusGroup: 'في الدراسة', stageLimit: stageMeta('دراسة المشروع')?.limit ?? 900,
        hoursInStage: 0, amountRequested: amount, amountGranted: 0, amountSpent: 0, weight: 50, score: 0,
        owner, year: '2026-f', funding: 'foundation', tags: [], grantMethod: 'بحث واستجابة', shared: false,
        impact: false, supportStatus: null, submittedAt: TODAY, durationDays: days,
        beneficiaries: Number(v.reach) || 0, hasInterimReport: false, hasFinalReport: false,
        hasKnowledgeProduct: false, fieldVisit: false, type: 'مشروع عادي', holder: 'supervisor',
        createdAt: `${TODAY}T${NOW_TIME()}`, startAt: v.startAt, endAt: v.startAt && days ? addWorkingDays(v.startAt, days) : v.endAt,
      })
      const f = flowOf(o.id)
      f.createdAt = `${TODAY} ${NOW_TIME()}`
      f.sentAt = f.createdAt
      f.objectives = (v.objectives ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
      f.docs = o.docs.map((k) => ({ kind: k, name: `${REQUEST_DOCS.find((d) => d.key === k)?.label ?? k}.pdf`, by: o.asEntity ? e?.name ?? o.by : o.by, at: TODAY }))
      f.versions = [{ no: 1, at: TODAY, by: o.by, say: o.asEntity ? 'أرسلته الجهة من البوابة' : 'أدخله مشرف المنح نيابةً عن الجهة', snap: snapOf(projectRows[0], f) }]
      event(o.id, {
        action: 'تقديم طلب المشروع', by: o.asEntity ? e?.name ?? o.by : o.by, actor: o.asEntity ? 'entity' : 'staff', dept: 'تقديم الطلب',
        fields: [
          { k: 'المبلغ المطلوب', v: amount.toLocaleString('en-US') },
          { k: 'المجال', v: v.field },
          { k: 'الإسناد', v: owner ? `${owner} · ${CYCLE.domains[v.field]?.distribution === 'manual' ? 'المشرف الوحيد للمجال' : 'تلقائي حسب قاعدة المجال'}` : 'بانتظار إسناد مدير المنح', strong: true },
        ],
      })
      if (owner) note(o.id, owner, `طلب جديد · ${v.name}`, `أُسند إليك تلقائيًا في مجال ${v.field}`)
      else note(o.id, 'مدير المنح', `طلب بلا مشرف · ${v.name}`, `مجال ${v.field} توزيعه يدوي · يحتاج إسنادًا`)
      break
    }
    case 'assign': {
      p!.owner = o.owner
      event(o.id, { action: 'إسناد المشروع لمشرف', by: o.by, fields: [{ k: 'المشرف', v: o.owner, strong: true }] })
      note(o.id, o.owner, `أُسند إليك · ${p!.name}`, `من ${o.by}`)
      break
    }
    case 'doc': {
      const f = flowOf(o.id)
      f.docs = f.docs.filter((d) => d.kind !== o.kind)
      f.docs.push({ kind: o.kind, name: o.name, by: o.by, at: TODAY })
      const k = REQUEST_DOCS.find((d) => d.key === o.kind)
      event(o.id, { action: 'رفع مرفق', by: o.by, actor: k?.audience === 'entity' && o.by === p!.entityName ? 'entity' : 'staff', fields: [{ k: 'المرفق', v: k?.label ?? o.kind }, { k: 'الاطلاع', v: k?.audience === 'internal' ? 'داخلي · لا تراه الجهة' : 'الجهة والفريق' }], files: [o.name] })
      break
    }
    case 'study': {
      const f = flowOf(o.id)
      const prev = f.study
      f.study = { ...o.study, at: TODAY, version: prev ? prev.version + (f.returnNote ? 1 : 0) : 1, field: p!.field }
      if (f.returnNote) f.returnNote = undefined
      event(o.id, {
        action: prev ? 'تحديث دراسة المشروع' : 'تسجيل دراسة المشروع', by: o.study.by,
        fields: [
          { k: 'الدرجة', v: `${studyScore(o.study.scores)} من 100` },
          { k: 'التوصية', v: o.study.recommendation === 'approve' ? 'الموافقة' : o.study.recommendation === 'reject' ? 'الاعتذار' : 'لم تُحدَّد', strong: true },
          ...(o.study.recommendation === 'approve' ? [{ k: 'المبلغ الموصى به', v: o.study.amount.toLocaleString('en-US') }] : []),
        ],
      })
      break
    }
    case 'recommend': {
      const f = flowOf(o.id)
      const s = f.study
      p!.holder = 'manager'
      p!.hoursInStage = 0
      event(o.id, {
        action: s?.recommendation === 'reject' ? 'توصية بالاعتذار وإحالة لمدير المنح' : 'توصية بالموافقة وإحالة لمدير المنح',
        by: o.by, tone: 'ok',
        fields: [
          { k: 'التوصية', v: s?.recommendation === 'reject' ? 'الاعتذار' : 'الموافقة', strong: true },
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
      f.versions.push({ no: f.versions.length + 1, at: TODAY, by: o.by, say: `أعادت الجهة الإرسال بعد الاستكمال${f.completionNote ? ` · ${f.completionNote}` : ''}`, snap: snapOf(p!, f) })
      f.completionNote = undefined
      event(o.id, { action: 'إعادة إرسال الطلب بعد الاستكمال', by: o.by, actor: 'entity', dept: 'استكمال بيانات المشروع' })
      if (p!.owner) note(o.id, p!.owner, `أعادت الجهة الإرسال · ${p!.name}`, 'استؤنفت الدراسة')
      break
    }
    case 'transfer': {
      const f = flowOf(o.id)
      const from = { field: p!.field, owner: p!.owner }
      if (f.study) { f.pastStudies.unshift(f.study); f.study = undefined }
      p!.field = o.field
      const t = trackOf(o.field)
      if (t) p!.track = t
      p!.owner = o.owner
      p!.holder = 'supervisor'
      p!.hoursInStage = 0
      event(o.id, {
        action: 'تحويل المشروع إلى مجال آخر', by: o.by, tone: 'warn',
        fields: [
          { k: 'من', v: `${from.field} · ${from.owner ?? 'بلا مشرف'}` },
          { k: 'إلى', v: `${o.field} · ${o.owner}`, strong: true },
          { k: 'السبب', v: o.reason },
          { k: 'الدراسة السابقة', v: 'محفوظة في السجل' },
        ],
      })
      note(o.id, o.owner, `حُوّل إليك · ${p!.name}`, `من مجال ${from.field} · ${o.reason}`)
      break
    }
    case 'return': {
      const f = flowOf(o.id)
      f.returnNote = o.note
      p!.holder = 'supervisor'
      p!.hoursInStage = 0
      event(o.id, { action: 'إعادة المشروع لمشرف المنح', by: o.by, tone: 'warn', fields: [{ k: 'الملاحظات', v: o.note, strong: true }] })
      if (p!.owner) note(o.id, p!.owner, `أعاده مدير المنح · ${p!.name}`, o.note)
      break
    }
    case 'refer': {
      const c = consultantByKey(o.consultant)
      const f = flowOf(o.id)
      const exp = new Date(`${TODAY}T00:00:00Z`)
      exp.setUTCDate(exp.getUTCDate() + (c?.accessDays ?? 7))
      f.referral = { consultant: o.consultant, by: o.by, at: TODAY, expiresAt: exp.toISOString().slice(0, 10) }
      event(o.id, { action: 'إحالة إلى مستشار', by: o.by, fields: [{ k: 'المستشار', v: c?.name ?? o.consultant, strong: true }, { k: 'وصول حتى', v: f.referral.expiresAt }, { k: 'الرأي', v: 'استشاري غير ملزم' }] })
      if (c) note(o.id, c.name, `طلب رأي · ${p!.name}`, `من ${o.by} · حتى ${f.referral.expiresAt}`)
      break
    }
    case 'opinion': {
      const f = flowOf(o.id)
      if (!f.referral) return
      f.referral.opinion = o.opinion
      f.referral.verdict = o.verdict
      f.referral.opinionAt = TODAY
      event(o.id, { action: 'رأي المستشار', by: o.by, fields: [{ k: 'الرأي', v: o.verdict, strong: true }, { k: 'الملاحظات', v: o.opinion }, { k: 'الإلزام', v: 'غير ملزم' }] })
      if (p!.owner) note(o.id, p!.owner, `وصل رأي المستشار · ${p!.name}`, o.verdict)
      break
    }
    case 'close': {
      const f = flowOf(o.id)
      f.closed = { kind: o.kind, reason: o.reason, by: o.by, at: TODAY }
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
  ops.push(o)
  apply(o)
  save()
  emit()
}

/* Replay at load */
try {
  const raw = localStorage.getItem(KEY)
  ops = raw ? (JSON.parse(raw) as Op[]) : []
} catch {
  ops = []
}
for (const o of ops) apply(o)

/* ── Public actions ── */

export const submitRequest = (values: Record<string, string>, docs: string[], by: string, asEntity: boolean): string => {
  const id = nextId()
  run({ op: 'submit', id, values, by, asEntity, docs })
  return id
}
export const assignSupervisor = (id: string, owner: string, by: string) => run({ op: 'assign', id, owner, by })
export const uploadDoc = (id: string, kind: string, name: string, by: string) => run({ op: 'doc', id, kind, name, by })
export const saveStudy = (id: string, study: Omit<Study, 'at' | 'version' | 'field'>) => run({ op: 'study', id, study })

/** Forward with the recorded recommendation · refused (returns the reasons) when a guard fails */
export const recommend = (id: string, by: string): string[] => {
  const b = forwardBlockers(id)
  if (b.length) return b
  run({ op: 'recommend', id, by })
  return []
}
export const requestCompletion = (id: string, note: string, by: string) => run({ op: 'complete', id, note, by })
export const resubmit = (id: string, by: string) => run({ op: 'resubmit', id, by })
export const transferProject = (id: string, field: string, owner: string, reason: string, by: string) =>
  run({ op: 'transfer', id, field, owner, reason, by })
export const returnToSupervisor = (id: string, note: string, by: string) => run({ op: 'return', id, note, by })
export const referConsultant = (id: string, consultant: string, by: string) => run({ op: 'refer', id, consultant, by })
export const giveOpinion = (id: string, opinion: string, verdict: NonNullable<Referral['verdict']>, by: string) =>
  run({ op: 'opinion', id, opinion, verdict, by })
export const closeRequest = (id: string, kind: 'cancel' | 'archive', reason: string, by: string) =>
  run({ op: 'close', id, kind, reason, by })

/** Is this project at the supervisor's own seat · the reason when not */
function atSupervisorSeat(id: string, by: string): string {
  const p = row(id)
  if (!p || p.stage !== 'دراسة المشروع' || (p.holder && p.holder !== 'supervisor')) return 'ليس عند مشرف المنح'
  if (p.owner !== by) return 'مسند لمشرف آخر'
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
    const o: Op = { op: 'complete', id, note: note.trim(), by }
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
    else { ops.push({ op: 'recommend', id, by }); apply({ op: 'recommend', id, by }); done.push(id) }
  }
  save()
  emit()
  return { done, held }
}

/** Is the consultant's access still open on this project */
export const referralOpen = (r?: Referral): boolean => !!r && !r.opinion && r.expiresAt >= TODAY

/* Re-audit 7 Oct · the consultant's screen was open to anyone who knew the project number. The
   referral now carries an access code (sent with the link in production); the screen asks for it
   and keeps the consultant in for this tab. */
export function adviceCode(projectId: string, r: Referral): string {
  let h = 2166136261
  for (const ch of `${projectId}|${r.consultant}|${r.at}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return String(100000 + (h % 900000))
}
const ADVICE_KEY = (id: string) => `ab-advice-${id}`
export const adviceUnlocked = (id: string): boolean => {
  try { return sessionStorage.getItem(ADVICE_KEY(id)) === '1' } catch { return false }
}
export function unlockAdvice(id: string, code: string): boolean {
  const r = flowOf(id).referral
  if (!r || code.trim() !== adviceCode(id, r)) return false
  try { sessionStorage.setItem(ADVICE_KEY(id), '1') } catch { /* storage blocked · the code is asked again */ }
  return true
}

/** For the timeline · events this module recorded on the project, newest first */
export const flowEvents = (id: string): LogEvent[] => flowOf(id).events

/** Reset the demo (from settings) · drops every recorded operation */
export const resetIntake = () => {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}
