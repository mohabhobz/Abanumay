import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * حالة الفلاتر في الـURL مش في الذاكرة.
 *
 * السبب عملي: المشرف بيقعد على نفس الفلتر طول اليوم، ولازم يقدر
 * يحفظه في المفضلة أو يبعته لمدير المنح كما هو. كمان زرار الرجوع
 * بيرجّع الفلتر السابق بدل ما يخرج من الشاشة.
 */
export interface QueryParamsApi<T extends Record<string, string | undefined>> {
  values: T
  /** بيصفّر الصفحة تلقائيًا مع أي تغيير فلتر */
  set: (patch: Partial<Record<keyof T, string | undefined>>) => void
  /** بيستبدل كل الفلاتر دفعة واحدة — للّقطات المحفوظة */
  replace: (next: Partial<Record<keyof T, string | undefined>>) => void
  clear: () => void
  /** عدد الفلاتر المفعّلة، بدون البحث والترتيب والصفحة */
  activeCount: (ignore?: (keyof T)[]) => number
}

/**
 * فلتر متعدد القيم في مفتاح واحد: `region=الرياض,مكة المكرمة`.
 *
 * الفاصلة مش مصادفة: هي أقصر شكل يفضل مقروء في شريط العنوان، والـURL
 * لسه ينفع يتبعت لمدير المنح زي ما هو. وقيم النظام (مسارات ومجالات
 * ومناطق ومدن وأوسمة) مفيهاش فاصلة، فمفيش لبس. لو جه يوم وفيه قيمة
 * بفاصلة، المكان الوحيد اللي هيتغيّر هو الدالتين دول.
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

  return { values, set, replace, clear, activeCount }
}
