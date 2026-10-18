import { ROUTES } from '@/app/routes'
import { readJson } from '@/lib/config'
import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { payRequests } from '@/data/mock/disbursements'
import { closeRows } from '@/data/mock/closing'
import { planRows } from '@/data/mock/plans'
import { regRows } from '@/data/mock/registration'
import { entityRows } from '@/data/mock/entities'
import { allBudgets } from '@/data/mock/chain'
import { PERM_INITIAL, PERM_KEY, type PermState } from '@/data/mock/permissions'
import { BUDGET_REQS, REQ_KIND_SAY, docOf, eventsOf, linkHistory, LINK_CHANGE_SAY, movesOf, MOVE_SAY } from '@/data/budget/store'
import { BATCHES, BATCH_SAY, RELINKS, UPD_ROWS, overlayOf } from '@/data/entities/store'
import { flowEvents } from '@/data/intake/flow'
import { approvalEvents } from '@/data/approvals/store'
import { PLAN_LOG } from '@/data/plans/store'
import { PORTFOLIOS, allEhOps } from '@/data/partners/store'
import { accountEvents } from '@/data/entities/auth'
import { CASES } from '@/data/closing/store'
import { BEHALF_LOG, behalfAt, behalfOnDay } from '@/data/behalf'
import { ROLES, STAFF_DIRECTORY, roleByKey } from '@/data/roles'
import { ESC_RULES } from './escRules'
import { NOTIFY_RULES } from './notify'
import { SETTINGS_LOG } from './settingsLog'
import { nf } from '@/lib/format'

/* The audit log · cross «سجل التدقيق والسجل التاريخي».

   Every module keeps its own history where the work happens (a project's timeline, an agreement's
   log, a payment's trail, a budget's events and ledger, an entity's file). What the document asks
   for on top is one place that reads them all, append-only, with who, when, the value before and
   after, and the reason · and the budget, the registration requests and the plans, which had
   none or only notes. This file is that reader: it never writes, so a row can't be edited or
   deleted from here, and it reads the same records the module screens read. */

export type AuditModule = 'budget' | 'entities' | 'projects' | 'agreements' | 'payments' | 'closing' | 'plans' | 'partners' | 'settings'
export const MODULE_SAY: Record<AuditModule, string> = {
  budget: 'الميزانية', entities: 'الجهات والتسجيل', projects: 'المشاريع والاعتماد', agreements: 'الاتفاقيات', payments: 'الصرف',
  closing: 'الإغلاق', plans: 'الخطط', partners: 'الشركاء والمحافظ', settings: 'الإعدادات والصلاحيات',
}

export interface AuditField { k: string; v: string }
export interface AuditRow {
  id: string
  module: AuditModule
  /** The record the action was on · its name and where it opens */
  ref: string
  href: string
  action: string
  by: string
  /** ISO date, with the time when the record keeps it */
  at: string
  note?: string
  fields: AuditField[]
  /** Batch 8 · 0.def.18 · the role the action was taken in · and, for the admin's takeovers, «on behalf of» (0.def.16) */
  role?: string
  behalf?: { role: string; reason: string }
}

const d10 = (s: string) => s.slice(0, 10)
const fmt = (n: number) => nf.format(Math.round(n))

function budgetRows(): AuditRow[] {
  const out: AuditRow[] = []
  for (const d of allBudgets) {
    const name = d.name ?? `ميزانية ${d.yearId}`
    eventsOf(d.id).forEach((e, i) => out.push({ id: `bd-${d.id}-${i}`, module: 'budget', ref: name, href: ROUTES.budgetDoc(d.id), action: e.text, by: e.by, at: e.at, note: e.note, fields: [] }))
    movesOf(d.id).forEach((m) => {
      const line = docOf(d.id)?.nodes.find((n) => n.id === m.nodeId)?.label ?? m.nodeId
      out.push({
        id: `mv-${m.id}`, module: 'budget', ref: `${name} · ${line}`, href: ROUTES.budgetDoc(d.id), action: MOVE_SAY[m.kind], by: m.by, at: m.at, note: m.note,
        fields: [{ k: 'المبلغ', v: fmt(m.amount) }, { k: 'القيمة السابقة', v: fmt(m.before) }, { k: 'القيمة الجديدة', v: fmt(m.after) }, ...(m.ref ? [{ k: 'المرجع', v: m.ref }] : [])],
      })
    })
  }
  for (const r of BUDGET_REQS) {
    r.events.forEach((e, i) => out.push({
      id: `br-${r.id}-${i}`, module: 'budget', ref: `${REQ_KIND_SAY[r.kind]} · ${r.id}`, href: ROUTES.budgetOp(r.id), action: e.text, by: e.by, at: e.at,
      note: e.note ?? (i === 0 ? r.reason : undefined),
      fields: e.tone === 'ok' && r.result ? r.result.flatMap((x) => [{ k: `${x.label} · قبل`, v: fmt(x.before) }, { k: `${x.label} · بعد`, v: fmt(x.after) }]) : [{ k: 'المبلغ', v: fmt(r.amount) }],
    }))
  }
  for (const p of projectRows) {
    linkHistory(p.id).forEach((c, i) => out.push({
      id: `lk-${p.id}-${i}`, module: 'budget', ref: `ربط ${p.name}`, href: ROUTES.project(p.id), action: LINK_CHANGE_SAY[c.kind], by: c.by, at: c.at, note: c.reason,
      fields: [...(c.amount ? [{ k: 'المبلغ', v: fmt(c.amount) }] : []), { k: 'الوصف', v: c.text }],
    }))
  }
  return out
}

function entityRowsLog(): AuditRow[] {
  const out: AuditRow[] = []
  for (const e of entityRows) {
    overlayOf(e.id).events.forEach((ev) => out.push({
      id: `en-${e.id}-${ev.id}`, module: 'entities', ref: e.name, href: ROUTES.entity(e.id, 'log'), action: ev.action, by: ev.by, at: `${ev.at}${ev.time ? ` ${ev.time}` : ''}`, note: ev.note, fields: ev.fields ?? [],
    }))
  }
  for (const r of regRows) {
    (r.events ?? []).forEach((ev, i) => out.push({
      id: `rg-${r.id}-${i}`, module: 'entities', ref: `طلب تسجيل · ${r.name}`, href: ROUTES.entityRequest(r.id), action: ev.action, by: ev.by, at: ev.at, note: ev.note, fields: ev.fields ?? [],
    }))
  }
  /* v3 · 2.4.11 · a project moved to another entity · before, after, when, who */
  for (const r of RELINKS) {
    out.push({
      id: `rl-${r.id}`, module: 'projects', ref: r.projectName, href: ROUTES.project(r.projectId), action: 'تعديل الجهة المستفيدة المرتبطة بالمشروع', by: r.by,
      at: r.at, note: r.reason,
      fields: [{ k: 'الجهة السابقة', v: r.from.name }, { k: 'الجهة الجديدة', v: r.to.name },
        { k: 'السجلات المحدَّثة', v: `اتفاقيات ${r.touched.agreements} · طلبات صرف ${r.touched.payments} · خطط ${r.touched.plans} · إغلاق ${r.touched.closings}` }],
    })
  }
  /* 14 Oct · a batch on a selection · one master line, each entity's own line names it */
  for (const b of BATCHES) {
    out.push({
      id: `bt-${b.id}`, module: 'entities', ref: `دفعة ${b.id}`, href: `${ROUTES.audit}?q=${b.id}`, action: `${BATCH_SAY[b.act]} · إجراء جماعي`, by: b.by,
      at: b.at, note: b.note,
      fields: [{ k: 'الدفعة', v: b.id }, { k: 'تم', v: String(b.ok.length) }, ...b.skipped.map((x) => ({ k: `مستثناة · ${x.reason}`, v: String(x.ids.length) })), ...(b.failed.length ? [{ k: 'تعذّر', v: String(b.failed.length) }] : [])],
    })
  }
  for (const u of UPD_ROWS) {
    u.events.forEach((ev, i) => out.push({
      id: `up-${u.id}-${i}`, module: 'entities', ref: `تحديث بيانات · ${u.entityName}`, href: ROUTES.entityUpdateReview(u.id), action: ev.action, by: ev.by, at: ev.at, note: ev.note, fields: ev.fields ?? [],
    }))
  }
  return out
}

function projectLog(): AuditRow[] {
  const out: AuditRow[] = []
  for (const p of projectRows) {
    for (const ev of [...flowEvents(p.id), ...approvalEvents(p.id)]) {
      out.push({
        id: `pj-${ev.id}`, module: 'projects', ref: p.name, href: ROUTES.projectTab(p.id, 'log'), action: ev.action, by: ev.by, at: `${ev.at} ${ev.time}`,
        fields: ev.fields.map((f) => ({ k: f.k, v: f.v })),
      })
    }
  }
  return out
}

/* Batch 8 · 0.def.18 · the role is a column of the log · a staff member's seat from the directory,
   an entity's name as the beneficiary, the system as itself */
const ENTITY_TITLE = 'الجهة المستفيدة'
function roleOf(by: string): string {
  const a = STAFF_DIRECTORY.find((x) => x.name === by)
  if (a) return roleByKey(a.role).title
  const seat = ROLES.find((r) => r.title === by || r.name === by)
  if (seat) return seat.title
  if (by === 'النظام' || by.startsWith('النظام')) return 'النظام'
  if (entityRows.some((e) => e.name === by) || regRows.some((r) => r.name === by)) return ENTITY_TITLE
  return '—'
}
const ADMIN_NAMES = () => new Set(STAFF_DIRECTORY.filter((a) => a.role === 'admin').map((a) => a.name))
function stamped(r: AuditRow): AuditRow {
  if (r.id.startsWith('bh-')) return r
  /* A date-only row places nothing inside a span · its own «الصفة» says the seat it was taken in, and
     the admin's name on another seat's action is a takeover that day (Verifier · 17 Oct) */
  const own = r.fields.find((f) => f.k === 'الصفة')?.v
  const b = behalfAt(r.by, r.at) ?? (own && ADMIN_NAMES().has(r.by) && own !== roleByKey('admin').title ? behalfOnDay(r.by, r.at.slice(0, 10), own) : undefined)
  if (b) {
    const seat = roleByKey(b.role).title
    return { ...r, role: `${roleByKey('admin').title} · نيابةً عن ${seat}`, behalf: { role: seat, reason: b.reason }, fields: [...r.fields, { k: 'الدور الأصلي', v: seat }, { k: 'سبب التولّي', v: b.reason }] }
  }
  return { ...r, role: r.role ?? r.fields.find((f) => f.k === 'الصفة')?.v ?? roleOf(r.by) }
}

/* Batch 8 · 10.4.15 · the closing's evaluation cycle and the cases (stop · cut · raise · recovery) join the log */
function closingExtra(): AuditRow[] {
  return [
    ...closeRows.flatMap((c) => (c.evalAudit ?? []).map((e, i): AuditRow => ({
      id: `ce-${c.id}-${i}`, module: 'closing', ref: `تقييم · ${c.projectName}`, href: ROUTES.closing(c.id), action: e.what, by: e.by, at: e.at, fields: [],
    }))),
    ...CASES.flatMap((k) => k.log.map((e, i): AuditRow => ({
      id: `cs-${k.id}-${i}`, module: 'closing', ref: `${k.id} · ${k.projectName}`, href: ROUTES.distress(k.id), action: e.what, by: e.by, at: e.at,
      fields: [...(k.newAmount !== undefined && i === 0 ? [{ k: 'القيمة السابقة', v: fmt(k.granted) }, { k: 'القيمة الجديدة', v: fmt(k.newAmount) }] : [])],
    }))),
  ]
}

/* Re-audit 17 Oct · one clock in the log · rows stamped as ISO (UTC: takeovers, settings, accounts,
   plan decisions) were cut to «HH:MM» in UTC while the project rows carry local time, so a takeover
   read 11:51 and the action inside it 14:52 in the same minute, and «T» and « » sorted apart.
   Every ISO stamp is read in the viewer's zone as «YYYY-MM-DD HH:MM»; a local or date-only one stays. */
const pad = (n: number) => String(n).padStart(2, '0')
export function auditStamp(at: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(at)) return at
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at.replace('T', ' ').slice(0, 16)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function auditRows(): AuditRow[] {
  return auditRaw().map(stamped).map((r) => ({ ...r, at: auditStamp(r.at) })).sort((a, b) => b.at.localeCompare(a.at))
}

function auditRaw(): AuditRow[] {
  const perm = readJson<PermState>(PERM_KEY, PERM_INITIAL)
  return [
    /* The takeovers themselves · who, which role, why, from and until (0.def.16) */
    ...BEHALF_LOG.flatMap((b): AuditRow[] => [
      { id: `bh-${b.id}-s`, module: 'settings', ref: `تولّي · ${roleByKey(b.role).title}`, href: ROUTES.escalation, action: 'بدء تولّي إجراء نيابةً عن دور آخر', by: b.by, at: b.from, note: b.reason, fields: [{ k: 'الدور الأصلي', v: roleByKey(b.role).title }], role: roleByKey('admin').title },
      ...(b.to ? [{ id: `bh-${b.id}-e`, module: 'settings' as const, ref: `تولّي · ${roleByKey(b.role).title}`, href: ROUTES.escalation, action: 'إنهاء التولّي', by: b.by, at: b.to, fields: [{ k: 'الدور الأصلي', v: roleByKey(b.role).title }], role: roleByKey('admin').title }] : []),
    ]),
    ...closingExtra(),
    ...budgetRows(),
    ...entityRowsLog(),
    ...projectLog(),
    ...agreements.flatMap((a) => a.log.map((e, i): AuditRow => ({
      id: `ag-${a.id}-${i}`, module: 'agreements', ref: `${a.id} · ${a.projectName}`, href: ROUTES.agreement(a.id), action: e.what, by: e.who, at: e.at, note: e.note,
      fields: [{ k: 'الصفة', v: e.role }, ...(e.notified ? [{ k: 'الإشعار', v: e.notified }] : [])],
    }))),
    ...payRequests.flatMap((r) => r.log.map((e, i): AuditRow => ({
      id: `py-${r.id}-${i}`, module: 'payments', ref: `الدفعة ${r.no} · ${r.projectName}`, href: ROUTES.payment(r.id), action: e.what, by: e.who, at: e.at, note: e.note,
      fields: [{ k: 'الصفة', v: e.role }, ...(e.notified ? [{ k: 'الإشعار', v: e.notified }] : [])],
    }))),
    ...closeRows.flatMap((c) => c.audit.map((e, i): AuditRow => ({
      id: `cl-${c.id}-${i}`, module: 'closing', ref: c.projectName, href: ROUTES.closing(c.id), action: e.what, by: e.by, at: e.at, fields: [],
    }))),
    ...PLAN_LOG.map((e, i): AuditRow => {
      const p = planRows.find((x) => x.id === e.planId)
      /* A plan decision on a project without a plan is recorded on the project */
      const pid = e.planId.startsWith('project:') ? e.planId.slice(8) : ''
      const pr = pid ? projectRows.find((x) => x.id === pid) : undefined
      return { id: `pl-${e.planId}-${PLAN_LOG.length - i}`, module: 'plans', ref: p ? `خطة ${p.projectName}` : pr ? `مشروع ${pr.name}` : e.planId, href: pid ? ROUTES.project(pid) : ROUTES.plan(e.planId), action: e.what, by: e.by, at: e.at, note: e.note, fields: [] }
    }),
    ...PORTFOLIOS.flatMap((pf) => pf.log.map((e, i): AuditRow => ({
      id: `pf-${pf.id}-${i}`, module: 'partners', ref: pf.name, href: ROUTES.portfolio(pf.id), action: e.what, by: e.by, at: e.at, fields: [],
    }))),
    /* Re-audit 7 Oct · the Ehsan projects' operations and the portal account events join the log */
    ...allEhOps().flatMap(({ projectId, ops }) => ops.map((e, i): AuditRow => ({
      id: `eh-${projectId}-${i}`, module: 'partners', ref: projectRows.find((p) => p.id === projectId)?.name ?? projectId, href: ROUTES.project(projectId), action: e.kind, by: e.by, at: e.at, note: e.note, fields: [],
    }))),
    ...accountEvents().map((e, i): AuditRow => ({
      id: `acct-${i}`, module: 'entities', ref: e.account, href: e.id.startsWith('e-') ? ROUTES.entity(e.id.slice(2)) : ROUTES.entityRequests, action: e.created ? 'إنشاء حساب في بوابة الجهات' : 'تعيين كلمة مرور جديدة للحساب', by: e.account, at: e.at, fields: [],
    })),
    ...perm.log.map((e): AuditRow => ({ id: `pm-${e.id}`, module: 'settings', ref: e.target, href: `${ROUTES.permissions}?tab=log`, action: e.change, by: e.by, at: e.at, fields: [] })),
    /* Re-audit 7 Oct · every save of the rules, with each value before and after · it used to be one
       line per page, overwritten by the next save. A save from before the history keeps its line */
    ...SETTINGS_LOG.map((e): AuditRow => ({
      id: e.id, module: 'settings', ref: e.ref, href: e.href, action: `تعديل ${e.ref}`, by: e.by, at: e.at,
      fields: e.changes.map((c) => ({ k: c.k, v: `${c.from} ← ${c.to}` })),
    })),
    ...(ESC_RULES.savedAt && !SETTINGS_LOG.some((e) => e.ref === 'آلية التصعيد') ? [{ id: 'esc-saved', module: 'settings' as const, ref: 'آلية التصعيد', href: ROUTES.escalationSettings, action: 'تعديل آلية التصعيد', by: ESC_RULES.savedBy ?? '', at: ESC_RULES.savedAt, fields: [] }] : []),
    ...(NOTIFY_RULES.savedAt && !SETTINGS_LOG.some((e) => e.ref === 'قنوات الإشعار') ? [{ id: 'ntf-saved', module: 'settings' as const, ref: 'قنوات الإشعار', href: `${ROUTES.notifyHub}?tab=channels`, action: 'تعديل قنوات الإشعار', by: NOTIFY_RULES.savedBy ?? '', at: NOTIFY_RULES.savedAt, fields: [] }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))
}

export const auditDay = d10
