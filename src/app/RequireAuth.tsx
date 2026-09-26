import { Navigate, useLocation } from 'react-router-dom'
import { isSignedIn } from '@/data/session'
import { ROUTES } from './routes'

/**
 * Gate for all internal screens.
 * It keeps the path the user was headed to in `state.from`, so opening a project link while signed
 * out lands back on that project after login instead of the default page — the link that brought
 * them in is why they came.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (isSignedIn()) return <>{children}</>
  /* The root isn't an intended destination — it just means "the site was opened." If we passed it
     as `from`, the user would land on "Today" instead of the default screen. */
  const target = loc.pathname + loc.search
  const from = loc.pathname === ROUTES.home ? undefined : target
  return <Navigate to={ROUTES.login} replace state={from ? { from } : null} />
}
