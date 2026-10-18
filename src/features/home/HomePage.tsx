import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DateText, Glass, Icon, icons, Money } from '@/components/ui'
import { AbLeaf, HeroSuccess, IdentityBanner } from '@/components/soul'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { onToast, toast } from '@/data/feedback'
import { rowGo } from '@/lib/rowGo'
import { LANE_NOTE, LANE_SAY, todayFor, type Lane, type TodayItem } from './today'
import { setTrail } from './trail'

/* «اليوم» · the person's working day on one screen (client brief, 17 Oct · layout reworked 18 Oct
   on the client's comment: «the layout is bad, nothing alive, it isn't clear what to do first»).

   Read top to bottom, in the order the eye is meant to travel:
     1. the identity field · the greeting and the day · the home screen's one solid surface
     2. «خطوتك التالية» · the one thing to do now, large, with one primary action · the day's path
        above it (what is done, where I am, what follows) so the order is seen, not read
     3. «تقدّمك» beside it · today's count against the day, the week as seven bars, what moved
     4. the board · four columns · due today · returned · waiting · coming · each card opens itself

   The old page is the first tab of Reports («تقارير اليوم»). Each role sees its own work only. */

const COLS: Lane[] = ['due', 'returned', 'waiting', 'coming']
const SHOW = 4
const CHIPS = 6

const TONE_OF: Record<Lane, string> = { due: 'warn', returned: 'teal', waiting: 'mute', coming: 'mute' }

const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export default function HomePage() {
  const { role, user } = useRole()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  useEffect(() => onToast(() => setTick((t) => t + 1)), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => todayFor(role.key, user.name), [role.key, user.name, tick])
  const [later, setLater] = useState<string[]>([])
  const [queue, setQueue] = useState<string>('')
  const [leaving, setLeaving] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [moreQ, setMoreQ] = useState(false)

  const key = (i: TodayItem) => `${i.queueKey}|${i.id}`
  const ordered = [...day.items.filter((i) => !later.includes(key(i))), ...day.items.filter((i) => later.includes(key(i)))]
  const next = ordered[0]
  const after = ordered[1]
  const done = day.items.length === 0
  const total = day.items.length + day.progress.today
  const overview = role.key === 'ceo' || role.key === 'grants-manager'

  const go = (i: TodayItem) => { setTrail({ id: i.id, queueKey: i.queueKey, title: i.title, to: i.to }); navigate(i.to) }
  const finish = (i: TodayItem) => {
    if (!i.quick) return go(i)
    const out = i.quick.run()
    if (out.length) { toast(`لم يُنفّذ «${i.quick.label}» · ${out[0]}`, 'warn'); return }
    setLeaving(true)
    window.setTimeout(() => {
      setLeaving(false)
      toast(after ? `تم · التالي: ${after.title}` : 'تم · أنجزت كل ما ينتظرك', 'ok')
    }, 260)
  }
  const col = (l: Lane) => day.byLane[l].filter((i) => (!queue || i.queueKey === queue) && !(next && key(i) === key(next)))

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const first = user.name.split(' ')[0]
  /* the busiest stages first · the rest one press away, so the row stays one line */
  const qs = [...day.queues].sort((a, b) => b.count - a.count || b.late - a.late)
  const todayIso = [...day.progress.days].reverse().find((d) => !d.future)?.day ?? ''
  const weekMax = Math.max(1, ...day.progress.days.map((d) => d.n))

  return (
    <AppLayout assistantContext={assistFor.home(user.name, day.items.length, day.byLane.due.length)}>
      <div className="viewstack">
        <div className="screen col tday">
          {/* 1 · the identity field · greeting and the day only · no number sits on it */}
          <IdentityBanner
            title={`${greet}، ${first}`}
            sub={<><DateText>{new Date().toISOString().slice(0, 10)}</DateText> · {done ? 'يومك فارغ الآن، وكل ما يصلك يظهر هنا أولًا' : 'يومك مرتّب لك · ابدأ بالبطاقة الأولى'}</>}
            action={overview ? (
              <Link className="btn btn-ghost" to={ROUTES.reports}><Icon name={icons.chart} size="sm" />نظرة المؤسسة</Link>
            ) : undefined}
          />

          <div className="tday-top">
            <div className="col tday-main">
            {/* 2 · the next step */}
            {done ? (
              <Glass className="tday-done">
                <HeroSuccess />
                <div className="tday-done-b">
                  <h2 className="tday-done-t">أنجزتَ كل شيء لليوم</h2>
                  <p className="sub">
                    {day.progress.today
                      ? <>أنجزت <span className="num">{day.progress.today}</span> {day.progress.today === 1 ? 'إجراءً' : 'إجراءات'} اليوم، ولا شيء آخر ينتظرك.</>
                      : 'لا شيء ينتظرك الآن · ما يصلك يظهر هنا أولًا.'}
                  </p>
                </div>
              </Glass>
            ) : next && (
              <Glass className={`tday-focus${leaving ? ' out' : ''}`} key={key(next)}>
                <div className="tday-focus-h">
                  <span className="tday-step">خطوتك التالية</span>
                  <span className="sub">
                    <span className="num">{day.progress.today + 1}</span> من <span className="num">{total}</span> اليوم
                  </span>
                </div>

                {/* The day's line · the same gradient bar the old top cards carried · filled up to where I
                    am, a knob on «now», a tick for each late item still ahead */}
                <DayLine share={total ? day.progress.today / total : 0} late={ordered.map((x, k) => (x.lane === 'due' ? (day.progress.today + k + 0.5) / total : -1)).filter((x) => x > 0)} />
                {after && <p className="tday-then">بعده: <b>{after.title}</b> <span className="sub">· {after.queue}</span></p>}

                <div className="tday-focus-b">
                  <span className="tday-ic" aria-hidden="true"><Icon name={icons[next.icon]} /></span>
                  <div className="tday-focus-t">
                    <span className="tday-q">{next.queue}</span>
                    <h2>{next.title}</h2>
                    <p className="sub">{next.sub}{next.code ? ` · ${next.code}` : ''}</p>
                  </div>
                  {next.amount ? <div className="tday-amt"><span className="sub">المبلغ</span><Money>{next.amount}</Money></div> : null}
                </div>

                <div className="tday-focus-f">
                  <span className={`tag ${TONE_OF[next.lane]} tday-pill`}><Icon name={icons.clock} size="sm" />{next.why}</span>
                  <div className="tday-acts">
                    {after && <button type="button" className="btn btn-ghost" onClick={() => setLater((x) => [...x, key(next)])}>لاحقًا</button>}
                    {next.quick && <button type="button" className="btn btn-2" onClick={() => go(next)}>افتح السجل</button>}
                    <button type="button" className="btn btn-p tday-go" onClick={() => finish(next)}>
                      {next.quick ? next.quick.label : 'ابدأ الآن'}
                    </button>
                  </div>
                </div>
              </Glass>
            )}

            {/* The week · seven days of my actions, and what moved after them */}
            <Glass className="tday-wk">
              <div className="tday-wk-b">
                <div className="tday-wk-c">
                  <span className="tday-step">أسبوعك</span>
                <div className="tday-week" role="img" aria-label={`إجراءاتك هذا الأسبوع: ${day.progress.week}`}>
                  {day.progress.days.map((d) => (
                    <span key={d.day} className={d.day === todayIso ? 'on' : d.future ? 'fut' : undefined} title={d.future ? 'لم يأتِ بعد' : `${d.n} ${d.n === 1 ? 'إجراء' : 'إجراءات'}`}>
                      {d.n > 0 && <small className="num tday-wn">{d.n}</small>}
                      <i className={`wk-${Math.round((d.n / weekMax) * 4)}`} />
                      <small>{DAY_SHORT[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</small>
                    </span>
                  ))}
                </div>
                <p className="sub">هذا الأسبوع: <span className="num">{day.progress.week}</span> {day.progress.week === 1 ? 'إجراء' : 'إجراءات'} باسمك</p>
                </div>
              </div>
            </Glass>
            </div>

            {/* 3 · progress · it changes with the day: a start line, then what was done, then the finish */}
            <Glass className={`tday-prog${day.progress.today ? ' on' : ''}`}>
              <div className="tday-prog-h">
                <span className="tday-step">تقدّمك</span>
              </div>
              <div className="tday-big">
                <b className="num">{day.progress.today}</b>
                <span className="sub">{done ? 'إجراءات اليوم' : <>من <span className="num">{total}</span> اليوم</>}</span>
                {day.progress.today > 0 && <span className="tday-pct num">{Math.round(day.progress.share * 100)}%</span>}
              </div>
              {/* The leaves fill with the day · one per fifth of it · the system's own mark */}
              <div className="tday-leaves" role="img" aria-label={`أنجزت ${Math.round(day.progress.share * 100)}% من يومك`}>
                {Array.from({ length: 5 }, (_, k) => (
                  <span key={k} className={day.progress.share >= (k + 1) / 5 ? 'on' : day.progress.share > k / 5 ? 'half' : undefined}>
                    <AbLeaf className="tday-leaf" />
                  </span>
                ))}
              </div>
              <p className="tday-say">{sayOf(day.progress.today, day.progress.share, done)}</p>

              {day.progress.done.length > 0 && (
                <div className="tday-donel">
                  <span className="tday-sh">ما أنجزته اليوم</span>
                  <ul>
                    {day.progress.done.slice(0, 3).map((d, k) => (
                      <li key={`${d.href}-${k}`}>
                        <span className="tday-tick" aria-hidden="true"><Icon name={icons.check} size="sm" /></span>
                        <Link to={d.href}><b>{d.action}</b> <span className="sub">· {d.ref}</span></Link>
                        <span className="sub num">{d.at.slice(11, 16)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="tday-moved">
                <span className="tday-sh">تحرّك بفضلك</span>
                {day.progress.moved.length ? (
                  <ul>
                    {day.progress.moved.slice(0, 3).map((m) => <li key={m.href}><Icon name={icons.check} size="sm" /><Link to={m.href}>{m.text}</Link></li>)}
                  </ul>
                ) : <p className="sub">ما يتقدّم بعد خطوتك يظهر هنا: مشروع اعتُمد، دفعة صُرفت، مشروع أُغلق.</p>}
              </div>
            </Glass>
          </div>

          {/* The role's stages as personal queues · a filter over the board */}
          {!done && day.queues.length > 1 && (
            <div className="tday-chips" role="group" aria-label="بنودك حسب المرحلة">
              <button type="button" className={`fchip${!queue ? ' on' : ''}`} aria-pressed={!queue} onClick={() => setQueue('')}>
                الكل <span className="num">{day.items.length}</span>
              </button>
              {(moreQ ? qs : qs.slice(0, CHIPS)).map((q) => (
                <button key={q.key} type="button" className={`fchip${queue === q.key ? ' on' : ''}`} aria-pressed={queue === q.key} onClick={() => setQueue(queue === q.key ? '' : q.key)}>
                  <Icon name={icons[q.icon]} size="sm" />{q.label} <span className="num">{q.count}</span>
                </button>
              ))}
              {qs.length > CHIPS && (
                <button type="button" className="fchip" aria-expanded={moreQ} onClick={() => setMoreQ((x) => !x)}>
                  {moreQ ? 'أقل' : <>مراحل أخرى <span className="num">{qs.length - CHIPS}</span></>}
                </button>
              )}
            </div>
          )}

          {/* 4 · the board · gone on the finish line, where four empty columns would only be noise */}
          {(!done || day.byLane.coming.length > 0) && <div className="tday-board">
            {(done ? (['coming'] as Lane[]) : COLS).map((l) => {
              const rows = col(l)
              const all = open[l]
              return (
                <Glass key={l} className={`tday-col c-${l}`}>
                  <div className="tday-col-h">
                    <i className="tday-dot" aria-hidden="true" />
                    <b>{LANE_SAY[l]}</b>
                    <span className="num tday-n">{rows.length}</span>
                  </div>
                  <p className="sub tday-col-n">{LANE_NOTE[l]}</p>
                  {rows.length ? (
                    <ul className="tday-cards">
                      {(all ? rows : rows.slice(0, SHOW)).map((i) => <Card key={key(i)} i={i} go={go} />)}
                    </ul>
                  ) : (
                    <p className="tday-empty"><Icon name={icons.check} size="sm" />لا شيء هنا</p>
                  )}
                  {rows.length > SHOW && (
                    <button type="button" className="btn btn-ghost btn-sm tday-more" onClick={() => setOpen((o) => ({ ...o, [l]: !all }))}>
                      {all ? 'اعرض أقل' : `اعرض الكل (${rows.length})`}
                    </button>
                  )}
                </Glass>
              )
            })}
          </div>}
        </div>
      </div>
    </AppLayout>
  )
}

/** One card on the board · the whole card opens its record, and the visit remembers where from */
function Card({ i, go }: { i: TodayItem; go: (i: TodayItem) => void }) {
  return (
    <li {...rowGo(() => go(i), i.to, 'tday-card')}>
      <span className="tday-card-q"><Icon name={icons[i.icon]} size="sm" />{i.queue}</span>
      <Icon name={icons.chevron} size="sm" className="tday-card-go" />
      <span className="tday-card-t">{i.title}</span>
      <span className="tday-card-f">
        <span className={`tag ${TONE_OF[i.lane]} tday-pill sm`}>{i.why}{i.date && <> <DateText>{i.date}</DateText></>}</span>
        {i.amount ? <Money sm>{i.amount}</Money> : null}
      </span>
    </li>
  )
}

/* The progress line in words · calm, specific, never a score */
function sayOf(n: number, share: number, done: boolean): string {
  if (done) return n ? 'أغلقت يومك · كل ما وصلك أُنجز.' : 'لا شيء ينتظرك الآن.'
  if (!n) return 'يبدأ يومك بالبطاقة الأولى · كل بند تنجزه يملأ ورقة.'
  if (share >= 0.75) return 'اقتربت من نهاية يومك · القليل المتبقي مرتّب أمامك.'
  if (share >= 0.5) return 'أنجزت نصف يومك · الباقي على نفس الترتيب.'
  if (share >= 0.25) return 'ربع يومك خلفك · استمر بالبطاقة التالية.'
  return `بدأت يومك · ${n === 1 ? 'بند واحد' : `${n} بنود`} أُنجزت حتى الآن.`
}


/** The day's line · a track, a gradient fill up to «now» from the start side, a knob, late ticks */
function DayLine({ share, late }: { share: number; late: number[] }) {
  const uid = useId().replace(/:/g, '')
  const f = Math.max(0.02, Math.min(1, share)) * 100
  return (
    <svg className="gb-line tday-line" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-g`} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" className="gb-st-a" />
          <stop offset="1" className="gb-st-c" />
        </linearGradient>
      </defs>
      <rect className="gb-line-t" width="100%" height="100%" />
      <rect className="gb-line-f" x={`${100 - f}%`} width={`${f}%`} height="100%" fill={`url(#${uid}-g)`} />
      {late.map((x, k) => <rect key={k} className="tday-tick-l" x={`${100 - x * 100}%`} y="25%" width="3" height="50%" />)}
      <circle className="tday-knob" cx={`${100 - f}%`} cy="50%" r="11" />
    </svg>
  )
}
