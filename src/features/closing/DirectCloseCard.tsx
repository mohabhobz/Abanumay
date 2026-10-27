import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, KV, Money, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { holds, holdersSay } from '@/data/shared/decisions'
import { closeOfProject } from '@/data/mock/closing'
import { projectById } from '@/data/mock/projects'
import { isLive } from '@/data/status'
import {
  CASE_STAGE_SAY, CASE_STAGE_TONE, DIRECT_PATH, casesOfProject, grantOf, paidToDate, useClosing,
} from '@/data/closing/store'

/* Client sheet 24 Oct (#27) · «إغلاق المشاريع مباشر» · an independent procedure.

   A project can be closed without the final-report and evaluation cycle. The supervisor opens it
   with a reason and its document, and it walks a fixed path · grants manager → CEO → finance ·
   finance's settlement is what closes it: the open payment requests and the payments still ahead
   stop, what's held and unpaid goes back to the budget line, and the project reads «مكتمل». It
   lives with the other decisions on a project (the distress cases), so it has their page, their
   inbox queue and their log. */

export function DirectCloseCard({ projectId }: { projectId: string }) {
  useClosing()
  const { role } = useRole()
  const p = projectById(projectId)
  const mine = casesOfProject(projectId).filter((c) => c.kind === 'direct')
  const anyOpen = casesOfProject(projectId).some((c) => c.stage !== 'closed' && c.stage !== 'rejected')
  const cycle = closeOfProject(projectId)
  const why = !p ? 'المشروع غير موجود'
    : p.closedDirect ? 'أُغلق المشروع مباشرة'
    : !(isLive(p.statusGroup) || p.statusGroup === 'متعثر') ? 'يُغلق مباشرة مشروع معتمد تحت التنفيذ'
    : cycle && cycle.stage !== 'closed' ? `للمشروع إغلاق قائم ${cycle.id} · يُستكمل من صفحته`
    : anyOpen ? 'للمشروع إجراء مفتوح في حالات التعثر · يُبتّ فيه أولًا'
    : ''
  const can = holds('distressBy', role.key)
  const unpaid = Math.max(0, grantOf(projectId) - paidToDate(projectId))
  return (
    <Glass>
      <Head title="الإغلاق المباشر" meta={<Tag tone="mute">إجراء مستقل</Tag>} />
      {mine.length > 0 && (
        <ul className="apv-list">
          {mine.map((c) => (
            <li key={c.id}>
              <span className="apv-t">
                <b><Link className="tlink" to={ROUTES.distress(c.id)}>{c.id}</Link> · {c.reason}</b>
                <span className="sub">فُتح <DateText>{c.openedAt}</DateText>{c.finance ? <> · أُغلق <DateText>{c.finance.at}</DateText></> : null}</span>
              </span>
              <span className="pc-sp" />
              <Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag>
            </li>
          ))}
        </ul>
      )}
      <KV rows={[
        { k: 'مسار الاعتماد', v: DIRECT_PATH.join(' ← ') },
        { k: 'غير المصروف من المنحة', v: <Money sm>{unpaid}</Money> },
      ]} />
      {!p?.closedDirect && (
        <div className="rowf gp-2 mt-3">
          {can
            ? why
              ? <button type="button" className="btn btn-2 btn-sm" disabled title={why}><Icon name={icons.lock} size="sm" />إغلاق مباشر</button>
              : <Link className="btn btn-2 btn-sm" title="يفتح طلب الإغلاق المباشر" to={ROUTES.distressNew(projectId, 'direct')}><Icon name={icons.lock} size="sm" />إغلاق مباشر</Link>
            : <span className="sub">يفتح الإغلاق المباشر {holdersSay('distressBy')}.</span>}
          {can && why && <span className="sub">{why}</span>}
        </div>
      )}
    </Glass>
  )
}
