/* Client 14 Nov · staff passwords.

   A staff account the system admin adds starts with a temporary password she sets (Permissions →
   «إضافة مستخدم»), and she can set a new temporary one later (Edit details → reset). A temporary
   password opens one screen only: «عيّن كلمة مرورك», where the person picks their own, and only then
   the system. Their own password is changed later from their profile (الحساب → الأمان).

   The demo accounts have no password in this store, so they keep signing in with any password, as
   the demo always has · once one of them sets a password from the profile, it is checked.

   Kept in the browser for the prototype · in production the server keeps a hash. Keyed by the
   sign-in (the email's local part). */

const KEY = 'ab-staff-pass'
interface Rec { pass: string; at: string; temp: boolean }
const read = (): Record<string, Rec> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }
const write = (v: Record<string, Rec>) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked */ } }
const k = (login: string) => login.trim().toLowerCase().split('@')[0]
const day = () => new Date().toISOString().slice(0, 10)

/** The rules a staff member's own password meets · checked as they type */
export const STAFF_PASS_RULES: { key: string; label: string; test: (pw: string, other: string) => boolean }[] = [
  { key: 'len', label: '12 حرفًا على الأقل', test: (pw) => pw.length >= 12 },
  { key: 'mix', label: 'حروف وأرقام معًا', test: (pw) => /\p{L}/u.test(pw) && /\d/.test(pw) },
  { key: 'new', label: 'تختلف عن كلمة المرور الحالية', test: (pw, other) => pw.length > 0 && pw !== other },
]

/** A temporary one the admin sets · shorter is fine, it lives until the first sign-in */
export const tempIssues = (pw: string): string[] => {
  const out: string[] = []
  if (pw.length < 8) out.push('8 أحرف على الأقل')
  if (!(/\p{L}/u.test(pw) && /\d/.test(pw))) out.push('حروف وأرقام معًا')
  return out
}

/** A readable temporary password · no look-alike letters */
export const makeTemp = (): string => {
  const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789'
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  return `${pick(U)}${pick(L)}${pick(L)}${pick(L)}-${pick(D)}${pick(D)}${pick(D)}${pick(D)}-${pick(L)}${pick(U)}`
}

export const setTempPassword = (login: string, pass: string): void => { const v = read(); v[k(login)] = { pass, at: day(), temp: true }; write(v) }
export const setOwnPassword = (login: string, pass: string): void => { const v = read(); v[k(login)] = { pass, at: day(), temp: false }; write(v) }

/** null · no password kept for this account (a demo account) · any password opens it */
export const staffPasswordOk = (login: string, pass: string): boolean | null => {
  const r = read()[k(login)]
  return r ? r.pass === pass : null
}
export const mustChangePassword = (login: string): boolean => Boolean(read()[k(login)]?.temp)
export const hasStaffPassword = (login: string): boolean => Boolean(read()[k(login)])
export const staffPasswordAt = (login: string): string | undefined => read()[k(login)]?.at
