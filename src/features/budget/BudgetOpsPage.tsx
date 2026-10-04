import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackTo, DateText, Empty, Glass, Head, Icon, Mono, Money, Num, Tag, icons } from '@/components/ui'
import { Segments } from '@/components/ui/filters'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { docTitle, pathOf } from '@/data/mock/budgetTree'
import { readRole } from '@/data/roles'
import {
  BUDGET_REQS, REQ_KIND_SAY, REQ_STATE_SAY, docOf, mayAct, reqTone, stepOf, useBudget, type ReqState,
} from '@/data/budget/store'

/* Budget operation requests (1.3) · every transfer, increase and decrease, with where each one is
   on its path and whose step it is. The «عندي» segment is the role's own queue: the requests at the
   step the role's settings name it for. */

const GROUPS: { key: string; label: string; states: ReqState[] }[] = [
  { key: 'open', label: 'قيد الاعتماد', states: ['submitted', 'finance', 'exec'] },
  { key: 'prep', label: 'مسودة ومعاد', states: ['draft', 'returned'] },
  { key: 'done', label: 'نُفِّذ', states: ['executed'] },
  { key: 'no', label: 'مرفوض', states: ['rejected'] },
]

export default function BudgetOpsPage() {
  const navigate = useNavigate()
  useBudget()
  const role = readRole()
  const [seg, setSeg] = useState<string | undefined>(undefined)
  const mine = (s: ReqState) => {
    const st = stepOf(s)
    return !!st && (st === 'prepare' ? s === 'returned' && mayAct('prepare', role) : mayAct(st, role))
  }
  const rows = BUDGET_REQS.filter((r) =>
    !seg ? true : seg === 'mine' ? mine(r.state) : GROUPS.find((g) => g.key === seg)?.states.includes(r.state))

  return (
    <AppLayout assistantContext={assistFor.page('طلبات عمليات الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />
          <header>
            <div>
              <h1 className="ptitle">طلبات عمليات الميزانية</h1>
              <p className="sub mt-1">المناقلة والتعزيز والتخفيض · على الميزانيات المعتمدة، وداخل الميزانية الواحدة</p>
            </div>
            {mayAct('prepare', role) && (
              <Link className="btn btn-p" to={ROUTES.budgetOpNew}>
                <Icon name={icons.plus} size="sm" />
                طلب جديد
              </Link>
            )}
          </header>

          <Segments
            items={[
              { key: '', label: 'الكل', count: BUDGET_REQS.length },
              { key: 'mine', label: 'عند خطوتي', count: BUDGET_REQS.filter((r) => mine(r.state)).length },
              ...GROUPS.map((g) => ({ key: g.key, label: g.label, count: BUDGET_REQS.filter((r) => g.states.includes(r.state)).length })),
            ]}
            active={seg ?? ''}
            onChange={(k) => setSeg(k || undefined)}
          />

          <Glass className="tblcard">
            <Head title="الطلبات" meta={<span className="sub"><Num>{rows.length}</Num> طلب</span>} />
            {rows.length === 0 ? (
              <Empty title="لا طلبات هنا." note="يُنشأ الطلب من هنا أو من شاشة الميزانية المعتمدة." />
            ) : (
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>الطلب</th>
                      <th>العملية</th>
                      <th>الميزانية</th>
                      <th>البند</th>
                      <th className="n">المبلغ</th>
                      <th>الحالة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const d = docOf(r.docId)
                      const line = (nid?: string) => (d && nid ? pathOf(d.nodes, nid).split(' · ').slice(-1)[0] : '')
                      return (
                        <tr key={r.id} className="clk" onClick={() => navigate(ROUTES.budgetOp(r.id))}>
                          <td><Link className="lnk" to={ROUTES.budgetOp(r.id)} onClick={(e) => e.stopPropagation()}><Mono>{r.id}</Mono></Link></td>
                          <td>{REQ_KIND_SAY[r.kind]}</td>
                          <td className="trim1">{d ? docTitle(d) : r.docId}</td>
                          <td className="trim1">
                            {r.kind === 'transfer' ? <>{line(r.fromId)} ← {line(r.toId)}</> : line(r.toId ?? r.fromId)}
                          </td>
                          <td className="n"><Money sm>{r.amount}</Money></td>
                          <td><Tag tone={reqTone(r.state)}>{REQ_STATE_SAY[r.state]}</Tag></td>
                          <td><DateText>{r.createdAt.slice(0, 10)}</DateText></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}
