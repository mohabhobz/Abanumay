import { useCallback, useEffect, useState } from 'react'
import { asUser, readRole, roleByKey, writeRole, type Role, type RoleKey } from '@/data/roles'
import type { CurrentUser } from '@/types/domain'

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
  return { role, user: asUser(role), setRole }
}
