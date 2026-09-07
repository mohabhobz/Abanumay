import { useEffect, useState } from 'react'

/** بيرجّع true لو الاستعلام منطبق، وبيتابع التغيير */
export function useMediaQuery(query: string): boolean {
  const [hit, setHit] = useState(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setHit(e.matches)
    setHit(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return hit
}

export const useIsMobile = () => useMediaQuery('(max-width: 860px)')
