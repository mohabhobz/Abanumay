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
    /* Filters removed from the code get filtered out, and new ones added after the last save don't
   appear automatically — a user who arranged a handful of filters shouldn't have a new one barge
   into their order. They'll find it in the customization panel. */
    return keys.filter((k): k is string => typeof k === 'string' && all.includes(k))
  } catch {
    return all
  }
}

export const writeFilterOrder = (table: string, keys: string[]): void => {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(keys))
  } catch {
    /* Storage may be blocked — the order then only lasts for this session. */
  }
}
