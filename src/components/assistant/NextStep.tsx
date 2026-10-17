import { useState } from 'react'
import { Tag } from '@/components/ui'
import { toast } from '@/data/feedback'
import { pct } from '@/lib/format'
import type { AgentAct, Suggestion } from '@/data/shared/agent'

/**
 * «الحل المقترح» — inside the assistant card (17 Oct · client: the assistant suggests what the
 * employee needs to do, says which option is best, and gives the options right there).
 * Nothing runs by itself: an option runs when the employee presses it, under their own name,
 * through the same store call as the decision dock.
 */
export function NextStep<A extends AgentAct>({ s, exec }: {
  s: Suggestion<A>
  /** Runs the option through the store · returns what refused it */
  exec: (a: A, note: string) => string[] | void
}) {
  const [bad, setBad] = useState<string[]>([])
  const press = (a: A, note: string) => {
    const out = exec(a, note) || []
    setBad(out)
    if (out.length) toast(`لم يُنفّذ «${a.label}» · ${out[0]}`, 'warn')
    else toast(`تم: ${a.label}`, 'ok')
  }
  return (
    <section className="nstep" aria-label="الحل المقترح">
      <div className="nstep-h">
        <b>الحل المقترح</b>
        {s.best && <Tag tone={s.confidence >= 0.85 ? 'ok' : 'warn'}>وضوح القراءة {pct(Math.round(s.confidence * 100))}</Tag>}
      </div>
      <p className="nstep-p">{s.best ? <>الأفضل الآن: <b>{s.best.label}</b></> : s.hold}</p>
      {s.why.length > 0 && <ul className="nstep-why">{s.why.map((w) => <li key={w}>{w}</li>)}</ul>}
      {s.options.length > 0 && (
        <div className="nstep-o">
          <span className="sub">اختياراتك</span>
          {s.options.map((o) => (
            <div key={o.action.label} className="nstep-r">
              <button
                type="button"
                className={`btn ${o.blocked ? 'btn-ghost' : 'btn-2'} nstep-b`}
                disabled={Boolean(o.blocked)}
                title={o.blocked ?? (o.note ? `تُرسل بالملاحظة: ${o.note}` : undefined)}
                onClick={() => press(o.action, o.note)}
              >
                <span className="nstep-l">{o.action.label}</span>
                {o.best && <Tag tone="teal">المقترح</Tag>}
              </button>
              {o.blocked && <span className="sub nstep-x">{o.blocked}</span>}
            </div>
          ))}
        </div>
      )}
      {bad.length > 0 && <p className="bad nstep-p">{bad.join(' · ')}</p>}
    </section>
  )
}
