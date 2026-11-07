import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ButtonLink, Button, DateText, Glass, Icon, icons, Money, Tabs } from '@/components/ui'
import { HeroSuccess } from '@/components/soul'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { onToast, toast } from '@/data/feedback'
import { rowGo } from '@/lib/rowGo'
import { LANE_SAY, todayFor, type Lane, type TodayItem } from './today'
import { setTrail } from './trail'

/* «اليوم» · second version for comparison (client 7 Nov · «نسخة تانية من صفحة اليوم وسيب القديمة») ·
   the same data, sections and order as `HomePage`, with the polish pass applied:

   · the page names itself and the day («اليوم» · the date · what waits), not a greeting on a banner
   · the next step without the decorative day line · its position in the day stays as text
   · progress as a number and a percent · no leaves tally · «تحرّك بفضلك» only when something moved
   · section titles without the coloured bar · cards without glows or gradient tiles
   · the late warning stays a tag on the next step only · on the board it reads as quiet text
   · an empty column folds into a line, the board takes the columns that hold something
   · room at the foot of the page, so the floating assistant and the phone's bar cover nothing

   Reached at `/today-v2` · the original stays the home page until the client chooses. */

const COLS: Lane[] = ['due', 'returned', 'waiting', 'coming']
const SHOW = 4

const TONE_OF: Record<Lane, string> = { due: 'warn', returned: 'teal', waiting: 'mute', coming: 'mute' }

const DAY_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export default function HomePageV2() {
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
  /* the busiest stages first · the rest one press away, so the row stays one line */
  const qs = [...day.queues].sort((a, b) => b.count - a.count || b.late - a.late)
  const todayIso = [...day.progress.days].reverse().find((d) => !d.future)?.day ?? ''
  const weekMax = Math.max(1, ...day.progress.days.map((d) => d.n))

  return (
    <AppLayout assistantContext={assistFor.home(user.name, day.items.length, day.byLane.due.length)}>
      <div className="viewstack">
        <div className="screen col tday tday2">
          {/* 1 · the page and the day · what waits, in one line */}
          <header className="tday2-h">
            <div>
              <h1 className="ptitle">اليوم</h1>
              <p className="sub"><DateText>{new Date().toISOString().slice(0, 10)}</DateText>
                {done ? ' · لا شيء ينتظرك الآن' : <> · <span className="num">{day.items.length}</span> {day.items.length === 1 ? 'بند ينتظرك' : 'بنود تنتظرك'}{day.byLane.due.length > 0 && <>، <span className="num">{day.byLane.due.length}</span> مستحقة اليوم</>}</>}
              </p>
            </div>
            {overview && <ButtonLink variant="2" to={ROUTES.reports}><Icon name={icons.chart} size="sm" />نظرة المؤسسة</ButtonLink>}
          </header>

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
                      : 'لا شيء ينتظرك الآن.'}
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
                    {after && <Button type="button" variant="ghost" onClick={() => setLater((x) => [...x, key(next)])}>لاحقًا</Button>}
                    {next.quick && <Button type="button" variant="2" onClick={() => go(next)}>افتح السجل</Button>}
                    <Button type="button" variant="p" className="tday-go" onClick={() => finish(next)}>
                      {next.quick ? next.quick.label : 'ابدأ الآن'}
                    </Button>
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

              {day.progress.moved.length > 0 && (
                <div className="tday-moved">
                  <span className="tday-sh">ما تحرّك بعد إجراءاتك</span>
                  <ul>
                    {day.progress.moved.slice(0, 3).map((m) => <li key={m.href}><Icon name={icons.check} size="sm" /><Link to={m.href}>{m.text}</Link></li>)}
                  </ul>
                </div>
              )}
            </Glass>
          </div>

          {/* The role's stages as personal queues · a filter over the board */}
          {!done && day.queues.length > 1 && (
            /* 19 Oct · client · the system's one tab shape (`Tabs`) · was a row of filter chips with its
               own selected style and a «مراحل أخرى» toggle · every stage is a tab now, the row scrolls */
            <Tabs
              className="tday-tabs"
              items={[{ slug: '', label: 'الكل', count: day.items.length }, ...qs.map((q) => ({ slug: q.key, label: q.label, count: q.count }))]}
              active={queue}
              onChange={setQueue}
            />
          )}

          {/* 4 · the board · gone on the finish line, where four empty columns would only be noise */}
          {(!done || day.byLane.coming.length > 0) && <div className={`tday-board n-${(done ? (['coming'] as Lane[]) : COLS).filter((l) => col(l).length).length || 1}`}>
            {(done ? (['coming'] as Lane[]) : COLS).filter((l) => col(l).length).map((l) => {
              const rows = col(l)
              const all = open[l]
              return (
                <Glass key={l} className={`tday-col c-${l}`}>
                  <div className="tday-col-h">
                    <i className="tday-dot" aria-hidden="true" />
                    <b>{LANE_SAY[l]}</b>
                    <span className="num tday-n">{rows.length}</span>
                  </div>
                  <ul className="tday-cards">
                    {(all ? rows : rows.slice(0, SHOW)).map((i) => <Card key={key(i)} i={i} go={go} />)}
                  </ul>
                  {rows.length > SHOW && (
                    <Button type="button" variant="ghost" size="sm" className="tday-more" onClick={() => setOpen((o) => ({ ...o, [l]: !all }))}>
                      {all ? 'اعرض أقل' : `اعرض الكل (${rows.length})`}
                    </Button>
                  )}
                </Glass>
              )
            })}
          </div>}
          {/* the columns with nothing in them · one quiet line instead of an empty card each */}
          {!done && COLS.some((l) => !col(l).length) && (
            <p className="sub tday2-none"><Icon name={icons.check} size="sm" />لا شيء {COLS.filter((l) => !col(l).length).map((l) => `في «${LANE_SAY[l]}»`).join(' ولا ')}</p>
          )}
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
        <span className={`tday2-why${i.lane === 'due' ? ' late' : ''}`}>{i.why}{i.date && <> <DateText>{i.date}</DateText></>}</span>
        {i.amount ? <Money sm>{i.amount}</Money> : null}
      </span>
    </li>
  )
}

/* The progress line in words · calm, specific, never a score */
function sayOf(n: number, share: number, done: boolean): string {
  if (done) return n ? 'أنجزت كل ما وصلك اليوم' : 'لا شيء ينتظرك الآن'
  if (!n) return 'لم تنجز شيئًا اليوم بعد'
  if (share >= 0.75) return 'بقي القليل من يومك'
  if (share >= 0.5) return 'أنجزت نصف يومك'
  if (share >= 0.25) return 'أنجزت ربع يومك'
  return `${n === 1 ? 'بند واحد' : `${n} بنود`} أُنجزت حتى الآن`
}
