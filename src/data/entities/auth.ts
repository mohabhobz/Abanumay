import { entityRows } from '@/data/mock/entities'
import { regRows } from '@/data/mock/registration'
import { ENTITY_RULES } from './rules'

/* Entity accounts, one-time codes and password reset (2.3.pw · 2.2.6 · 2.3.upd-17).

   An account is found by any of the three things an entity may remember — username, email or
   mobile — and the screen answers the same sentence whether it exists or not (2.3.pw-3), so the
   form can't be used to learn which entities are registered.

   Codes: five digits, valid for the minutes set in settings, dead after the allowed wrong tries,
   and a new one only after the wait. In the prototype the code is shown on screen (there is no SMS
   gateway); everything else — expiry, tries, resend, invalidation — runs as it would. Passwords are
   kept in the browser for the demo; in production the server holds a hash. */

export interface PortalAccount {
  id: string
  username: string
  email: string
  mobile: string
  name: string
  kind: 'reg' | 'entity'
}

const PASS_KEY = 'ab-portal-pass'
const OTP_KEY = 'ab-otp'

const readPass = (): Record<string, { pass: string; at: string }> => {
  try { return JSON.parse(localStorage.getItem(PASS_KEY) ?? '{}') } catch { return {} }
}
const writePass = (v: Record<string, { pass: string; at: string }>) => {
  try { localStorage.setItem(PASS_KEY, JSON.stringify(v)) } catch { /* storage blocked */ }
}

/** Every account the portal knows · the registration accounts and the approved entities' users */
export const accounts = (): PortalAccount[] => [
  ...entityRows.filter((e) => !e.archived).map((e) => ({
    id: `e-${e.id}`, username: `dept${e.id}`, email: e.email, mobile: e.mobile, name: e.name, kind: 'entity' as const,
  })),
  ...regRows.filter((r) => !r.entityId).map((r) => ({
    id: `r-${r.acctEmail}`, username: r.acctEmail, email: r.acctEmail, mobile: r.clerkMobile, name: r.name, kind: 'reg' as const,
  })),
  ...Object.keys(readPass()).filter((k) => k.startsWith('n-')).map((k) => ({
    id: k, username: k.slice(2), email: k.slice(2), mobile: '', name: k.slice(2), kind: 'reg' as const,
  })),
]

const clean = (s: string) => s.trim().toLowerCase().replace(/\s/g, '')

/** By username, email or mobile (2.3.pw-2) · masked fixture mobiles never match */
export const findAccount = (who: string): PortalAccount | undefined => {
  const w = clean(who)
  if (!w) return undefined
  return accounts().find((a) => [a.username, a.email, /X/.test(a.mobile) ? '' : a.mobile].some((x) => x && clean(x) === w))
}

/** The account a registration creates · its password is the one typed on the account screen */
export const createAccount = (email: string, pass: string): void => {
  const all = readPass()
  all[`n-${email.trim().toLowerCase()}`] = { pass, at: new Date().toISOString() }
  writePass(all)
}

export const setPassword = (acct: PortalAccount, pass: string): void => {
  const all = readPass()
  all[acct.id] = { pass, at: new Date().toISOString() }
  writePass(all)
  clearOtp()
}

/** Sign-in check · an account whose password was set here must match it; the rest are the demo's */
export const passwordOk = (who: string, pass: string): boolean | null => {
  const a = findAccount(who)
  const all = readPass()
  const saved = a ? all[a.id] ?? all[`n-${a.email}`] : all[`n-${clean(who)}`]
  return saved ? saved.pass === pass : null
}

export const passwordChangedAt = (acct: PortalAccount): string | undefined => readPass()[acct.id]?.at

/* ── One-time codes ── */

export type OtpPurpose = 'register' | 'reset' | 'update'

export interface OtpChallenge {
  purpose: OtpPurpose
  /** Where it went · masked for display */
  to: string[]
  code: string
  sentAt: number
  expiresAt: number
  tries: number
  dead: boolean
  account?: string
}

export const mask = (s: string): string => {
  if (!s) return ''
  if (s.includes('@')) {
    const [u, d] = s.split('@')
    return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`
  }
  return s.length > 4 ? `${'•'.repeat(s.length - 4)}${s.slice(-4)}` : s
}

let current: OtpChallenge | null = (() => {
  try { return JSON.parse(sessionStorage.getItem(OTP_KEY) ?? 'null') } catch { return null }
})()

const keep = () => {
  try { sessionStorage.setItem(OTP_KEY, JSON.stringify(current)) } catch { /* ignore */ }
}

export const OTP_LEN = 5

/** Send a new code · refuses while the previous one is inside its resend wait */
export const sendOtp = (purpose: OtpPurpose, to: string[], account?: string): OtpChallenge => {
  const t = Date.now()
  current = {
    purpose, to: to.filter(Boolean).map(mask), account,
    code: String(Math.floor(10000 + Math.random() * 90000)),
    sentAt: t, expiresAt: t + ENTITY_RULES.otpMinutes * 60_000, tries: 0, dead: false,
  }
  keep()
  return current
}

export const otp = (): OtpChallenge | null => current

export const resendIn = (): number =>
  current ? Math.max(0, Math.ceil((current.sentAt + ENTITY_RULES.resendSeconds * 1000 - Date.now()) / 1000)) : 0

export const expiresIn = (): number =>
  current ? Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000)) : 0

export type OtpResult = 'ok' | 'wrong' | 'expired' | 'dead' | 'none'

/** Check a code · a wrong one counts, and the last allowed wrong one kills it (2.3.pw-13) */
export const verifyOtp = (code: string): OtpResult => {
  if (!current) return 'none'
  if (current.dead) return 'dead'
  if (Date.now() > current.expiresAt) return 'expired'
  if (code === current.code) {
    current.dead = true
    keep()
    return 'ok'
  }
  current.tries += 1
  if (current.tries >= ENTITY_RULES.otpAttempts) current.dead = true
  keep()
  return current.dead ? 'dead' : 'wrong'
}

export const triesLeft = (): number => (current ? Math.max(0, ENTITY_RULES.otpAttempts - current.tries) : 0)

/** Every code and link is void once the password changes (2.3.pw-9) */
export const clearOtp = (): void => {
  current = null
  try { sessionStorage.removeItem(OTP_KEY) } catch { /* ignore */ }
}

/** Cross · notifications · every password set or changed, with the account it belongs to (2.3.pw-8) */
export const passwordEvents = (): { account: PortalAccount; at: string; created: boolean }[] => {
  const all = readPass()
  const list = accounts()
  return Object.entries(all).flatMap(([id, v]) => {
    const account = list.find((a) => a.id === id)
    return account ? [{ account, at: v.at, created: id.startsWith('n-') }] : []
  })
}
