import { useEffect, useRef } from 'react'

/* Grouping used to reset when navigating away and back — the original
   intent was for it to persist with the session.

   Why `sessionStorage`, not `localStorage`? Grouping is a question, not
   a display preference. Someone grouping by region today is asking
   about today's regions — if the screen stayed grouped a week later,
   they'd open projects and find a collapsed table they never asked for
   and don't remember why. The session is the right boundary: it
   persists as long as they're working on the same question, and the
   question is forgotten when they close it.

   "Clear grouping" needs to be saved just like grouping itself. If
   clearing left storage untouched, navigating away and back would
   restore the grouping the user had just cleared by hand — so clearing
   is stored as an explicit empty value, and the difference between
   "empty" and "not stored" is the difference between "I cleared it" and
   "I never opened the screen."

   Restoring also happens once, on entry. Restoring on every render
   would fight the user: they clear it, and the hook restores it. */
const keyOf = (table: string) => `ab-group-${table}`

export function useStickyGroup(
  table: string,
  value: string | undefined,
  apply: (v: string | undefined) => void,
): void {
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    /* The URL wins over storage: someone arriving via a link with grouping
       in it wants exactly that grouping, and someone sending that link to a
       colleague is sending their own question, not the colleague's saved one. */
    if (value !== undefined) return
    try {
      const saved = sessionStorage.getItem(keyOf(table))
      if (saved) apply(saved)
    } catch {
      /* Storage is unavailable — the screen simply opens with no grouping. */
    }
  }, [table, value, apply])

  useEffect(() => {
    if (!done.current) return
    try {
      sessionStorage.setItem(keyOf(table), value ?? '')
    } catch {
      /* Storage is unavailable — grouping stays for this page only. */
    }
  }, [table, value])
}
