import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  StepLink, BackTo, DateText, Empty, Glass, Head, Icon, icons, Mono, Money, MultiSelect, Num, Person,
  SearchBox, Select, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { NOUN, nf, nounAfter, countOf } from '@/lib/format'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import { LIVE_SPECS, specByKey, type LiveCol, type LiveFilterDef, type LiveSpec } from '@/data/liveReports'
import { budgetTree, liveRows, type BudgetNode, type LiveRow } from '@/data/mock/liveRows'
import { CYCLES } from '@/data/budgetPlan'
import { FieldSpend, PlanCoverage, SpendGauge, YearSpend } from '@/features/budget/BudgetCharts'

/**
 * One catalog report screen.
 *
 * This page both describes the real screen and runs it at the same time:
 *
 * - At the top: the question it answers, its path in the system, and its
 * real row count there.
 * - Below that: the filters as they actually are, each labeled with its
 * real option count, because "97 options in one dropdown" is itself the
 * problem and needs to be visible.
 * - Then: the table with its real columns and row shapes.
 * - Budget is the exception: a four-level tree instead of a single table.
 *
 * Any issue found on the real screen is written where it belongs, not
 * hidden in a separate document — the client opens the screen and finds
 * what we found.
 */
export default function LiveReport() {
  const { key = '' } = useParams<{ key: string }>()
  const spec = specByKey(key)

  if (!spec) {
    return (
      <AppLayout assistantContext={assistFor.page('التقارير')}>
        <div className="viewstack"><div className="screen col">
          <Glass>
            <Empty
              title="هذه الشاشة غير موجودة في الكتالوج."
              note="عُد إلى الكتالوج واختر تقريرًا منه."
              actions={<Link className="btn btn-2" to={ROUTES.reportTab('catalog')}>كتالوج التقارير</Link>}
            />
          </Glass>
        </div></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout assistantContext={assistFor.page(spec.title)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo to={ROUTES.reportTab('catalog')} label="الكتالوج" />

          <header>
            <div>
              <h1 className="ptitle">{spec.title}</h1>
              <p className="sub mt-1">
                <code className="mono">control/{spec.path}</code>
                {spec.rowsLive !== null && (
                  <> · <span className="num">{nf.format(spec.rowsLive)}</span> {nounAfter(spec.rowsLive, NOUN.row)} في النظام الحالي</>
                )}
                {spec.flaw && <> · <Tag tone="mute">{spec.flaw}</Tag></>}
              </p>
            </div>
          </header>

          <Glass className="lrq">
            <p className="lrq-q">{spec.question ? spec.question : spec.what}</p>
            {spec.question && <p className="mut lrq-w">{spec.what}</p>}
          </Glass>

          {spec.finding && (
            <Glass className="lrfind">
              <span className="badge badge-30"><Icon name={icons.insight} size="sm" /></span>
              <p>{spec.finding}</p>
            </Glass>
          )}

          {spec.charts.length > 0 && <Charts spec={spec} />}

          {spec.key === 'budget' ? <BudgetTree /> : <Rows spec={spec} />}

          <Nav spec={spec} />
        </div>
      </div>
    </AppLayout>
  )
}

/* Charts */

function Charts({ spec }: { spec: LiveSpec }) {
  return (
    <section className="rpsec">
      <Head title="رسوم الشاشة" meta={`${countOf(spec.charts.length, NOUN.chart)} في النظام`} />
      {spec.charts.map((c) => (
        <RealChart key={c.title} title={c.title} />
      ))}
    </section>
  )
}

/**
 * Charts are drawn from real data, not placeholder outlines.
 *
 * An earlier version drew random bars that only showed the chart's
 * shape, not its values — that was the wrong call: a screen claiming
 * "there's a chart here" without actually rendering it is no different
 * from a line of text. The three charts in `reports1_1` and the four in
 * `reports1_5` all feed from the same allocation tree, so all of them are rendered.
 */
function RealChart({ title }: { title: string }) {
  const c2026 = CYCLES[0]
  if (title.includes('نسبة المصروف')) {
    return <SpendGauge title={title} value={c2026.spent} of={c2026.alloc} />
  }
  if (title.includes('حسب المجال') && title.includes('المصاريف')) return <FieldSpend />
  if (title === 'المصاريف السنوية') return <YearSpend />
  if (title.includes('الإنجاز')) return <PlanCoverage />
  return null
}

/* Table */

function cellOf(v: string | number | undefined, c: LiveCol) {
  if (v === undefined || v === '') return <span className="sub"> </span>
  if (c.kind === 'money' && typeof v === 'number') return <Money>{v}</Money>
  if (c.kind === 'num' && typeof v === 'number') return <Num>{v}</Num>
  if (c.kind === 'id') return <Mono>{String(v)}</Mono>
  if (c.kind === 'date') return <DateText>{String(v)}</DateText>
  if (c.kind === 'pct') return <span className="num">{String(v)}</span>
  if (c.kind === 'file') return <span className="lrfile"><Icon name={icons.clip} size="sm" />{String(v)}</span>
  if (c.kind === 'link') return <span className="lnk">{String(v)}</span>
  if (c.kind === 'person') return <Person name={String(v)} quiet={false} />
  return String(v)
}

/* Filters · the screen's real filters, run on the sample rows.

   They used to be drawn as a static list of bespoke chips above the table — a fourth filter
   look in the system. Now they are the system toolbar itself (`Glass.ftoolbar`): search,
   `MultiSelect`, «فلاتر متقدمة», and the active-filter chips with «مسح الكل», exactly as on the
   projects list. A filter works when the sample table has its column; one without a column
   stays listed (so the inventory is complete) but disabled. */

/** Filter label → column label, where the live system names them differently */
const FILTER_COL: Record<string, string> = { 'حالة المشاريع': 'حالة المشروع' }

type LiveFilter = LiveFilterDef & { col?: LiveCol }

function filtersOf(spec: LiveSpec): { selects: LiveFilter[]; rest: LiveFilter[]; texts: LiveFilterDef[] } {
  const colFor = (label: string) => spec.cols.find((c) => c.label === (FILTER_COL[label] ?? label))
  const all = spec.filters.filter((f) => f.kind !== 'text').map((f) => ({
    ...f, col: f.kind === 'select' ? colFor(f.label) : undefined,
  }))
  const live = all.filter((f) => f.col)
  return {
    selects: live.slice(0, 2),
    rest: [...live.slice(2), ...all.filter((f) => !f.col)],
    texts: spec.filters.filter((f) => f.kind === 'text'),
  }
}

const SEARCH_KINDS = new Set(['id', 'text', 'long', 'person', 'link'])

function Rows({ spec }: { spec: LiveSpec }) {
  const rows = useMemo(() => liveRows(spec, 24), [spec])
  const { selects, rest, texts } = useMemo(() => filtersOf(spec), [spec])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [advOpen, setAdvOpen] = useState(false)

  const valuesOf = (f: LiveFilter) => picked[f.label] ?? []
  const pick = (f: LiveFilter, v: string[]) => setPicked((p) => ({ ...p, [f.label]: v }))
  const clear = () => { setQ(''); setPicked({}) }

  /* Options come from the sample rows, each with its row count — same as the list screens */
  const optionsOf = (f: LiveFilter) => {
    if (!f.col) return []
    const n = new Map<string, number>()
    for (const r of rows) {
      const v = String(r[f.col.key] ?? '')
      if (v) n.set(v, (n.get(v) ?? 0) + 1)
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => ({ value: v, label: `${v} (${c})` }))
  }

  const live = useMemo(() => [...selects, ...rest].filter((f) => f.col), [selects, rest])
  const shown = useMemo(() => {
    const t = q.trim()
    return rows.filter((r) =>
      live.every((f) => {
        const vs = picked[f.label] ?? []
        return vs.length === 0 || vs.includes(String(r[f.col!.key] ?? ''))
      }) &&
      (!t || spec.cols.some((c) => SEARCH_KINDS.has(c.kind) && String(r[c.key] ?? '').includes(t))))
  }, [rows, live, picked, q, spec.cols])

  if (spec.cols.length === 0) {
    return (
      <Glass>
        <Empty
          title="هذه الشاشة فارغة في النظام الحالي."
          note="تُفتح دون جدول أو فلاتر أو رسوم، ولا يوجد منها إلا اسمها في القائمة. أُدرجت هنا ليبقى الجرد كاملًا، ولأنها بند في قائمة متطلبات الواجهة الخلفية."
        />
      </Glass>
    )
  }

  const sheet: Sheet = {
    file: `abanumay-${spec.path}`,
    title: spec.title,
    headers: spec.cols.map((c) => c.label),
    rows: shown.map((r) => spec.cols.map((c) => String(r[c.key] ?? ''))),
  }

  const only = spec.cols.filter((c) => c.only)
  const heavy = spec.filters.filter((f) => (f.count ?? 0) >= 20).length
  const advCount = rest.filter((f) => valuesOf(f).length > 0).length
  const chips = live.flatMap((f) => valuesOf(f).map((v) => ({ f, v })))
  const hasFilters = spec.filters.length > 0

  return (
    <section className="rpsec">
      <Head
        title="الجدول بأعمدته"
        meta={`${countOf(spec.cols.length, NOUN.column)}${hasFilters ? ` · ${countOf(spec.filters.length, NOUN.filter)}` : ''} · عيّنة ${countOf(rows.length, NOUN.row)}`}
      />

      <p className="mut rpsec-n">
        القيم تجريبية · الأعمدة والفلاتر منقولة من <code className="mono">control/{spec.path}</code>.
        {heavy > 0 && (
          <>
            {' '}في النظام الحالي <Num>{heavy}</Num> من فلاترها <b>منسدلة طويلة بلا بحث</b>،
            وهنا كل قائمة طويلة مزوّدة ببحث داخلي.
          </>
        )}
        {only.length > 0 && (
          <>
            {' '}الأعمدة المعلّمة <b>لا مثيل لها في أي شاشة أخرى</b>: {only.map((c) => c.label).join(' · ')}.
          </>
        )}
      </p>

      <Glass className="ftoolbar rptb">
        <div className="ftool-r">
          <div className="ftool-f">
            {texts.length > 0 && (
              <SearchBox
                value={q}
                onChange={setQ}
                placeholder={`ابحث ب${texts.map((f) => f.label).join(' أو ')}…`}
              />
            )}
            {selects.map((f) => (
              <MultiSelect
                key={f.label}
                values={valuesOf(f)}
                all={f.label}
                options={optionsOf(f)}
                people={f.col?.kind === 'person'}
                onChange={(v) => pick(f, v)}
              />
            ))}
            {rest.length > 0 && (
              <button
                className={`fchip${advOpen ? ' on' : ''}`}
                onClick={() => setAdvOpen((x) => !x)}
                aria-expanded={advOpen}
              >
                <Icon name={icons.filter} size="sm" />
                فلاتر متقدمة
                {advCount > 0 && <b className="num">{advCount}</b>}
              </button>
            )}
            {!hasFilters && (
              <span className="sub">
                <span className="num">{nf.format(shown.length)}</span> {nounAfter(shown.length, NOUN.row)} · لا فلاتر لهذه الشاشة في النظام
              </span>
            )}
          </div>
          <div className="ftool-a">
            <ExportMenu sheet={sheet} note={`${spec.title} · ${countOf(shown.length, NOUN.row)}`} />
          </div>
        </div>

        {advOpen && rest.length > 0 && (
          <div className="fgrid">
            {rest.map((f) => (
              <div key={f.label} className="fgrid-i">
                {f.col ? (
                  <MultiSelect
                    label={f.label}
                    values={valuesOf(f)}
                    all="الكل"
                    options={optionsOf(f)}
                    people={f.col.kind === 'person'}
                    onChange={(v) => pick(f, v)}
                  />
                ) : (
                  /* No column for it in the sample table · listed, not usable */
                  <Select
                    label={f.label}
                    icon={f.kind === 'date' ? icons.clock : undefined}
                    disabled
                    options={[]}
                    all="لا عمود له في العيّنة"
                    onChange={() => undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {(chips.length > 0 || q.trim()) && (
          <div className="factive">
            {q.trim() && (
              <button className="fpill" onClick={() => setQ('')}>
                <span className="sub">بحث:</span> {q.trim()}
                <Icon name={icons.close} size="sm" />
              </button>
            )}
            {chips.map(({ f, v }) => (
              <button
                key={`${f.label}:${v}`}
                className="fpill"
                onClick={() => pick(f, valuesOf(f).filter((x) => x !== v))}
              >
                <span className="sub">{f.label}:</span>{' '}
                {f.col?.kind === 'person' ? <Person name={v} quiet={false} /> : v}
                <Icon name={icons.close} size="sm" />
              </button>
            ))}
            <button className="fclear" onClick={clear}>مسح الكل</button>
          </div>
        )}
      </Glass>

      <Glass className="tblcard">
        {shown.length === 0 ? (
          <Empty title="لا توجد صفوف بهذه الفلاتر." note="خفّف الفلاتر أو امسحها." />
        ) : (
        <div className="tblwrap">
          <div className="tblock">
            <table className="tbl">
              <colgroup>
                {spec.cols.map((c) => <col key={c.key} style={{ width: c.w ?? 130 }} />)}
              </colgroup>
              <thead>
                <tr>
                  {spec.cols.map((c) => (
                    <th key={c.key} className={c.kind === 'num' || c.kind === 'money' || c.kind === 'pct' ? 'n' : undefined}>
                      {/* Same `DataTable` wrapper: without it, a long column header truncates
                          with no ellipsis — "Actual Implementation Duration" used to cut off
                          mid-word. */}
                      <span className="th-t">{c.label}</span>
                      {c.only && <span className="lronly" title="عمود لا مثيل له في شاشة أخرى">•</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => <Row key={i} r={r} cols={spec.cols} />)}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </Glass>
    </section>
  )
}

function Row({ r, cols }: { r: LiveRow; cols: LiveCol[] }) {
  return (
    <tr>
      {cols.map((c) => (
        <td
          key={c.key}
          className={c.kind === 'num' || c.kind === 'money' || c.kind === 'pct' ? 'n' : undefined}
          title={String(r[c.key] ?? '')}
        >
          {cellOf(r[c.key], c)}
        </td>
      ))}
    </tr>
  )
}

/* Budget tree */

/**
 * Budget is a tree, not a table.
 *
 * The current system builds this tree across four consecutive pages:
 * clicking "View" navigates to another page, and you go back with the
 * browser button. Once you drill to the fourth level, the columns drop
 * from six to three for no reason.
 *
 * Here it's one level with a breadcrumb trail above it: navigation stays
 * within the same screen, and the columns are identical at every level.
 */
function BudgetTree() {
  const [path, setPath] = useState<BudgetNode[]>([])
  const list = path.length === 0 ? budgetTree : (path[path.length - 1].children ?? [])
  const leaf = list.length === 0

  const rows = leaf ? [] : list
  const sheet: Sheet = {
    file: `abanumay-budget-${path.map((n) => n.id).join('-') || 'root'}`,
    title: `الميزانية · ${path.map((n) => n.label).join(' ← ') || 'كل الدورات'}`,
    headers: ['البند', 'الميزانية', 'المعتمد', 'المحجوز', 'المصروف', 'المتبقي', 'نسبة المتبقي'],
    rows: rows.map((n) => [
      n.label, String(n.budget), String(n.approved), String(n.reserved),
      String(n.spent), String(n.left), `${n.leftPct}%`,
    ]),
    totals: rows.length > 1 ? [
      'الإجمالي',
      String(rows.reduce((s, n) => s + n.budget, 0)),
      String(rows.reduce((s, n) => s + n.approved, 0)),
      String(rows.reduce((s, n) => s + n.reserved, 0)),
      String(rows.reduce((s, n) => s + n.spent, 0)),
      String(rows.reduce((s, n) => s + n.left, 0)),
      '',
    ] : undefined,
  }

  const LEVELS = ['السنة × مصدر التمويل', 'المسار', 'المجال', 'الهدف']

  return (
    <section className="rpsec">
      <Head
        title="شجرة الميزانية"
        meta={`المستوى ${path.length + 1} من 4 · ${LEVELS[Math.min(path.length, 3)]}`}
      />

      {/* Breadcrumb trail: navigation stays within the screen instead of moving
          through consecutive pages.

          The breadcrumb, count, and export all belong in one toolbar row. The
          breadcrumb used to sit outside `.ftool-r`, so the bar broke across
          three lines: the chip alone on the right, the count below it, and
          export alone on the left on a third line. It now matches the
          `/reports/view/*` layout: (breadcrumb + count) on the right, (export)
          on the left, one row. */}
      <Glass className="ftoolbar rptb">
        <div className="ftool-r">
          <div className="ftool-f">
              <div className="lrbc">
                <button className={`lrbc-i${path.length === 0 ? ' on' : ''}`} onClick={() => setPath([])}>
                  كل الدورات
                </button>
                {path.map((n, i) => (
                  <span key={n.id} className="lrbc-s">
                    <Icon name={icons.chevron} size="sm" />
                    <button
                      className={`lrbc-i${i === path.length - 1 ? ' on' : ''}`}
                      onClick={() => setPath(path.slice(0, i + 1))}
                    >
                      {n.label}
                    </button>
                  </span>
                ))}
              </div>
            {!leaf && (
              <span className="sub">
                <span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.line)} ·{' '}
                الإجماليات محسوبة من الدورات الخمس الحقيقية
              </span>
            )}
          </div>
          {!leaf && <div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div>}
        </div>
      </Glass>

      {leaf ? (
        <Glass><Empty title="آخر مستوى في الشجرة." note="لا تقسيم تحت الهدف، فعُد إلى مستوى أعلى من المسار في الأعلى." /></Glass>
      ) : (
        <>
          <Glass className="tblcard">
            <div className="tblwrap">
              <div className="tblock">
                <table className="tbl">
                  <colgroup>
                    <col style={{ width: 240 }} />
                    {Array.from({ length: 5 }, (_, i) => <col key={i} style={{ width: 130 }} />)}
                    <col style={{ width: 110 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>البند</th>
                      <th className="n">الميزانية</th>
                      <th className="n">المعتمد</th>
                      <th className="n">المحجوز</th>
                      <th className="n">المصروف</th>
                      <th className="n">المتبقي</th>
                      <th className="n">نسبة المتبقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((n) => {
                      const over = n.left < 0
                      const tight = !over && n.leftPct > 0 && n.leftPct < 5
                      return (
                        <tr
                          key={n.id}
                          className={n.children?.length ? 'clk' : undefined}
                          onClick={() => n.children?.length && setPath([...path, n])}
                        >
                          <td title={n.label}>
                            {n.children?.length ? <Icon name={icons.chevron} size="sm" /> : null}
                            {' '}{n.label}
                          </td>
                          <td className="n"><Money sm>{n.budget}</Money></td>
                          <td className="n"><Money sm>{n.approved}</Money></td>
                          <td className="n"><Money sm>{n.reserved}</Money></td>
                          <td className="n"><Money sm>{n.spent}</Money></td>
                          <td className={`n${over ? ' bad' : ''}`}><Money sm>{n.left}</Money></td>
                          <td className="n">
                            {over ? <Tag tone="no">فوق الحد المالي</Tag>
                              : tight ? <Tag tone="warn">{n.leftPct}%</Tag>
                              : `${n.leftPct}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Glass>

          <p className="mut rpsec-n">
            <b>المتبقي = الميزانية − المعتمد.</b> الصف ذو القيمة السالبة يعني اعتمادًا يتجاوز
            الحد المالي، وقد حدث ذلك فعلًا في <span className="num">2024</span> و
            <span className="num">2025</span>. والنظام الحالي يعرض هذا الرقم في خلية
            جدول عادية دون أي تنبيه، ولا توجد شاشة تنبّه مدير المنح إلى تجاوز الحد المالي
            <b> وقت</b> الاعتماد.
          </p>
        </>
      )}
    </section>
  )
}

/* Next and previous */

function Nav({ spec }: { spec: LiveSpec }) {
  const i = LIVE_SPECS.findIndex((s) => s.key === spec.key)
  const prev = LIVE_SPECS[i - 1]
  const next = LIVE_SPECS[i + 1]
  return (
    <nav className="lrnav">
      {prev
        ? <StepLink to={ROUTES.liveReport(prev.key)} dir="prev" className="btn btn-2 btn-sm">{prev.title}</StepLink>
        : <span />}
      <Link to={ROUTES.reportTab('catalog')} className="btn btn-2 btn-sm">كل الشاشات</Link>
      {next
        ? <StepLink to={ROUTES.liveReport(next.key)} dir="next" className="btn btn-2 btn-sm">{next.title}</StepLink>
        : <span />}
    </nav>
  )
}
