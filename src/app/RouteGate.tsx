import { useEffect, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AppLayout } from '@/app/layout/AppLayout'
import { PageSkeleton, skeletonKind } from '@/components/ui/Skeleton'

/* 26 Nov · audit #60 · every internal screen opens on its outline first.

   A page reads its records while it draws, so a heavy one (closing, the board, the projects list)
   held the old page frozen, or a blank field, until it was done. The gate draws the new page's
   outline (`PageSkeleton`, inside the same shell, so the rail never blinks) and lets it paint,
   then draws the page itself in the next task.

   It keys on the page, not the address: a module's list and a record are two pages; two records of
   the same module, or a record's tabs, are the same page, so moving between them keeps what's on
   screen (open panels, typed text) and shows no outline. */
const pageKey = (path: string) => {
  const segs = path.split('/').filter(Boolean)
  const rec = segs.findIndex((s, i) => i > 0 && /\d/.test(s))
  return rec > 0 ? `/${segs.slice(0, rec).join('/')}/:id` : `/${segs.join('/')}`
}

/** Review only · `localStorage['ab-skel-hold'] = '1'` keeps every screen on its outline, to look at it */
const holdOutline = () => { try { return localStorage.getItem('ab-skel-hold') === '1' } catch { return false } }

export function RouteGate() {
  const outlet = useOutlet()
  const { pathname } = useLocation()
  const key = pageKey(pathname)
  const [ready, setReady] = useState('')

  useEffect(() => {
    if (ready === key || holdOutline()) return
    /* After the outline has been painted · a frame, then the next task */
    let t = 0
    const f = requestAnimationFrame(() => { t = window.setTimeout(() => setReady(key), 0) })
    return () => { cancelAnimationFrame(f); clearTimeout(t) }
  }, [key, ready])

  if (ready === key) return outlet
  return <AppLayout><PageSkeleton kind={skeletonKind(pathname)} /></AppLayout>
}
