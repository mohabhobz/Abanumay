import { useSyncExternalStore } from 'react'
import { agreements, agreementById, setBlockedGate } from '@/data/mock/agreements'
import { projectRows } from '@/data/mock/projects'
import { planOfProject } from '@/data/mock/plans'
import { stageMeta } from '@/data/mock/taxonomy'
import { setAgreementGate } from '@/data/mock/disbursements'
import { setFundingGate as setAgrFundingGate } from '@/data/mock/agreementNew'
import { TODAY } from '@/data/intake/cycle'
import { roleByKey, type RoleKey } from '@/data/roles'
import { linkOf, docOf } from '@/data/budget/store'
import { pathOf } from '@/data/mock/budgetTree'
import { appFlowOf } from '@/data/approvals/store'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import type { AgreementEvent, AgreementKind, AgreementPayment, AgreementRow, PayDoc, ProjectRow } from '@/types/domain'

/* Agreements (BPD-008) · the actions.

   The fixture builds the agreements already in the system at their stages; this store moves them.
   Same model as intake, entities, budget and approvals: an ordered list of operations kept in the
   browser and replayed at load, so a reload lands on the same state; in production each operation
   is a POST.

   What an agreement carries beyond its row (`AgrFlow`): its clauses (terms, conditions,
   obligations, follow-up · 8.2.10), who it went back to on a return (the executive's return goes
   to the grants manager, not the supervisor · 8.2.19), the signatures (the entity's, electronic or
   a signed paper copy, then the foundation's representative · 8.4.15 · 8.4.16), and its archived
   versions (8.4.6). A signed agreement is never edited: a change opens a new version that goes
   through the whole cycle again, while the version in force keeps the project paying (8.4.17). */

/* ── Clauses ── */

export type ClauseKind = 'clause' | 'condition' | 'obligation' | 'followup'
export const CLAUSE_SAY: Record<ClauseKind, string> = {
  clause: 'بند', condition: 'شرط', obligation: 'التزام', followup: 'آلية المتابعة',
}
export interface Clause {
  id: string
  kind: ClauseKind
  title: string
  body: string
  /** Where it came from · the template, the approval's special conditions, the assistant, or staff */
  source: 'template' | 'approval' | 'ai' | 'staff'
}

/** What every agreement must carry before it's sent (8.2.13 · 8.4.9) */
export const REQUIRED_CLAUSES: ClauseKind[] = ['obligation', 'followup']
export const REQUIRED_ANNEXES = ['تفويض ممثل الجهة']

/** The template's clauses · the starting text of every new agreement */
export const templateClauses = (p: { name: string; entityName: string }, stamp: string): Clause[] => [
  { id: `cl-${stamp}-1`, kind: 'clause', source: 'template', title: 'موضوع الاتفاقية', body: `تقديم منحة لتنفيذ مشروع «${p.name}» وفق خطة التنفيذ المعتمدة والملحقة بهذه الاتفاقية.` },
  { id: `cl-${stamp}-2`, kind: 'obligation', source: 'template', title: 'التزامات المؤسسة', body: 'صرف الدفعات وفق الجدول المعتمد بعد استيفاء شروط استحقاق كل دفعة، ومتابعة التنفيذ وتقديم الدعم الفني.' },
  { id: `cl-${stamp}-3`, kind: 'obligation', source: 'template', title: `التزامات ${p.entityName}`, body: 'تنفيذ المشروع وفق الخطة والميزانية المعتمدتين، وعدم صرف المنحة في غير ما خُصّصت له، وحفظ المستندات المالية.' },
  { id: `cl-${stamp}-4`, kind: 'followup', source: 'template', title: 'آلية المتابعة والتقارير', body: 'ترفع الجهة تقريرًا مرحليًّا عند كل دفعة وتقريرًا ختاميًّا عند نهاية التنفيذ، وللمؤسسة الزيارات الميدانية.' },
  { id: `cl-${stamp}-5`, kind: 'clause', source: 'template', title: 'التعديل والإنهاء', body: 'لا يُعدَّل أي بند بعد التوقيع إلا بإصدار جديد يمرّ بدورة الاعتماد كاملة، وللمؤسسة إنهاء الاتفاقية عند الإخلال الجوهري.' },
]

/* ── The agreement's flow ── */

export interface Signature { at: string; by: string; method: 'e' | 'paper'; file?: string }
export interface AgrVersion {
  version: number
  at: string
  by: string
  reason: string
  kind: AgreementKind
  template: string
  amount: number
  payments: AgreementPayment[]
  clauses: Clause[]
  signer: { name: string; title: string }
  docs: PayDoc[]
  /** Signed and approved · the version that was in force */
  final: boolean
}
export interface AgrFlow {
  clauses: Clause[]
  /** A return's destination · the supervisor (manager's and entity's returns) or the grants
      manager (the executive's · 8.2.19) */
  returnedTo?: 'supervisor' | 'manager'
  /** Sent to the grants manager at least once on this version · the kind is fixed from then (8.4.3) */
  submitted: boolean
  entitySign?: Signature
  foundationSign?: { at: string; by: string }
  /** The version in force · it keeps the project paying while a new version climbs the cycle */
  inForce?: number
  versions: AgrVersion[]
  /** An additional agreement replaces the one in force when it activates (8.4.25) */
  replaces?: string
  replacedBy?: string
  /** The paper agreement's draft copy, uploaded at creation (8.2.30) */
  paperCopy?: string
}

const FLOWS = new Map<string, AgrFlow>()
export const agrFlowOf = (id: string): AgrFlow => {
  let f = FLOWS.get(id)
  if (!f) { f = { clauses: [], submitted: false, versions: [] }; FLOWS.set(id, f) }
  return f
}

/** Who holds the agreement now · a role, or the entity */
export type AgrHolder = RoleKey | 'entity' | null
export function agrHolder(a: AgreementRow): AgrHolder {
  const f = agrFlowOf(a.id)
  switch (a.stage) {
    case 'draft': return 'supervisor'
    case 'returned': return f.returnedTo === 'manager' ? 'grants-manager' : 'supervisor'
    case 'manager': return 'grants-manager'
    case 'executive': return 'ceo'
    /* After the entity signs, the foundation's representative approves the final copy (8.4.15) ·
       a paper agreement's signature arrives on paper, so the supervisor records it */
    case 'entity': return f.entitySign ? 'ceo' : 'entity'
    default: return null
  }
}
export const HOLDER_SAY: Record<Exclude<AgrHolder, null>, string> = {
  supervisor: 'مشرف المنح', 'grants-manager': 'مدير المنح', ceo: 'المدير التنفيذي', finance: 'الإدارة المالية', comms: 'الاتصال المؤسسي', member: 'عضو اللجنة والمجلس', admin: 'مدير النظام', entity: 'الجهة المستفيدة',
}
/** The stage's name as the holder reads it · a return names where it went */
export function agrStageSay(a: AgreementRow): string {
  const f = agrFlowOf(a.id)
  if (a.stage === 'returned') return f.returnedTo === 'manager' ? 'مُعادة إلى مدير المنح' : 'بانتظار التعديل'
  if (a.stage === 'entity' && f.entitySign) return 'بانتظار اعتماد ممثل المؤسسة'
  if (a.stage === 'cancelled' && f.replacedBy) return `حلّت محلها ${f.replacedBy}`
  return ({ draft: 'مسودة عند المشرف', manager: 'بانتظار مدير المنح', executive: 'بانتظار المدير التنفيذي', entity: 'بانتظار توقيع الجهة', active: 'سارية', cancelled: 'ملغاة', returned: 'بانتظار التعديل' } as const)[a.stage]
}

/* ── Notifications · read by the drawer ── */

export interface AgrNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const AGR_NOTES: AgrNote[] = []
const notify = (to: string[], a: AgreementRow, title: string, context: string, href = ROUTES.agreement(a.id)) => {
  for (const t of to) AGR_NOTES.unshift({ id: `agn-${AGR_NOTES.length + 1}`, to: t, title, context, at: TODAY, href })
}

/* ── Readers ── */

const projectOf = (a: { projectId: string }): ProjectRow | undefined => projectRows.find((p) => p.id === a.projectId)
const SUP = () => roleByKey('supervisor').title
const MGR = () => roleByKey('grants-manager').title
const CEO = () => roleByKey('ceo').title

/** The amount held for the project · the funding link when there is one, else the fixture's figure */
export const reservedOf = (a: { projectId: string; reserved: number }): number => {
  const l = linkOf(a.projectId)
  return l && (l.stage === 'final' || l.stage === 'initial') ? l.amount : a.reserved
}

/** The project's execution window · start, end · the payment dates must sit inside it (8.2.12) */
export function windowOf(projectId: string): { from?: string; to?: string } {
  const p = projectRows.find((x) => x.id === projectId)
  const plan = planOfProject(projectId)
  if (plan?.phases.length) return { from: plan.phases[0].from, to: plan.phases[plan.phases.length - 1].to }
  if (p?.startAt) return { from: p.startAt, to: p.endAt }
  return {}
}

export interface AgrIssue { key: string; say: string; rule: string }

/** Everything that stops sending or approving (8.2.12 · 8.2.13 · 8.4.8 · 8.4.9) · the same check on
    the draft builder and on a saved agreement */
export function agrIssues(v: {
  projectId: string
  kind: AgreementKind | ''
  template: string
  signer: { name: string; title: string }
  amount: number
  reserved: number
  payments: { no: number; amount: number; dueAt: string; requirement?: string }[]
  clauses: Clause[]
  docs: { kind: string; name: string }[]
  paperCopy?: string
}): AgrIssue[] {
  const out: AgrIssue[] = []
  if (!v.kind) out.push({ key: 'kind', say: 'حدّد نوع الاتفاقية (ورقية أو إلكترونية).', rule: '8.2.4' })
  if (v.kind === 'إلكترونية' && !v.template) out.push({ key: 'template', say: 'اختر النموذج المعتمد للاتفاقية الإلكترونية.', rule: '8.2.5' })
  if (v.kind === 'ورقية' && !v.paperCopy) out.push({ key: 'paper', say: 'ارفع نسخة الاتفاقية الورقية.', rule: '8.2.30' })
  if (!v.signer.name.trim() || !v.signer.title.trim()) out.push({ key: 'signer', say: 'أدخل اسم ممثل الجهة المخوّل بالتوقيع وصفته.', rule: '8.1.input-3' })
  if (v.amount !== v.reserved) out.push({ key: 'reserved', say: `قيمة الاتفاقية ${nf.format(v.amount)} والمحجوز في الميزانية ${nf.format(v.reserved)} · يلزم أن يتطابقا.`, rule: '8.4.9' })

  if (!v.payments.length) out.push({ key: 'empty', say: 'لا توجد دفعات · الجدول جزء من الاتفاقية لا ملحق بها.', rule: '8.2.11' })
  const total = v.payments.reduce((s, p) => s + (p.amount || 0), 0)
  if (v.payments.length && total !== v.amount) {
    const gap = v.amount - total
    out.push({ key: 'sum', say: gap > 0 ? `مجموع الدفعات ينقص عن قيمة المنحة ${nf.format(gap)}.` : `مجموع الدفعات يزيد على قيمة المنحة ${nf.format(-gap)}.`, rule: '8.2.12' })
  }
  const noReq = v.payments.filter((p) => !(p.requirement ?? '').trim()).map((p) => p.no)
  if (noReq.length) out.push({ key: 'req', say: `الدفعة ${noReq.join('، ')} بلا شرط استحقاق.`, rule: '8.1.output-4' })
  for (let i = 1; i < v.payments.length; i++) {
    const a = v.payments[i - 1], b = v.payments[i]
    if (a.dueAt && b.dueAt && b.dueAt < a.dueAt) { out.push({ key: 'order', say: `تاريخ الدفعة ${b.no} يسبق تاريخ الدفعة ${a.no}.`, rule: '8.2.12' }); break }
  }
  /* The dates against the implementation plan · a payment after the project ends has nothing to pay for */
  const w = windowOf(v.projectId)
  const late = v.payments.filter((p) => p.dueAt && w.to && p.dueAt > w.to).map((p) => p.no)
  const early = v.payments.filter((p) => p.dueAt && w.from && p.dueAt < w.from).map((p) => p.no)
  if (late.length) out.push({ key: 'late', say: `الدفعة ${late.join('، ')} بعد نهاية التنفيذ في الخطة (${w.to}).`, rule: '8.2.12' })
  if (early.length > 1) out.push({ key: 'early', say: `الدفعات ${early.join('، ')} قبل بداية التنفيذ (${w.from}) · الدفعة الأولى وحدها تسبق البداية.`, rule: '8.2.12' })

  for (const k of REQUIRED_CLAUSES) {
    if (!v.clauses.some((c) => c.kind === k && c.body.trim())) out.push({ key: `cl-${k}`, say: `لا يوجد «${CLAUSE_SAY[k]}» في بنود الاتفاقية.`, rule: '8.2.10' })
  }
  /* The approval's special conditions before the agreement are mandatory terms (5.4.16) */
  const conds = appFlowOf(v.projectId).conditions.filter((c) => c.when === 'agreement' || c.when === 'firstPay')
  const missingCond = conds.filter((c) => !v.clauses.some((x) => x.kind === 'condition' && x.body.includes(c.text)))
  if (missingCond.length) out.push({ key: 'cond', say: `شروط الاعتماد غير مدرجة: ${missingCond.map((c) => c.text).join('، ')}.`, rule: '8.2.13' })
  for (const n of REQUIRED_ANNEXES) {
    if (!v.docs.some((d) => d.kind === n || d.name.includes(n.split(' ')[0]))) out.push({ key: 'annex', say: `الملحق «${n}» غير مرفوع.`, rule: '8.2.10' })
  }
  return out
}

export const issuesOfRow = (a: AgreementRow): AgrIssue[] => {
  const f = agrFlowOf(a.id)
  return agrIssues({ ...a, reserved: reservedOf(a), clauses: f.clauses, paperCopy: f.paperCopy ?? (a.kind === 'ورقية' ? a.docs.find((d) => d.kind === 'ورقية' || d.kind === 'اتفاقية')?.name : undefined) })
}

/* ── The agreement's text · the template with the project's data in it (8.2.6 · 8.4.5) ── */

export interface TextPart { h: string; body: string[] }
export function agreementText(v: {
  projectId: string; amount: number; template: string; kind: AgreementKind | ''
  signer: { name: string; title: string }; payments: { no: number; amount: number; dueAt: string; requirement?: string }[]; clauses: Clause[]
}): TextPart[] {
  const p = projectOf(v)
  const plan = planOfProject(v.projectId)
  const link = linkOf(v.projectId)
  const w = windowOf(v.projectId)
  const lines = link ? link.shares.map((s) => { const d = docOf(s.docId); return `${d ? pathOf(d.nodes, s.nodeId) : s.nodeId} · ${nf.format(s.amount)} ريال` }) : []
  return [
    { h: 'الأطراف', body: [
      'الطرف الأول: مؤسسة سليمان أبانمي الأهلية، ويمثّلها المدير التنفيذي.',
      `الطرف الثاني: ${p?.entityName ?? ''}، ويمثّلها ${v.signer.name || '—'} بصفته ${v.signer.title || '—'}.`,
    ] },
    { h: 'المشروع', body: [
      `اسم المشروع: ${p?.name ?? ''} · المسار ${p?.track ?? ''} · المجال ${p?.field ?? ''} · الهدف ${p?.goal ?? ''}.`,
      `المستفيدون المستهدفون: ${nf.format(p?.beneficiaries ?? 0)} مستفيد.`,
      w.from ? `مدة التنفيذ: من ${w.from} إلى ${w.to ?? '—'}${p?.durationDays ? ` (${nf.format(p.durationDays)} يومًا)` : ''}.` : `مدة التنفيذ: ${nf.format(p?.durationDays ?? 0)} يومًا من تاريخ السريان.`,
    ] },
    { h: 'قيمة المنحة ومصدرها', body: [
      `قيمة المنحة ${nf.format(v.amount)} ريال، محجوزة في الميزانية المعتمدة.`,
      ...lines.map((x) => `البند: ${x}`),
    ] },
    ...(plan?.phases.length ? [{ h: 'خطة التنفيذ (ملحق)', body: plan.phases.map((x, i) => `المرحلة ${i + 1}: ${x.name} · من ${x.from} إلى ${x.to} · ${nf.format(x.cost)} ريال`) }] : []),
    { h: 'جدول صرف الدفعات', body: v.payments.map((x) => `الدفعة ${x.no}: ${nf.format(x.amount)} ريال · تستحق ${x.dueAt || '—'} · بشرط ${x.requirement || '—'}`) },
    ...v.clauses.map((c) => ({ h: `${CLAUSE_SAY[c.kind]} · ${c.title}`, body: [c.body] })),
    { h: 'التوقيع', body: [v.kind === 'ورقية' ? 'تُوقَّع ورقيًّا من الطرفين وتُرفع النسخة الموقّعة في النظام.' : 'تُوقَّع إلكترونيًّا من بوابة المنح ثم يعتمدها ممثل المؤسسة.'] },
  ]
}

/* ── The assistant's review · advisory only (8.2.7 · 8.4.22) ── */

export interface AgrHint { id: string; tone: 'warn' | 'ok'; text: string; add?: Omit<Clause, 'id'>; template?: string }
export function agrReview(v: Parameters<typeof agrIssues>[0]): AgrHint[] {
  const p = projectOf(v)
  const out: AgrHint[] = []
  const w = windowOf(v.projectId)
  const last = v.payments[v.payments.length - 1]
  if (last && !/ختامي|نهائي/.test(last.requirement ?? '')) out.push({ id: 'last', tone: 'warn', text: 'شرط الدفعة الأخيرة غير مرتبط بالتقرير الختامي · يُقترح ربطها به.' })
  if (last && w.to && last.dueAt > w.to) out.push({ id: 'end', tone: 'warn', text: `الدفعة الأخيرة بعد نهاية خطة التنفيذ (${w.to}).` })
  if (!v.clauses.some((c) => c.kind === 'followup')) out.push({ id: 'fu', tone: 'warn', text: 'لا توجد آلية متابعة.', add: { kind: 'followup', source: 'ai', title: 'آلية المتابعة والتقارير', body: 'ترفع الجهة تقريرًا مرحليًّا عند كل دفعة وتقريرًا ختاميًّا عند نهاية التنفيذ.' } })
  const dup = v.clauses.map((c) => c.title.trim()).filter((t, i, xs) => t && xs.indexOf(t) !== i)
  if (dup.length) out.push({ id: 'dup', tone: 'warn', text: `بند مكرّر: ${[...new Set(dup)].join('، ')}.` })
  for (const c of appFlowOf(v.projectId).conditions) {
    if (!v.clauses.some((x) => x.body.includes(c.text))) out.push({ id: `cond-${c.id}`, tone: 'warn', text: `شرط اعتماد غير مدرج: ${c.text}`, add: { kind: 'condition', source: 'approval', title: c.when === 'agreement' ? 'شرط قبل توقيع الاتفاقية' : 'شرط قبل الدفعة الأولى', body: c.text } })
  }
  /* By the grant's field and size · suggested terms, never added without the supervisor */
  const field = p?.field ?? ''
  const byField: Record<string, Omit<Clause, 'id'>> = {
    'التعليم': { kind: 'clause', source: 'ai', title: 'حماية بيانات المستفيدين', body: 'تحفظ الجهة بيانات الطلاب والمعلمين ولا تُشاركها إلا لأغراض المتابعة المعتمدة.' },
    'الصحة': { kind: 'clause', source: 'ai', title: 'التراخيص الصحية', body: 'تلتزم الجهة بالحصول على التراخيص الصحية اللازمة قبل بدء الخدمة والمحافظة على سريانها.' },
  }
  const sug = byField[field] ?? { kind: 'clause' as const, source: 'ai' as const, title: 'الظهور الإعلامي', body: 'تُشير الجهة إلى دعم المؤسسة في المواد الإعلامية للمشروع وفق دليل الهوية.' }
  if (!v.clauses.some((c) => c.title === sug.title)) out.push({ id: 'field', tone: 'ok', text: `بند مقترح لمجال ${field || 'المشروع'}: «${sug.title}».`, add: sug })
  const tpl = v.amount > 1_000_000 ? 'اتفاقية منحة كبرى (فوق مليون)' : (p?.durationDays ?? 0) > 365 ? 'اتفاقية منحة متعددة السنوات' : ''
  if (v.kind === 'إلكترونية' && tpl && v.template !== tpl) out.push({ id: 'tpl', tone: 'ok', text: `النموذج المقترح لحجم المنحة ومدتها: «${tpl}».`, template: tpl })
  if (!out.some((x) => x.tone === 'warn')) out.push({ id: 'okall', tone: 'ok', text: 'البنود متوافقة مع خطة التنفيذ ولا تعارض في الجدول.' })
  return out
}

/* ── Operations ── */

type Patch = Partial<Pick<AgreementRow, 'kind' | 'template' | 'payments' | 'signer' | 'docs'>> & { clauses?: Clause[]; paperCopy?: string }
type Op = { at: string; by: string } & (
  | { op: 'create'; row: Pick<AgreementRow, 'id' | 'projectId' | 'kind' | 'template' | 'payments' | 'signer' | 'docs'>; clauses: Clause[]; paperCopy?: string; send: boolean; replaces?: string }
  | { op: 'save'; id: string; patch: Patch }
  | { op: 'submit'; id: string }
  | { op: 'act'; id: string; act: AgrAct; note: string; file?: string }
  | { op: 'newVersion'; id: string; reason: string }
)
export type AgrAct =
  | 'approve' | 'return' | 'resubmit' | 'toSupervisor' | 'send' | 'cancel'
  | 'entitySign' | 'entityReturn' | 'paperSign' | 'finalize' | 'finalReturn'

const KEY = 'ab-agreement-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export function useAgreements(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}
const now = () => new Date().toISOString()
const day = (iso: string) => iso.slice(0, 10)

const log = (a: AgreementRow, step: number, who: string, role: string, what: string, at: string, note?: string, notified?: string) => {
  const e: AgreementEvent = { at: day(at), who, role, what, step, note, notified, version: a.version }
  a.log.push(e)
}
const move = (a: AgreementRow, stage: AgreementRow['stage']) => { a.stage = stage; a.hoursInStage = 0 }

const snapshot = (a: AgreementRow, f: AgrFlow, by: string, at: string, reason: string, final: boolean): AgrVersion => ({
  version: a.version, at: day(at), by, reason, kind: a.kind, template: a.template, amount: a.amount,
  payments: structuredClone(a.payments), clauses: structuredClone(f.clauses), signer: { ...a.signer }, docs: structuredClone(a.docs), final,
})

/* The project moves with its agreement only at the end (8.4.26 · 8.4.27) · activation puts it
   into execution, at the first stage of disbursing */
const EXEC_STAGE = 'المشرف إذن الصرف'
const activateProject = (projectId: string) => {
  const p = projectRows.find((x) => x.id === projectId)
  if (!p) return
  const meta = stageMeta(EXEC_STAGE)
  p.stage = EXEC_STAGE
  if (meta) { p.statusGroup = meta.group; p.stageLimit = meta.limit }
  p.hoursInStage = 0
}

function apply(o: Op) {
  switch (o.op) {
    case 'create': {
      if (agreementById(o.row.id)) return
      const p = projectRows.find((x) => x.id === o.row.projectId)
      if (!p) return
      const a: AgreementRow = {
        ...o.row, projectName: p.name, entityId: p.entityId, entityName: p.entityName, stage: 'draft', version: 1,
        amount: p.amountGranted, reserved: reservedOf({ projectId: p.id, reserved: p.amountGranted }), owner: p.owner ?? o.by,
        openedAt: day(o.at), hoursInStage: 0, log: [],
      }
      agreements.unshift(a)
      const f = agrFlowOf(a.id)
      f.clauses = structuredClone(o.clauses)
      f.paperCopy = o.paperCopy
      f.replaces = o.replaces
      log(a, 3, o.by, 'مشرف المنح', o.replaces ? `أنشأ اتفاقية إضافية تحلّ محل ${o.replaces} عند سريانها` : 'أنشأ مسودة اتفاقية المنحة', o.at)
      log(a, 4, o.by, 'مشرف المنح', `حدّد طبيعة الاتفاقية · ${a.kind}`, o.at)
      if (a.kind === 'إلكترونية') log(a, 5, o.by, 'مشرف المنح', `اختار النموذج · ${a.template}`, o.at)
      else log(a, 5, o.by, 'مشرف المنح', `رفع نسخة الاتفاقية الورقية · ${o.paperCopy}`, o.at)
      log(a, 6, 'النظام', 'النظام', 'عرض نص الاتفاقية وأدرج بيانات المشروع والجهة والميزانية وخطة التنفيذ', o.at)
      log(a, 9, o.by, 'مشرف المنح', `سجّل جدول صرف الدفعات · ${nf.format(a.payments.length)} دفعات`, o.at)
      notify([MGR()], a, `اتفاقية جديدة قيد الإعداد · ${a.projectName}`, `${a.id} · ${a.kind}`)
      if (o.send) apply({ op: 'submit', id: a.id, by: o.by, at: o.at })
      return
    }
    case 'save': {
      const a = agreementById(o.id)
      if (!a) return
      const f = agrFlowOf(a.id)
      if (agrHolder(a) !== 'supervisor') return
      /* The kind is fixed once the version went for approval · only a new version changes it (8.4.3) */
      if (o.patch.kind && o.patch.kind !== a.kind && f.submitted) return
      const { clauses, paperCopy, ...rest } = o.patch
      Object.assign(a, structuredClone(rest))
      if (clauses) f.clauses = structuredClone(clauses)
      if (paperCopy !== undefined) f.paperCopy = paperCopy
      log(a, 8, o.by, 'مشرف المنح', 'حفظ تعديلات المسودة', o.at)
      return
    }
    case 'submit': {
      const a = agreementById(o.id)
      if (!a || agrHolder(a) !== 'supervisor' || issuesOfRow(a).length) return
      const f = agrFlowOf(a.id)
      f.submitted = true
      f.returnedTo = undefined
      a.note = undefined
      log(a, 10, 'النظام', 'النظام', 'تحقّق من أن مجموع الدفعات يساوي قيمة المنحة ومن توافق التواريخ مع خطة التنفيذ', o.at)
      log(a, 11, 'النظام', 'النظام', 'تحقّق من اكتمال البيانات والبنود والملاحق وتطابق القيمة مع المحجوز', o.at)
      log(a, 12, o.by, 'مشرف المنح', 'أرسل الاتفاقية إلى مدير المنح مع بيانات المشروع والمرفقات', o.at, undefined, 'مدير المنح · اتفاقية بانتظار المراجعة')
      move(a, 'manager')
      notify([MGR()], a, `اتفاقية بانتظار مراجعتك · ${a.projectName}`, a.id)
      return
    }
    case 'act': {
      const a = agreementById(o.id)
      if (!a) return
      const f = agrFlowOf(a.id)
      const h = agrHolder(a)
      switch (o.act) {
        case 'approve':
          if (a.stage !== 'manager' || issuesOfRow(a).length) return
          log(a, 13, o.by, 'مدير المنح', 'راجع الاتفاقية واعتمدها', o.at, o.note || undefined)
          log(a, 16, 'النظام', 'النظام', 'أحال الاتفاقية إلى المدير التنفيذي للاعتماد النهائي', o.at, undefined, 'المدير التنفيذي · اتفاقية بانتظار الاعتماد')
          move(a, 'executive')
          notify([CEO()], a, `اتفاقية بانتظار اعتمادك · ${a.projectName}`, a.id)
          return
        case 'return':
          if (a.stage === 'manager') {
            log(a, 14, o.by, 'مدير المنح', 'أعاد الاتفاقية إلى مشرف المنح بملاحظات · بانتظار التعديل', o.at, o.note, 'مشرف المنح · اتفاقية بانتظار التعديل')
            f.returnedTo = 'supervisor'
            notify([a.owner, SUP()], a, `أُعيدت الاتفاقية للتعديل · ${a.projectName}`, o.note)
          } else if (a.stage === 'executive') {
            log(a, 18, o.by, 'المدير التنفيذي', 'أعاد الاتفاقية إلى مدير المنح مع حفظ سجل الاعتمادات', o.at, o.note, 'مدير المنح · اتفاقية مُعادة من المدير التنفيذي')
            f.returnedTo = 'manager'
            notify([MGR()], a, `أعاد المدير التنفيذي الاتفاقية · ${a.projectName}`, o.note)
          } else return
          a.note = o.note
          move(a, 'returned')
          return
        /* 8.2.20 · 8.2.22 · the grants manager acts on the executive's return: back up after
           review, or down to the supervisor when the change is in the content */
        case 'resubmit':
          if (h !== 'grants-manager' || a.stage !== 'returned' || issuesOfRow(a).length) return
          log(a, 19, o.by, 'مدير المنح', 'عالج ملاحظات المدير التنفيذي وأعاد إرسال الاتفاقية', o.at, o.note || undefined, 'المدير التنفيذي · اتفاقية مُعاد إرسالها')
          f.returnedTo = undefined
          a.note = undefined
          move(a, 'executive')
          notify([CEO()], a, `أُعيد إرسال الاتفاقية · ${a.projectName}`, o.note)
          return
        case 'toSupervisor':
          if (h !== 'grants-manager' || a.stage !== 'returned') return
          log(a, 22, o.by, 'مدير المنح', 'أحال ملاحظات المدير التنفيذي إلى مشرف المنح للتعديل', o.at, o.note, 'مشرف المنح · اتفاقية بانتظار التعديل')
          f.returnedTo = 'supervisor'
          a.note = o.note
          a.hoursInStage = 0
          notify([a.owner, SUP()], a, `اتفاقية بانتظار التعديل · ${a.projectName}`, o.note)
          return
        /* 8.2.23 · 8.4.13 · only after the internal approvals, and by the agreement's kind */
        case 'send':
          if (a.stage !== 'executive') return
          log(a, 17, o.by, 'المدير التنفيذي', 'اعتمد الاتفاقية', o.at, o.note || undefined)
          log(a, 20, 'النظام', 'النظام', a.kind === 'إلكترونية'
            ? 'أرسل الاتفاقية إلى الجهة عبر بوابة المنح للمراجعة والتوقيع الإلكتروني'
            : 'أحال الاتفاقية الورقية للطباعة والتسليم للجهة · يرفع المشرف النسخة الموقّعة', o.at, undefined, 'الجهة المستفيدة · اتفاقية بانتظار التوقيع')
          move(a, 'entity')
          if (a.kind === 'إلكترونية') notify([a.entityName], a, `اتفاقية بانتظار توقيعك · ${a.projectName}`, 'افتحها من البوابة وراجع البنود ثم وقّع', `${ROUTES.agreement(a.id)}?as=entity`)
          else notify([a.owner, SUP()], a, `اطبع الاتفاقية وسلّمها للجهة · ${a.projectName}`, 'ارفع النسخة الموقّعة عند وصولها')
          return
        case 'cancel':
          if (a.stage !== 'executive' && a.stage !== 'manager') return
          log(a, 18, o.by, 'المدير التنفيذي', 'ألغى الاتفاقية · يبقى المشروع في إعداد الاتفاقية', o.at, o.note)
          move(a, 'cancelled')
          notify([a.owner, MGR()], a, `أُلغيت الاتفاقية · ${a.projectName}`, o.note)
          return
        case 'entitySign':
          if (a.stage !== 'entity' || f.entitySign || a.kind !== 'إلكترونية') return
          f.entitySign = { at: day(o.at), by: o.by, method: 'e' }
          a.hoursInStage = 0
          log(a, 21, o.by, 'الجهة المستفيدة', `راجعت الاتفاقية ووقّعتها إلكترونيًّا · ${a.signer.title}`, o.at, undefined, 'المدير التنفيذي · اتفاقية موقّعة بانتظار اعتماد ممثل المؤسسة')
          notify([CEO()], a, `وقّعت الجهة الاتفاقية · ${a.projectName}`, 'اعتمد النسخة النهائية')
          return
        case 'paperSign':
          if (a.stage !== 'entity' || f.entitySign || a.kind !== 'ورقية' || !o.file) return
          f.entitySign = { at: day(o.at), by: a.signer.name, method: 'paper', file: o.file }
          a.hoursInStage = 0
          a.docs.push({ name: o.file, kind: 'موقّعة', at: day(o.at), size: '—' })
          log(a, 21, o.by, 'مشرف المنح', `أرفق النسخة الورقية الموقّعة من الجهة · ${o.file}`, o.at, undefined, 'المدير التنفيذي · اتفاقية موقّعة بانتظار اعتماد ممثل المؤسسة')
          notify([CEO()], a, `وصلت النسخة الموقّعة · ${a.projectName}`, 'اعتمد النسخة النهائية')
          return
        case 'entityReturn':
          if (a.stage !== 'entity' || f.entitySign) return
          log(a, 22, o.by, 'الجهة المستفيدة', 'أعادت الجهة الاتفاقية بملاحظات', o.at, o.note, 'مشرف المنح · أعادت الجهة الاتفاقية بملاحظات')
          f.returnedTo = 'supervisor'
          a.note = o.note
          move(a, 'returned')
          notify([a.owner, SUP()], a, `أعادت الجهة الاتفاقية · ${a.projectName}`, o.note)
          return
        /* 8.2.24 – 8.2.29 · the foundation's representative approves the final copy · it's
           locked, archived and activated, and the project moves to execution */
        case 'finalize': {
          if (a.stage !== 'entity' || !f.entitySign) return
          f.foundationSign = { at: day(o.at), by: o.by }
          log(a, 23, o.by, 'ممثل المؤسسة', 'اعتمد النسخة النهائية ووقّعها عن المؤسسة', o.at)
          log(a, 24, 'النظام', 'النظام', 'تحقّق من اكتمال الاعتمادات والتوقيعات واعتمد النسخة النهائية ومنع تعديلها', o.at)
          f.versions.push(snapshot(a, f, o.by, o.at, a.version > 1 ? 'إصدار معدّل نافذ' : 'النسخة النهائية', true))
          log(a, 25, 'النظام', 'النظام', 'أرشف النسخة النهائية وملاحقها وربطها بالمشروع والجهة والميزانية وجدول الدفعات', o.at)
          f.inForce = a.version
          move(a, 'active')
          a.activeAt = day(o.at)
          log(a, 26, 'النظام', 'النظام', 'فعّل الاتفاقية ومكّن إجراءات المتابعة وطلبات صرف الدفعات', o.at, undefined, 'جميع الأطراف · الاتفاقية سارية')
          if (f.replaces) {
            const old = agreementById(f.replaces)
            if (old && old.stage === 'active') {
              move(old, 'cancelled')
              agrFlowOf(old.id).replacedBy = a.id
              log(old, 26, 'النظام', 'النظام', `انتهى سريانها بسريان الاتفاقية الإضافية ${a.id}`, o.at)
            }
          }
          const p = projectRows.find((x) => x.id === a.projectId)
          if (p && p.stage === 'اعتماد الإتفاقية') {
            activateProject(a.projectId)
            log(a, 28, 'النظام', 'النظام', 'حوّل حالة المشروع إلى «تحت التنفيذ»', o.at)
          }
          notify([a.owner, MGR(), CEO(), a.entityName], a, `سرت الاتفاقية · ${a.projectName}`, 'أصبحت طلبات صرف الدفعات متاحة')
          return
        }
        case 'finalReturn':
          if (a.stage !== 'entity' || !f.entitySign) return
          log(a, 23, o.by, 'ممثل المؤسسة', 'أعاد الاتفاقية الموقّعة إلى مشرف المنح قبل الاعتماد', o.at, o.note)
          f.entitySign = undefined
          f.returnedTo = 'supervisor'
          a.note = o.note
          move(a, 'returned')
          notify([a.owner, SUP()], a, `أُعيدت الاتفاقية قبل الاعتماد النهائي · ${a.projectName}`, o.note)
          return
      }
      return
    }
    /* 8.4.17 · a change after signing opens a new version · the one in force stays in force */
    case 'newVersion': {
      const a = agreementById(o.id)
      if (!a || a.stage !== 'active') return
      const f = agrFlowOf(a.id)
      if (!f.versions.some((v) => v.version === a.version)) f.versions.push(snapshot(a, f, o.by, o.at, 'النسخة النهائية', true))
      a.version += 1
      f.submitted = false
      f.entitySign = undefined
      f.foundationSign = undefined
      f.returnedTo = undefined
      a.note = undefined
      move(a, 'draft')
      log(a, 3, o.by, 'مشرف المنح', `فتح الإصدار ${nf.format(a.version)} للتعديل · ${o.reason} · يبقى الإصدار ${nf.format(f.inForce ?? a.version - 1)} نافذًا حتى سريان الجديد`, o.at, o.reason)
      notify([MGR()], a, `إصدار جديد قيد الإعداد · ${a.projectName}`, o.reason)
      return
    }
  }
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); apply(o); save(); emit() }

/* ── Seed · the fixture's agreements carry their clauses, annexes and signatures ── */

function seed() {
  for (const a of agreements) {
    const f = agrFlowOf(a.id)
    f.clauses = templateClauses({ name: a.projectName, entityName: a.entityName }, a.id)
    for (const c of appFlowOf(a.projectId).conditions) f.clauses.push({ id: `cl-${a.id}-c${c.id}`, kind: 'condition', source: 'approval', title: 'شرط الاعتماد', body: c.text })
    if (!a.docs.some((d) => REQUIRED_ANNEXES.includes(d.kind) || d.kind === 'تفويض')) a.docs.push({ name: 'تفويض ممثل الجهة.pdf', kind: 'تفويض ممثل الجهة', at: a.openedAt, size: '420 ك.ب' })
    for (const d of a.docs) if (d.kind === 'تفويض') d.kind = 'تفويض ممثل الجهة'
    if (a.kind === 'ورقية') f.paperCopy = 'نسخة الاتفاقية الورقية.pdf'
    f.submitted = a.stage !== 'draft'
    if (a.stage === 'returned') f.returnedTo = 'supervisor'
    if (a.stage === 'active') {
      f.entitySign = { at: a.activeAt ?? a.openedAt, by: a.signer.name, method: a.kind === 'ورقية' ? 'paper' : 'e', file: a.kind === 'ورقية' ? 'النسخة الموقّعة.pdf' : undefined }
      f.foundationSign = { at: a.activeAt ?? a.openedAt, by: roleByKey('ceo').name }
      f.inForce = a.version
      f.versions = [snapshot(a, f, roleByKey('ceo').name, `${a.activeAt ?? a.openedAt}T00:00:00Z`, 'النسخة النهائية', true)]
    }
    /* Fixture schedules sit inside the window the plan gives, when a plan exists · moved, not invented */
    const w = windowOf(a.projectId)
    a.payments.forEach((p, i) => {
      if (w.to && p.dueAt > w.to) p.dueAt = w.to
      if (w.from && i > 0 && p.dueAt < w.from) p.dueAt = w.from
      const prev = a.payments[i - 1]
      if (prev && p.dueAt < prev.dueAt) p.dueAt = prev.dueAt
    })
  }
}

/* One of each station the fixture doesn't reach on its own · an executive's return sitting with
   the grants manager (8.2.19), and an electronic signature waiting for the foundation (8.4.15) */
function seedStations() {
  const ret = agreements.filter((a) => a.stage === 'returned')[1]
  if (ret) {
    agrFlowOf(ret.id).returnedTo = 'manager'
    ret.note = 'خفّض الدفعة الأولى إلى الثلث واربطها بتوقيع الاتفاقية واستلام سند التعهّد'
    log(ret, 18, 'عبدالرحمن الهليّل', 'المدير التنفيذي', 'أعاد الاتفاقية إلى مدير المنح مع حفظ سجل الاعتمادات', `${TODAY}T08:00:00Z`, ret.note, 'مدير المنح · اتفاقية مُعادة من المدير التنفيذي')
  }
  const sig = agreements.find((a) => a.stage === 'entity' && a.kind === 'إلكترونية' && agreements.filter((x) => x.stage === 'entity').indexOf(a) > 0)
  if (sig) {
    agrFlowOf(sig.id).entitySign = { at: TODAY, by: sig.signer.name, method: 'e' }
    log(sig, 21, sig.signer.name, 'الجهة المستفيدة', `راجعت الاتفاقية ووقّعتها إلكترونيًّا · ${sig.signer.title}`, `${TODAY}T08:00:00Z`, undefined, 'المدير التنفيذي · اتفاقية موقّعة بانتظار اعتماد ممثل المؤسسة')
  }
}

function hydrate() {
  seed()
  seedStations()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) apply(o)
}
hydrate()

setBlockedGate((a) => a.stage !== 'active' && a.stage !== 'cancelled' && issuesOfRow(a).length > 0)

/* 8.1.input-1 · 8.2.1 · an agreement starts only on a project whose hold is final */
setAgrFundingGate((projectId) => {
  const l = linkOf(projectId)
  return l && l.stage !== 'final' ? 'لم يكتمل الحجز النهائي للمخصص' : ''
})

/* Disbursement opens on the version in force (8.2.31 · 8.4.19) */
setAgreementGate((projectId) => agreements.some((a) => a.projectId === projectId && agrFlowOf(a.id).inForce !== undefined && (a.stage !== 'cancelled' || !agrFlowOf(a.id).replacedBy)))

/* ── Actions ── */

export const nextAgreementId = (): string => {
  let n = 3101 + agreements.length
  while (agreements.some((a) => a.id === `AG-2026-${n}`)) n++
  return `AG-2026-${n}`
}
export function createAgreement(v: { row: Pick<AgreementRow, 'id' | 'projectId' | 'kind' | 'template' | 'payments' | 'signer' | 'docs'>; clauses: Clause[]; paperCopy?: string; send: boolean; replaces?: string }, by: string): string[] {
  const p = projectRows.find((x) => x.id === v.row.projectId)
  if (!p) return ['المشروع غير موجود']
  if (v.send) {
    const issues = agrIssues({ ...v.row, amount: p.amountGranted, reserved: reservedOf({ projectId: p.id, reserved: p.amountGranted }), clauses: v.clauses, paperCopy: v.paperCopy })
    if (issues.length) return issues.map((i) => i.say)
  }
  run({ op: 'create', ...v, by, at: now() })
  return []
}
export const saveAgreement = (id: string, patch: Patch, by: string) => run({ op: 'save', id, patch, by, at: now() })
export function submitAgreement(id: string, by: string): string[] {
  const a = agreementById(id)
  if (!a) return ['الاتفاقية غير موجودة']
  const issues = issuesOfRow(a)
  if (issues.length) return issues.map((i) => i.say)
  run({ op: 'submit', id, by, at: now() })
  return []
}
export function actOnAgreement(id: string, act: AgrAct, note: string, by: string, file?: string): string[] {
  const a = agreementById(id)
  if (!a) return ['الاتفاقية غير موجودة']
  if ((act === 'return' || act === 'toSupervisor' || act === 'cancel' || act === 'entityReturn' || act === 'finalReturn') && !note.trim()) return ['سبب الإعادة إلزامي']
  if ((act === 'approve' || act === 'resubmit') && issuesOfRow(a).length) return issuesOfRow(a).map((i) => i.say)
  if (act === 'paperSign' && !file) return ['ارفع النسخة الموقّعة']
  const before = JSON.stringify([a.stage, agrFlowOf(id).entitySign, agrFlowOf(id).returnedTo])
  run({ op: 'act', id, act, note: note.trim(), file, by, at: now() })
  return JSON.stringify([a.stage, agrFlowOf(id).entitySign, agrFlowOf(id).returnedTo]) === before ? ['الإجراء غير متاح في هذه المرحلة'] : []
}
export function openNewVersion(id: string, reason: string, by: string): string[] {
  if (!reason.trim()) return ['سبب الإصدار الجديد إلزامي']
  run({ op: 'newVersion', id, reason: reason.trim(), by, at: now() })
  return []
}
export const resetAgreements = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }

/** The actions a seat has on an agreement (8.2.14 – 8.2.29) */
export interface AgrAction { act: AgrAct | 'submit'; label: string; kind: 'btn-p' | 'btn-2' | 'btn-d'; needsNote?: boolean; needsFile?: boolean; step: number }
export function agrActions(a: AgreementRow, role: RoleKey, asEntity: boolean): AgrAction[] {
  const h = agrHolder(a)
  if (asEntity) {
    return h === 'entity' && a.kind === 'إلكترونية'
      ? [{ act: 'entitySign', label: 'وقّع الاتفاقية إلكترونيًّا', kind: 'btn-p', step: 21 }, { act: 'entityReturn', label: 'أعدها بملاحظات', kind: 'btn-2', needsNote: true, step: 22 }]
      : []
  }
  if (h === 'supervisor' && role === 'supervisor') return [{ act: 'submit', label: 'إرسال لمدير المنح', kind: 'btn-p', step: 12 }]
  if (a.stage === 'manager' && role === 'grants-manager') {
    return [
      { act: 'approve', label: 'اعتماد وإحالة للتنفيذي', kind: 'btn-p', step: 13 },
      { act: 'return', label: 'إعادة لمشرف المنح', kind: 'btn-2', needsNote: true, step: 14 },
    ]
  }
  if (h === 'grants-manager' && a.stage === 'returned' && role === 'grants-manager') {
    return [
      { act: 'resubmit', label: 'أعد الإرسال للمدير التنفيذي', kind: 'btn-p', step: 19 },
      { act: 'toSupervisor', label: 'أحلها لمشرف المنح للتعديل', kind: 'btn-2', needsNote: true, step: 22 },
    ]
  }
  if (a.stage === 'executive' && role === 'ceo') {
    return [
      { act: 'send', label: 'اعتماد وإرسال للجهة', kind: 'btn-p', step: 20 },
      { act: 'return', label: 'إعادة لمدير المنح', kind: 'btn-2', needsNote: true, step: 18 },
      { act: 'cancel', label: 'إلغاء الاتفاقية', kind: 'btn-d', needsNote: true, step: 18 },
    ]
  }
  /* A paper signature arrives on paper · the supervisor attaches the signed copy */
  if (h === 'entity' && a.kind === 'ورقية' && role === 'supervisor') {
    return [
      { act: 'paperSign', label: 'أرفق النسخة الموقّعة', kind: 'btn-p', needsFile: true, step: 21 },
      { act: 'entityReturn', label: 'تسجيل إعادة الجهة بملاحظات', kind: 'btn-2', needsNote: true, step: 22 },
    ]
  }
  if (h === 'ceo' && a.stage === 'entity' && role === 'ceo') {
    return [
      { act: 'finalize', label: 'اعتماد النسخة النهائية وتفعيلها', kind: 'btn-p', step: 24 },
      { act: 'finalReturn', label: 'إعادة لمشرف المنح', kind: 'btn-2', needsNote: true, step: 23 },
    ]
  }
  return []
}

/** May this seat edit the content now · the supervisor on a draft or a return to them (8.2.16) */
export const mayEdit = (a: AgreementRow, role: RoleKey, asEntity: boolean) => !asEntity && role === 'supervisor' && agrHolder(a) === 'supervisor'

/** Agreements of one project, newest first · one in force at most (8.4.25) */
export const agreementsOfProject = (projectId: string): AgreementRow[] => agreements.filter((a) => a.projectId === projectId)
export const inForceOf = (projectId: string): AgreementRow | undefined =>
  agreements.find((a) => a.projectId === projectId && agrFlowOf(a.id).inForce !== undefined && a.stage !== 'cancelled')
    ?? agreements.find((a) => a.projectId === projectId && a.stage === 'active')
