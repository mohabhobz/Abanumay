import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Money } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { df, NOUN, nounAfter, pct } from '@/lib/format'
import { TONE } from '@/lib/tone'
import { IdentityBanner } from '@/components/soul'
import { Columns, SaudiMap, Spark, StackBar, type MapPoint, type MapRow } from '@/components/charts'
import {
  amountTrend, backlogTrend, complianceTrend, inboxFor, oldestTrend, TREND_DAYS,
  type InboxItem, type InboxQueue, type TrendPoint,
} from './inbox'
import { budgetOf, myProjects, topEntities } from './mine'

/* Today · what waits on me, per role.

   The home page used to be one combined dashboard for every role (now `HomeOverview`, a category
   in Reports at ROUTES.overview). The client asked for the opposite: each role opens on the requests that sit
   with it, in the order its work arrives. So the page is the role's queues, nothing else:

     four numbers with their trend: how much waits, how much of it is within its limit, what it
     is worth, and how old the oldest is
     the queues as one plain list in the client's order · a row opens the module's list filtered to
     that stage (the same count, so nothing disappears on the way)
     then the same work drawn: where it is on the map, how old it is, and where the money sits.

   Switching the profile from the account menu swaps the whole page, which is how the three views
   are reviewed in the prototype. */

const GREET = () => (new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير')

export default function HomePage() {
  const { role, user } = useRole()
  const queues = useMemo(() => inboxFor(role.key, user.name), [role.key, user.name])
  /* Phone only (F-5) · the drawn analysis stays folded until asked for */
  const [more, setMore] = useState(false)

  const all = queues.flatMap((q) => q.items)
  const late = all.filter((i) => i.late)
  const busy = queues.filter((q) => q.items.length > 0)
  const oldest = [...all].sort((a, b) => b.days - a.days)[0]
  const lateQ = [...queues].sort((a, b) => lateOf(b) - lateOf(a))[0]
  const money = all.reduce((a, i) => a + (i.amount ?? 0), 0)
  const richQ = [...queues].sort((a, b) => moneyOf(b) - moneyOf(a))[0]
  const within = all.length ? Math.round(((all.length - late.length) / all.length) * 100) : 100
  const verb = role.key === 'supervisor' ? 'توصيتك' : role.key === 'grants-manager' ? 'اعتمادك' : 'قرارك'

  /* E-6 · E-8 · the money and the partners of the role's own projects */
  const mine = useMemo(() => myProjects(role.key, user.name), [role.key, user.name])
  const bud = useMemo(() => budgetOf(mine), [mine])
  const tops = useMemo(() => topEntities(mine, 3), [mine])
  const budParts = [
    { key: 'spent', label: 'المصروف', value: bud.spent, color: 'var(--ch-1)' },
    { key: 'reserved', label: 'المحجوز', value: bud.reserved, color: 'var(--ch-2)' },
    { key: 'remaining', label: 'المتبقي', value: bud.remaining, color: 'var(--ch-4)' },
  ]
  const scope = role.key === 'supervisor' ? 'مشاريعك' : role.key === 'grants-manager' ? 'مشاريع فريقك' : 'المحفظة'

  const tiles: Tile[] = [
    {
      k: `بانتظار ${verb}`,
      v: String(all.length),
      note: `في ${busy.length} قوائم`,
      to: (busy[0] ?? queues[0]).all,
      trend: backlogTrend(all),
    },
    {
      k: 'ضمن المدة',
      v: pct(within),
      note: late.length ? `${late.length} متأخرة` : 'لا متأخر',
      to: lateQ.all,
      trend: complianceTrend(all),
    },
    {
      k: 'القيمة المنتظرة',
      v: (money / 1_000_000).toFixed(1),
      note: 'مليون ريال',
      to: richQ.all,
      trend: amountTrend(all),
    },
    {
      k: 'أقدم انتظار',
      v: String(oldest?.days ?? 0),
      note: oldest ? nounAfter(oldest.days, NOUN.day) : 'لا شيء ينتظر',
      to: oldest ? oldest.to : queues[0].all,
      trend: oldestTrend(all),
    },
  ]

  return (
    <AppLayout assistantContext={assistFor.home(user.name, all.length, late.length)}>
      <div className="viewstack">
        <div className="screen col pt">
          {/* One screen, no scroll on desktop: the fold takes the view's height, the strip takes
              its own, and the work row gets the rest · each card shrinks its chart into the space
              instead of the page growing. On narrow screens it falls back to a normal stack. */}
          <section className="ibx-fold">
            <IdentityBanner
              title={<>{GREET()}، {user.name.split(' ')[0]}</>}
              sub={<>{df.format(new Date())} · {user.role}</>}
              action={
                <Link className="btn btn-ghost btn-sm" to={ROUTES.overview}>
                  <Icon name={icons.chart} size="sm" />
                  اللوحة المجمّعة
                </Link>
              }
            />

            <div className="kpis">
              {tiles.map((t) => (
                <Link key={t.k} to={t.to} className="kpi glass has-spk">
                  <TileBody {...t} />
                </Link>
              ))}
            </div>

            <div className={`ibx-main${more ? ' more' : ''}`}>
              <QueueList queues={queues} />
              <div className="ibx-more">
                <button type="button" className="btn btn-2" aria-expanded={more} onClick={() => setMore((x) => !x)}>
                  <Icon name={icons.chart} size="sm" />
                  {more ? 'أخفِ الخريطة والأرقام' : 'اعرض الخريطة والميزانية والأعمار'}
                </button>
              </div>

              <Glass className="ibx-map">
                <Head title="أين تقع طلباتك" meta={<span className="sub">حسب منطقة المشروع</span>} />
                <SaudiMap points={mapPoints(all, queues)} unit="طلبًا" amounts list={cityRows(all)} />
              </Glass>

              <div className="ibx-side">
                <Glass className="ibx-age">
                  <Head title="أعمار الطلبات" meta={<span className="sub">بالأيام</span>} />
                  <Columns cols={ageing(all)} />
                </Glass>
                <Glass className="ibx-bud">
                  <Head
                    title={`ميزانية ${scope}`}
                    meta={<span className="sub"><Money sm>{bud.granted}</Money></span>}
                  />
                  <StackBar parts={budParts} total={bud.granted} />
                  {/* One line, not a stacked legend: the card shares the column with two others */}
                  <ul className="ibx-budl">
                    {budParts.map((x) => (
                      <li key={x.key}>
                        <i style={{ background: x.color }} aria-hidden="true" />
                        {x.label} <b className="num">{(x.value / 1_000_000).toFixed(1)} م</b>
                      </li>
                    ))}
                  </ul>
                </Glass>
                <Glass className="ibx-entcard">
                  <Head title="أعلى جهاتك دعمًا" meta={<span className="sub">{yearSpan(tops)}</span>} />
                  <ul className="ibx-ents">
                    {tops.map((e) => (
                      <li key={e.id}>
                        <Link to={ROUTES.entity(e.id)} title={`${e.projects} ${nounAfter(e.projects, NOUN.project)} · ${e.years.join('، ')}`}>
                          <span className="ibx-tn">{e.name}</span>
                          <span className="ibx-tm">{e.projects} {nounAfter(e.projects, NOUN.project)}</span>
                          <Money sm>{e.total}</Money>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Glass>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}

interface Tile { k: string; v: string; note: string; to: string; trend: TrendPoint[] }

const lateOf = (q: InboxQueue) => q.items.filter((i) => i.late).length
const moneyOf = (q: InboxQueue) => q.items.reduce((a, i) => a + (i.amount ?? 0), 0)

/** One point per region · the note says which queues the region's requests sit in */
function mapPoints(items: InboxItem[], queues: InboxQueue[]): MapPoint[] {
  const by = new Map<string, InboxItem[]>()
  for (const i of items) if (i.region) by.set(i.region, [...(by.get(i.region) ?? []), i])
  return [...by].map(([region, list]) => ({
    key: region,
    label: region,
    value: list.length,
    amount: list.reduce((a, i) => a + (i.amount ?? 0), 0),
    note: queues
      .map((q) => [q.label, list.filter((i) => q.items.includes(i)).length] as const)
      .filter(([, n]) => n > 0)
      .map(([l, n]) => `${l} ${n}`)
      .join(' · '),
  }))
}

/** The years the ranking covers · it accumulates across years instead of resetting each one */
const yearSpan = (rows: { years: string[] }[]): string => {
  const ys = [...new Set(rows.flatMap((r) => r.years))].sort()
  return ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : ys[0] ?? 'كل السنوات'
}

/** E-5 · cities under the map, most requests first · swipes sideways when there are many */
function cityRows(items: InboxItem[]): MapRow[] {
  const by = new Map<string, MapRow>()
  for (const i of items) {
    if (!i.city) continue
    const r = by.get(i.city) ?? { key: i.city, label: i.city, value: 0, amount: 0 }
    r.value += 1
    r.amount = (r.amount ?? 0) + (i.amount ?? 0)
    by.set(i.city, r)
  }
  return [...by.values()].sort((a, b) => b.value - a.value || (b.amount ?? 0) - (a.amount ?? 0))
}

/* Buckets on the decision boundaries the system already uses: a week is fine, two raise a question,
   a month is a problem. A column turns amber or red by the share of its requests past their limit. */
function ageing(items: InboxItem[]) {
  const b = [
    { key: '0–7', label: 'حتى 7', test: (d: number) => d <= 7 },
    { key: '8–14', label: '8–14', test: (d: number) => d > 7 && d <= 14 },
    { key: '15–30', label: '15–30', test: (d: number) => d > 14 && d <= 30 },
    { key: '+30', label: 'أكثر من 30', test: (d: number) => d > 30 },
  ]
  return b.map((x) => {
    const here = items.filter((i) => x.test(i.days))
    const share = here.length ? here.filter((i) => i.late).length / here.length : 0
    return {
      key: x.key,
      label: x.label,
      value: here.length,
      color: share >= 0.5 ? 'var(--ch-late)' : share > 0 ? 'var(--ch-warn)' : 'var(--ch-2)',
    }
  })
}

const SLA_SAY = { ok: 'ضمن الحدّ', near: 'قريب من الحدّ', late: 'فوق الحدّ' } as const

function TileBody({ k, v, note, trend }: Tile) {
  const first = trend[0]
  const last = trend[trend.length - 1]
  return (
    <>
      <span className="kpi-h">
        <span className="kpi-k">{k}</span>
        <Icon name={icons.chevron} size="sm" className="kpi-go" />
      </span>
      <span className="kpi-v num">{v}</span>
      <span className="kpi-n">{note}</span>
      <Spark
        points={trend}
        label={`${k} خلال آخر ${TREND_DAYS} يومًا: من ${first.value} إلى ${last.value} · اليوم ${SLA_SAY[last.sla]}`}
      />
    </>
  )
}

/* The queues as one list · each row is the queue's door: it opens the module's list at the stage
   that sits with this role. Empty queues stay in place (the order is the client's) but quiet. */
function QueueList({ queues }: { queues: InboxQueue[] }) {
  return (
    <Glass className="ibx-listcard">
      <Head title="قوائمك" meta={<span className="sub">بترتيب العمل</span>} />
      <ul className="ibx-list">
        {queues.map((q) => {
          const n = q.items.length
          const over = lateOf(q)
          const old = Math.max(0, ...q.items.map((i) => i.days))
          return (
            <li key={q.key}>
              <Link to={q.all} className={n === 0 ? 'none' : ''}>
                <Icon name={icons[q.icon]} size="sm" />
                <span className="ibx-l">
                  <span className="ibx-lt">{q.label}</span>
                  <span className="sub ibx-ln">
                    {n === 0 ? 'لا شيء بانتظارك' : old > 0 ? `أقدمها ${old} ${nounAfter(old, NOUN.day)}` : q.note}
                  </span>
                </span>
                {over > 0 && <span className={`tag ${TONE.late}`}>{over} فوق الحدّ</span>}
                <b className="ibx-n num">{n}</b>
                <Icon name={icons.chevron} size="sm" className="ibx-go" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Glass>
  )
}
