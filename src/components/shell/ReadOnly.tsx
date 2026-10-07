import type { ReactNode } from 'react'

/* A read-only preview · re-audit 7 Oct. Staff read an entity's portal or update form as the entity
   sees it, and act on nothing: a disabled fieldset turns every control inside it off at once, and
   draws nothing of its own (`display: contents`), so the layout's own selectors still see their
   children. Off, it renders the children as they are. */
export function ReadOnly({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <fieldset className="xs-ro" disabled>{children}</fieldset> : <>{children}</>
}
