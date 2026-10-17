import { stampNow } from '@/data/clock'
import type { AuditModule } from '@/data/shared/audit'

/* 17 Oct · client: «the AI in the whole system has to be agentic and take decisions».

   Until now every reading was advisory: the assistant said what it saw and the person pressed the
   button. Here the assistant **picks the exit itself and takes it**, on the record's own actions —
   the same store call the button makes, so every rule, seat and stop still holds and nothing can
   pass that a person couldn't pass.

   Three limits, on purpose:
   1. It decides only among the exits the seat already has · it never invents one.
   2. It never takes an irreversible negative exit (final rejection · cancellation · decline) — those
      stay human. It may return a record for completion, with the reasons it found as the note.
   3. It can't attach a file it doesn't have (a transfer proof, a signed copy) · it says so.

   Each module can be **delegated** («فوّض المساعد»): from then on, a decision with confidence at or
   above the bar runs by itself after a short visible countdown the person can stop. Every decision
   it takes is written here and read by the audit log as «قرار المساعد», with its reasons and the
   person it acted for. In production this list is the agent's own event stream on the server. */

export const AGENT_NAME = 'مساعد أبانمي'
/* Its own names for the modules · the card can't import the audit log (it pulls every store and
   closes an import cycle with a lazily loaded page) */
export const AGENT_MODULE_SAY: Record<AuditModule, string> = {
  budget: 'الميزانية', entities: 'الجهات والتسجيل', projects: 'المشاريع والاعتماد', agreements: 'الاتفاقيات', payments: 'الصرف',
  closing: 'الإغلاق', plans: 'الخطط', partners: 'الشركاء والمحافظ', settings: 'الإعدادات والصلاحيات',
}
/** At or above this, a delegated module runs the decision by itself */
export const AUTO_BAR = 0.85

export interface AgentAct { label: string; kind?: string; needsNote?: boolean; needsFile?: string | boolean; needsAmount?: boolean }
export interface AgentPlan<A extends AgentAct> {
  action: A
  /** What made it choose · one sentence each */
  why: string[]
  /** 0..1 */
  confidence: number
  /** The note it writes with the action (its reasons, for a return) */
  note: string
}
export interface AgentHold { hold: string; why: string[] }

export interface AgentLog {
  id: string
  module: AuditModule
  ref: string
  href: string
  action: string
  why: string[]
  confidence: number
  /** The person it acted for (their seat ran it) */
  for: string
  role?: string
  auto: boolean
  at: string
}

const KEY = 'ab-agent-log'
const AUTO_KEY = 'ab-agent-auto'
const EVENT = 'ab:agent'
const read = <T,>(k: string, d: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d } catch { return d } }
export const AGENT_LOG: AgentLog[] = read<AgentLog[]>(KEY, [])
const AUTO: Record<string, boolean> = read<Record<string, boolean>>(AUTO_KEY, {})
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(AGENT_LOG)); localStorage.setItem(AUTO_KEY, JSON.stringify(AUTO)) } catch { /* storage blocked · holds for this visit */ }
  window.dispatchEvent(new Event(EVENT))
}
export const onAgentChange = (fn: () => void) => { window.addEventListener(EVENT, fn); return () => window.removeEventListener(EVENT, fn) }

export const agentAuto = (module: string) => Boolean(AUTO[module])
export function setAgentAuto(module: string, on: boolean) { AUTO[module] = on; save() }

export function logAgent(e: Omit<AgentLog, 'id' | 'at'>) {
  AGENT_LOG.unshift({ ...e, id: `AG-${Date.now().toString(36)}-${AGENT_LOG.length}`, at: stampNow() })
  save()
}
export const agentLogOf = (ref: string) => AGENT_LOG.filter((x) => x.ref === ref)

/* ── The decision rule ──
   `issues` are what the system's own checks found wrong with the record now (the same lists the
   screen shows). No issue → the forward exit. Issues → the return-for-completion exit, its note
   the issues. Nothing fits → the decision is left to the person, with why. */
const NEGATIVE = /رفض|إلغاء|اعتذار|إيقاف|استبعاد|إنهاء/
const RETURN = /^(إعادة|أعد إلى|أعده)|استكمال|طلب تعديل/

export function agentDecide<A extends AgentAct>(
  actions: A[],
  ctx: {
    issues: string[]
    /** What the system confirmed is in order · its reasons for going forward */
    good?: string[]
    /** The stops a given exit would hit right now (the store's own `…Stops`) */
    stops?: (a: A) => string[]
    /** Prefer this exit forward when several fit */
    forward?: RegExp
    /** Exits that read negative but aren't final · a recommendation to decline is the next seat's to take */
    allow?: RegExp
  },
): AgentPlan<A> | AgentHold {
  const neg = (a: A) => NEGATIVE.test(a.label) && !ctx.allow?.test(a.label)
  const open = actions.filter((a) => !neg(a) || RETURN.test(a.label))
  if (!actions.length) return { hold: 'لا إجراء لهذا الدور على السجل الآن', why: [] }
  const issues = [...new Set(ctx.issues.filter(Boolean))]
  if (issues.length) {
    const back = open.find((a) => RETURN.test(a.label) && !a.needsFile)
    if (back) return {
      action: back,
      why: [`وجد المساعد ${issues.length === 1 ? 'ملاحظة واحدة' : `${issues.length} ملاحظات`} تمنع التقدّم`, ...issues.slice(0, 4)],
      confidence: Math.min(0.95, 0.78 + 0.04 * issues.length),
      note: `أعاده ${AGENT_NAME}: ${issues.join(' · ')}`,
    }
    return { hold: 'وجد ملاحظات ولا مسار إعادة لهذا الدور · القرار لك', why: issues.slice(0, 4) }
  }
  const fwd = open.filter((a) => !RETURN.test(a.label) && !neg(a))
  if (!fwd.length) return { hold: 'لم تجد فحوص النظام ما يستدعي الإعادة · والتقدّم ليس من إجراءات دورك هنا', why: ctx.good?.filter(Boolean).slice(0, 3) ?? [] }
  const ranked = [...fwd].sort((a, b) => Number(ctx.forward?.test(b.label) ?? 0) - Number(ctx.forward?.test(a.label) ?? 0)
    || Number(b.kind === 'btn-p') - Number(a.kind === 'btn-p'))
  const go = ranked.find((a) => !a.needsFile && !(ctx.stops?.(a).length))
  if (go) {
    const good = ctx.good?.filter(Boolean) ?? []
    return {
      action: go,
      why: ['لم تجد فحوص النظام ما يمنع التقدّم', ...good.slice(0, 4)],
      confidence: Math.min(0.97, 0.82 + 0.03 * good.length),
      note: `قرار ${AGENT_NAME}: ${good.length ? good.join(' · ') : 'الفحوص سليمة'}`,
    }
  }
  const file = ranked.find((a) => a.needsFile)
  if (file) return { hold: `الخطوة التالية تحتاج ${typeof file.needsFile === 'string' ? file.needsFile : 'مرفقًا'} · يرفعه المستخدم`, why: [] }
  const st = ranked.flatMap((a) => ctx.stops?.(a) ?? [])
  return { hold: 'الإجراء التالي متوقف على شرط لم يتحقق', why: [...new Set(st)].slice(0, 4) }
}

export const isHold = <A extends AgentAct>(p: AgentPlan<A> | AgentHold): p is AgentHold => 'hold' in p
