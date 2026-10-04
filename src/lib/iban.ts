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
