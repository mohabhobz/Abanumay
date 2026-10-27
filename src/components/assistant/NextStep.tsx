import { useState } from 'react'
import { Button, DecisionDialog, Icon, icons, Tag } from '@/components/ui'
import { toast } from '@/data/feedback'
import { pct } from '@/lib/format'
import type { AgentAct, SuggestOpt, Suggestion } from '@/data/shared/agent'

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
  /* Client 26 Oct · an option opens the one decision popup · its reason, or a confirmation */
  const [pick, setPick] = useState<SuggestOpt<A> | null>(null)
  const press = (a: A, note: string) => {
    const out = exec(a, note) || []
    setBad(out)
    if (out.length) return out
    toast(`تم: ${a.label}`, 'ok')
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
          {/* Client 27 Oct · each option is a clear row · a mark for its kind, the label (and why it is
              locked, when it is), the suggested one lifted, and an arrow saying it opens the decision popup */}
          <div className="nstep-list">
            {s.options.map((o) => {
              const danger = Boolean(o.action.kind?.includes('btn-d'))
              return (
                <Button plain
                  key={o.action.label}
                  type="button"
                  className={`nstep-c${o.best ? ' best' : ''}${danger ? ' dng' : ''}`}
                  disabled={Boolean(o.blocked)}
                  title={o.blocked ?? undefined}
                  onClick={() => setPick(o)}
                >
                  <span className="nstep-m" aria-hidden><Icon name={o.blocked ? icons.lock : danger ? icons.close : o.best ? icons.check : icons.edit} size="sm" /></span>
                  <span className="nstep-t">
                    <span className="nstep-l">{o.action.label}{o.best && <Tag tone="teal">المقترح</Tag>}</span>
                    {o.blocked && <span className="sub nstep-d">{o.blocked}</span>}
                  </span>
                  {!o.blocked && <Icon name={icons.chevron} size="sm" className="nstep-go" />}
                </Button>
              )
            })}
          </div>
        </div>
      )}
      {bad.length > 0 && <p className="bad nstep-p">{bad.join(' · ')}</p>}
      {pick && (
        <DecisionDialog
          title={pick.action.label}
          tone={pick.action.kind?.includes('btn-d') ? 'btn-d' : 'btn-p'}
          note={pick.mustNote ? 'required' : 'optional'}
          initialNote={pick.note}
          onClose={() => setPick(null)}
          onConfirm={(n) => press(pick.action, n)}
        />
      )}
    </section>
  )
}
