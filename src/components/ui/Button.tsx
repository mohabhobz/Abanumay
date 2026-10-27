import { forwardRef, type ButtonHTMLAttributes, type LabelHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

/* The system's one button element.

   Every `<button>` in the app renders through this component, so the button's classes, defaults and
   accessibility live in one place. It adds nothing to the markup by itself: the classes it writes are
   exactly the ones the call site used to write by hand.

   - An action button (`.btn`) takes its look from props: `variant` (`btn-p` primary, `btn-2`
     secondary, `btn-ghost`, `btn-d` destructive), `size` (`btn-sm`) and `full` (`btn-full`).
   - A button that is not an action button (a chip, a tab, an icon toggle, a row) passes `plain` and
     keeps its own `className` untouched.

   Two siblings share the same look for what is not a `<button>`: `ButtonLink` (a route link drawn as
   an action button) and `ButtonLabel` (a `<label>` wrapping a file input, drawn as an action button). */

export type ButtonVariant = 'p' | '2' | 'ghost' | 'd'

/** The look shared by `Button`, `ButtonLink` and `ButtonLabel` */
export interface ButtonLook {
  /** The action button's tone · omitted, the button is a bare `.btn` */
  variant?: ButtonVariant
  /** `sm` · the compact height used in rows and cards */
  size?: 'sm'
  /** Fills its container's width (`btn-full`) */
  full?: boolean
}

/** The action button's classes, in one place */
const btnClass = ({ variant, size, full }: ButtonLook, className?: string): string =>
  ['btn', variant && `btn-${variant}`, size && `btn-${size}`, full && 'btn-full', className].filter(Boolean).join(' ')

export interface ButtonProps extends ButtonLook, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Not an action button · no `btn` classes, the `className` passes through as written */
  plain?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, full, plain, className, ...rest },
  ref,
) {
  const cls = plain ? className : btnClass({ variant, size, full }, className)
  return <button ref={ref} className={cls || undefined} {...rest} />
})

/** A route link drawn as an action button */
export function ButtonLink({ variant, size, full, className, ...rest }: ButtonLook & LinkProps) {
  return <Link className={btnClass({ variant, size, full }, className)} {...rest} />
}

/** A `<label>` drawn as an action button · it wraps a file `<input>`, so the whole button opens the picker */
export function ButtonLabel({ variant, size, full, className, ...rest }: ButtonLook & LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={btnClass({ variant, size, full }, className)} {...rest} />
}
