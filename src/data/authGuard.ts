import { readJson, persist } from '@/lib/config'
import { logSettings } from '@/data/shared/settingsLog'

/* Sign-in protection in the browser · batch 8 (the frontend half of «passwords and sessions»).

   The server owns the real thing: hashed passwords, tokens, revocation. What the screens own, and
   now do, is the same behaviour the server will enforce, so the journeys are final:

   · wrong passwords · after `maxTries` in a row the account is locked for `lockMinutes`, and the
     screen says how long is left
   · idle session · after `idleMinutes` without a click or a key the session ends; `warnSeconds`
     before that a bar offers to stay signed in
   · sign out everywhere · ends every open tab's session at once (an epoch every tab compares)

   In production the counters and the epoch live on the server and these functions call it. */

export interface AuthRules { maxTries: number; lockMinutes: number; idleMinutes: number; warnSeconds: number }
const DEFAULT: AuthRules = { maxTries: 5, lockMinutes: 15, idleMinutes: 30, warnSeconds: 120 }
const CFG_KEY = 'ab-cfg-auth'
export const AUTH_RULES: AuthRules = readJson(CFG_KEY, DEFAULT)
export const AUTH_RULES_DEFAULT = DEFAULT
export function saveAuthRules(next: AuthRules, by: string): void {
  logSettings('حماية الدخول', '/settings/decisions', by, (Object.keys(next) as (keyof AuthRules)[]).filter((k) => next[k] !== AUTH_RULES[k]).map((k) => ({ k, from: String(AUTH_RULES[k]), to: String(next[k]) })))
  Object.assign(AUTH_RULES, next)
  persist(CFG_KEY, AUTH_RULES)
}

/* ── Wrong passwords ── */

const TRIES = 'ab-login-tries'
type Tries = Record<string, { n: number; lockedUntil?: number }>
const readTries = (): Tries => { try { return JSON.parse(localStorage.getItem(TRIES) ?? '{}') as Tries } catch { return {} } }
const writeTries = (t: Tries) => { try { localStorage.setItem(TRIES, JSON.stringify(t)) } catch { /* storage blocked */ } }
const keyOf = (user: string) => user.trim().toLowerCase()

/** Seconds left on a lock · 0 when the account isn't locked */
export function lockLeft(user: string): number {
  const t = readTries()[keyOf(user)]
  return t?.lockedUntil ? Math.max(0, Math.ceil((t.lockedUntil - Date.now()) / 1000)) : 0
}

/** Record a wrong password · how many tries are left (0 means it just locked) */
export function loginFailed(user: string): number {
  const all = readTries()
  const k = keyOf(user)
  const t = all[k] ?? { n: 0 }
  if (t.lockedUntil && t.lockedUntil <= Date.now()) { t.n = 0; delete t.lockedUntil }
  t.n += 1
  if (t.n >= AUTH_RULES.maxTries) t.lockedUntil = Date.now() + AUTH_RULES.lockMinutes * 60_000
  all[k] = t
  writeTries(all)
  return Math.max(0, AUTH_RULES.maxTries - t.n)
}

export function loginSucceeded(user: string): void {
  const all = readTries()
  delete all[keyOf(user)]
  writeTries(all)
}

/* ── Sign out everywhere ── */

const EPOCH = 'ab-session-epoch'
export const currentEpoch = (): string => { try { return localStorage.getItem(EPOCH) ?? '0' } catch { return '0' } }
export function signOutEverywhere(): void {
  try { localStorage.setItem(EPOCH, String(Number(currentEpoch()) + 1)) } catch { /* storage blocked */ }
}

/* ── The demo's person switcher ──
   A shortcut for signing out and in as someone else, for walking the journeys. It goes before
   production: off from the settings, or off at build time with VITE_DEMO_SWITCHER=off, which wins. */
const DEMO_KEY = 'ab-cfg-demo'
export const DEMO: { switcher: boolean } = readJson(DEMO_KEY, { switcher: true })
export const switcherOn = (): boolean => import.meta.env.VITE_DEMO_SWITCHER !== 'off' && DEMO.switcher
export function setSwitcher(on: boolean, by: string): void {
  logSettings('حماية الدخول', '/settings/permissions', by, [{ k: 'مبدّل الأشخاص التجريبي', from: DEMO.switcher ? 'ظاهر' : 'مخفي', to: on ? 'ظاهر' : 'مخفي' }])
  DEMO.switcher = on
  persist(DEMO_KEY, DEMO)
}
