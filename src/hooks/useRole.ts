import { useCallback, useEffect, useState } from 'react'
import { asUser, readRole, roleByKey, writeRole, type Role, type RoleKey } from '@/data/roles'
import type { CurrentUser } from '@/types/domain'
import { isEntitySession, sessionScope } from '@/data/session'
import { entityById } from '@/data/mock/entities'
import { regRows } from '@/data/mock/registration'

const EVENT = 'ab:role'

/**
 * Current role, shared across all components.
 *
 * Switching dispatches a window event instead of putting a context
 * around the app — this is the only piece of shared state here, and a
 * context would have been more structure than needed. Once the auth
 * token becomes the source of the role, this hook collapses to a single
 * line reading from the session, and the switcher disappears.
 */
export function useRole(): {
  role: Role
  user: CurrentUser
  setRole: (key: RoleKey) => void
} {
  const [key, setKey] = useState<RoleKey>(readRole)

  useEffect(() => {
    const onChange = (e: Event) => setKey((e as CustomEvent<RoleKey>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  const setRole = useCallback((next: RoleKey) => {
    writeRole(next)
    window.dispatchEvent(new CustomEvent<RoleKey>(EVENT, { detail: next }))
  }, [])

  const role = roleByKey(key)
  /* Re-audit 7 Oct · an entity session signs as the entity, never as the last staff seat used in this
     browser · a partner's portfolio actions are logged under the partner's name */
  if (isEntitySession()) {
    const scope = sessionScope()
    const name = (scope.entityId && entityById(scope.entityId)?.name) || regRows.find((r) => r.id === scope.reqId)?.name || 'الجهة'
    return { role, user: { ...asUser(role), name, role: 'الجهة المستفيدة', financialAuthority: null, actions: [] }, setRole }
  }
  return { role, user: asUser(role), setRole }
}
