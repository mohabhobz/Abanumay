import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Glass, Tag } from '@/components/ui'
import { Switch } from '@/components/ui/Switch'
import { AbLeaf } from '@/components/soul'
import { toast } from '@/data/feedback'
import { pct } from '@/lib/format'
import type { AuditModule } from '@/data/shared/audit'
import {
  AGENT_LOG, AGENT_MODULE_SAY as MODULE_SAY, AGENT_NAME, AUTO_BAR, agentAuto, isHold, logAgent, onAgentChange, setAgentAuto,
  type AgentAct, type AgentHold, type AgentPlan,
} from '@/data/shared/agent'

/** Seconds the delegated decision waits, visibly, before it runs · the person can stop it */
const COUNT = 5
/** A delegated decision runs once per record and exit in a visit, even if the page re-renders */
const RAN = new Set<string>()

export interface AgentDecideProps<A extends AgentAct> {
  module: AuditModule
  /** The record · its name in the log and where it opens */
  record: { ref: string; href: string }
  plan: AgentPlan<A> | AgentHold
  /** The person whose seat runs it */
  user: string
  role?: string
  /** Runs the exit through the store · returns what refused it */
  exec: (a: A, note: string) => string[] | void
}

/**
 * «قرار المساعد» — the assistant takes the decision itself (17 Oct · client: the AI is agentic).
 * It shows what it picked and why, runs it on «نفّذ القرار», and — once the module is delegated —
 * runs it by itself after a short countdown. The exits, the seat and the stops are the store's own
 * (`agent.ts`), so it can't do what the person couldn't.
 */
export function AgentDecide<A extends AgentAct>({ module, record, plan, user, role, exec }: AgentDecideProps<A>) {
  const auto = useSyncExternalStore(onAgentChange, () => agentAuto(module))
  const [left, setLeft] = useState<number | null>(null)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const hold = isHold(plan)
  const key = hold ? '' : `${record.ref}|${plan.action.label}`
  const last = AGENT_LOG.find((x) => x.ref === record.ref)

  const run = (isAuto: boolean) => {
    if (hold) return
    RAN.add(key)
    const out = exec(plan.action, plan.note) || []
    if (out.length) {
      setSaid({ bad: out })
      toast(`لم يُنفّذ المساعد «${plan.action.label}» · ${out[0]}`, 'warn')
      return
    }
    logAgent({ module, ref: record.ref, href: record.href, action: plan.action.label, why: plan.why, confidence: plan.confidence, for: user, role, auto: isAuto })
    setSaid({ ok: plan.action.label })
    toast(`${isAuto ? 'نفّذ المساعد تلقائيًا' : 'نفّذ المساعد'}: ${plan.action.label}`, 'ok')
  }

  /* The delegated path · counts down where the person can see it, then runs */
  const conf = hold ? 0 : plan.confidence
  useEffect(() => {
    if (hold || !auto || conf < AUTO_BAR || RAN.has(key)) return
    setLeft(COUNT)
    timer.current = window.setInterval(() => setLeft((n) => (n === null ? null : n - 1)), 1000)
    /* the countdown dies with the card · a re-render of the page keeps the same key and doesn't stop it */
    return () => window.clearInterval(timer.current)
  }, [hold, auto, key, conf])
  useEffect(() => {
    if (left !== 0) return
    window.clearInterval(timer.current)
    setLeft(null)
    run(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])
  const stop = () => { RAN.add(key); window.clearInterval(timer.current); setLeft(null); toast('أوقفت التنفيذ التلقائي · القرار لك', 'info') }

  return (
    <Glass className="agent">
      <div className="agent-h">
        <span className="badge badge-30"><AbLeaf className="aispark live" /></span>
        <div className="agent-t">
          <b>قرار المساعد</b>
          <span className="sub">{AGENT_NAME} يقرّر على إجراءات دورك وينفّذها · كل قرار في سجل التدقيق</span>
        </div>
        {!hold && <Tag tone={plan.confidence >= AUTO_BAR ? 'ok' : 'warn'}>ثقة {pct(Math.round(plan.confidence * 100))}</Tag>}
      </div>

      {said?.ok ? (
        <p className="agent-p">نفّذ المساعد <b>{said.ok}</b> · سُجّل باسمه نيابةً عن {user}</p>
      ) : hold ? (
        <p className="agent-p">{plan.hold}</p>
      ) : (
        <p className="agent-p">القرار: <b>{plan.action.label}</b></p>
      )}
      {!said?.ok && plan.why.length > 0 && (
        <ul className="agent-why">{plan.why.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      {said?.bad && <p className="bad agent-p">{said.bad.join(' · ')}</p>}

      {left !== null ? (
        <div className="agent-a">
          <span className="agent-cd" aria-live="polite">سينفّذه المساعد خلال <span className="num">{left}</span> ث</span>
          <button type="button" className="btn btn-2" onClick={stop}>أوقف</button>
        </div>
      ) : (
        <div className="agent-a">
          {!hold && !said?.ok && <button type="button" className="btn btn-2" onClick={() => run(false)}>نفّذ القرار</button>}
          <Switch
            label={`فوّض المساعد في ${MODULE_SAY[module]}`}
            note={`ينفّذ وحده كل قرار ثقته ${pct(AUTO_BAR * 100)} فأكثر`}
            on={auto}
            onChange={(v) => { setAgentAuto(module, v); toast(v ? `فُوّض المساعد في ${MODULE_SAY[module]}` : `أُلغي تفويض المساعد في ${MODULE_SAY[module]}`, 'info') }}
          />
        </div>
      )}
      {last && !said?.ok && <p className="sub agent-p">آخر قرار له هنا: {last.action}{last.auto ? ' · تلقائيًا' : ''}</p>}
    </Glass>
  )
}
