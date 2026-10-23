import { rowGo } from '@/lib/rowGo'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/routes'
import { Glass, Head, Mono, Num, Tag } from '@/components/ui'
import { countOf, nf, NOUN, projectCode } from '@/lib/format'
import { projectById } from '@/data/mock/projects'
import type { Entity } from '@/types/domain'

export { DataTab } from './DataTab'
export { StudyTab } from './StudyTab'
export { EntityTab } from './EntityTab'
export { AgreementTab, type AgreementTabProps } from './AgreementTab'
export { PlanTab, type PlanTabProps } from './PlanTab'
export { CloseTab, type CloseTabProps } from './CloseTab'
export { PaymentsTab, type PaymentsTabProps } from './PaymentsTab'
export { LogTab, type LogTabProps } from './LogTab'
export { ActivitiesTab, type ActivitiesTabProps } from './ActivitiesTab'
export { FollowUpsTab, type FollowUpsTabProps } from './FollowUpsTab'
export { AttachmentsTab, type AttachmentsTabProps } from './AttachmentsTab'

/* Previous projects */

export function HistoryTab({
  entity: E, currentId, year,
}: { entity: Entity; currentId: string; year: string }) {
  const navigate = useNavigate()
  return (
    <>
      <Glass>
        <Head title="مؤشرات الجهة" meta="تراكمي" />
        <div className="imp" style={{ '--n': E.stats.length } as CSSProperties}>
          {E.stats.map((s) => (
            <div key={s.k}>
              <div className="v num">{nf.format(s.v)}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="مشاريع الجهة" meta={`${countOf(E.projects.length, NOUN.project)}`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>الرقم</th><th>المشروع</th><th>المنطقة</th><th>الحالة</th>
                <th className="n">الوزن</th>
              </tr>
            </thead>
            <tbody>
              {E.projects.map((p) => (
                <tr key={p.id} {...(p.id === currentId ? { className: 'lv0' } : rowGo(navigate, ROUTES.project(p.id)))}>
                  <td><Mono>{projectCode(p.id, projectById(p.id)?.year ?? year)}</Mono></td>
                  <td>{p.name}</td>
                  <td>{p.region}</td>
                  <td><Tag tone={p.tone}>{p.status}</Tag></td>
                  <td className="n">{p.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub mt-3">
          مشروع واحد اعتُذر عنه بوزن <Num>96</Num>، وهو أعلى وزن سُجّل للجهة. سبب الاعتذار غير
          مسجّل في النظام الحالي.
        </div>
      </Glass>
    </>
  )
}

/* Follow-ups */

/**
 * Follow-ups.
 *
 * In the current system, a follow-up is where disbursement conditions get
 * documented: an entry stating "second payment requirement: 50% of
 * operations complete" is what the disbursement authorization issued days
 * later was based on. So it isn't a notes log — it's the evidence a
 * financial decision rests on.
 *
 * It also appears inside the project log in the same chronological order,
 * because the system places it in the same timeline. This tab is a
 * focused view of it.
 */
/* Correspondence */
