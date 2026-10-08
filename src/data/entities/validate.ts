import { entityRows } from '@/data/mock/entities'
import { regRows, type RegBank } from '@/data/mock/registration'
import { ENTITY_RULES } from './rules'
import { banksOf } from '@/data/mock/payEntity'

/* Format and uniqueness checks for an entity's data · registration and update requests share them
   (2.2.4 · 2.4.6 · 2.4.7 · 2.4.10 · 2.3.upd-4).

   Each check answers in one sentence naming the field, the way the form shows it under the field:
   a list of rules after the click makes the user search for what went wrong. */

/** Digits only · what a numeric field keeps from what was typed or pasted (2.4.7) */
export const digitsOnly = (s: string): string => s.replace(/[^\d]/g, '')

/** Saudi mobile · 05XXXXXXXX or 9665XXXXXXXX */
export const isMobile = (s: string): boolean => /^(05\d{8}|9665\d{8})$/.test(digitsOnly(s))
/** Landline · 01X… or 9661X… (8–9 digits after the area code) */
export const isPhone = (s: string): boolean => /^(0\d{8,9}|966\d{8,9})$/.test(digitsOnly(s))
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())
export const isUrl = (s: string): boolean => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim())
export const isLicense = (s: string): boolean => /^\d{5,12}$/.test(s.trim())

export { ibanValid } from '@/lib/iban'

/** A field's format problem, or '' · `kind` follows the registration form's field kinds */
export const formatIssue = (key: string, kind: string, value: string): string => {
  const v = value.trim()
  if (!v) return ''
  if (kind === 'tel') {
    if (/[^\d\s+]/.test(v)) return 'أرقام فقط · بلا حروف أو رموز.'
    const mobileKey = /mobile/i.test(key)
    if (mobileKey ? !isMobile(v) : !isPhone(v)) {
      return mobileKey ? 'جوال سعودي يبدأ بـ05 ويليه 8 أرقام، أو 9665 ويليه 8 أرقام.' : 'هاتف يبدأ برمز المنطقة، مثل 0112345678.'
    }
  }
  if (kind === 'email' && !isEmail(v)) return 'بريد إلكتروني صحيح، مثل name@org.sa.'
  if ((kind === 'url' || key === 'website') && !isUrl(v)) return 'عنوان موقع صحيح، مثل www.org.sa.'
  if ((kind === 'digits' || key === 'licenseNo') && !isLicense(v)) return 'أرقام فقط · من 5 إلى 12 رقمًا.'
  return ''
}

/** A value fixtures hide on purpose (9665XXXXXXXX, SA00 0000…) never counts as a duplicate */
const masked = (s: string) => /X/.test(s) || /^SA0+$/i.test(s.replace(/\s/g, ''))
const norm = (s: string) => s.replace(/[\sـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase()

export interface Dup { field: string; label: string; who: string }

/**
 * Same name, email, mobile or IBAN as an entity or a live request (2.4.10) · the license number has
 * its own rule (2.4.8 · 2.4.9) and is checked by `licenseClash`.
 */
export const duplicates = (
  v: { name?: string; email?: string; mobile?: string; clerkEmail?: string },
  banks: Pick<RegBank, 'iban'>[] = [],
  opts: { exceptReq?: string; exceptEntity?: string } = {},
): Dup[] => {
  const out: Dup[] = []
  const ents = entityRows.filter((e) => e.id !== opts.exceptEntity && !e.archived)
  const reqs = regRows.filter((r) => r.id !== opts.exceptReq && r.state !== 'rejected' && !(r.entityId && r.entityId === opts.exceptEntity))
  const hit = (field: string, label: string, val: string | undefined, pick: (x: { name: string; email: string; mobile: string; clerkEmail?: string }) => string) => {
    if (!val?.trim() || masked(val)) return
    const n = norm(val)
    const e = ents.find((x) => !masked(pick(x)) && norm(pick(x)) === n)
    if (e) { out.push({ field, label, who: e.name }); return }
    const r = reqs.find((x) => !masked(pick(x)) && norm(pick(x)) === n)
    if (r) out.push({ field, label, who: `${r.name} · طلب ${r.id}` })
  }
  hit('name', 'اسم الجهة', v.name, (x) => x.name)
  hit('email', 'البريد الإلكتروني', v.email, (x) => x.email)
  hit('mobile', 'جوال الجهة', v.mobile, (x) => x.mobile)
  hit('clerkEmail', 'بريد مدخل البيانات', v.clerkEmail, (x) => x.clerkEmail ?? '')
  for (const b of banks) {
    const iban = b.iban.replace(/\s/g, '').toUpperCase()
    if (!iban || masked(iban)) continue
    /* Re-audit 7 Oct · the accounts of existing entities too, not only other requests */
    const e = ents.find((x) => banksOf(x.id).some((y) => !masked(y.iban) && y.iban.replace(/\s/g, '').toUpperCase() === iban))
    if (e) { out.push({ field: 'iban', label: `الآيبان ${b.iban}`, who: e.name }); continue }
    const r = reqs.find((x) => x.banks.some((y) => y.iban.replace(/\s/g, '').toUpperCase() === iban))
    if (r) out.push({ field: 'iban', label: `الآيبان ${b.iban}`, who: `${r.name} · طلب ${r.id}` })
  }
  return out
}

/* ── Documents · validity and legibility (2.4.5) ── */

export interface PickedFile { name: string; size: number; type?: string }

const OK_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif']

/** A file the form refuses outright · wrong type or over the size limit */
export const fileRefusal = (f: PickedFile, maxMb: number): string => {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!OK_EXT.includes(ext)) return `الامتداد .${ext} غير مقبول · PDF أو JPG أو PNG.`
  if (f.size > maxMb * 1024 * 1024) return `الملف أكبر من ${maxMb} م.ب.`
  return ''
}

/**
 * A scan small enough to be unreadable · a warning, not a refusal: a photographed license under
 * 60 KB is usually too compressed to read, and the reviewer is told to check it rather than the
 * entity being stopped on a guess.
 */
export const legibilityWarning = (f: PickedFile): string => {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'gif'].includes(ext) && f.size > 0 && f.size < 60 * 1024
    ? 'صورة صغيرة الحجم · قد لا تكون واضحة للمراجع.'
    : ''
}

/** The registration documents that carry an expiry, and the field holding it */
export const DOC_EXPIRY: Record<string, { field: string; label: string }> = {
  license: { field: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص' },
  board: { field: 'boardEndsAt', label: 'تاريخ انتهاء تكليف أعضاء المجلس' },
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10)

/** An uploaded document that is already out of date on the day it is sent */
export const expiredDocs = (values: Record<string, string>, uploaded: Iterable<string>): string[] => {
  const today = todayIso()
  const out: string[] = []
  for (const k of uploaded) {
    const x = DOC_EXPIRY[k]
    const at = x ? values[x.field] : ''
    if (x && at && at < today) out.push(k)
  }
  return out
}

/* ── Passwords (2.3.pw-8) ── */

export const passwordIssues = (pass: string, user = ''): string[] => {
  const out: string[] = []
  if (pass.length < ENTITY_RULES.passMin) out.push(`${ENTITY_RULES.passMin} أحرف على الأقل`)
  if (ENTITY_RULES.passNeedsLetter && !/[A-Za-z؀-ۿ]/.test(pass)) out.push('حرف واحد على الأقل')
  if (ENTITY_RULES.passNeedsDigit && !/\d/.test(pass)) out.push('رقم واحد على الأقل')
  if (user && pass && pass.toLowerCase().includes(user.toLowerCase().split('@')[0])) out.push('لا تتضمّن اسم المستخدم')
  return out
}
