import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/routes'
import { Icon, icons } from '@/components/ui'

/**
 * "What this record belongs to" — the links a table row no longer carries.
 * 17 Oct · client: a row opens its own record, and **inside** the record are the links to its
 * project and its entity (and its agreement / plan when it has one). One strip, same place on
 * every detail page, so the user learns where to look once.
 * The entity's own view (`?as=entity`) gets the names as text — those pages are staff screens.
 */
export interface RelatedLink { kind: 'project' | 'entity' | 'agreement' | 'plan' | 'payment' | 'closing'; id: string; label: string }

const SAY: Record<RelatedLink['kind'], string> = {
  project: 'المشروع', entity: 'الجهة', agreement: 'الاتفاقية', plan: 'الخطة', payment: 'طلب الصرف', closing: 'الإغلاق',
}
const ICON: Record<RelatedLink['kind'], keyof typeof icons> = {
  project: 'navProjects', entity: 'entity', agreement: 'contract', plan: 'plan', payment: 'pay', closing: 'navClosings',
}
const href = (l: RelatedLink) =>
  l.kind === 'project' ? ROUTES.project(l.id)
  : l.kind === 'entity' ? ROUTES.entity(l.id)
  : l.kind === 'agreement' ? ROUTES.agreement(l.id)
  : l.kind === 'plan' ? ROUTES.plan(l.id)
  : l.kind === 'payment' ? ROUTES.payment(l.id)
  : ROUTES.closing(l.id)

export function Related({ links, plain }: { links: (RelatedLink | false | null | undefined)[]; plain?: boolean }) {
  const ls = links.filter((l): l is RelatedLink => !!l && !!l.id)
  if (!ls.length) return null
  return (
    <nav className="related mt-2" aria-label="السجلات المرتبطة">
      {ls.map((l) => plain ? (
        <span key={l.kind} className="related-i"><Icon name={icons[ICON[l.kind]]} size="sm" /><span className="sub">{SAY[l.kind]}</span> {l.label}</span>
      ) : (
        <Link key={l.kind} className="related-i lnk" to={href(l)}><Icon name={icons[ICON[l.kind]]} size="sm" /><span className="sub">{SAY[l.kind]}</span> {l.label}</Link>
      ))}
    </nav>
  )
}
