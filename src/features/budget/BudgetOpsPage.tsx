import { rowGo } from '@/lib/rowGo'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ButtonLink, BackTo, DateText, Empty, Glass, Head, Icon, Mono, Money, MultiSelect, Num, Tag, icons } from '@/components/ui'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { budgetReqOutcome, outcomeMatches, outcomeOptions } from '@/data/shared/outcome'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
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
  /* Client sheet 24 Oct (#95) · the request's outcome · مكتمل / مرفوض / ملغي, or still under way ·
     the segments count within the outcome pick */
  const { values: v, set } = useQueryParams(['res'])
  const res = readList(v.res)
  const inRes = BUDGET_REQS.filter((r) => outcomeMatches(budgetReqOutcome(r.state), res))
  const inSeg = (r: (typeof BUDGET_REQS)[number]) =>
    !seg ? true : seg === 'mine' ? mine(r.state) : Boolean(GROUPS.find((g) => g.key === seg)?.states.includes(r.state))
  const rows = inRes.filter(inSeg)

  return (
    <AppLayout assistantContext={assistFor.page('طلبات عمليات الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />
          <header>
            <div>
              <h1 className="ptitle">طلبات عمليات الميزانية</h1>

            </div>
            {mayAct('prepare', role) && (
              <ButtonLink variant="p" to={ROUTES.budgetOpNew}>
                <Icon name={icons.plus} size="sm" />
                طلب جديد
              </ButtonLink>
            )}
          </header>

          <Segments
            items={[
              { key: '', label: 'الكل', count: inRes.length },
              { key: 'mine', label: 'عند خطوتي', count: inRes.filter((r) => mine(r.state)).length },
              ...GROUPS.map((g) => ({ key: g.key, label: g.label, count: inRes.filter((r) => g.states.includes(r.state)).length })),
            ]}
            active={seg ?? ''}
            onChange={(k) => setSeg(k || undefined)}
          />

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <MultiSelect
                  values={res}
                  all="كل النتائج"
                  options={outcomeOptions(BUDGET_REQS.filter(inSeg), (r) => budgetReqOutcome(r.state))}
                  onChange={(x) => set({ res: writeList(x) })}
                />
              </div>
            </div>
          </Glass>

          <Glass className="tblcard">
            <Head title="الطلبات" meta={<span className="sub"><Num>{rows.length}</Num> طلب</span>} />
            {rows.length === 0 ? (
              <Empty title="لا طلبات هنا." />
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
                      <th>النتيجة</th>
                      <th>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const d = docOf(r.docId)
                      const line = (nid?: string) => (d && nid ? pathOf(d.nodes, nid).split(' · ').slice(-1)[0] : '')
                      return (
                        <tr key={r.id} {...rowGo(navigate, ROUTES.budgetOp(r.id))}>
                          <td><Link className="lnk" to={ROUTES.budgetOp(r.id)} onClick={(e) => e.stopPropagation()}><Mono>{r.id}</Mono></Link></td>
                          <td>{REQ_KIND_SAY[r.kind]}</td>
                          <td className="trim1">{d ? docTitle(d) : r.docId}</td>
                          <td className="trim1">
                            {r.kind === 'transfer' ? <>{line(r.fromId)} ← {line(r.toId)}</> : line(r.toId ?? r.fromId)}
                          </td>
                          <td className="n"><Money sm>{r.amount}</Money></td>
                          <td><Tag tone={reqTone(r.state)}>{REQ_STATE_SAY[r.state]}</Tag></td>
                          <td><OutcomeTag outcome={budgetReqOutcome(r.state)} pending /></td>
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
