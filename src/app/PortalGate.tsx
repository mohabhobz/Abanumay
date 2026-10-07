import { Navigate, useLocation } from 'react-router-dom'
import { isSignedIn, sessionRole, sessionScope } from '@/data/session'
import { regRows } from '@/data/mock/registration'
import { portalOf } from './entityAccess'
import { ROUTES } from './routes'

/* The entity's portal and its update request · re-audit 7 Oct.

   Both pages used to be public: anyone with `?entity=<number>` read an entity's portal and sent
   changes in its name. Now they need a session. An entity session opens its own portal only (its
   entity, or its own registration request); a staff session reads any portal as a preview, with
   every action disabled (`PortalPreview`), because staff never act as the entity. */

export function PortalGate({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (!isSignedIn()) return <Navigate to={ROUTES.login} replace state={{ from: loc.pathname + loc.search }} />
  if (sessionRole() !== 'entity') return <>{children}</>
  const scope = sessionScope()
  const q = new URLSearchParams(loc.search)
  const ent = q.get('entity')
  const req = q.get('req')
  const reqEntity = req ? regRows.find((r) => r.id === req)?.entityId : undefined
  const ok = ent
    ? ent === scope.entityId
    : req
      ? req === scope.reqId || (Boolean(reqEntity) && reqEntity === scope.entityId)
      : false
  return ok ? <>{children}</> : <Navigate to={portalOf(scope)} replace />
}

