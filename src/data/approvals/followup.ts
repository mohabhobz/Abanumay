/* Following a session's decisions through (10 Oct) · the committee and board decide, then someone has
   to see each decision carried out (doc 7.1.output-4 · 6.1.output-4). A decision's follow-up is read
   from what happened after it, not typed: an approval follows its conditions, its agreement and the
   project's execution · a referral follows the board session that took it · a return follows the seat
   it went back to · a rejection follows the entity's notice and the released hold. */

import { ROUTES } from '@/app/routes'
import { HOLDER_LABEL } from '@/data/holders'
import { projectRows } from '@/data/mock/projects'
import { agreementForProject, agrStageLabel } from '@/data/mock/agreements'
import { hasFunding } from '@/data/budget/store'
import { SESSIONS, appFlowOf, type Session, type SessionItem } from './store'

export type FollowState = 'done' | 'moving' | 'waiting'
export interface FollowUp {
  state: FollowState
  /** Where the decision stands now, in a sentence */
  say: string
  /** The next thing that carries it out, when one is left */
  next?: string
  href?: string
}

export const FOLLOW_SAY: Record<FollowState, string> = { done: 'نُفّذ', moving: 'قيد التنفيذ', waiting: 'لم يبدأ' }
export const FOLLOW_TONE: Record<FollowState, 'ok' | 'teal' | 'warn'> = { done: 'ok', moving: 'teal', waiting: 'warn' }

export function followUp(s: Session, it: SessionItem): FollowUp | undefined {
  if (!it.outcome) return undefined
  const p = projectRows.find((x) => x.id === it.projectId)
  if (!p) return undefined
  if (it.outcome === 'approve') {
    const open = appFlowOf(p.id).conditions.filter((c) => !c.met)
    const a = agreementForProject(p.id)
    if (p.statusGroup === 'مكتمل') return { state: 'done', say: 'اعتُمد ونُفّذ · المشروع مكتمل', href: ROUTES.project(p.id) }
    if (a?.stage === 'active') {
      return open.length
        ? { state: 'moving', say: 'الاتفاقية سارية · المشروع في التنفيذ', next: `شروط القرار المفتوحة: ${open.map((c) => c.text).join('، ')}`, href: ROUTES.project(p.id) }
        : { state: 'done', say: 'الاتفاقية سارية والشروط مستوفاة · المشروع في التنفيذ', href: ROUTES.agreement(a.id) }
    }
    if (a) return { state: 'moving', say: `الاتفاقية: ${agrStageLabel(a.stage)}`, next: open.length ? `وشروط مفتوحة: ${open.length}` : 'التوقيع والسريان', href: ROUTES.agreement(a.id) }
    return { state: 'waiting', say: 'لم تُفتح الاتفاقية بعد', next: 'يفتح مشرف المنح الاتفاقية من صفحة المشروع', href: ROUTES.project(p.id) }
  }
  if (it.outcome === 'refer') {
    const b = SESSIONS.find((x) => x.body === 'board' && x.id !== s.id && x.items.some((y) => y.projectId === p.id))
    const bi = b?.items.find((y) => y.projectId === p.id)
    if (b && bi?.outcome) return { state: 'done', say: `قرّر مجلس الأمناء في «${b.title}»`, href: ROUTES.approvalSession(b.id) }
    if (b) return { state: 'moving', say: `مدرج في «${b.title}»`, next: 'قرار المجلس', href: ROUTES.approvalSession(b.id) }
    return { state: 'waiting', say: 'بانتظار إدراجه في جلسة لمجلس الأمناء', next: 'يُدرج من قائمة المحال إلى المجلس', href: ROUTES.board }
  }
  if (it.outcome === 'return') {
    const at = it.target ? HOLDER_LABEL[it.target] : 'المحطة السابقة'
    const back = (p.holder ?? 'supervisor') !== it.target
    return back
      ? { state: 'done', say: `عُولج عند ${at} وتحرّك منها`, href: ROUTES.project(p.id) }
      : { state: 'moving', say: `عند ${at} للاستكمال`, next: 'معالجة ملاحظات الجلسة وإعادة الرفع', href: ROUTES.project(p.id) }
  }
  /* reject · the entity is told and the hold released by the decision itself */
  return hasFunding(p.id)
    ? { state: 'moving', say: 'رُفض · الحجز لم يُفرج عنه بعد', next: 'فكّ الحجز من الميزانية', href: ROUTES.project(p.id) }
    : { state: 'done', say: 'رُفض · أُبلغت الجهة وأُفرج عن الحجز', href: ROUTES.project(p.id) }
}

/** Every decided item of every session, with its follow-up · for the queues and the KPI */
export const allFollowUps = () =>
  SESSIONS.flatMap((s) => s.items.filter((i) => i.outcome).map((i) => ({ s, it: i, f: followUp(s, i)! }))).filter((x) => x.f)
