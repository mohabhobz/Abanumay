import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '@/app/routes'
import { AUTH_RULES } from '@/data/authGuard'
import { isSignedIn, signOut } from '@/data/session'

/* Ends an idle session · batch 8. A bar shows `warnSeconds` before the end with «ابقَ متصلًا»;
   any click, key or scroll restarts the count. A session ended from another tab («sign out
   everywhere») is noticed on the same tick. */

export function SessionGuard() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const last = useRef(Date.now())
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const touch = () => { last.current = Date.now(); setLeft(null) }
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    /* Only a page opened inside a session guards it · the public pages (the consultant's link) have none */
    const had = isSignedIn()
    const tick = window.setInterval(() => {
      if (!had) return
      if (!isSignedIn()) { navigate(ROUTES.login, { replace: true, state: { from: pathname } }); return }
      const idle = (Date.now() - last.current) / 1000
      const rest = AUTH_RULES.idleMinutes * 60 - idle
      if (rest <= 0) { signOut(); navigate(ROUTES.login, { replace: true, state: { expired: true, from: pathname } }); return }
      setLeft(rest <= AUTH_RULES.warnSeconds ? Math.ceil(rest) : null)
    }, 1000)
    return () => { evs.forEach((e) => window.removeEventListener(e, touch)); window.clearInterval(tick) }
  }, [navigate, pathname])

  if (left === null) return null
  return (
    <div className="sessbar" role="alert">
      <span>ستنتهي جلستك لعدم النشاط خلال <b className="num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b></span>
      <button type="button" className="btn btn-p btn-sm" onClick={() => { last.current = Date.now(); setLeft(null) }}>ابقَ متصلًا</button>
    </div>
  )
}
