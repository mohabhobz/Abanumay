import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { meOf, readRole } from '@/data/roles'
import { planOfProject, planStageLabel } from '@/data/mock/plans'
import { changePlanDecision, originalDecision, planDecisionHistory, planDecisionOf, planRuleSays, usePlans, type PlanDecision } from '@/data/plans/store'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { nf } from '@/lib/format'

/* «خطة العمل» · the plan decision on the project (12.2.1 · 12.2.2 · 12.4.31 – 12.4.33).

   The grants manager decides with the approval whether the project needs a plan; the card shows
   that decision with its author and date, the rule's suggestion beside it, and the plan it led
   to. The manager may change it either way with a reason: switching off cancels the plan and
   stops its procedures, switching on opens one. Each change stays in the history. */

const SOURCE_SAY = { approval: 'مع توصية الاعتماد', change: 'تعديل لاحق', legacy: 'خطة قائمة قبل التوثيق', rule: 'وفق القاعدة' } as const

export function PlanDecisionCard({ projectId, approved }: { projectId: string; approved: boolean }) {
  usePlans()
  const role = readRole()
  const d = planDecisionOf(projectId)
  const plan = planOfProject(projectId)
  const rule = planRuleSays(projectId)
  const orig = originalDecision(projectId)
  const hist: PlanDecision[] = [...planDecisionHistory(projectId), ...(orig && planDecisionHistory(projectId).length ? [orig] : [])]
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState('')
  const me = meOf(role)
  const mayChange = role === 'grants-manager' && approved

  return (
    <Glass>
      <Head title="خطة العمل" meta={d ? <Tag tone={d.needs ? 'teal' : 'mute'}>{d.needs ? 'يتطلب خطة' : 'لا يتطلب خطة'}</Tag> : <span className="sub">لم يُقرَّر بعد</span>} />
      <ul className="apv-list">
        {d && (
          <li>
            <span className="apv-t">
              <b>{d.needs ? 'يتطلب خطة عمل' : 'لا يتطلب خطة عمل'} · {SOURCE_SAY[d.source]}</b>
              {d.reason && <span className="sub">السبب: {d.reason}</span>}
            </span>
            <span className="pc-sp" />
            <Person name={d.by} />
            <span className="sub"><DateText>{d.at}</DateText></span>
          </li>
        )}
        <li>
          <span className="apv-t">
            <b>اقتراح القاعدة: {rule ? 'يتطلب خطة' : 'لا يتطلب خطة'}</b>
            <span className="sub">من {nf.format(APPROVAL_RULES.planFrom)} ريال أو مدة تتجاوز السنة · والقرار لمدير المنح{/* doc 4.4.2 */}</span>
          </span>
        </li>
        {plan && (
          <li>
            <span className="apv-t">
              <b><Link className="tlink" to={ROUTES.plan(plan.id)}>{plan.id}</Link> · {planStageLabel(plan.stage)}</b>
              <span className="sub">{plan.drafter === 'entity' ? 'تكتبها الجهة' : 'يكتبها المشرف بالنيابة'}</span>
            </span>
          </li>
        )}
      </ul>

      {mayChange && d && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب تعديل القرار · إلزامي" aria-label="سبب تعديل قرار الخطة" /></span>
          <button type="button" className="btn btn-2 btn-sm" disabled={!reason.trim()} onClick={() => { const out = changePlanDecision(projectId, !d.needs, reason, me); setSaid(out[0] ?? ''); if (!out.length) setReason('') }}>
            {d.needs ? 'حوّله إلى «لا يتطلب خطة»' : 'حوّله إلى «يتطلب خطة»'}
          </button>
        </div>
      )}
      {mayChange && !d && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب القرار · إلزامي" aria-label="سبب تعديل قرار الخطة" /></span>
          {[true, false].map((needs) => (
            <button key={String(needs)} type="button" className={`btn ${needs === rule ? 'btn-p' : 'btn-2'} btn-sm`} disabled={!reason.trim()} onClick={() => { const out = changePlanDecision(projectId, needs, reason, me); setSaid(out[0] ?? ''); if (!out.length) setReason('') }}>
              {needs ? 'يتطلب خطة' : 'لا يتطلب خطة'}
            </button>
          ))}
        </div>
      )}
      {said && <p className="bad cnote">{said}</p>}
      {mayChange && d?.needs && plan && plan.stage !== 'cancelled' && <p className="sub cnote">التحويل إلى «لا يتطلب خطة» يلغي الخطة ويوقف إجراءاتها.{/* doc 12.4.32 */}</p>}

      {hist.length > 1 && (
        <>
          <h4 className="fnd-h">سجل القرار</h4>
          <ul className="apv-list">
            {hist.slice(1).map((h, i) => (
              <li key={i}>
                <span className="apv-t"><b>{h.needs ? 'يتطلب خطة' : 'لا يتطلب خطة'}</b>{h.reason && <span className="sub">{h.reason}</span>}</span>
                <span className="pc-sp" />
                <Person name={h.by} />
                <span className="sub"><DateText>{h.at}</DateText></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Glass>
  )
}
