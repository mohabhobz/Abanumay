import { nf } from '@/lib/format'
import { Riyal } from './primitives'

/**
 * Money field · **one single version**.
 * Warning: there used to be three amount fields: one showing "513000" with no separators and the
 * currency **outside** the field (disbursement request), one showing "240000" next to "400,000"
 * below it (closing report), and the correct one in new project (thousands separators plus currency
 * inside). The value is stored as digits only and displayed via `nf`, with the currency shown
 * inside the field.
 */
export function MoneyField({
  value, onChange, label, disabled, placeholder = '0',
}: {
  value: string | number
  onChange: (digits: string) => void
  label: string
  disabled?: boolean
  placeholder?: string
}) {
  const n = Number(String(value).replace(/\D/g, ''))
  return (
    <span className="fld">
      <input
        className="num"
        inputMode="numeric"
        value={value === '' || !Number.isFinite(n) ? '' : nf.format(n)}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        aria-label={label}
      />
      <Riyal />
    </span>
  )
}
