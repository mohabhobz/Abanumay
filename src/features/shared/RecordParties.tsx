import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, KV, Mono, Money, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { projectById } from '@/data/mock/projects'
import { entityById } from '@/data/mock/entities'
import { accountSay } from '@/data/shared/decisions'
import { activationTone, groupTone } from '@/lib/tone'
import { entityCode, projectCode } from '@/lib/format'

/* Client 27 Oct · «المشروع» and «الجهة» as tabs on every record that belongs to a project · the same
   two cards on the agreement, the plan, the payment and the closing, each opening its own file */

export function RecordProjectCard({ projectId, projectName }: { projectId: string; projectName: string }) {
  const p = projectById(projectId)
  return (
    <Glass>
      <Head title="المشروع" meta={p ? <Tag tone={groupTone(p.statusGroup)}>{p.statusGroup}</Tag> : undefined} />
      <KV rows={[
        { k: 'المشروع', v: <Link className="tlink" to={ROUTES.project(projectId)}>{projectName}</Link> },
        ...(p ? [
          { k: 'رمز المشروع', v: <Mono>{projectCode(p.id, p.year)}</Mono> },
          { k: 'المسار · المجال · الهدف', v: `${p.track} · ${p.field} · ${p.goal}` },
          { k: 'المنطقة', v: `${p.region}${p.city ? ` · ${p.city}` : ''}` },
          { k: 'المبلغ المعتمد', v: <Money>{p.amountGranted || p.amountRequested}</Money> },
          { k: 'مالك المشروع', v: p.owner ? <Person name={p.owner} /> : '—' },
        ] : []),
      ]} />
    </Glass>
  )
}

export function RecordEntityCard({ entityId, entityName, extra = [] }: {
  entityId: string
  entityName: string
  /** Rows the record adds · the agreement's representative, for one */
  extra?: { k: string; v: ReactNode }[]
}) {
  const e = entityById(entityId)
  return (
    <Glass>
      <Head title="الجهة" meta={e && !e.external ? <Tag tone={activationTone(accountSay(e))}>{accountSay(e)}</Tag> : undefined} />
      <KV rows={[
        { k: 'الجهة', v: <Link className="tlink" to={ROUTES.entity(entityId)}>{entityName}</Link> },
        ...(e ? [
          { k: 'رمز الجهة', v: <Mono>{entityCode(e.id, e.registeredAt)}</Mono> },
          { k: 'تصنيف الجهة', v: e.type },
          { k: 'رقم الترخيص', v: <Mono>{e.licenseNo}</Mono> },
          { k: 'المنطقة · المدينة', v: `${e.region}${e.city ? ` · ${e.city}` : ''}` },
        ] : []),
        ...extra,
      ]} />
    </Glass>
  )
}
