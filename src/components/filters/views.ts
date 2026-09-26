/* Saved views.

   The intent: filters get saved as a named group, and picking it later applies all of them at once.

   A view saves the whole screen state, not the page number: filters, sort, grouping, row count, and
   view type. Because "Riyadh city projects," saved while grouped by region, deserves to come back
   grouped — a view is the question and the shape of its answer, not just the filters.

   ⚠️ Storage is local in this mock. The right home for views is per-user, on the server, so they
   travel with the user across devices and can be shared with a team — noted as a backend item. */

export interface SavedView {
  id: string
  name: string
  /** Query string with no leading `?` and no page number. */
  query: string
}

const KEY = (table: string) => `ab-views-${table}`
/** A limit that keeps the list from becoming another list that needs its own search. */
const MAX = 20

export const readViews = (table: string): SavedView[] => {
  try {
    const raw = localStorage.getItem(KEY(table))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (v): v is SavedView =>
        typeof v === 'object' && v !== null &&
        typeof (v as SavedView).id === 'string' &&
        typeof (v as SavedView).name === 'string' &&
        typeof (v as SavedView).query === 'string',
    )
  } catch {
    return []
  }
}

const write = (table: string, list: SavedView[]): SavedView[] => {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* Storage may be blocked — views then only last for this session. */
  }
  return list
}

/** Writes the list and returns it — the caller uses it directly as state. */
export const writeViews = (table: string, list: SavedView[]): SavedView[] => write(table, list)
