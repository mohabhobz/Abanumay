import { useSyncExternalStore } from 'react'
import { actDay, asOf } from '@/data/clock'
import type { LogEvent } from '@/data/mock/log'
import { ESC_RULES } from '@/data/shared/escRules'
import {
  TODAY, planById, planOfProject, planRows, readyToClose,
} from '@/data/mock/plans'
import { projectRows } from '@/data/mock/projects'
import { appFlowOf, planSuggested, setConfirmHook } from '@/data/approvals/store'
import { roleByKey } from '@/data/roles'
import { ROUTES } from '@/app/routes'
import { nowStamp } from '@/lib/format'
import type { PlanActivity, PlanPhase, PlanRow } from '@/types/domain'

/* Project plans (BPD-012) · the actions.

   The fixture builds the plans already in the system; this store moves them and keeps every move.
   Same model as the other procedures: an ordered list of operations kept in the browser and
   replayed at load, so a reload lands on the same state; in production each operation is a POST.
   Every operation carries its own ids, so a replay rebuilds the same records.

   Three things the fixture alone couldn't hold:
   · the plan decision · «يتطلب خطة / لا يتطلب خطة» is the grants manager's, taken with the
     approval (4.4.2 · 12.2.1), documented with its author and date, and changeable both ways with
     a reason (12.4.31): switching off cancels the plan, switching on opens one (12.4.32 · 12.4.33)
   · the opening · a project that needs a plan gets its record when its approval is confirmed,
     beside its agreement (12.2.3 · 12.4.3)
   · the amendment · an approved change applies its proposed structure, and the structure before
     it is kept with the request (12.2.22 · 12.4.23) */

/* ── The plan decision ── */

export interface PlanDecision { needs: boolean; by: string; at: string; reason?: string; source: 'approval' | 'change' | 'legacy' | 'rule' }
const DECISIONS = new Map<string, PlanDecision[]>()

/** The decision in force · the last change, else the approval's, else a plan the project already has */
export function planDecisionOf(projectId: string): PlanDecision | undefined {
  const own = DECISIONS.get(projectId)
  if (own?.length) return own[0]
  return originalDecision(projectId)
}
/** The decision taken with the approval · before any later change */
export function originalDecision(projectId: string): PlanDecision | undefined {
  const f = appFlowOf(projectId)
  const rec = f.recs.find((r) => r.needsPlan !== undefined)
  if (rec) return { needs: rec.needsPlan!, by: rec.by, at: rec.at, source: 'approval' }
  if (f.needsPlan !== undefined) return { needs: f.needsPlan, by: roleByKey('grants-manager').name, at: TODAY, source: 'approval' }
  if (planOfProject(projectId)) return { needs: true, by: roleByKey('grants-manager').name, at: planOfProject(projectId)!.openedAt, source: 'legacy' }
  return undefined
}
export const planDecisionHistory = (projectId: string): PlanDecision[] => DECISIONS.get(projectId) ?? []
/** The rule's suggestion (4.4.2) · amount or duration · the manager confirms or changes it */
export const planRuleSays = (projectId: string): boolean => {
  const p = projectRows.find((x) => x.id === projectId)
  return p ? planSuggested(p) : false
}
const isApproved = (p: { stage: string; supportStatus?: string | null; amountGranted: number }) =>
  p.amountGranted > 0 && !['دراسة المشروع', 'استكمال بيانات المشروع'].includes(p.stage) && !p.stage.startsWith('مرفوض') && p.stage !== 'مشروع معتذر عنه'

/* ── Notifications · read by the drawer ── */

export interface PlanNote { id: string; to: string; title: string; context: string; at: string; href: string }
export const PLAN_NOTES: PlanNote[] = []
const notify = (to: string[], p: PlanRow, title: string, context: string, href = ROUTES.plan(p.id)) => {
  for (const t of to) PLAN_NOTES.unshift({ id: `pln-${PLAN_NOTES.length + 1}`, to: t, title, context, at: actDay(), href })
}
const SUP = () => roleByKey('supervisor').title
const MGR = () => roleByKey('grants-manager').title

/* ── Readers ── */

const actOf = (p: PlanRow, actId: string): PlanActivity | undefined => p.phases.flatMap((ph) => ph.activities).find((a) => a.id === actId)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** «متعثر» · past its end by more than a month without acceptance, or returned twice (12.4.25) */
export const STUCK_DAYS = 30
const stuckDays = () => ESC_RULES.stuck.plan ?? STUCK_DAYS
export const isStuck = (a: PlanActivity, today = TODAY): boolean =>
  a.state !== 'accepted' && ((a.to && days(a.to, today) > stuckDays()) || (a.notes ?? []).filter((n) => n.kind === 'reject').length >= 2)
export const stuckActivities = (p: PlanRow): PlanActivity[] => p.phases.flatMap((ph) => ph.activities).filter((a) => isStuck(a))

/** The plan's execution window against the project's approved duration (12.2.4) */
export function projectWindow(projectId: string): { from?: string; to?: string; days: number } {
  const p = projectRows.find((x) => x.id === projectId)
  return { from: p?.startAt, to: p?.endAt, days: p?.durationDays ?? 0 }
}

/** Who may write the draft now · the entity on its portal, or the supervisor on its behalf (12.2.5) */
export const mayDraft = (p: PlanRow, asEntity: boolean) =>
  (p.stage === 'draft' || p.stage === 'returned') && (asEntity || p.drafter === 'supervisor')

/* ── Operations ── */

type Op = { at: string; by: string } & (
  | { op: 'decide'; projectId: string; needs: boolean; reason: string; planId: string }
  | { op: 'open'; projectId: string; planId: string; drafter: 'entity' | 'supervisor'; reason?: string }
  | { op: 'save'; planId: string; phases: PlanPhase[] }
  | { op: 'send'; planId: string; actor: 'entity' | 'supervisor' }
  | { op: 'review'; planId: string; act: 'toManager' | 'returnEntity' | 'approve' | 'managerReturn'; note: string }
  | { op: 'start'; planId: string; actId: string }
  | { op: 'evidence'; planId: string; actId: string; evId: string; kind: string; fileName: string; replace?: string }
  | { op: 'evidenceDrop'; planId: string; actId: string; evId: string }
  | { op: 'claim'; planId: string; actId: string }
  | { op: 'accept'; planId: string; actId: string }
  | { op: 'reject'; planId: string; actId: string; note: string }
  | { op: 'comment'; planId: string; actId: string; say: string; from: 'staff' | 'entity' }
  | { op: 'change'; planId: string; changeId: string; say: string; proposed?: PlanPhase[] }
  | { op: 'changeDecide'; planId: string; changeId: string; outcome: 'approve' | 'reject' | 'return'; note: string }
)

const KEY = 'ab-plan-ops'
let ops: Op[] = []
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export function usePlans(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}
const now = () => new Date().toISOString()

const touch = (p: PlanRow, stage: PlanRow['stage'], note?: string) => { p.stage = stage; p.hoursInStage = 0; p.note = note }
const logOn = (a: PlanActivity, by: string, say: string, from: 'staff' | 'entity', kind: 'edit' | 'comment' = 'edit') => {
  a.notes = [...(a.notes ?? []), { kind, by, at: nowStamp(), say, from }]
}

function openFor(projectId: string, planId: string, drafter: 'entity' | 'supervisor') {
  const has = planOfProject(projectId)
  if (has && has.stage !== 'cancelled') return has
  const pr = projectRows.find((x) => x.id === projectId)
  if (!pr) return undefined
  const p: PlanRow = {
    id: planId, projectId, projectName: pr.name, entityId: pr.entityId, entityName: pr.entityName,
    stage: 'draft', baseline: 0, phases: [], owner: pr.owner ?? 'عمر قاسم', drafter, openedAt: actDay(), hoursInStage: 0, changes: [],
  }
  /* A cancelled plan stays on record · the new one is the project's plan from now (12.4.5) */
  planRows.unshift(p)
  notify([pr.entityName], p, `افتح خطة مشروعك · ${pr.name}`, 'اكتب المراحل والأنشطة والشواهد من البوابة', `${ROUTES.planEdit(p.id)}?as=entity`)
  notify([pr.owner ?? SUP(), SUP()], p, `فُتحت خطة · ${pr.name}`, drafter === 'entity' ? 'تكتبها الجهة من البوابة' : 'يكتبها المشرف بالنيابة')
  return p
}

/* The structure an approved change proposes, keeping each existing activity's execution (state,
   evidence, notes) · only what the request changed moves */
function applyStructure(p: PlanRow, next: PlanPhase[]) {
  const was = new Map(p.phases.flatMap((ph) => ph.activities).map((a) => [a.id, a]))
  p.phases = next.map((ph) => ({
    ...structuredClone(ph),
    activities: ph.activities.map((a) => {
      const old = was.get(a.id)
      return old ? { ...structuredClone(a), state: old.state, evidence: old.evidence, notes: old.notes, doneAt: old.doneAt } : structuredClone(a)
    }),
  }))
}

function apply(o: Op) { asOf(o.at, () => applyOp(o)) }
function applyOp(o: Op) {
  switch (o.op) {
    case 'decide': {
      const list = DECISIONS.get(o.projectId) ?? []
      /* Re-audit 7 Oct · the first decision on a project that had none is the original one, not a
         later change · and it carries the day it was taken */
      const first = !list.length && !originalDecision(o.projectId)
      list.unshift({ needs: o.needs, by: o.by, at: o.at.slice(0, 10), reason: o.reason, source: first ? 'approval' : 'change' })
      DECISIONS.set(o.projectId, list)
      const p = planOfProject(o.projectId)
      if (!o.needs && p && p.stage !== 'done' && p.stage !== 'cancelled') {
        touch(p, 'cancelled', `أُلغيت لتحوّل المشروع إلى «لا يتطلب خطة» · ${o.reason}`)
        notify([p.entityName, p.owner, SUP()], p, `أُلغيت خطة ${p.projectName}`, o.reason)
      }
      if (o.needs) {
        const pr = projectRows.find((x) => x.id === o.projectId)
        if (pr && isApproved(pr)) openFor(o.projectId, o.planId, 'entity')
      }
      return
    }
    case 'open': {
      if (o.reason) {
        const list = DECISIONS.get(o.projectId) ?? []
        if (!list[0]?.needs) { list.unshift({ needs: true, by: o.by, at: o.at.slice(0, 10), reason: o.reason, source: 'change' }); DECISIONS.set(o.projectId, list) }
      }
      openFor(o.projectId, o.planId, o.drafter)
      return
    }
    case 'save': {
      const p = planById(o.planId)
      if (!p || p.baseline > 0 || (p.stage !== 'draft' && p.stage !== 'returned' && p.stage !== 'supervisor')) return
      p.phases = structuredClone(o.phases)
      return
    }
    case 'send': {
      const p = planById(o.planId)
      if (!p || (p.stage !== 'draft' && p.stage !== 'returned')) return
      touch(p, 'supervisor')
      notify([p.owner, SUP()], p, `خطة بانتظار مراجعتك · ${p.projectName}`, o.actor === 'entity' ? 'أرسلتها الجهة' : 'أرسلها المشرف بالنيابة')
      return
    }
    case 'review': {
      const p = planById(o.planId)
      if (!p) return
      if (o.act === 'toManager' && p.stage === 'supervisor') {
        touch(p, 'manager')
        notify([MGR()], p, `خطة بانتظار اعتمادك · ${p.projectName}`, 'راجعها مشرف المنح')
      } else if (o.act === 'returnEntity' && p.stage === 'supervisor') {
        touch(p, 'returned', o.note)
        notify([p.entityName], p, `أُعيدت خطتك بملاحظات · ${p.projectName}`, o.note, `${ROUTES.planEdit(p.id)}?as=entity`)
      } else if (o.act === 'managerReturn' && p.stage === 'manager') {
        /* 12.2.11 · the grants manager's return goes to the supervisor, who reviews it with the entity */
        touch(p, 'supervisor', `أعادها مدير المنح · ${o.note}`)
        notify([p.owner, SUP()], p, `أعاد مدير المنح الخطة · ${p.projectName}`, o.note)
      } else if (o.act === 'approve' && p.stage === 'manager') {
        p.baseline = p.baseline === 0 ? 1 : p.baseline
        p.baselineAt = actDay()
        touch(p, 'active')
        notify([p.entityName, p.owner], p, `اعتُمدت الخطة · ${p.projectName}`, 'ثُبّتت النسخة المرجعية وبدأ التنفيذ')
      }
      return
    }
    case 'start': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || p.stage !== 'active' || (a.state !== 'todo')) return
      a.state = 'doing'
      logOn(a, o.by, 'بدأ تنفيذ النشاط', 'entity')
      return
    }
    case 'evidence': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || a.state === 'accepted' || a.state === 'claimed') return
      const old = o.replace ? a.evidence.find((e) => e.id === o.replace) : undefined
      a.evidence = [...a.evidence.filter((e) => e.id !== o.replace), { id: o.evId, kind: o.kind, fileName: o.fileName, uploadedAt: actDay(), by: o.by }]
      logOn(a, o.by, old ? `استبدل «${o.kind}»: ${old.fileName} ← ${o.fileName}` : `رفع «${o.kind}»: ${o.fileName}`, 'entity')
      if (a.state === 'todo') a.state = 'doing'
      return
    }
    case 'evidenceDrop': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || a.state === 'accepted' || a.state === 'claimed') return
      const ev = a.evidence.find((e) => e.id === o.evId)
      if (!ev) return
      a.evidence = a.evidence.filter((e) => e.id !== o.evId)
      logOn(a, o.by, `حذف «${ev.kind}»: ${ev.fileName}`, 'entity')
      return
    }
    case 'claim': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || p.stage !== 'active' || a.state === 'accepted' || a.state === 'claimed') return
      if (a.needs.some((n) => !a.evidence.some((e) => e.kind === n))) return
      a.state = 'claimed'
      /* 12.4.15 · the supervisor learns there's an activity to review */
      notify([p.owner, SUP()], p, `نشاط بانتظار قبولك · ${a.name}`, p.projectName)
      return
    }
    case 'accept': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || a.state !== 'claimed') return
      a.state = 'accepted'
      a.doneAt = actDay()
      if (readyToClose(p)) {
        p.stage = 'done'
        notify([p.entityName, p.owner, MGR()], p, `اكتملت خطة ${p.projectName}`, 'المشروع مؤهَّل لإجراءات الإغلاق')
      }
      return
    }
    case 'reject': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!p || !a || a.state !== 'claimed') return
      a.state = 'rejected'
      a.notes = [...(a.notes ?? []), { kind: 'reject', by: o.by, at: nowStamp(), say: o.note, from: 'staff' }]
      notify([p.entityName], p, `أُعيد نشاط بملاحظة · ${a.name}`, o.note, `${ROUTES.plan(p.id)}?as=entity`)
      return
    }
    case 'comment': {
      const p = planById(o.planId); const a = p && actOf(p, o.actId)
      if (!a) return
      a.notes = [...(a.notes ?? []), { kind: 'comment', by: o.by, at: nowStamp(), say: o.say, from: o.from }]
      return
    }
    case 'change': {
      const p = planById(o.planId)
      if (!p || p.baseline === 0) return
      const was = p.changes.find((c) => c.id === o.changeId)
      if (was) {
        if (was.state !== 'returned') return
        Object.assign(was, { say: o.say, proposed: o.proposed ? structuredClone(o.proposed) : undefined, state: 'waiting', at: actDay(), by: o.by })
      } else {
        p.changes = [...p.changes, { id: o.changeId, at: actDay(), by: o.by, say: o.say, state: 'waiting', proposed: o.proposed ? structuredClone(o.proposed) : undefined }]
      }
      notify([MGR()], p, `طلب تعديل جوهري على خطة · ${p.projectName}`, o.say)
      return
    }
    case 'changeDecide': {
      const p = planById(o.planId)
      const c = p?.changes.find((x) => x.id === o.changeId)
      if (!p || !c || c.state !== 'waiting') return
      c.note = o.note
      c.decidedAt = actDay()
      c.decidedBy = o.by
      if (o.outcome === 'approve') {
        c.state = 'approved'
        c.before = structuredClone(p.phases)
        if (c.proposed) applyStructure(p, c.proposed)
        p.baseline += 1
        p.baselineAt = actDay()
      } else c.state = o.outcome === 'reject' ? 'rejected' : 'returned'
      notify([p.entityName, p.owner], p, `قرار طلب التعديل · ${p.projectName}`, `${c.state === 'approved' ? 'اعتُمد' : c.state === 'rejected' ? 'رُفض' : 'أُعيد للاستكمال'} · ${o.note}`)
      return
    }
  }
}

/* ── History · cross «سجل التدقيق» · every operation on a plan, who and when, in order (12.4.30) ── */

export interface PlanLog { planId: string; at: string; by: string; what: string; note?: string }
export const PLAN_LOG: PlanLog[] = []
const REVIEW_SAY = { toManager: 'رفع الخطة لمدير المنح', returnEntity: 'إعادة الخطة للجهة', approve: 'اعتماد الخطة وتثبيت النسخة المرجعية', managerReturn: 'إعادة مدير المنح الخطة للمشرف' } as const
function describe(o: Op): { what: string; note?: string } {
  const act = (id: string) => { const p = planById((o as { planId: string }).planId); return p ? actOf(p, id)?.name ?? id : id }
  switch (o.op) {
    case 'decide': return { what: o.needs ? 'قرار «يتطلب خطة»' : 'قرار «لا يتطلب خطة»', note: o.reason }
    case 'open': return { what: o.drafter === 'entity' ? 'فتح الخطة لتكتبها الجهة' : 'فتح الخطة ليكتبها المشرف', note: o.reason }
    case 'save': return { what: 'حفظ مراحل الخطة وأنشطتها', note: `${o.phases.length} مراحل · ${o.phases.reduce((n, ph) => n + ph.activities.length, 0)} نشاط` }
    case 'send': return { what: o.actor === 'entity' ? 'إرسال الجهة الخطة للمراجعة' : 'إرسال المشرف الخطة بالنيابة' }
    case 'review': return { what: REVIEW_SAY[o.act], note: o.note || undefined }
    case 'start': return { what: `بدء نشاط · ${act(o.actId)}` }
    case 'evidence': return { what: `رفع شاهد «${o.kind}» · ${act(o.actId)}`, note: o.fileName }
    case 'evidenceDrop': return { what: `حذف شاهد · ${act(o.actId)}` }
    case 'claim': return { what: `تقديم نشاط للقبول · ${act(o.actId)}` }
    case 'accept': return { what: `قبول نشاط · ${act(o.actId)}` }
    case 'reject': return { what: `إعادة نشاط · ${act(o.actId)}`, note: o.note }
    case 'comment': return { what: `تعليق على نشاط · ${act(o.actId)}`, note: o.say }
    case 'change': return { what: 'طلب تعديل جوهري', note: o.say }
    case 'changeDecide': return { what: o.outcome === 'approve' ? 'اعتماد طلب التعديل' : o.outcome === 'reject' ? 'رفض طلب التعديل' : 'إعادة طلب التعديل', note: o.note }
  }
}
function logOp(o: Op) {
  const planId = o.op === 'decide' || o.op === 'open' ? planOfProject(o.projectId)?.id : o.planId
  /* Re-audit 7 Oct · a «no plan needed» decision on a project without a plan is recorded too · on
     the project, so the audit log and the project's log both carry it */
  if (!planId && o.op === 'decide') {
    PLAN_LOG.unshift({ planId: `project:${o.projectId}`, at: o.at, by: o.by, ...describe(o) })
    return
  }
  if (!planId) return
  PLAN_LOG.unshift({ planId, at: o.at, by: o.by, ...describe(o) })
}
export const planLogOf = (planId: string): PlanLog[] => PLAN_LOG.filter((x) => x.planId === planId)
/** Re-audit 7 Oct · the plan decisions taken after the approval, on the project's own log */
export const planDecisionEvents = (projectId: string): LogEvent[] =>
  (DECISIONS.get(projectId) ?? []).map((d, i) => ({
    id: `pd-${projectId}-${i}`, action: d.needs ? 'قرار: يتطلب خطة' : 'قرار: لا يتطلب خطة', dept: 'خطط المشاريع', by: d.by, actor: 'staff',
    at: d.at, time: '', days: 0, hours: 0, limit: 0, tone: 'mute',
    fields: [{ k: 'القرار', v: d.needs ? 'يتطلب خطة' : 'لا يتطلب خطة', strong: true }, ...(d.reason ? [{ k: 'السبب', v: d.reason }] : [])],
  }))

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · state holds for this visit */ } }
const run = (o: Op) => { ops.push(o); apply(o); logOp(o); save(); emit() }

/* ── Seed · projects approved with «يتطلب خطة» and no plan yet get their record ── */

function seed() {
  for (const pr of projectRows) {
    if (!isApproved(pr) || planOfProject(pr.id)) continue
    const f = appFlowOf(pr.id)
    if (f.decided && f.needsPlan) openFor(pr.id, `PL-P${pr.id}`, 'entity')
  }
}
function hydrate() {
  seed()
  try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
  for (const o of ops) { apply(o); logOp(o) }
}
hydrate()

/* Confirmed in this session · open the plan beside the agreement (12.2.3) */
setConfirmHook((projectId, by) => {
  if (appFlowOf(projectId).needsPlan && !planOfProject(projectId)) run({ op: 'open', projectId, planId: `PL-P${projectId}`, drafter: 'entity', by, at: now() })
})

/* ── Actions ── */

const id6 = () => Math.random().toString(36).slice(2, 8)

export function changePlanDecision(projectId: string, needs: boolean, reason: string, by: string): string[] {
  if (!reason.trim()) return ['سبب تعديل القرار إلزامي (12.4.31)']
  const cur = planDecisionOf(projectId)
  if (cur && cur.needs === needs) return ['القرار الحالي هو نفسه']
  run({ op: 'decide', projectId, needs, reason: reason.trim(), planId: `PL-${1030 + planRows.length}`, by, at: now() })
  return []
}
export function openPlanFor(projectId: string, drafter: 'entity' | 'supervisor', reason: string, by: string): string {
  const has = planOfProject(projectId)
  if (has && has.stage !== 'cancelled') return has.id
  const planId = `PL-${1030 + planRows.length}`
  run({ op: 'open', projectId, planId, drafter, reason: reason.trim() || undefined, by, at: now() })
  return planOfProject(projectId)?.id ?? planId
}
export const savePlanPhases = (planId: string, phases: PlanPhase[], by: string) => run({ op: 'save', planId, phases, by, at: now() })
export const sendPlanFor = (planId: string, actor: 'entity' | 'supervisor', by: string) => run({ op: 'send', planId, actor, by, at: now() })
export function reviewPlan(planId: string, act: 'toManager' | 'returnEntity' | 'approve' | 'managerReturn', note: string, by: string): string[] {
  /* Re-audit 7 Oct · a return carries its note in the store too, not only in the dock */
  if ((act === 'returnEntity' || act === 'managerReturn') && !note.trim()) return ['ملاحظة الإعادة إلزامية']
  run({ op: 'review', planId, act, note, by, at: now() })
  return []
}
export const startActivity = (planId: string, actId: string, by: string) => run({ op: 'start', planId, actId, by, at: now() })
export const uploadEvidence = (planId: string, actId: string, kind: string, fileName: string, by: string, replace?: string) =>
  run({ op: 'evidence', planId, actId, evId: `ev-${id6()}`, kind, fileName, replace, by, at: now() })
export const dropEvidence = (planId: string, actId: string, evId: string, by: string) => run({ op: 'evidenceDrop', planId, actId, evId, by, at: now() })
export const claimActivityBy = (planId: string, actId: string, by: string) => run({ op: 'claim', planId, actId, by, at: now() })
export const acceptActivityBy = (planId: string, actId: string, by: string) => run({ op: 'accept', planId, actId, by, at: now() })
export const rejectActivityBy = (planId: string, actId: string, note: string, by: string) => run({ op: 'reject', planId, actId, note, by, at: now() })
export const commentOn = (planId: string, actId: string, say: string, by: string, from: 'staff' | 'entity') => run({ op: 'comment', planId, actId, say, from, by, at: now() })
export function requestChange(planId: string, say: string, proposed: PlanPhase[] | undefined, by: string, changeId?: string): string[] {
  if (!say.trim()) return ['اكتب التعديل المطلوب وسببه']
  const p = planById(planId)
  if (!changeId && p?.changes.some((c) => c.state === 'waiting')) return ['يوجد طلب بانتظار مدير المنح بالفعل']
  run({ op: 'change', planId, changeId: changeId ?? `ch-${id6()}`, say: say.trim(), proposed, by, at: now() })
  return []
}
export function decideChangeBy(planId: string, changeId: string, outcome: 'approve' | 'reject' | 'return', note: string, by: string): string[] {
  if (!note.trim()) return ['اكتب ملاحظة القرار (12.4.22)']
  run({ op: 'changeDecide', planId, changeId, outcome, note: note.trim(), by, at: now() })
  return []
}
export const resetPlans = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } location.reload() }
