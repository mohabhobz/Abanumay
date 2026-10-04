import type { ReactNode } from 'react'
import { FieldSelect } from '@/components/ui'
import { citiesOf, type RegField } from '@/data/mock/registration'

/**
 * A single field.
 *
 * Closed values use `select`, everything else `input` - bank names specifically are closed per rule
 * 27, so a name doesn't get written ten different ways and become impossible to sort. The tooltips
 * written here are carried over from the live system verbatim.
 */
/** What a numeric field keeps from a keystroke or a paste (2.4.7) · no letters, no spaces */
const keep = (kind: string, x: string): string =>
  kind === 'tel' ? x.replace(/[^\d+]/g, '') : kind === 'digits' ? x.replace(/\D/g, '') : x

export function Field({
  f, value, parent, onChange, error, tag, disabled,
}: {
  f: RegField
  value: string
  parent: string
  onChange: (x: string) => void
  /** The field's format problem · shown in place of the hint (2.2.4) */
  error?: string
  /** A badge beside the label · «يتطلب اعتمادًا» on an update request */
  tag?: ReactNode
  disabled?: boolean
}) {
  const options = f.dependsOn ? citiesOf(parent) : f.options ?? []
  const locked = Boolean(f.dependsOn) && !parent

  return (
    <label className={`regf${f.wide ? ' regf-w' : ''}${f.nl ? ' regf-nl' : ''}`}>
      <span className="lb">
        {f.label}
        {f.req && <b className="regf-r" aria-label="إلزامي">*</b>}
        {tag}
      </span>
      {/* Note: `.fld` isn't a cosmetic class - it's the system's actual control for fields,
          registered in `ctlaudit` so its focus ring gets checked alongside search and filters. A
          field written specifically for this screen would have been a sixth corner case of the same
          thing, with a different focus ring. */}
      {f.kind === 'select' ? (
        /* Note: `FieldSelect` draws `.fld` itself, so it isn't wrapped in `<span className="fld">`
           too, or it becomes a field inside a field: two borders and two backgrounds stacked, at
           double the height. */
        <FieldSelect
          value={value}
          options={options}
          disabled={locked || disabled}
          onChange={onChange}
          label={f.label}
          placeholder={locked ? 'اختر المنطقة أولًا' : 'اختر'}
        />
      ) : (
        <span className="fld">
          {/* Note: `type="password"` isn't decoration, it's behavior. This field takes a password,
              and the browser needs to know that to mask the characters, suggest a strong one, and
              avoid saving it in ordinary autofill - `text` would have shown exactly what the user
              types on a screen that might be shared in a meeting. */}
          {/* Note: `id` isn't decorative - the "edit" button in the verification dialog returns to
              this field and focuses it (per the client's own screens), which is impossible without
              an address to reach it. */}
          <input
            id={`rf-${f.key}`}
            type={
              f.kind === 'date' ? 'date'
                : f.kind === 'number' ? 'number'
                  : f.kind === 'password' ? 'password'
                    : f.kind === 'email' ? 'email' : 'text'
            }
            autoComplete={f.kind === 'password' ? 'new-password' : undefined}
            inputMode={f.kind === 'tel' || f.kind === 'number' || f.kind === 'digits' ? 'numeric' : f.kind === 'url' ? 'url' : undefined}
            dir={f.kind === 'tel' || f.kind === 'digits' || f.kind === 'url' || f.kind === 'email' ? 'ltr' : undefined}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(keep(f.kind, e.target.value))}
            aria-label={f.label}
            aria-invalid={error ? true : undefined}
          />
        </span>
      )}
      {error
        ? <span className="bad regf-h">{error}</span>
        : f.hint && <span className="sub regf-h">{f.hint}</span>}
    </label>
  )
}
