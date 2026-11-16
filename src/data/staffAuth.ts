/* Client 14 Nov · staff passwords · client 16 Nov · no password is handed over.

   The system admin adds an account with the person's details only (Permissions → «إضافة مستخدم»);
   the system emails an invitation to the work email, and the link opens «عيّن كلمة مرورك», where
   the person picks their own password · until then the account is «بانتظار التفعيل» and doesn't
   sign in. A forgotten password goes the same way: the admin sends a reset link, the person sets a
   new one. Their own password is changed later from their profile (الحساب → الدخول والأمان).

   There is no mail server in the prototype, so the link the email would carry is shown on screen
   (the same way the entity's one-time codes are) · everything else runs as it would: the link is
   single-use, lasts 48 hours, and a newer one replaces an older one.

   The demo accounts have no password kept, so they sign in with any password, as the demo always
   has · once one of them sets a password from the profile, it is checked.

   Kept in the browser for the prototype · in production the server keeps a hash. Keyed by the
   sign-in (the email's local part). */

const KEY = 'ab-staff-pass'
const INV = 'ab-staff-invite'
interface Rec { pass: string; at: string }
export interface Invite { token: string; login: string; email: string; name: string; at: number; kind: 'invite' | 'reset' }

const readJ = <T,>(k: string): T => { try { return JSON.parse(localStorage.getItem(k) ?? '{}') as T } catch { return {} as T } }
const writeJ = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const key = (login: string) => login.trim().toLowerCase().split('@')[0]
const day = () => new Date().toISOString().slice(0, 10)

/** How long a link lasts */
export const INVITE_HOURS = 48

/** The rules a staff member's own password meets · checked as they type */
export const STAFF_PASS_RULES: { key: string; label: string; test: (pw: string, other: string) => boolean }[] = [
  { key: 'len', label: '12 حرفًا على الأقل', test: (pw) => pw.length >= 12 },
  { key: 'mix', label: 'حروف وأرقام معًا', test: (pw) => /\p{L}/u.test(pw) && /\d/.test(pw) },
  { key: 'new', label: 'تختلف عن كلمة المرور الحالية', test: (pw, other) => pw.length > 0 && pw !== other },
]

export const setOwnPassword = (login: string, pass: string): void => {
  const v = readJ<Record<string, Rec>>(KEY); v[key(login)] = { pass, at: day() }; writeJ(KEY, v)
}

/** null · no password kept for this account · a demo account opens with any password */
export const staffPasswordOk = (login: string, pass: string): boolean | null => {
  const r = readJ<Record<string, Rec>>(KEY)[key(login)]
  return r ? r.pass === pass : null
}
export const hasStaffPassword = (login: string): boolean => Boolean(readJ<Record<string, Rec>>(KEY)[key(login)])
export const staffPasswordAt = (login: string): string | undefined => readJ<Record<string, Rec>>(KEY)[key(login)]?.at

/** A new link for this person · replaces any earlier one of theirs */
export const sendInvite = (email: string, name: string, kind: Invite['kind']): Invite => {
  const all = readJ<Record<string, Invite>>(INV)
  for (const t of Object.keys(all)) if (all[t].login === key(email)) delete all[t]
  const token = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('')
  const inv: Invite = { token, login: key(email), email: email.toLowerCase(), name, at: Date.now(), kind }
  all[token] = inv
  writeJ(INV, all)
  return inv
}

export type InviteState = 'ok' | 'expired' | 'none'
export const inviteOf = (token: string): { inv?: Invite; state: InviteState } => {
  const inv = readJ<Record<string, Invite>>(INV)[token]
  if (!inv) return { state: 'none' }
  if (Date.now() - inv.at > INVITE_HOURS * 3600e3) return { inv, state: 'expired' }
  return { inv, state: 'ok' }
}

/** The person's own password, set from the link · the link is spent */
export const redeemInvite = (token: string, pass: string): Invite | undefined => {
  const all = readJ<Record<string, Invite>>(INV)
  const inv = all[token]
  if (!inv) return undefined
  setOwnPassword(inv.login, pass)
  delete all[token]
  writeJ(INV, all)
  return inv
}

/** The newest link still open for this person, if any */
export const openInviteOf = (login: string): Invite | undefined =>
  Object.values(readJ<Record<string, Invite>>(INV)).filter((i) => i.login === key(login)).sort((a, b) => b.at - a.at)[0]
