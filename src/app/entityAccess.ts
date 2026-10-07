import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { planRows } from '@/data/mock/plans'
import { closeRows } from '@/data/mock/closing'
import { payRequests } from '@/data/mock/disbursements'
import { CASES } from '@/data/closing/store'
import { PORTFOLIOS } from '@/data/partners/store'
import type { Scope } from '@/data/session'
import { ROUTES } from './routes'

/* Which screens an entity session may open · re-audit 7 Oct.

   An entity used to reach every staff screen once signed in, and a staff member could act «as the
   entity» on any record. The rule now: an entity session opens its portal and the entity view
   (`?as=entity`, or `?as=partner` for a strategic partner) of a record that belongs to it, and
   nothing else. A staff session never acts as an entity · it is sent to the staff view of the same
   record. */

const own = (entityId: string | undefined, scope: Scope) => Boolean(entityId && scope.entityId && entityId === scope.entityId)

/** The entity a record belongs to, read from the path · undefined when the path isn't an entity view */
function ownerOf(path: string, q: URLSearchParams): string | undefined {
  let m: RegExpMatchArray | null
  if (path === ROUTES.projectNew) return q.get('entity') ?? undefined
  if (path === ROUTES.portfolioNew) return q.get('entity') ?? undefined
  if ((m = path.match(/^\/projects\/portfolio\/([^/]+)$/))) return PORTFOLIOS.find((x) => x.id === m![1])?.entityId
  if ((m = path.match(/^\/projects\/([^/]+)(\/[^/]+)?$/))) return projectRows.find((x) => x.id === m![1])?.entityId
  if ((m = path.match(/^\/agreements\/([^/]+)$/))) return agreements.find((x) => x.id === m![1])?.entityId
  if ((m = path.match(/^\/plans\/([^/]+)(\/edit)?$/))) return planRows.find((x) => x.id === m![1])?.entityId
  if ((m = path.match(/^\/closings\/cases\/([^/]+)$/))) return CASES.find((x) => x.id === m![1])?.entityId
  if ((m = path.match(/^\/closings\/([^/]+)(\/report)?$/))) return closeRows.find((x) => x.id === m![1])?.entityId
  if (path === `${ROUTES.payments}/new`) return projectRows.find((x) => x.id === q.get('project'))?.entityId
  if ((m = path.match(/^\/payments\/([^/]+)(\/edit)?$/))) return payRequests.find((x) => x.id === m![1])?.entityId
  return undefined
}

/** May this entity session open this screen? */
export function entityMayOpen(path: string, search: string, scope: Scope): boolean {
  const q = new URLSearchParams(search)
  const as = q.get('as')
  if (as !== 'entity' && as !== 'partner') return false
  return own(ownerOf(path, q), scope)
}

/** Where an entity session goes when it opens something that isn't its own */
export const portalOf = (scope: Scope): string =>
  scope.entityId ? `${ROUTES.entityPortal}?entity=${scope.entityId}` : scope.reqId ? `${ROUTES.entityPortal}?req=${scope.reqId}` : ROUTES.login

/** The staff view of an entity-view path · the same record without `as` */
export function staffViewOf(path: string, search: string): string | null {
  const q = new URLSearchParams(search)
  if (!q.has('as')) return null
  q.delete('as')
  const rest = q.toString()
  return `${path}${rest ? `?${rest}` : ''}`
}

/** The entity a record path belongs to · the test harness signs in as that entity with it */
export const ownerOfPath = (pathWithSearch: string): string | undefined => {
  const [path, search = ''] = pathWithSearch.split('?')
  return ownerOf(path, new URLSearchParams(search))
}
