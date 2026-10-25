import { Link } from 'react-router-dom'
import { EntityMark } from './EntityMark'

/* Client 24 Oct · «أي اسم مستخدم أو جهة أو مشروع … جمبها اللوجو أو الصورة · صغيرة 32px».

   A person already reads with its face (`Person`). An entity or a project reads with the entity's
   mark beside its name, at the small size (32) · a project carries its entity's logo, since a
   project has no logo of its own · the name links to its record when a link is given. */
export function OrgName({ name, logo, to, quiet }: { name: string; logo?: string; to?: string; quiet?: boolean }) {
  return (
    <span className="prs prs-md">
      <EntityMark logo={logo} size="sm" />
      {to ? <Link className="tlink prs-n" to={to}>{name}</Link> : <span className={quiet ? 'prs-n sub' : 'prs-n'}>{name}</span>}
    </span>
  )
}
