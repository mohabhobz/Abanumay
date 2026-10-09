import { Link, useNavigate } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, icons, Num, Segments, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { HEAT_TONE } from '@/lib/tone'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { exportXlsx, printArea, type Sheet } from '@/lib/export'
import { countOf, NOUN } from '@/lib/format'
import { ESC_PROCS, procLabel, stuckSay, type EscProc } from '@/data/shared/escRules'
import { escCounts, escItems, type EscItem } from '@/data/shared/escalation'
import { Who } from './parts'
import { useAllStores } from './useAllStores'

const KEYS = ['heat', 'proc'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* The late and stalled report of every procedure · cross «التصعيد», clause 3.

   The payments report was the only one that carried the four columns the document names (current
   stage, delay start, day count, responsible). This page is that report for all thirteen
   procedures, from one list (`escItems`), so a request late in the budget, the registration desk
   or the board reads the same way as a late payment. Grouped by procedure, then stage: the report
   answers «where is the bottleneck», it isn't an inbox. */

const HEATS = [
  { key: '', label: 'المتأخر والمتعثر' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
]
const heatSay = (it: EscItem) => (it.heat === 'stuck' ? 'متعثر' : 'متأخر')

export default function EscalationPage() {
  useAllStores()
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const proc = ESC_PROCS.some((p) => p.key === v.proc) ? (v.proc as EscProc) : undefined
  const all = escItems()
  const counts = escCounts()
  const rows = all.filter((it) => (!proc || it.proc === proc) && (!v.heat || it.heat === v.heat))
  const late = all.filter((x) => x.heat === 'late').length
  const stuck = all.length - late

  const groups = ESC_PROCS.map((p) => ({ ...p, rows: rows.filter((r) => r.proc === p.key) })).filter((g) => g.rows.length)

  const sheet: Sheet = {
    file: `abanumay-escalation-${new Date().toISOString().slice(0, 10)}`,
    title: 'المتأخر والمتعثر في جميع الإجراءات',
    headers: ['الإجراء', 'الطلب', 'المرحلة الحالية', 'تاريخ بدء التأخير', 'عدد الأيام', 'المسؤول', 'الحالة', 'تاريخ التعثر'],
    rows: rows.map((r) => [procLabel(r.proc), r.title, r.stage, r.lateFrom, String(r.over), r.owner, heatSay(r), r.stuckFrom ?? '']),
    totals: ['', countOf(rows.length, NOUN.request), '', '', '', '', '', ''],
  }

  return (
    <AppLayout assistantContext={assistFor.page('المتأخر والمتعثر')}>
      <div className="viewstack">
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">المتأخر والمتعثر</h1>
              <p className="sub mt-1">
                آلية التصعيد في جميع الإجراءات · <Num>{stuck}</Num> متعثر و<Num>{late}</Num> متأخر عن مدة المرحلة
              </p>
            </div>
            <div className="rowf gp-2">
              <Link className="btn btn-2 btn-sm" to={ROUTES.escalationSettings}>إعداد آلية التصعيد</Link>
              <button type="button" className="btn btn-2 btn-sm" onClick={() => exportXlsx(sheet)}>
                <Icon name={icons.export} size="sm" />
                صدّر إلى إكسل
              </button>
              <button type="button" className="btn btn-2 btn-sm" onClick={() => setTimeout(printArea, 60)}>اطبع</button>
            </div>
          </header>

          <Segments items={HEATS} active={v.heat ?? ''} onChange={(x) => set({ heat: x })} />

          <Glass className="tblcard">
            <Head title="حسب الإجراء" meta={proc ? <button type="button" className="lnk" onClick={() => set({ proc: undefined })}>كل الإجراءات</button> : <span className="sub">اختر إجراءً لعرض طلباته وحدها</span>} />
            <div className="tblwrap">
              <table className="tbl" aria-label="المتأخر والمتعثر حسب الإجراء">
                <thead>
                  <tr>
                    <th><span className="th-t">الإجراء</span></th>
                    <th className="n"><span className="th-t">متأخر</span></th>
                    <th className="n"><span className="th-t">متعثر</span></th>
                    <th><span className="th-t">يصير متعثرًا</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ESC_PROCS.map((p) => {
                    const c = counts[p.key] ?? { late: 0, stuck: 0 }
                    return (
                      <tr key={p.key} className={proc === p.key ? 'sel' : undefined} onClick={() => set({ proc: proc === p.key ? undefined : p.key })}>
                        <td><button type="button" className="tlink" onClick={(e) => { e.stopPropagation(); set({ proc: proc === p.key ? undefined : p.key }) }}>{p.label}</button>{/* doc p.bpd */}</td>
                        <td className="n"><Num>{c.late}</Num></td>
                        <td className="n"><Num>{c.stuck}</Num></td>
                        <td className="sub">{stuckSay(p.key)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Glass>

          {groups.length === 0 ? (
            <Glass>
              <Empty title="لا يوجد طلب متأخر أو متعثر." note="كل الطلبات المفتوحة ضمن مدة مرحلتها." />
            </Glass>
          ) : (
            groups.map((g) => (
              <section className="paygrp" key={g.key}>
                <div className="paygrp-h">
                  <h2>{g.label}</h2>
                  <span className="sub"><Num>{g.rows.length}</Num> {g.rows.length === 1 ? 'طلب' : 'طلبات'} · متعثر {stuckSay(g.key)}</span>
                </div>
                <Glass className="tblcard">
                  <div className="tblwrap">
                    <table className="tbl" aria-label={`المتأخر في ${g.label}`}>
                      <thead>
                        <tr>
                          <th><span className="th-t">الطلب</span></th>
                          <th><span className="th-t">المرحلة الحالية</span></th>
                          <th><span className="th-t">الحالة</span></th>
                          <th><span className="th-t">تاريخ بدء التأخير</span></th>
                          <th className="n"><span className="th-t">عدد الأيام</span></th>
                          <th><span className="th-t">المسؤول</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.id} onClick={() => navigate(r.href)}>
                            <td><Link className="tlink" to={r.href} onClick={(e) => e.stopPropagation()}>{r.title}</Link><div className="sub trim1">{r.sub}</div></td>
                            <td className="sub">{r.stage}</td>
                            <td><Tag tone={HEAT_TONE[r.heat]}>{heatSay(r)}</Tag>{r.stuckFrom && <div className="sub">منذ <DateText>{r.stuckFrom}</DateText></div>}</td>
                            <td><DateText>{r.lateFrom}</DateText></td>
                            <td className="n"><Num>{r.over}</Num></td>
                            <td><Who name={r.owner} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Glass>
              </section>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
}
