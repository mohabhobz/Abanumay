/** IBAN check digits (ISO 13616 · mod 97) · the shape SA + 22 digits is not enough (2.4.6) */
export const ibanValid = (raw: string): boolean => {
  const iban = raw.replace(/\s/g, '').toUpperCase()
  if (!/^SA\d{22}$/.test(iban)) return false
  const moved = iban.slice(4) + iban.slice(0, 4)
  const num = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of num) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

/** A valid sample · SA03 8000 0000 6080 1016 7519 passes the check, for placeholders and tests */
export const IBAN_SAMPLE = 'SA03 8000 0000 6080 1016 7519'

/* Client 27 Oct · demo accounts read as real ones · a fictional but well-formed Saudi IBAN (the
   bank's two-digit code, an 18-digit account, the mod-97 check digits), stable per seed, so the
   cards and tables show a full number instead of an X-masked one */
const BANK_CODES: Record<string, string> = {
  'مصرف الراجحي': '80', 'البنك الأهلي السعودي': '10', 'بنك الرياض': '20', 'البنك السعودي الفرنسي': '55',
  'البنك السعودي البريطاني': '45', 'البنك العربي الوطني': '30', 'بنك البلاد': '15', 'بنك الجزيرة': '60',
  'مصرف الإنماء': '05', 'البنك السعودي للاستثمار': '65',
}
const mod97 = (num: string) => { let r = 0; for (const ch of num) r = (r * 10 + Number(ch)) % 97; return r }
export function demoIban(seed: string, bank = ''): string {
  let h = 2166136261
  for (const ch of `${seed}|${bank}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  let acct = ''
  let x = h || 1
  while (acct.length < 18) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; acct += String(x % 10) }
  const bban = (BANK_CODES[bank] ?? String(10 + (h % 80)).padStart(2, '0')) + acct
  /* SA = 28 10 · check digits make the whole number ≡ 1 (mod 97) */
  const check = String(98 - mod97(`${bban}281000`)).padStart(2, '0')
  return `SA${check}${bban}`.replace(/(.{4})/g, '$1 ').trim()
}
