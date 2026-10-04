import { useMemo, useState } from 'react'
import {
  DateText, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, StepArc, Steps, Tag,
  type GateStep, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import {
  FLOW, J_AMOUNT, J_ENTITY, J_PROJECT, TOTAL_STEPS, dayOf, locate, readDone, writeDone,
} from './flow'

/* The happy path · meeting 1 Oct, item A-7 — one record of each procedure, end to end.

   The screen walks `FLOW` one step at a time. The seat that acts is always named with the person
   in it, the button is that seat's action, and the record card grows as each step sets its
   fields. Nothing here reads or writes the prototype's mock data: the journey is a counter in the
   session, so it can live on its own branch and be demoed without touching any other screen. */

export default function JourneyPage() {
  const mobile = useIsMobile()
  const [done, setDoneState] = useState(readDone)
  const setDone = (n: number) => {
    writeDone(n)
    setDoneState(n)
    setView(null)
  }
  /* A finished procedure can be reopened read-only from the stepper · `null` follows the journey */
  const [view, setView] = useState<number | null>(null)

  const here = locate(done)
  const finished = done >= TOTAL_STEPS
  const shown = view ?? Math.min(here.proc, FLOW.length - 1)
  const proc = FLOW[shown]!
  const live = !finished && shown === here.proc

  /* Steps already done, counted across the flow, for the log and each record */
  const offset = useMemo(() => FLOW.slice(0, shown).reduce((n, p) => n + p.steps.length, 0), [shown])
  const doneHere = finished || shown < here.proc ? proc.steps.length : here.step
  const step = live ? proc.steps[here.step] : undefined

  /* The record as it stands · each done step adds what it set */
  const record = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of proc.steps.slice(0, doneHere)) Object.assign(out, s.sets ?? {})
    return out
  }, [proc, doneHere])

  const ladder: StepItem[] = proc.steps.map((s, i) => ({
    label: i < doneHere ? s.done : s.act,
    note: <Person name={s.person} />,
    at: i < doneHere ? <DateText>{dayOf(offset + i)}</DateText> : undefined,
    state: i < doneHere ? 'done' : i === doneHere && live ? 'now' : 'todo',
  }))

  const procState = (i: number): 'done' | 'now' | 'todo' =>
    finished || i < here.proc ? 'done' : i === here.proc ? 'now' : 'todo'

  const fan: GateStep[] = FLOW.map((p, i) => {
    const st = procState(i)
    return {
      label: p.label,
      cap: st === 'done' ? 'تمّ' : `${p.steps.length} خطوات`,
      state: st === 'todo' ? 'pending' : st,
      lines: [<>{p.steps.map((s) => s.who).filter((w, k, a) => a.indexOf(w) === k).join(' ← ')}</>],
      src: p.id,
    }
  })

  /* The whole journey's log, newest first */
  const log = useMemo(() => {
    const out: { at: string; text: string; who: string; proc: string }[] = []
    let n = 0
    for (const p of FLOW) {
      for (const s of p.steps) {
        if (n < done) out.push({ at: dayOf(n), text: s.done, who: s.person, proc: p.label })
        n++
      }
    }
    return out.reverse()
  }, [done])

  return (
    <AppLayout assistantContext={assistFor.page('المسار السعيد')}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{J_PROJECT}</h1>
              <p className="sub mt-1">
                المسار السعيد · {J_ENTITY} · مشروع واحد واتفاقية وخطة ودفعة واحدة وإغلاق، وكل خطوة
                تُعتمد من أول مرة
              </p>
              <div className="gt-tag">
                <Tag tone={finished ? 'ok' : 'mute'}>
                  {finished ? 'اكتمل المسار' : <>الخطوة <Num>{done + 1}</Num> من <Num>{TOTAL_STEPS}</Num></>}
                </Tag>
              </div>
              <div className="pamt">
                <div className="lb">قيمة المنحة</div>
                <div className="v"><Money sm>{J_AMOUNT}</Money></div>
                <div className="sub">ضمن حدّ مدير المنح · فيعتمدها دون رفع</div>
              </div>
            </div>
            <div className="pgates">
              <StepArc
                steps={fan}
                compact={mobile}
                aria="مراحل المسار السعيد"
                holderKey={finished ? 'اكتمل' : 'يتصرّف الآن'}
                holder={finished ? 'المشروع مغلق' : FLOW[here.proc]!.steps[here.step]!.who}
                rest={[finished ? null : <>في «{FLOW[here.proc]!.label}» · <Mono>{FLOW[here.proc]!.id}</Mono></>]}
              />
            </div>
          </header>

          <Glass className="regsteps">
            <Steps
              flow="stepper"
              onPick={(i) => { if (finished || i < here.proc) setView(i); else if (i === here.proc) setView(null) }}
              items={FLOW.map((p, i) => ({ label: p.label, state: procState(i) }))}
            />
          </Glass>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head
                  title={proc.label}
                  meta={<><Mono>{proc.id}</Mono>{!live && <> <Tag tone="ok">مكتمل</Tag></>}</>}
                />
                {Object.keys(record).length > 0 ? (
                  <KV rows={Object.entries(record).map(([k, v]) => ({ k, v }))} />
                ) : (
                  <p className="sub cnote">لم يُنشأ السجل بعد · يبدأ بالخطوة الأولى.</p>
                )}
              </Glass>

              <Glass>
                <Head title="خطوات الإجراء" meta={<span className="sub"><Num>{doneHere}</Num> من <Num>{proc.steps.length}</Num></span>} />
                <Steps items={ladder} flow="ladder" />
              </Glass>
            </div>

            <div className="col aiside">
              {step && (
                <Glass>
                  <Head title="يتصرّف الآن" meta={<Tag tone="mute">{step.who}</Tag>} />
                  <div className="jr-who">
                    <Person name={step.person} size="md" quiet={false} />
                  </div>
                  <p className="sub cnote">ما يُعدَّل في هذه الخطوة</p>
                  <ul className="payq-ck mt-2">
                    {step.edit.map((x) => (
                      <li key={x} className="ok">
                        <Icon name={icons.edit} size="sm" />
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}

              <Glass>
                <Head title="سجل المسار" meta={<span className="sub"><Num>{log.length}</Num> إجراء</span>} />
                {log.length ? (
                  <ul className="jr-log">
                    {log.slice(0, 8).map((e) => (
                      <li key={`${e.at}-${e.text}`}>
                        <span className="sub"><DateText>{e.at}</DateText> · {e.proc}</span>
                        <span>{e.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sub cnote">لم يبدأ المسار بعد.</p>
                )}
              </Glass>
            </div>
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar">
            <div className="rowf gp-3">
              <span className="decsent">
                {finished ? (
                  <>اكتمل المسار · <b>{TOTAL_STEPS}</b> خطوة من التسجيل حتى الإغلاق</>
                ) : view !== null && !live ? (
                  <>تعرض «{proc.label}» وقد اكتمل<span className="decsep" /><span className="sub">المسار عند «{FLOW[here.proc]!.label}»</span></>
                ) : (
                  <>بدور <b>{step?.who}</b> · {step?.person}<span className="decsep" />{proc.label}</>
                )}
              </span>
            </div>
            <div className="rowf gp-2">
              {done > 0 && (
                <button className="btn btn-ghost" onClick={() => setDone(0)}>ابدأ من جديد</button>
              )}
              {view !== null && !live && !finished && (
                <button className="btn btn-2" onClick={() => setView(null)}>عُد إلى الخطوة الحالية</button>
              )}
              {live && step && (
                <button className="btn btn-p" onClick={() => setDone(done + 1)}>{step.act}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
