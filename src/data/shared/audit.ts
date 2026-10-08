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
import { UPD_ROWS, overlayOf } from '@/data/entities/store'
import { flowEvents } from '@/data/intake/flow'
import { approvalEvents } from '@/data/approvals/store'
import { PLAN_LOG } from '@/data/plans/store'
import { PORTFOLIOS, allEhOps } from '@/data/partners/store'
import { accountEvents } from '@/data/entities/auth'
import { ESC_RULES } from './escRules'
import { NOTIFY_RULES } from './notify'
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
      id: `rg-${r.id}-${i}`, module: 'entities', ref: `طلب تسجيل · ${r.name}`, href: ROUTES.entityRequest(r.id), action: ev.action, by: ev.by, at: ev.at.replace('T', ' ').slice(0, 16), note: ev.note, fields: ev.fields ?? [],
    }))
  }
  for (const u of UPD_ROWS) {
    u.events.forEach((ev, i) => out.push({
      id: `up-${u.id}-${i}`, module: 'entities', ref: `تحديث بيانات · ${u.entityName}`, href: ROUTES.entityUpdateReview(u.id), action: ev.action, by: ev.by, at: ev.at.replace('T', ' ').slice(0, 16), note: ev.note, fields: ev.fields ?? [],
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

export function auditRows(): AuditRow[] {
  const perm = readJson<PermState>(PERM_KEY, PERM_INITIAL)
  return [
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
      return { id: `pl-${e.planId}-${PLAN_LOG.length - i}`, module: 'plans', ref: p ? `خطة ${p.projectName}` : pr ? `مشروع ${pr.name}` : e.planId, href: pid ? ROUTES.project(pid) : ROUTES.plan(e.planId), action: e.what, by: e.by, at: e.at.replace('T', ' ').slice(0, 16), note: e.note, fields: [] }
    }),
    ...PORTFOLIOS.flatMap((pf) => pf.log.map((e, i): AuditRow => ({
      id: `pf-${pf.id}-${i}`, module: 'partners', ref: pf.name, href: ROUTES.portfolio(pf.id), action: e.what, by: e.by, at: e.at, fields: [],
    }))),
    /* Re-audit 7 Oct · the Ehsan projects' operations and the portal account events join the log */
    ...allEhOps().flatMap(({ projectId, ops }) => ops.map((e, i): AuditRow => ({
      id: `eh-${projectId}-${i}`, module: 'partners', ref: projectRows.find((p) => p.id === projectId)?.name ?? projectId, href: ROUTES.project(projectId), action: e.kind, by: e.by, at: e.at, note: e.note, fields: [],
    }))),
    ...accountEvents().map((e, i): AuditRow => ({
      id: `acct-${i}`, module: 'entities', ref: e.account, href: ROUTES.entityRequests, action: e.created ? 'إنشاء حساب في بوابة الجهات' : 'تعيين كلمة مرور جديدة للحساب', by: e.account, at: e.at.replace('T', ' ').slice(0, 16), fields: [],
    })),
    ...perm.log.map((e): AuditRow => ({ id: `pm-${e.id}`, module: 'settings', ref: e.target, href: `${ROUTES.permissions}?tab=log`, action: e.change, by: e.by, at: e.at, fields: [] })),
    ...(ESC_RULES.savedAt ? [{ id: 'esc-saved', module: 'settings' as const, ref: 'آلية التصعيد', href: ROUTES.escalationSettings, action: 'تعديل آلية التصعيد', by: ESC_RULES.savedBy ?? '', at: ESC_RULES.savedAt, fields: [] }] : []),
    ...(NOTIFY_RULES.savedAt ? [{ id: 'ntf-saved', module: 'settings' as const, ref: 'قنوات الإشعار', href: `${ROUTES.notifyHub}?tab=channels`, action: 'تعديل قنوات الإشعار', by: NOTIFY_RULES.savedBy ?? '', at: NOTIFY_RULES.savedAt, fields: [] }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))
}

export const auditDay = d10
