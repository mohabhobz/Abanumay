import { Fragment, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, Icon, Money, Num, Select, Switch, icons } from '@/components/ui'
import { Segments } from '@/components/ui/filters'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { pct } from '@/lib/format'
import { fiscalYears } from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { useBudget } from '@/data/budget/store'
import { GROUP_SAY, consolidate, totalOf, type GroupBy } from '@/data/budget/report'

/* The consolidated budget report (1.4.6) · every budget's balances read together, grouped by
   track, domain, goal, strategic direction, funding source or project. Each row opens into the
   budgets that carry it, so a total never hides which budget the money sits in. Approved budgets
   by default · the switch adds those still on their approval path, for planning. */

const BY: GroupBy[] = ['track', 'field', 'goal', 'direction', 'source', 'project']

export default function BudgetReportPage() {
  const navigate = useNavigate()
  useBudget()
  const [by, setBy] = useState<GroupBy>('track')
  const [year, setYear] = useState('')
  const [drafts, setDrafts] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const docs = allBudgets.filter((d) => (drafts || d.state === 'approved') && (!year || d.yearId === year))
  const rows = consolidate(by, docs)
  const total = totalOf(rows)
  const use = (m: { allocated: number; held: number; paid: number; committed: number }) =>
    m.allocated ? Math.round(((m.held + m.paid + m.committed) / m.allocated) * 100) : 0

  const sheet: Sheet = {
    file: `abanumay-budget-report-${by}`,
    title: `التقرير المجمّع للميزانيات · حسب ${GROUP_SAY[by]}`,
    headers: [GROUP_SAY[by], 'عدد الميزانيات', 'المخصص', 'المحجوز', 'الملتزم به', 'المصروف', 'المتبقي'],
    rows: rows.map((r) => [r.label, String(r.parts.length), String(r.money.allocated), String(r.money.held), String(r.money.committed), String(r.money.paid), String(r.money.available)]),
    totals: ['الإجمالي', '', String(total.allocated), String(total.held), String(total.committed), String(total.paid), String(total.available)],
  }

  return (
    <AppLayout assistantContext={assistFor.page('التقرير المجمّع للميزانيات')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />
          <header>
            <div>
              <h1 className="ptitle">التقرير المجمّع للميزانيات</h1>
              <p className="sub mt-1">أرصدة كل الميزانيات معًا · وكل صف ينفتح على الميزانيات التي تحمله</p>
            </div>
          </header>

          <div className="ftool-r">
            <div className="ftool-f">
              <Select
                icon={icons.date}
                all="كل السنوات"
                value={year}
                options={fiscalYears.map((y) => ({ value: y.id, label: y.name }))}
                onChange={(v) => setYear(v ?? '')}
              />
              <Switch label="مع الميزانيات قيد الاعتماد" on={drafts} onChange={setDrafts} />
            </div>
            <div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div>
          </div>

          <Segments
            items={BY.map((k) => ({ key: k, label: GROUP_SAY[k] }))}
            active={by}
            onChange={(k) => setBy((k ?? 'track') as GroupBy)}
          />

          <Glass className="tblcard">
            <Head title={`حسب ${GROUP_SAY[by]}`} meta={<span className="sub"><Num>{rows.length}</Num> صف · <Num>{docs.length}</Num> ميزانية</span>} />
            {rows.length === 0 ? (
              <Empty title="لا بيانات للاختيار الحالي." note="جرّب سنة أخرى أو أضف الميزانيات قيد الاعتماد." />
            ) : (
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{GROUP_SAY[by]}</th>
                      <th className="n">الميزانيات</th>
                      <th className="n">المخصص</th>
                      <th className="n">المحجوز</th>
                      <th className="n">الملتزم به</th>
                      <th className="n">المصروف</th>
                      <th className="n">المتبقي</th>
                      <th className="n">الاستهلاك</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const on = open.has(r.key)
                      return (
                        <Fragment key={r.key}>
                          <tr className="clk" onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); return n })}>
                            <td title={r.label}>
                              <Icon name={on ? icons.chevronUp : icons.chevronDown} size="sm" />{' '}
                              {by === 'project' ? <Link className="lnk" to={ROUTES.project(r.key)} onClick={(e) => e.stopPropagation()}>{r.label}</Link> : r.label}
                            </td>
                            <td className="n"><Num>{r.parts.length}</Num></td>
                            <td className="n"><Money sm>{r.money.allocated}</Money></td>
                            <td className="n"><Money sm>{r.money.held}</Money></td>
                            <td className="n"><Money sm>{r.money.committed}</Money></td>
                            <td className="n"><Money sm>{r.money.paid}</Money></td>
                            <td className="n"><Money sm>{r.money.available}</Money></td>
                            <td className="n"><span className="num">{pct(use(r.money))}</span></td>
                          </tr>
                          {on && r.parts.map((p) => (
                            <tr key={`${r.key}-${p.docId}`} className="bgrep-sub">
                              <td><Link className="lnk sub" to={ROUTES.budgetDoc(p.docId)}>{p.title}</Link></td>
                              <td />
                              <td className="n"><Money sm>{p.money.allocated}</Money></td>
                              <td className="n"><Money sm>{p.money.held}</Money></td>
                              <td className="n"><Money sm>{p.money.committed}</Money></td>
                              <td className="n"><Money sm>{p.money.paid}</Money></td>
                              <td className="n"><Money sm>{p.money.available}</Money></td>
                              <td className="n"><span className="num">{pct(use(p.money))}</span></td>
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>الإجمالي</td>
                      <td />
                      <td className="n"><Money sm>{total.allocated}</Money></td>
                      <td className="n"><Money sm>{total.held}</Money></td>
                      <td className="n"><Money sm>{total.committed}</Money></td>
                      <td className="n"><Money sm>{total.paid}</Money></td>
                      <td className="n"><Money sm>{total.available}</Money></td>
                      <td className="n"><span className="num">{pct(use(total))}</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Glass>
          <p className="sub cnote">
            {by === 'project'
              ? 'المشروع متعدد السنوات يظهر بحصصه على كل ميزانية تموّله · حصة السنة القادمة التزام لا حجز.'
              : 'تقرير كل ميزانية منفردة في شاشتها · وهنا تُجمع أرصدتها دون أن تختلط.'}
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
