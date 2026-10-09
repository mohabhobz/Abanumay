import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, Money, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import {
  CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, casesOfProject, grantOf, paidToDate, stopPhase, useClosing,
} from '@/data/closing/store'

/* «حالات التعثر» on the project · 10.9.

   The project page is where a stop or a change of value starts: the supervisor sees the grant,
   what was paid and where a stop would land (before any payment, after a part, with payments
   still ahead), then opens the case. Each case is its own record with its own approvals, listed
   here with where it stands. */

export function DistressCard({ projectId }: { projectId: string }) {
  useClosing()
  const { role } = useRole()
  const list = casesOfProject(projectId)
  const open = list.some((c) => c.stage !== 'closed' && c.stage !== 'rejected')
  const phase = stopPhase(projectId)
  return (
    <Glass>
      <Head title="حالات التعثر وتعديل القيمة" meta={<span className="sub">قيمة المنحة <Money sm>{grantOf(projectId)}</Money> · المصروف <Money sm>{paidToDate(projectId)}</Money></span>} />
      {list.length > 0 ? (
        <ul className="apv-list">
          {list.map((c) => (
            <li key={c.id}>
              <span className="apv-t">
                <b><Link className="tlink" to={ROUTES.distress(c.id)}>{c.id}</Link> · {CASE_KIND_SAY[c.kind]}</b>
                <span className="sub">{c.reason} · <DateText>{c.openedAt}</DateText></span>
              </span>
              <span className="pc-sp" />
              <Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sub cnote">لا حالات على المشروع · لو أُوقف الآن: {phase.say}.</p>
      )}
      {role.key === 'supervisor' && !open && (
        <div className="rowf gp-2 mt-3">
          <Link className="btn btn-2 btn-sm" to={ROUTES.distressNew(projectId, 'stop')}><Icon name={icons.alert} size="sm" />إيقاف المشروع</Link>
          <Link className="btn btn-2 btn-sm" to={ROUTES.distressNew(projectId, 'reduce')}>تخفيض القيمة</Link>
          <Link className="btn btn-2 btn-sm" to={ROUTES.distressNew(projectId, 'increase')}>زيادة القيمة</Link>
        </div>
      )}
      <p className="sub cnote">يرفع المشرف القرار، ويوافق مدير المنح، ويعتمده الرئيس التنفيذي · ولا يتغيّر المشروع قبل اعتماده.{/* doc 10.9 */}</p>
    </Glass>
  )
}
