import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DockActions, DateText, Glass, Head, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { meOf, readRole } from '@/data/roles'
import { planOfProject, planStageLabel } from '@/data/mock/plans'
import { changePlanDecision, originalDecision, planDecisionHistory, planDecisionOf, planRuleSays, usePlans, type PlanDecision } from '@/data/plans/store'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { nf } from '@/lib/format'
import { planKind } from '@/data/approvals/store'
import { projectRows } from '@/data/mock/projects'

/* Client meeting 20 Oct (#38) · the project's type decides first · a portfolio always has a plan, an
   external project has neither a plan nor an agreement, and a regular project's plan is optional ·
   the grants manager decides it */
const KIND_SAY = {
  portfolio: { t: 'محفظة · تتطلب خطة دائمًا' },
  external: { t: 'مشروع خارجي · بلا خطة ولا اتفاقية' },
  regular: { t: 'مشروع عادي · الخطة اختيارية' },
} as const

/* «خطة العمل» · the plan decision on the project (12.2.1 · 12.2.2 · 12.4.31 – 12.4.33).

   The grants manager decides with the approval whether the project needs a plan; the card shows
   that decision with its author and date, the rule's suggestion beside it, and the plan it led
   to. The manager may change it either way with a reason: switching off cancels the plan and
   stops its procedures, switching on opens one. Each change stays in the history. */

const SOURCE_SAY = { approval: 'مع توصية الاعتماد', change: 'تعديل لاحق', legacy: 'مُرحّل من النظام السابق', rule: 'وفق القاعدة', late: 'قرار بعد الاعتماد' } as const

export function PlanDecisionCard({ projectId, approved }: { projectId: string; approved: boolean }) {
  usePlans()
  const { pathname } = useLocation()
  const role = readRole()
  const d = planDecisionOf(projectId)
  const plan = planOfProject(projectId)
  const rule = planRuleSays(projectId)
  const orig = originalDecision(projectId)
  const hist: PlanDecision[] = [...planDecisionHistory(projectId), ...(orig && planDecisionHistory(projectId).length ? [orig] : [])]
  const [said, setSaid] = useState('')
  const me = meOf(role)
  const pr = projectRows.find((x) => x.id === projectId)
  const kind = pr ? planKind(pr) : 'regular'
  /* the type forces the decision for a portfolio and an external project · the manager decides only a regular one */
  const mayChange = role === 'grants-manager' && approved && kind === 'regular'

  return (
    <Glass>
      <Head title="خطة العمل" hint={/* doc 4.4.2 */ `تقترح القاعدة خطة من ${nf.format(APPROVAL_RULES.planFrom)} ريال أو لمدة تتجاوز السنة`} meta={d ? <Tag tone={d.needs ? 'teal' : 'mute'}>{d.needs ? 'يتطلب خطة' : 'لا يتطلب خطة'}</Tag> : <span className="sub">لم يُقرَّر بعد</span>} />
      <ul className="apv-list">
        <li>
          <span className="apv-t">
            <b>{KIND_SAY[kind].t}</b>
          </span>
        </li>
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
          </span>
        </li>
        {plan && (
          <li>
            <span className="apv-t">
              {/* Client 27 Oct · on the plan's own page its number is text · a link there went nowhere */}
              <b>{pathname === ROUTES.plan(plan.id) ? <span className="num">{plan.id}</span> : <Link className="tlink" to={ROUTES.plan(plan.id)}>{plan.id}</Link>} · {planStageLabel(plan.stage)}</b>
              <span className="sub">{plan.drafter === 'entity' ? 'تكتبها الجهة' : 'يكتبها المشرف بالنيابة'}</span>
            </span>
          </li>
        )}
      </ul>

      {mayChange && d && (
        <div className="apv-row mt-3">
          {/* Client 26 Oct · the reason in the decision's popup */}
          <DockActions
            actions={[{ label: d.needs ? 'حوّله إلى «لا يتطلب خطة»' : 'حوّله إلى «يتطلب خطة»', kind: 'btn-2 btn-sm', needsNote: true }]}
            subject={d.needs && plan && plan.stage !== 'cancelled' ? 'تعديل قرار خطة المشروع · يلغي الخطة ويوقف إجراءاتها' : 'تعديل قرار خطة المشروع'}
            placeholder="سبب تعديل القرار"
            onRun={(_a, n) => { const out = changePlanDecision(projectId, !d.needs, n, me); setSaid(out[0] ?? ''); return out }}
          />
        </div>
      )}
      {mayChange && !d && (
        <div className="apv-row mt-3">
          {/* Client 26 Oct · the reason in the decision's popup */}
          <DockActions
            actions={[true, false].map((needs) => ({ label: needs ? 'يتطلب خطة' : 'لا يتطلب خطة', kind: `${needs === rule ? 'btn-p' : 'btn-2'} btn-sm`, needsNote: true, needs }))}
            subject="قرار خطة المشروع"
            placeholder="سبب القرار"
            onRun={(a, n) => { const out = changePlanDecision(projectId, a.needs, n, me); setSaid(out[0] ?? ''); return out }}
          />
        </div>
      )}
      {said && <p className="bad cnote">{said}</p>}

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
