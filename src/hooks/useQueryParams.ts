import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Filter state lives in the URL, not in memory.
 *
 * The reason is practical: a reviewer stays on the same filter all day
 * and needs to be able to bookmark it or send it to the grants manager
 * as-is. The back button also returns to the previous filter instead of
 * leaving the screen entirely.
 */
export interface QueryParamsApi<T extends Record<string, string | undefined>> {
  values: T
  /** Automatically resets the page on any filter change. */
  set: (patch: Partial<Record<keyof T, string | undefined>>) => void
  /** Replaces all filters at once — for saved views. */
  replace: (next: Partial<Record<keyof T, string | undefined>>) => void
  clear: () => void
  /** Count of active filters, excluding search, sort, and page. */
  activeCount: (ignore?: (keyof T)[]) => number
  /**
   * The current screen as a query string, excluding the page number.
   *
   * Only the page number is excluded: to the user, a "view" is the
   * question and the shape of its answer — filters, sort, grouping, page
   * size, and display type — not where they happen to be in pagination.
   */
  snapshot: () => string
  /** Replaces the entire screen with a saved view. */
  applyQuery: (q: string) => void
}

/**
 * Multi-value filter in a single key: `region=Riyadh,Makkah`.
 *
 * The comma isn't arbitrary: it's the shortest form that stays readable
 * in the address bar, and the URL can still be sent to the grants
 * manager as-is. None of the system's values (tracks, domains, regions,
 * cities, tags) contain a comma, so there's no ambiguity. If a
 * comma-containing value ever comes along, these two functions are the
 * only place that would need to change.
 */
export const readList = (v: string | undefined): string[] =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []

export const writeList = (xs: string[]): string | undefined =>
  xs.length ? xs.join(',') : undefined

export function useQueryParams<T extends Record<string, string | undefined>>(
  keys: readonly (keyof T & string)[],
): QueryParamsApi<T> {
  const [params, setParams] = useSearchParams()

  const values = useMemo(() => {
    const out = {} as T
    for (const k of keys) out[k] = (params.get(k) ?? undefined) as T[keyof T & string]
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, keys.join('|')])

  const set = useCallback(
    (patch: Partial<Record<keyof T, string | undefined>>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const replace = useCallback(
    (next: Partial<Record<keyof T, string | undefined>>) => {
      const sp = new URLSearchParams()
      for (const [k, val] of Object.entries(next)) {
        if (val !== undefined && val !== '') sp.set(k, val)
      }
      setParams(sp, { replace: true })
    },
    [setParams],
  )

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  const activeCount = useCallback(
    (ignore: (keyof T)[] = []) =>
      keys.filter((k) => !ignore.includes(k) && params.get(k)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, keys.join('|')],
  )

  const snapshot = useCallback(() => {
    const sp = new URLSearchParams(params)
    sp.delete('page')
    /* Alphabetical order so comparing a view against a saved one is a
       simple string comparison, unaffected if the user changed two filters
       in a different order. */
    const sorted = new URLSearchParams([...sp.entries()].sort((a, b) => a[0].localeCompare(b[0])))
    return sorted.toString()
  }, [params])

  const applyQuery = useCallback(
    (q: string) => setParams(new URLSearchParams(q), { replace: true }),
    [setParams],
  )

  return { values, set, replace, clear, activeCount, snapshot, applyQuery }
}
