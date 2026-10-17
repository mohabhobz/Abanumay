import type { KeyboardEvent, MouseEvent } from 'react'

/**
 * A table row that opens **its own record**.
 * 17 Oct · client: "any click on any row takes me to its own thing" — the whole row is the
 * target, not just the name. A control inside the row (checkbox, button, a link to the row's
 * own id) keeps its own click and the row doesn't fire twice.
 * ⚠️ Links to *other* records (the project, the entity) don't belong in the row: they steal the
 * click to something that is only part of it. They live on the record's own page instead.
 * The plain DataTable uses the same rule through `onOpen`.
 */
export function rowGo(go: (to: string) => void, to: string | undefined, extra?: string) {
  if (!to) return { className: extra }
  return {
    className: `clickable${extra ? ` ${extra}` : ''}`,
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('a,button,input,label,select,textarea,summary')) return
      go(to)
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) go(to)
    },
  }
}
