import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { icons } from './icons'

/* The system's form field shell.

   `FormField` is one labelled field: the label row on top (with the required mark), the control
   under it. It renders a `<label>` by default so a click on the name focuses the control; a field
   holding several controls (chips, a group of toggles) renders a `div` instead, so a click on a chip
   never lands on the first control.

   `FieldBox` is the control's own frame (`.fld`): the bordered box an `<input>`, `<textarea>` or
   `<select>` sits in, at the system's control height. `area` is the multi-line variant. */

export interface FormFieldProps {
  /** The field's name · text or nodes (a hint, a note after it) */
  label: ReactNode
  /** Draws the required mark after the name */
  required?: boolean
  /** Sits in the label row after the required mark · a tag, a note */
  after?: ReactNode
  /** Spans the form's full width (`regf-w`) */
  wide?: boolean
  /** The element it renders · `label` unless the field holds several controls */
  as?: 'label' | 'div' | 'span'
  className?: string
  children?: ReactNode
  /** What's wrong with the value · the field takes the error ring and the message under it */
  error?: ReactNode
}

export function FormField({ label, required, after, wide, as: Tag = 'label', className, children, error }: FormFieldProps) {
  const cls = ['regf', wide && 'regf-w', error && 'has-err', className].filter(Boolean).join(' ')
  return (
    <Tag className={cls}>
      <span className="lb">{label}{required && <b className="regf-r" aria-label="إلزامي">*</b>}{after}</span>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </Tag>
  )
}

export function FieldBox({ area, className, children }: { area?: boolean; className?: string; children?: ReactNode }) {
  const cls = ['fld', area && 'fld-a', className].filter(Boolean).join(' ')
  return <span className={cls}>{children}</span>
}

/* Audit 26 Nov · the system's one validation message, on every input · the alert icon, then the
   reason in red, at the field's hint size · every form (sign-in, registration, the record pages,
   settings) shows a field's problem with this and nothing else */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span className="ferr" id={id} role="alert">
      <Icon name={icons.alert} size="sm" />
      <span>{children}</span>
    </span>
  )
}
