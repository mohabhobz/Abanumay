import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Glass, Icon, icons, Num, SearchBox, Segments, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf, NOUN, nounAfter } from '@/lib/format'
import { LIVE_SPECS, catalogTotals, type LiveSpec } from '@/data/liveReports'

/**
 * Report catalog — every screen in the current system, with everything
 * it contains.
 *
 * The requirement was that nothing should be worked on while its
 * information is still incomplete. This is where that's proven: all 13
 * screens are here, and each opens onto its real columns, filters,
 * charts, and row shapes.
 *
 * The order is deliberate: working screens first, then ones that are a
 * form with no result, and the empty ones last — so whoever is reviewing
 * sees what's alive before what's dead.
 */

type Filter = 'all' | 'live' | 'form' | 'empty'

const stateOf = (s: LiveSpec): Exclude<Filter, 'all'> =>
  s.flaw ? 'empty' : s.rowsLive === null ? 'form' : 'live'

const STATE_TAG: Record<Exclude<Filter, 'all'>, { label: string; tone: 'ok' | 'warn' | 'no' }> = {
  live: { label: 'جدول جاهز', tone: 'ok' },
  form: { label: 'نموذج قبل النتيجة', tone: 'warn' },
  empty: { label: 'فارغة في النظام', tone: 'no' },
}

const ORDER: Record<string, number> = { live: 0, form: 1, empty: 2 }

export function Catalog() {
  const [q, setQ] = useState('')
  const [state, setState] = useState<Filter>('all')

  const list = useMemo(() => {
    const t = q.trim()
    return LIVE_SPECS
      .filter((s) => state === 'all' || stateOf(s) === state)
      .filter((s) => !t || s.title.includes(t) || s.path.includes(t) ||
        s.question.includes(t) || s.cols.some((c) => c.label.includes(t)))
      .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || (b.rowsLive ?? 0) - (a.rowsLive ?? 0))
  }, [q, state])

  return (
    <>
      {/* The number summarizing the whole module — computed from the catalog,
          not hardcoded. */}
      <Glass className="catsum">
        <div className="catsum-g">
          <Stat n={catalogTotals.screens} k="شاشة تقرير" />
          <Stat n={catalogTotals.cols} k={nounAfter(catalogTotals.cols, NOUN.describedColumn)} />
          <Stat n={catalogTotals.filters} k={nounAfter(catalogTotals.filters, NOUN.filter)} />
          <Stat n={catalogTotals.charts} k={nounAfter(catalogTotals.charts, NOUN.chart)} />
          <Stat n={catalogTotals.rows} k={`${nounAfter(catalogTotals.rows, NOUN.row)} في الشاشات`} big />
        </div>
        <p className="mut rpsec-n mt-3">
          كل شاشة تقرير في النظام العامل موصوفة هنا بالكامل: أعمدتها بأسمائها،
          وفلاترها بعدد خياراتها، ورسومها، ومستويات التعمّق إن وُجدت. اضغط أي
          شاشة لعرض جدولها بأعمدته الحقيقية، <b>القيم في الصفوف تجريبية</b>،
          والأعمدة والفلاتر منقولة كما هي.
        </p>
      </Glass>

      <div className="ftool-r">
        <div className="ftool-f">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث باسم التقرير أو عمود فيه…" />
          <Segments
            active={state === 'all' ? undefined : state}
            onChange={(v) => setState((v as Filter) ?? 'all')}
            items={[
              { key: 'live', label: 'جداول جاهزة', count: LIVE_SPECS.filter((s) => stateOf(s) === 'live').length },
              { key: 'form', label: 'نموذج قبل النتيجة', count: LIVE_SPECS.filter((s) => stateOf(s) === 'form').length },
              { key: 'empty', label: 'فارغة', count: catalogTotals.broken },
            ]}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <Glass><Empty title="لا توجد شاشة بهذا الوصف." note="ابحث باسم آخر أو امسح البحث." /></Glass>
      ) : (
        <div className="catg">
          {list.map((s) => <Card key={s.key} s={s} />)}
        </div>
      )}
    </>
  )
}

function Stat({ n, k, big }: { n: number; k: string; big?: boolean }) {
  return (
    <div className={`catsum-s${big ? ' big' : ''}`}>
      <b className="num">{nf.format(n)}</b>
      <span className="sub">{k}</span>
    </div>
  )
}

function Card({ s }: { s: LiveSpec }) {
  const st = stateOf(s)
  const tag = STATE_TAG[st]

  return (
    <Link to={ROUTES.liveReport(s.key)} className="catc glass">
      <span className="catc-h">
        <span className="catc-i"><Icon name={icons[s.icon]} size="md" /></span>
        <span className="catc-t">{s.title}</span>
        <Tag tone={tag.tone}>{tag.label}</Tag>
      </span>

      <code className="mono catc-p">control/{s.path}</code>

      <p className="catc-q">{s.question}</p>
      <p className="catc-w mut">{s.what}</p>

      {/* The counters are what tell you "what's in this screen" at a glance. */}
      <span className="catc-n">
        <b><Num>{s.cols.length}</Num> {nounAfter(s.cols.length, NOUN.column)}</b>
        {s.filters.length > 0 && <b><Num>{s.filters.length}</Num> {nounAfter(s.filters.length, NOUN.filter)}</b>}
        {s.charts.length > 0 && <b><Num>{s.charts.length}</Num> {nounAfter(s.charts.length, NOUN.chart)}</b>}
        {s.drill && <b><Num>{s.drill.length}</Num> {nounAfter(s.drill.length, NOUN.level)}</b>}
        {s.rowsLive !== null && (
          <span className="sub"><Num>{s.rowsLive}</Num> {nounAfter(s.rowsLive, NOUN.row)} في النظام</span>
        )}
      </span>

      {s.finding && <span className="catc-f">{isolate(s.finding)}</span>}
    </Link>
  )
}
