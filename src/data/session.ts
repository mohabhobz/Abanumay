import { currentEpoch } from './authGuard'
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

/** What an entity session may open · its own entity, or its own registration request */
export interface Scope { entityId?: string; reqId?: string }
const SCOPE = 'ab-scope'
const EPOCH_AT = 'ab-session-epoch-at'

export const signIn = (username: string, role: Role = 'staff', scope?: Scope): void => {
  try {
    sessionStorage.setItem(KEY, username || '1')
    sessionStorage.setItem(ROLE, role)
    /* Batch 8 · the session belongs to the current epoch · «sign out everywhere» moves it */
    sessionStorage.setItem(EPOCH_AT, currentEpoch())
    if (scope) sessionStorage.setItem(SCOPE, JSON.stringify(scope))
    else sessionStorage.removeItem(SCOPE)
  } catch {
    /* Private mode or blocked storage · the session stays in memory until refresh */
  }
}

export const signOut = (): void => {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(ROLE)
    sessionStorage.removeItem(SCOPE)
  } catch {
    /* Nothing to do */
  }
}

export const isSignedIn = (): boolean => {
  try {
    if (sessionStorage.getItem(KEY) === null) return false
    const at = sessionStorage.getItem(EPOCH_AT)
    if (at !== null && at !== currentEpoch()) { signOut(); return false }
    return true
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

/** The entity session's own records · empty for staff */
export const sessionScope = (): Scope => {
  try {
    return JSON.parse(sessionStorage.getItem(SCOPE) ?? '{}') as Scope
  } catch {
    return {}
  }
}

/** Signed in as an entity (or a registrant) · its screens are the portal and its own records */
export const isEntitySession = (): boolean => isSignedIn() && sessionRole() === 'entity'

/** A staff member reading an entity's portal · every control inside is disabled, links still open */
export const isPortalPreview = (): boolean => isSignedIn() && sessionRole() !== 'entity'

/** Batch 8 · after ending the other sessions, this tab joins the new epoch and stays signed in */
export const keepThisSession = (): void => {
  try { if (sessionStorage.getItem(KEY) !== null) sessionStorage.setItem(EPOCH_AT, currentEpoch()) } catch { /* ignore */ }
}
