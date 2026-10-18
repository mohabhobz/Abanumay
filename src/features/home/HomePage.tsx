import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DateText, Glass, Head, Icon, icons, Money, Tag } from '@/components/ui'
import { AbLeaf } from '@/components/soul'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { onToast, toast } from '@/data/feedback'
import { rowGo } from '@/lib/rowGo'
import { LANE_NOTE, LANE_SAY, todayFor, type Lane, type TodayItem } from './today'
import { setTrail } from './trail'

/* «اليوم» · the person's working day on one screen (client brief, 17 Oct).

   The previous page answered «how is the foundation?» · it is kept whole as the first tab of
   Reports («تقارير اليوم», `features/reports/TodayReport.tsx`) and backed up as files. This one
   answers «what do I do now?»:

     one next step, with one action · finishing it brings up the one after
     the rest in four quiet lanes · due today · returned to me · waiting on me · coming
     my progress · what I did today and this week, and what moved after my step
     a real finish line · «أنجزتَ كل شيء لليوم» has its own calm screen

   Each role sees its own work only. The foundation's numbers (the board, the impact, the map)
   left the page · the executive and the grants manager reach them from «نظرة المؤسسة» in the
   header. No points, no badges, no streaks, no confetti: the reward is the list emptying. */

const LANES: Lane[] = ['due', 'returned', 'waiting']
const SHOW = 5

export default function HomePage() {
  const { role, user } = useRole()
  const navigate = useNavigate()
  /* Every action anywhere answers with a toast · the day is re-read on it */
  const [tick, setTick] = useState(0)
  useEffect(() => onToast(() => setTick((t) => t + 1)), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => todayFor(role.key, user.name), [role.key, user.name, tick])
  const [later, setLater] = useState<string[]>([])
  const [queue, setQueue] = useState<string>('')
  const [leaving, setLeaving] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const key = (i: TodayItem) => `${i.queueKey}|${i.id}`
  /* «لاحقًا» moves an item to the end of this visit's order · it stays in its lane */
  const ordered = [...day.items.filter((i) => !later.includes(key(i))), ...day.items.filter((i) => later.includes(key(i)))]
  const next = ordered[0]
  const after = ordered[1]
  const done = day.items.length === 0
  const lateN = day.byLane.due.length
  const overview = role.key === 'ceo' || role.key === 'grants-manager'

  const go = (i: TodayItem) => { setTrail({ id: i.id, queueKey: i.queueKey, title: i.title, to: i.to }); navigate(i.to) }
  const finish = (i: TodayItem) => {
    if (!i.quick) return go(i)
    const out = i.quick.run()
    if (out.length) { toast(`لم يُنفّذ «${i.quick.label}» · ${out[0]}`, 'warn'); return }
    /* The card leaves, then the next one comes up · the toast names it */
    setLeaving(true)
    window.setTimeout(() => {
      setLeaving(false)
      toast(after ? `تم · التالي: ${after.title}` : 'تم · أنجزت كل ما ينتظرك', 'ok')
    }, 260)
  }
  /* The next step isn't repeated in its lane below it */
  const shown = (l: Lane) => day.byLane[l].filter((i) => (!queue || i.queueKey === queue) && !(next && key(i) === key(next)))

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const first = user.name.split(' ')[0]

  return (
    <AppLayout assistantContext={assistFor.home(user.name, day.items.length, lateN)}>
      <div className="viewstack">
        <div className="screen col tday">
          <header>
            <div>
              <h1 className="ptitle">يومك</h1>
              <p className="sub mt-1">
                {greet}، {first} ·{' '}
                {done ? 'لا شيء ينتظرك الآن' : <>أمامك <span className="num">{day.items.length}</span> {day.items.length === 1 ? 'بند' : 'بنود'}{lateN ? <> · <span className="num">{lateN}</span> مستحقة اليوم</> : ' · كلها ضمن مددها'} · مرتّبة لك</>}
              </p>
            </div>
            {overview && (
              <Link className="btn btn-2" to={ROUTES.reports}>
                <Icon name={icons.chart} size="sm" />
                نظرة المؤسسة
              </Link>
            )}
          </header>

          {day.progress.first && !done && (
            <p className="tday-first">هذا يومك · رتّبنا لك ما ينتظرك حسب أقربه لنهاية مدته · ابدأ بالبطاقة الأولى، وكلما أنجزت بندًا ظهر الذي يليه.</p>
          )}

          <div className="g2 tday-g">
            <div className="col">
              {done ? (
                <Glass className="tday-done">
                  <span className="badge badge-44"><AbLeaf className="aispark" /></span>
                  <h2 className="tday-done-t">أنجزتَ كل شيء لليوم</h2>
                  <p className="sub">
                    {day.progress.today
                      ? <>أنجزت <span className="num">{day.progress.today}</span> {day.progress.today === 1 ? 'إجراءً' : 'إجراءات'} اليوم · لا شيء آخر ينتظرك.</>
                      : 'لا شيء ينتظرك الآن · ما يصل إليك يظهر هنا أولًا.'}
                  </p>
                  {day.progress.moved.length > 0 && (
                    <ul className="tday-moved">
                      {day.progress.moved.map((m) => <li key={m.href}><Link to={m.href}>{m.text}</Link></li>)}
                    </ul>
                  )}
                </Glass>
              ) : next && (
                <Glass className={`tday-next${leaving ? ' out' : ''}`} key={key(next)}>
                  <div className="tday-next-h">
                    <span className="tday-q"><Icon name={icons[next.icon]} size="sm" />{next.queue}</span>
                    <Tag tone={next.lane === 'due' ? 'warn' : next.lane === 'returned' ? 'teal' : 'mute'}>{LANE_SAY[next.lane]}</Tag>
                  </div>
                  <span className="sub">ابدأ بهذا</span>
                  <h2 className="tday-next-t">{next.title}</h2>
                  <p className="sub">{next.sub}{next.code ? ` · ${next.code}` : ''}</p>
                  <div className="tday-next-m">
                    <span className={next.lane === 'due' ? 'tday-why tday-late' : 'tday-why'}>{next.why}</span>
                    {next.amount ? <Money sm>{next.amount}</Money> : null}
                  </div>
                  <div className="tday-next-a">
                    <button type="button" className="btn btn-p" onClick={() => finish(next)}>{next.quick ? next.quick.label : 'افتح وأنجزه'}</button>
                    {next.quick && <button type="button" className="btn btn-2" onClick={() => go(next)}>افتح السجل</button>}
                    {after && <button type="button" className="btn btn-ghost" onClick={() => setLater((x) => [...x, key(next)])}>لاحقًا</button>}
                  </div>
                  {after && <p className="sub tday-then">ثم: {after.title} · {after.queue}</p>}
                </Glass>
              )}

              {!done && day.queues.length > 1 && (
                <div className="tday-chips" role="group" aria-label="بنودك حسب المرحلة">
                  <button type="button" className={`fchip${!queue ? ' on' : ''}`} aria-pressed={!queue} onClick={() => setQueue('')}>
                    الكل <span className="num">{day.items.length}</span>
                  </button>
                  {day.queues.map((q) => (
                    <button key={q.key} type="button" className={`fchip${queue === q.key ? ' on' : ''}`} aria-pressed={queue === q.key} onClick={() => setQueue(queue === q.key ? '' : q.key)}>
                      {q.label} <span className="num">{q.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {LANES.map((l) => {
                const rows = shown(l)
                if (!rows.length) return null
                const all = open[l]
                return (
                  <Glass key={l} className="tday-lane">
                    <Head title={<>{LANE_SAY[l]} <span className="num sub">{rows.length}</span></>} meta={<span className="sub">{LANE_NOTE[l]}</span>} />
                    <ul className="tday-list">
                      {(all ? rows : rows.slice(0, SHOW)).map((i) => <Row key={key(i)} i={i} go={go} />)}
                    </ul>
                    {rows.length > SHOW && (
                      <button type="button" className="btn btn-ghost btn-sm tday-more" onClick={() => setOpen((o) => ({ ...o, [l]: !all }))}>
                        {all ? 'اعرض أقل' : `اعرض الكل (${rows.length})`}
                      </button>
                    )}
                  </Glass>
                )
              })}
            </div>

            <div className="col">
              <Glass className="tday-prog">
                <Head title="تقدّمك" meta={<span className="sub">من سجل التدقيق باسمك</span>} />
                <div className="tday-bar" role="img" aria-label={`أنجزت ${day.progress.today} من ${day.progress.today + day.items.length} اليوم`}>
                  <i style={{ inlineSize: `${Math.round(day.progress.share * 100)}%` }} />
                </div>
                <p className="tday-pl">
                  أنجزت <b className="num">{day.progress.today}</b> اليوم
                  {day.items.length ? <> · بقي <b className="num">{day.items.length}</b></> : ' · لا شيء متبقٍّ'}
                </p>
                <p className="sub">هذا الأسبوع: <span className="num">{day.progress.week}</span> {day.progress.week === 1 ? 'إجراء' : 'إجراءات'} باسمك</p>
                <h3 className="tday-sh">تحرّك بفضلك</h3>
                {day.progress.moved.length ? (
                  <ul className="tday-moved">
                    {day.progress.moved.map((m) => <li key={m.href}><Link to={m.href}>{m.text}</Link></li>)}
                  </ul>
                ) : <p className="sub">يظهر هنا ما يتقدّم بعد خطوتك: مشروع اعتُمد بعد توصيتك، دفعة صُرفت بعد إذنك، مشروع أُغلق.</p>}
              </Glass>

              {day.byLane.coming.length > 0 && (
                <Glass className="tday-lane">
                  <Head title={<>{LANE_SAY.coming} <span className="num sub">{day.byLane.coming.length}</span></>} meta={<span className="sub">{LANE_NOTE.coming}</span>} />
                  <ul className="tday-list">
                    {day.byLane.coming.slice(0, SHOW).map((i) => <Row key={key(i)} i={i} go={go} />)}
                  </ul>
                </Glass>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/** One item · the whole row opens it, and the visit remembers where it came from */
function Row({ i, go }: { i: TodayItem; go: (i: TodayItem) => void }) {
  return (
    <li {...rowGo(() => go(i), i.to, 'tday-row')}>
      <Icon name={icons[i.icon]} size="sm" />
      <span className="tday-rt">
        <span className="tday-rn">{i.title}</span>
        <span className="sub tday-rs">{i.queue} · {i.sub}</span>
      </span>
      <span className={i.lane === 'due' ? 'tday-rw tday-late' : 'tday-rw sub'}>{i.why}{i.date && <> <DateText>{i.date}</DateText></>}</span>
      {i.amount ? <Money sm>{i.amount}</Money> : <span />}
      <Icon name={icons.chevron} size="sm" className="tday-go" />
    </li>
  )
}
