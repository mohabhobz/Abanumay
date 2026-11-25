/* Visible filters and their order.

   The intent: the data returns dozens of possible filter types, but a user wants to pick a handful
   and arrange them the way that suits them.

   What's stored is **the visible list, in order**; everything else stays hidden. This one shape
   solves both needs at once: order is the list's order, and hiding is simply absence from it.

   Storage is local, like columns, and for the same reason: this is the shape of your own screen,
   and a link you send a colleague carries the question, not your screen's layout. */

const KEY = (table: string) => `ab-filters-${table}`

export const readFilterOrder = (table: string, all: string[]): string[] => {
  try {
    const raw = localStorage.getItem(KEY(table))
    if (!raw) return all
    const keys = JSON.parse(raw) as unknown
    if (!Array.isArray(keys)) return all
    /* Filters removed from the code get filtered out · client 25 Nov · a filter added to the system
       after the last save shows too (at its default place, after the saved ones) · it used to stay
       hidden until found in the customization panel, so a new filter looked like it was never added.
       What the user hid on purpose stays hidden: the filters known at the save are kept beside it. */
    const kept = keys.filter((k): k is string => typeof k === 'string' && all.includes(k))
    const knownRaw = localStorage.getItem(`${KEY(table)}-known`)
    const known: string[] = knownRaw ? JSON.parse(knownRaw) : KNOWN_BEFORE[table] ?? []
    const added = all.filter((k) => !kept.includes(k) && !known.includes(k))
    return [...kept, ...added]
  } catch {
    return all
  }
}

/* The filters each list had before «known» was kept (25 Nov) · a save older than that knew these */
const KNOWN_BEFORE: Record<string, string[]> = {
  projects: ['year', 'stage', 'track', 'field', 'goal', 'region', 'city', 'tag', 'method', 'support', 'owner'],
  entities: ['type', 'licensor', 'region', 'city', 'governance', 'registered'],
}

export const writeFilterOrder = (table: string, keys: string[], all?: string[]): void => {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(keys))
    if (all) localStorage.setItem(`${KEY(table)}-known`, JSON.stringify(all))
  } catch {
    /* Storage may be blocked — the order then only lasts for this session. */
  }
}
