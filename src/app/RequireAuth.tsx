import { Navigate, useLocation } from 'react-router-dom'
import { isSignedIn, sessionRole, sessionScope } from '@/data/session'
import { entityMayOpen, portalOf, staffViewOf } from './entityAccess'
import { ROUTES } from './routes'

/**
 * Gate for all internal screens.
 * It keeps the path the user was headed to in `state.from`, so opening a project link while signed
 * out lands back on that project after login instead of the default page — the link that brought
 * them in is why they came.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (isSignedIn()) {
    /* Re-audit 7 Oct · an entity opens its own records' entity view and nothing else; staff never
       act as an entity · they land on the staff view of the same record */
    if (sessionRole() === 'entity') {
      const scope = sessionScope()
      return entityMayOpen(loc.pathname, loc.search, scope) ? <>{children}</> : <Navigate to={portalOf(scope)} replace />
    }
    const staffView = staffViewOf(loc.pathname, loc.search)
    if (staffView) return <Navigate to={staffView} replace />
    return <>{children}</>
  }
  /* The root isn't an intended destination — it just means "the site was opened." If we passed it
     as `from`, the user would land on "Today" instead of the default screen. */
  const target = loc.pathname + loc.search
  const from = loc.pathname === ROUTES.home ? undefined : target
  return <Navigate to={ROUTES.login} replace state={from ? { from } : null} />
}
