import { reducedMotion } from '@/lib/prefs'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Money, Num, Person, Select, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { Mono } from '@/components/ui'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import { BUDGET_STATE_SAY, budgetTone, docTitle, yearById } from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { BUDGET_REQS, lineDeps, shareSay, useBudget } from '@/data/budget/store'
import { docSources } from '@/data/mock/budgetTree'
import { PageActions } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { Segments } from '@/components/ui/filters'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import {
  CYCLES, PLAN_LEVELS, chain, childSum, cycleById, imbalances, leaves,
  nodeAt, parentCount, type Imbalance, type PlanNode,
} from '@/data/budgetPlan'
import { FieldSpend, PlanCoverage, SpendGauge, YearSpend } from './BudgetCharts'
import { GapPeek } from './GapPeek'

/**
 * Budget.
 *
 * The live system stores the allocation hierarchy across four sequential screens, and each screen
 * prints the sum of its own children in the last row while the parent's allocation is written on
 * the previous screen. So the two figures never meet, and no one noticed that ten out of fourteen
 * items didn't balance.
 *
 * So this module is built by flipping the order:
 * - balance check comes first, before the tree, not after. The number that changes a decision is
 * stated in the first line.
 * - a single-level tree with breadcrumb navigation - moving happens within the screen, and columns
 * stay the same across levels (the live system reduces them from six to three at the last level).
 * - two columns for the eye, not the database - "sum of children" and "difference" sit next to
 * "allocation", so a mismatch shows in the same row.
 * - a toggle between allocation and consumption - same tree, two questions.
 */
export default function BudgetPage() {
  useBudget()
  const [cycleId, setCycleId] = useState(CYCLES[0].id)
  const [path, setPath] = useState<string[]>([])
  const [view, setView] = useState<'alloc' | 'use'>('alloc')

  const cycle = cycleById(cycleId)
  const root = cycle.tree

  const gaps = useMemo(() => (root ? imbalances(root) : []), [root])
  const parents = useMemo(() => (root ? parentCount(root) : 0), [root])
  const goals = useMemo(() => (root ? leaves(root) : []), [root])

  const here = root ? nodeAt(root, path) : undefined
  const rows = here?.children ?? []
  const crumb = root ? chain(root, path) : []

  /**
   * Jumping from the balance check to the tree.
   *
   * The click already worked - the route changed and the tree opened on the item - but the tree sat
   * 2142px down, two screens below what the user was looking at. So from their side: nothing
   * happened when they clicked.
   *
   * The jump now moves the eye along with it: a scroll to the tree and a brief pulse on the section
   * to say "here, you've arrived."
   */
  const tree = useRef<HTMLDivElement>(null)
  const [landed, setLanded] = useState(0)

  const goTo = (p: string[], jump = false) => {
    setPath(p)
    if (jump) setLanded((n) => n + 1)
  }

  useEffect(() => {
    if (!landed) return
    const el = tree.current
    if (!el) return
    const soft = !reducedMotion()
    el.classList.add('land')
    /* Scroll after render: the tree's row count changes with the jump, and scrolling before rows
       are measured would target an old height. */
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: soft ? 'smooth' : 'auto', block: 'start' })
      })
    })
    const id = setTimeout(() => el.classList.remove('land'), 1600)
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(id) }
  }, [landed])

  return (
    <AppLayout assistantContext={assistFor.page('الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الميزانية</h1>
              <p className="sub mt-1">
                التخصيص على أربع مستويات، الدورة والمسار والمجال والهدف، ومعه ما استُهلك منه
              </p>
            </div>

            {/* Note: this screen used to only display, never create. The figures on it are the
                result of the allocation tree, and the tree itself had no entry point - so there was
                no create button or settings. Settings come before creation in the order because a
                budget can't open unless its year and funding source are defined. */}
            {/* Note: the cycle switcher used to sit after the create button, crowding it in the
                corner - and the switcher isn't really an action: it changes what you're looking at,
                not adds something. It now sits in the row below, with whatever else controls the
                view.

                A cycle is always selected, so there's no "all" option - `allowEmpty={false}`. */}
            <PageActions
              settings={ROUTES.budgetSettings}
              create={{ label: 'ميزانية جديدة', to: ROUTES.budgetNew }}
            />
          </header>

          <div className="hscope">
            <Select
              icon={icons.budget}
              value={cycleId}
              allowEmpty={false}
              options={CYCLES.map((c) => ({
                value: c.id,
                label: c.active ? `${c.label}، نشطة` : c.label,
              }))}
              onChange={(v) => { if (v) { setCycleId(v); setPath([]) } }}
            />
          </div>

          {/* Note: the budgets themselves were missing from the budget screen. What was below were
              charts and consumption - the result of the allocation - while the records the
              allocation is built on had no entry point. These are identified by "year + source", so
              the same year with two sources gives two rows. */}
          <Glass className="tblcard">
            <Head
              title="الميزانيات المعرَّفة"
              meta={
                <span className="rowf gp-2">
                  <span className="sub"><Num>{allBudgets.length}</Num> {nounAfter(allBudgets.length, NOUN.budget)}</span>
                  <Link className="btn btn-2 btn-sm" to={ROUTES.budgetOps}>
                    <Icon name={icons.redo} size="sm" />
                    طلبات العمليات
                    {BUDGET_REQS.some((r) => ['submitted', 'finance', 'exec'].includes(r.state)) && (
                      <Tag tone="warn"><Num>{BUDGET_REQS.filter((r) => ['submitted', 'finance', 'exec'].includes(r.state)).length}</Num></Tag>
                    )}
                  </Link>
                  <Link className="btn btn-2 btn-sm" to={ROUTES.budgetReport}>
                    <Icon name={icons.chart} size="sm" />
                    التقرير المجمّع
                  </Link>
                </span>
              }
            />
            <ul className="cfglist">
              {allBudgets.map((d) => {
                /* Note: dependent count in place of a delete button · the budget's own projects,
                   read from its root line (links, plans and the projects it was built from) */
                const root = d.nodes.find((n) => n.parentId === null)
                const dep = root ? lineDeps(d, root.id).projects.length : 0
                return (
                  <li key={d.id}>
                    <b>{docTitle(d)}</b>
                    <span className="sub"><Mono>{d.id}</Mono> · {yearById(d.yearId)?.name} · {shareSay(docSources(d))}</span>
                    <span className="pc-sp" />
                    <span className="num">{nf.format(d.total)}</span>
                    {dep > 0 ? <Tag tone="mute">مشاريع مرتبطة بها: <Num>{dep}</Num></Tag> : <Tag tone="ok">بلا متعلقات</Tag>}
                    <Tag tone={budgetTone(d.state)}>{BUDGET_STATE_SAY[d.state]}</Tag>
                    <Link className="btn btn-2 btn-sm" to={ROUTES.budgetDoc(d.id)}>
                      افتح الشجرة
                      <Icon name={icons.chevron} size="sm" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Glass>

          <Summary cycle={cycle} goals={goals.length} />

          {root ? (
            <>
              <Balance gaps={gaps} parents={parents} onGo={(p) => goTo(p, true)} root={root} />

              <section className="rpsec">
                <Head title="الصورة الكاملة" meta="رسوم النظام العامل نفسها، بالبيانات الحقيقية" />
                <div className="chgrid">
                  <SpendGauge value={cycle.spent} of={cycle.alloc} />
                  <YearSpend />
                </div>
                <FieldSpend />
                <PlanCoverage />
              </section>

              <Tree
                sectionRef={tree}
                root={root}
                here={here}
                rows={rows}
                crumb={crumb}
                path={path}
                view={view}
                onView={setView}
                onGo={goTo}
                cycleLabel={cycle.label}
              />
            </>
          ) : (
            <Glass className="bgclosed">
              <Icon name={icons.lock} size="lg" />
              <div>
                <b>هذه الدورة مغلقة.</b>
                <p className="sub">
                  شجرة التخصيص الكاملة متاحة للدورة النشطة فقط
                  (<span className="num">2026</span> · المؤسسة). وللدورات السابقة تتوفر
                  الإجماليات أعلاه فقط، وهي ما يعرضه النظام.
                </p>
              </div>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

/* Cycle bar */

function Summary({ cycle, goals }: { cycle: ReturnType<typeof cycleById>; goals: number }) {
  const over = cycle.alloc - cycle.approved < 0
  const usePct = cycle.alloc ? Math.round((cycle.spent / cycle.alloc) * 100) : 0
  const commitPct = cycle.alloc ? Math.round((cycle.approved / cycle.alloc) * 100) : 0

  return (
    <Glass className="bgsum">
      <div className="bgsum-g">
        <Cell k="المخصص" v={cycle.alloc} />
        <Cell k="المعتمد" v={cycle.approved} tone={over ? 'no' : undefined} />
        <Cell k="المحجوز" v={cycle.reserved} />
        <Cell k="المنصرف" v={cycle.spent} />
        <Cell k="المتبقي" v={cycle.alloc - cycle.approved} tone={over ? 'no' : 'ok'} />
      </div>

      {/* One bar with three layers: disbursed inside approved inside allocated. The layers aren't
          separate bars, so a figure never gets counted twice. */}
      <div className="bgbar" aria-hidden="true">
        <i className="commit" style={{ width: `${Math.min(100, commitPct)}%` }} />
        <i className="spend" style={{ width: `${Math.min(100, usePct)}%` }} />
      </div>
      <div className="bgbar-k mut">
        <span><b className="dot spend" /> منصرف <span className="num">{usePct}%</span></span>
        <span><b className="dot commit" /> معتمد <span className="num">{commitPct}%</span></span>
        {goals > 0 && <span><span className="num">{goals}</span> هدفًا في الشجرة</span>}
        {over && <Tag tone="no">المعتمد فوق المخصص</Tag>}
      </div>
    </Glass>
  )
}

function Cell({ k, v, tone }: { k: string; v: number; tone?: 'ok' | 'no' }) {
  return (
    <div className="bgsum-c">
      <span className="sub">{k}</span>
      <b className={tone === 'no' ? 'bad' : undefined}><Money sm>{v}</Money></b>
    </div>
  )
}

/* Balance check */

/**
 * First section on the page, deliberately.
 *
 * This figure doesn't appear in the live system at all, and it's the first thing a finance director
 * will ask about. Placing it under the tree means it wouldn't get seen.
 */
/**
 * The first row shows, the rest expand on click - a wall of eleven identical rows turns into
 * background noise and pushes the tree two screens down.
 */
const TOP = 5

function Balance({
  gaps, parents, onGo, root,
}: {
  gaps: Imbalance[]
  parents: number
  onGo: (p: string[]) => void
  root: PlanNode
}) {
  const [all, setAll] = useState(false)
  /* The item open in the panel - the click responds in place instead of scrolling the page down. */
  const [peek, setPeek] = useState<Imbalance | null>(null)
  const shown = all ? gaps : gaps.slice(0, TOP)
  const total = gaps.reduce((s, x) => s + Math.abs(x.gap), 0)

  if (gaps.length === 0) {
    return (
      <Glass className="bgok">
        <Icon name={icons.check} size="md" />
        <span>الشجرة متوازنة، مجموع أبناء كل بند يساوي مخصصه.</span>
      </Glass>
    )
  }

  return (
    <section className="rpsec">
      <Head
        title="فحص التوازن"
        meta={`${gaps.length} من ${countOf(parents, NOUN.line)} لا يتوازن`}
      />

      <Glass className="bgchk">
        <p className="bgchk-l">
          مجموع ما خُصِّص للأبناء <b>لا يساوي</b> مخصص الأب في{' '}
          <b className="bad"><Num>{gaps.length}</Num></b> بندًا من <Num>{parents}</Num>،
          بفارق تراكمي <b className="bad"><Money sm>{total}</Money></b>.
        </p>
        <p className="mut bgchk-n">
          في النظام العامل يظهر مخصص الأب في شاشة ومجموع أبنائه في الشاشة التالية،
          فلا يلتقي الرقمان. وهنا يُحسبان على الشجرة كلها مرة واحدة.
        </p>

        <p className="mut bgchk-h">اضغط أي بند لعرض تفصيل الفرق فيه.</p>

        <ul className="bglist">
            {shown.map((x) => (
              <li key={x.path.join('/') || 'root'}>
                <button className="bglist-i" onClick={() => setPeek(x)}>
                  <span className="bglist-lv sub">{PLAN_LEVELS[x.level]}</span>
                  <span className="bglist-t">{x.label || root.label}</span>
                  {/* Fixed-width label with the number after it - in RTL, the number extends to the
                      left and its last digit sits right against the label, so digit columns line up
                      and the ones place stays aligned. These used to be one variable-width string,
                      so each row started at a different point and comparison was tiring. */}
                  <span className="bglist-v mut">
                    <span className="sub">مخصص</span>
                    <Money sm>{x.alloc}</Money>
                  </span>
                  <span className="bglist-v mut">
                    <span className="sub">أبناؤه</span>
                    <Money sm>{x.childSum}</Money>
                  </span>
                  {/* Same badge styles as the rest of the system, not a new one - the tones are
                      calibrated once in `.tag`, and any alternative here opens a second file to
                      check across the three themes. */}
                  <span className="bglist-g">
                    <Tag tone={x.gap > 0 ? 'no' : 'warn'}>
                      {x.gap > 0 ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(x.gap)}</Money>
                    </Tag>
                  </span>
                  <Icon name={icons.chevron} size="sm" />
                </button>
              </li>
            ))}
        </ul>

        {peek && (
          <GapPeek
            gap={peek}
            root={root}
            onClose={() => setPeek(null)}
            onGoTree={() => { setPeek(null); onGo(peek.path) }}
          />
        )}

        {gaps.length > TOP && (
          <button className="btn btn-2 btn-sm bgchk-t" onClick={() => setAll((x) => !x)}>
            <Icon name={all ? icons.chevronUp : icons.chevronDown} size="sm" />
            {all ? 'اعرض أقل' : `اعرض المزيد (${gaps.length - TOP})`}
          </button>
        )}
      </Glass>
    </section>
  )
}

/* Tree */

function Tree({
  sectionRef, root, here, rows, crumb, path, view, onView, onGo, cycleLabel,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>
  root: PlanNode
  here: PlanNode | undefined
  rows: PlanNode[]
  crumb: PlanNode[]
  path: string[]
  view: 'alloc' | 'use'
  onView: (v: 'alloc' | 'use') => void
  onGo: (p: string[]) => void
  cycleLabel: string
}) {
  const level = path.length
  const leaf = rows.length === 0

  const sheet: Sheet = useMemo(() => ({
    file: `abanumay-budget-${path.join('-') || 'root'}`,
    title: `الميزانية · ${[cycleLabel, ...crumb.map((c) => c.label)].join(' ← ')}`,
    headers: view === 'alloc'
      ? ['البند', 'المخصص', 'مجموع الأبناء', 'الفرق', 'خطة الإنجاز', 'المالك']
      : ['البند', 'المخصص', 'المحجوز', 'المنصرف', 'المتبقي', 'نسبة الاستهلاك'],
    rows: rows.map((n) => {
      if (view === 'alloc') {
        const sum = n.children?.length ? childSum(n) : 0
        return [
          n.label, String(n.alloc),
          n.children?.length ? String(sum) : '',
          n.children?.length ? String(sum - n.alloc) : '',
          `${n.plan}%`, n.owner ?? '',
        ]
      }
      const used = (n.reserved ?? 0) + (n.spent ?? 0)
      return [
        n.label, String(n.alloc), String(n.reserved ?? 0), String(n.spent ?? 0),
        String(n.alloc - used), n.alloc ? `${Math.round((used / n.alloc) * 100)}%` : '0%',
      ]
    }),
    totals: [
      'الإجمالي',
      String(rows.reduce((s, n) => s + n.alloc, 0)),
      ...(view === 'alloc'
        ? [String(rows.reduce((s, n) => s + (n.children?.length ? childSum(n) : 0), 0)), '', '', '']
        : [
          String(rows.reduce((s, n) => s + (n.reserved ?? 0), 0)),
          String(rows.reduce((s, n) => s + (n.spent ?? 0), 0)),
          '', '',
        ]),
    ],
  }), [rows, view, path, crumb, cycleLabel])

  return (
    <section className="rpsec bgtree" ref={sectionRef}>
      <Head
        title="شجرة التخصيص"
        meta={`المستوى ${level + 1} من 4 · ${PLAN_LEVELS[Math.min(level + 1, 3)]}`}
      />

      <div className="lrbc">
        <button className={`lrbc-i${level === 0 ? ' on' : ''}`} onClick={() => onGo([])}>
          {root.label}
        </button>
        {crumb.map((n, i) => (
          <span key={n.id} className="lrbc-s">
            <Icon name={icons.chevron} size="sm" />
            <button
              className={`lrbc-i${i === crumb.length - 1 ? ' on' : ''}`}
              onClick={() => onGo(path.slice(0, i + 1))}
            >
              {n.label}
            </button>
          </span>
        ))}
      </div>

      {leaf ? (
        <Glass className="bgleaf">
          <div>
            <b>{here?.label}</b>
            <p className="sub">آخر مستوى في الشجرة، ولا يتفرّع الهدف إلى بنود أخرى.</p>
          </div>
          <div className="bgleaf-v">
            <span><span className="sub">المخصص</span> <Money sm>{here?.alloc ?? 0}</Money></span>
            <span><span className="sub">المحجوز</span> <Money sm>{here?.reserved ?? 0}</Money></span>
            <span><span className="sub">المنصرف</span> <Money sm>{here?.spent ?? 0}</Money></span>
          </div>
        </Glass>
      ) : (
        <>
          <div className="ftool-r">
            <div className="ftool-f">
              {/* Toggle between the two questions - "how much did we allocate" or "how much did we
                  consume". This used to be hand-assembled here: a second copy of the same component
                  at a height of 30 instead of 31, that wouldn't pick up any improvement made to the
                  original. It's now `Segments`, like everywhere else. */}
              <Segments
                items={[{ key: 'alloc', label: 'التخصيص' }, { key: 'use', label: 'الاستهلاك' }]}
                active={view}
                onChange={(k) => onView((k ?? 'alloc') as typeof view)}
              />
              <span className="sub"><span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.line)}</span>
            </div>
            <div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div>
          </div>

          <Glass className="tblcard">
            <div className="tblwrap">
              <div className="tblock">
                {view === 'alloc'
                  ? <AllocTable rows={rows} path={path} onGo={onGo} parent={here} />
                  : <UseTable rows={rows} path={path} onGo={onGo} />}
              </div>
            </div>
          </Glass>
        </>
      )}
    </section>
  )
}

/**
 * The table footer compares the sum of children to the parent's allocation.
 *
 * Jumping here from the balance check shows the item's children, while the item's own allocation
 * sits one level up, outside the screen. So the difference you came here for isn't visible on
 * arrival. The footer now puts both figures together and computes the difference, so the reason is
 * right at the landing point.
 */
function AllocTable({
  rows, path, onGo, parent,
}: { rows: PlanNode[]; path: string[]; onGo: (p: string[]) => void; parent?: PlanNode }) {
  const total = rows.reduce((s, n) => s + n.alloc, 0)
  const gap = parent ? total - parent.alloc : 0
  return (
    <table className="tbl">
      <colgroup>
        <col style={{ width: 260 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 130 }} />
      </colgroup>
      <thead>
        <tr>
          <th>البند</th>
          <th className="n">المخصص</th>
          <th className="n">مجموع الأبناء</th>
          <th className="n">الفرق</th>
          <th className="n">خطة الإنجاز</th>
          <th>المالك</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => {
          const kids = n.children?.length ?? 0
          const sum = kids ? childSum(n) : null
          const gap = sum === null ? 0 : sum - n.alloc
          return (
            <tr
              key={n.id}
              className={kids ? 'clk' : undefined}
              onClick={() => kids && onGo([...path, n.id])}
            >
              <td title={n.label}>
                {kids ? <Icon name={icons.chevron} size="sm" /> : null}{' '}{n.label}
              </td>
              <td className="n">
                {n.alloc === 0 ? <Tag tone="warn">بلا مخصص</Tag> : <Money sm>{n.alloc}</Money>}
              </td>
              <td className="n">{sum === null ? <span className="sub"> </span> : <Money sm>{sum}</Money>}</td>
              <td className={`n${gap !== 0 ? ' bad' : ''}`}>
                {sum === null ? <span className="sub"> </span>
                  : gap === 0 ? <Tag tone="ok">متوازن</Tag>
                  : <>{gap > 0 ? '+' : '−'}<Money sm>{Math.abs(gap)}</Money></>}
              </td>
              <td className="n">
                {n.plan === 0 ? <Tag tone="warn">خارج الخطة</Tag> : `${n.plan}%`}
              </td>
              <td title={n.owner ?? ''}>{n.owner ? <Person name={n.owner} /> : <span className="sub"> </span>}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>مجموع الأبناء</td>
          <td className="n"><Money sm>{total}</Money></td>
          <td className="n mut">مخصص {parent?.label ?? 'الإجمالي'}</td>
          <td className="n"><Money sm>{parent?.alloc ?? 0}</Money></td>
          <td className="n" colSpan={2}>
            {parent && (gap === 0
              ? <Tag tone="ok">متوازن</Tag>
              : <Tag tone={gap > 0 ? 'no' : 'warn'}>
                  {gap > 0 ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(gap)}</Money>
                </Tag>)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function UseTable({ rows, path, onGo }: { rows: PlanNode[]; path: string[]; onGo: (p: string[]) => void }) {
  return (
    <table className="tbl">
      <colgroup>
        <col style={{ width: 260 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 150 }} />
      </colgroup>
      <thead>
        <tr>
          <th>البند</th>
          <th className="n">المخصص</th>
          <th className="n">المحجوز</th>
          <th className="n">المنصرف</th>
          <th className="n">المتبقي</th>
          <th>نسبة الاستهلاك</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => {
          const kids = n.children?.length ?? 0
          const used = (n.reserved ?? 0) + (n.spent ?? 0)
          const left = n.alloc - used
          const pct = n.alloc ? Math.round((used / n.alloc) * 100) : 0
          const tight = n.alloc > 0 && pct >= 95
          return (
            <tr
              key={n.id}
              className={kids ? 'clk' : undefined}
              onClick={() => kids && onGo([...path, n.id])}
            >
              <td title={n.label}>
                {kids ? <Icon name={icons.chevron} size="sm" /> : null}{' '}{n.label}
              </td>
              <td className="n"><Money sm>{n.alloc}</Money></td>
              <td className="n"><Money sm>{n.reserved ?? 0}</Money></td>
              <td className="n"><Money sm>{n.spent ?? 0}</Money></td>
              <td className={`n${left < 0 ? ' bad' : ''}`}><Money sm>{left}</Money></td>
              <td>
                <span className="bgpct">
                  <span className="bgpct-t">
                    <i className={tight ? 'no' : pct >= 80 ? 'warn' : 'ok'}
                      style={{ width: `${Math.min(100, Math.max(1, pct))}%` }} />
                  </span>
                  <b className="num">{pct}%</b>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>الإجمالي</td>
          <td className="n"><Money sm>{rows.reduce((s, n) => s + n.alloc, 0)}</Money></td>
          <td className="n"><Money sm>{rows.reduce((s, n) => s + (n.reserved ?? 0), 0)}</Money></td>
          <td className="n"><Money sm>{rows.reduce((s, n) => s + (n.spent ?? 0), 0)}</Money></td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  )
}
