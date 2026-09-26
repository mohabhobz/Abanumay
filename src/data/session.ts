/**
 * Session state · a single flag in this prototype, a token in the real system.
 *
 * Exists so the site actually opens on a sign-in screen rather than an internal one: without it,
 * anyone opening the link would land straight inside the system, giving the false impression of a
 * "grants system" with no permissions.
 *
 * Stored in `sessionStorage`, not `localStorage`, on purpose: a new tab starts at sign-in, and
 * refreshing mid-work doesn't kick the user out.
 *
 * Once the backend is ready: `signIn` stores the token, `isSignedIn` checks its validity, and
 * `signOut` also revokes it on the server.
 */
const KEY = 'ab-session'
const ROLE = 'ab-role'

/**
 * Session role · only two in this prototype.
 *
 * This isn't a permissions system · it's a display key so a demo can open both journeys from the
 * same link without hunting for a saved path. The real roles (officer, grants manager, executive,
 * finance) get determined from the token once the backend is ready, and there are far more than two
 * of them.
 */
export type Role = 'staff' | 'entity'

export const signIn = (username: string, role: Role = 'staff'): void => {
  try {
    sessionStorage.setItem(KEY, username || '1')
    sessionStorage.setItem(ROLE, role)
  } catch {
    /* Private mode or blocked storage · the session stays in memory until refresh */
  }
}

export const signOut = (): void => {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(ROLE)
  } catch {
    /* Nothing to do */
  }
}

export const isSignedIn = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

/** Current session role · defaults to organization staff */
export const sessionRole = (): Role => {
  try {
    return sessionStorage.getItem(ROLE) === 'entity' ? 'entity' : 'staff'
  } catch {
    return 'staff'
  }
}
