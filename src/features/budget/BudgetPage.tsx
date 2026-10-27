import { useState, useMemo } from 'react'
import { ButtonLink, Button, Glass, Head, Icon, icons, Money, Num, Select, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { Mono } from '@/components/ui'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import { BUDGET_STATE_SAY, budgetTone, docTitle, yearById } from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { BUDGET_REQS, lineDeps, mayAct, shareSay, useBudget } from '@/data/budget/store'
import { readRole } from '@/data/roles'
import { docSources, fundSources, moneyOf } from '@/data/mock/budgetTree'
import { PageActions } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import {
  CYCLES, PLAN_LEVELS, cycleById, imbalances, leaves,
  parentCount, type Imbalance, type PlanNode } from '@/data/budgetPlan'
import { FieldSpend, SpendGauge, YearSpend } from './BudgetCharts'
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
  /* client 18 Oct · #37 · each funding source has its own budgets · the list reads by source */
  const [src, setSrc] = useState('')
  const shownBudgets = src ? allBudgets.filter((d) => docSources(d).some((x) => x.code === src)) : allBudgets
  const cycle = cycleById(cycleId)
  const root = cycle.tree

  const gaps = useMemo(() => (root ? imbalances(root) : []), [root])
  const parents = useMemo(() => (root ? parentCount(root) : 0), [root])
  const goals = useMemo(() => (root ? leaves(root) : []), [root])

  return (
    <AppLayout assistantContext={assistFor.page('الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الميزانية</h1>
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
              create={mayAct('prepare', readRole()) ? { label: 'ميزانية جديدة', to: ROUTES.budgetNew } : undefined}
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
              onChange={(v) => { if (v) setCycleId(v) }}
            />
            <Select
              icon={icons.budget}
              value={src}
              all="كل مصادر التمويل"
              options={fundSources.map((f) => ({ value: f.code, label: f.name }))}
              onChange={(v) => setSrc(v ?? '')}
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
                  <span className="sub"><Num>{shownBudgets.length}</Num> {nounAfter(shownBudgets.length, NOUN.budget)}</span>
                  <ButtonLink variant="2" size="sm" to={ROUTES.budgetOps}>
                    <Icon name={icons.redo} size="sm" />
                    طلبات العمليات
                    {BUDGET_REQS.some((r) => ['submitted', 'finance', 'exec'].includes(r.state)) && (
                      <Tag tone="warn"><Num>{BUDGET_REQS.filter((r) => ['submitted', 'finance', 'exec'].includes(r.state)).length}</Num></Tag>
                    )}
                  </ButtonLink>
                  <ButtonLink variant="2" size="sm" to={ROUTES.budgetReport}>
                    <Icon name={icons.chart} size="sm" />
                    التقرير المجمّع
                  </ButtonLink>
                </span>
              }
            />
            <ul className="cfglist">
              {shownBudgets.map((d) => {
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
                    {/* 11 Oct · audit UI-047 · the tags sit in one fixed-width slot, so the amount
                        beside them starts on the same line in every row */}
                    <span className="bgl-tags">
                      {dep > 0 ? <Tag tone="mute">مشاريع مرتبطة بها: <Num>{dep}</Num></Tag> : <Tag tone="ok">بلا متعلقات</Tag>}
                      <Tag tone={budgetTone(d.state)}>{BUDGET_STATE_SAY[d.state]}</Tag>
                    </span>
                    <ButtonLink variant="2" size="sm" to={ROUTES.budgetDoc(d.id)}>
                      افتح الشجرة
                      <Icon name={icons.chevron} size="sm" />
                    </ButtonLink>
                  </li>
                )
              })}
            </ul>
          </Glass>

          {/* Client 27 Oct · «ملخص الميزانية» · one summary per funding source · a picked source shows its
              own, «كل مصادر التمويل» shows every source's, each named · a cycle with no budget
              documents yet keeps the cycle's own figures */}
          {(() => {
            const per = sourceSummaries(cycle.id.slice(0, 4), src)
            return per.length
              ? per.map((x) => <Summary key={x.code} title={`ملخص الميزانية · ${x.name}`} fig={x} />)
              : <Summary title="ملخص الميزانية" fig={cycle} goals={goals.length} />
          })()}

          {root ? (
            <>
              <Balance gaps={gaps} parents={parents} root={root} />

              <section className="rpsec">
                <Head title="الصورة الكاملة" />
                <div className="chgrid">
                  <SpendGauge value={cycle.spent} of={cycle.alloc} />
                  <YearSpend />
                </div>
                <FieldSpend />
                {/* Client 27 Oct · the per-field achievement plan chart is gone from the budget page */}
              </section>

              {/* Client sheet 26 Oct (#111) · the allocation tree section is gone from the budget page · each budget opens its own tree */}
            </>
          ) : (
            <Glass className="bgclosed">
              <Icon name={icons.lock} size="lg" />
              <div>
                <b>هذه الدورة مغلقة.</b>
              </div>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

/* Cycle bar */

/** A summary's figures · the cycle's, or one funding source's within it */
interface Figures { alloc: number; approved: number; reserved: number; spent: number }

/** Each funding source's figures in the cycle's year · read from the year's budget documents · a
    document split across sources gives each source its share of the document's money · approved
    documents only, a budget still on its approval path isn't money yet */
function sourceSummaries(year: string, only: string): (Figures & { code: string; name: string })[] {
  const docs = allBudgets.filter((d) => yearById(d.yearId)?.name === year && d.state === 'approved')
  if (!docs.length) return []
  return fundSources
    .filter((f) => !only || f.code === only)
    .map((f) => {
      const out = { code: f.code, name: f.name, alloc: 0, approved: 0, reserved: 0, spent: 0 }
      for (const d of docs) {
        const share = docSources(d).find((x) => x.code === f.code)
        if (!share || !d.total) continue
        const ratio = share.amount / d.total
        const m = d.nodes.filter((n) => n.parentId === null).reduce((a, n) => {
          const x = moneyOf(d.nodes, n.id)
          return { held: a.held + x.held, paid: a.paid + x.paid, committed: a.committed + x.committed }
        }, { held: 0, paid: 0, committed: 0 })
        out.alloc += share.amount
        out.reserved += Math.round(m.held * ratio)
        out.spent += Math.round(m.paid * ratio)
        out.approved += Math.round((m.held + m.paid + m.committed) * ratio)
      }
      return out
    })
    .filter((x) => x.alloc > 0 || only === x.code)
}

function Summary({ title, fig: cycle, goals = 0 }: { title: string; fig: Figures; goals?: number }) {
  const over = cycle.alloc - cycle.approved < 0
  const usePct = cycle.alloc ? Math.round((cycle.spent / cycle.alloc) * 100) : 0
  const commitPct = cycle.alloc ? Math.round((cycle.approved / cycle.alloc) * 100) : 0

  return (
    <Glass className="bgsum">
      <Head title={title} />
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

type GapLevel = 'all' | 'tracks' | 'fields'
const GAP_LEVELS: { key: GapLevel; label: string }[] = [
  { key: 'all', label: 'الجميع' },
  { key: 'tracks', label: 'على مستوى المسارات' },
  { key: 'fields', label: 'على مستوى المجالات' },
]

function Balance({
  gaps, parents, root,
}: {
  gaps: Imbalance[]
  parents: number
  root: PlanNode
}) {
  const [all, setAll] = useState(false)
  /* The item open in the panel - the click responds in place instead of scrolling the page down. */
  const [peek, setPeek] = useState<Imbalance | null>(null)
  /* Client 27 Oct · the check reads at one level or both · «الجميع» lists the cycle, then the tracks,
     then the fields, each group in its own order (largest gap first) */
  const [lvl, setLvl] = useState<GapLevel>('all')
  const picked = lvl === 'tracks' ? gaps.filter((x) => x.level === 1)
    : lvl === 'fields' ? gaps.filter((x) => x.level === 2)
      : [...gaps.filter((x) => x.level === 0), ...gaps.filter((x) => x.level === 1), ...gaps.filter((x) => x.level >= 2)]
  const shown = all ? picked : picked.slice(0, TOP)
  const total = picked.reduce((s, x) => s + Math.abs(x.gap), 0)

  if (gaps.length === 0) {
    return (
      <Glass className="bgok">
        <Icon name={icons.check} size="md" />
        <span>الشجرة متوازنة.</span>
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
        <div className="bgchk-h">
          <p className="bgchk-l">
            الفارق التراكمي <b className="bad"><Money sm>{total}</Money></b>
          </p>
          <span className="cfgchips" role="radiogroup" aria-label="مستوى فحص التوازن">
            {GAP_LEVELS.map((x) => (
              <Button plain key={x.key} type="button" role="radio" aria-checked={lvl === x.key}
                className={`cfgchip${lvl === x.key ? ' on' : ''}`} onClick={() => { setLvl(x.key); setAll(false) }}>
                {x.label}
              </Button>
            ))}
          </span>
        </div>
        {picked.length === 0 && <p className="sub cnote">لا بند غير متوازن على هذا المستوى.</p>}

        <ul className="bglist">
            {shown.map((x) => (
              <li key={x.path.join('/') || 'root'}>
                <Button plain className="bglist-i" onClick={() => setPeek(x)}>
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
                </Button>
              </li>
            ))}
        </ul>

        {peek && (
          <GapPeek
            gap={peek}
            root={root}
            onClose={() => setPeek(null)}
          />
        )}

        {picked.length > TOP && (
          <Button variant="2" size="sm" className="bgchk-t" onClick={() => setAll((x) => !x)}>
            <Icon name={all ? icons.chevronUp : icons.chevronDown} size="sm" />
            {all ? 'اعرض أقل' : `اعرض المزيد (${picked.length - TOP})`}
          </Button>
        )}
      </Glass>
    </section>
  )
}
