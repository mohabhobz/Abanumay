import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { portalOf } from '@/app/entityAccess'
import { AskDock, Background, MobileTop, Rail } from '@/components/shell'
import { AssistantOverlay } from '@/features/assistant/AssistantOverlay'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useHashScroll } from '@/hooks/useHashScroll'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { isEntitySession, sessionScope, signOut } from '@/data/session'
import type { AssistantContext } from '@/components/assistant'

export interface AppLayoutProps {
  children: ReactNode
  /** Assistant content for the current page — the range line and cards. */
  assistantContext?: AssistantContext
}

/**
 * Shell for all internal pages: background, navigation, and the assistant panel.
 * The assistant panel lives here rather than on each page individually, so it stays open while
 * navigating and can be opened from anywhere with the keyboard shortcut.
 * It never opens on its own on any page: the user lands on the full assistant screen after login,
 * so the welcome happens there once — a side panel opening by itself afterward would be an
 * interruption, not a welcome.
 */
/* The route opened first in the session — the last one learned (so the double effect in StrictMode
   doesn't clear the flag just set). */
let freshPath = ''

/**
 * Once per session. `:root[data-fresh]` is set only on the first visit to a route in a session, and
 * all the CSS motion depends on it; a second visit to the page appears static from the first frame.
 * Storage uses `sessionStorage` wrapped in try: if blocked, the motion plays every time, which is
 * preferable to it never playing.
 */
function useFreshVisit(path: string) {
  useLayoutEffect(() => {
    const K = 'ab-seen'
    let seen: string[] = []
    try { seen = JSON.parse(sessionStorage.getItem(K) ?? '[]') } catch { seen = [] }
    const fresh = path === freshPath || !seen.includes(path)
    const el = document.documentElement
    if (fresh) {
      el.setAttribute('data-fresh', '')
      freshPath = path
      if (!seen.includes(path)) {
        try { sessionStorage.setItem(K, JSON.stringify([...seen, path])) } catch { /* No storage. */ }
      }
    } else {
      el.removeAttribute('data-fresh')
    }
  }, [path])
}

export function AppLayout({ children, assistantContext }: AppLayoutProps) {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { user } = useRole()
  const entity = isEntitySession()
  const { pathname } = useLocation()
  useFreshVisit(pathname)
  useHashScroll()

  const toggleAssistant = useCallback(() => setAssistantOpen((v) => !v), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleAssistant()
      }
      if (e.key === 'Escape') setAssistantOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleAssistant])

  return (
    <>
      <Background />
      <div className="app">
        {mobile && !entity && <MobileTop user={user} />}

        <div className="shell">
          {/* Re-audit 7 Oct · an entity session reads its own records in the staff layout, without
              the staff navigation · its way out is its portal */}
          {entity ? (
            <nav className="xs-etop glass" aria-label="بوابة الجهة">
              <Link className="btn btn-2 btn-sm" to={portalOf(sessionScope())}>
                <Icon name={icons.chevronBack} size="sm" />
                بوابة {user.name}
              </Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}>
                <Icon name={icons.logout} size="sm" />
                تسجيل الخروج
              </button>
            </nav>
          ) : (
          <Rail
            user={user}
            onSignOut={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}
            shut={assistantOpen}
          />
          )}

          {children}

          <AssistantOverlay
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            ctx={assistantContext}
          />

          {/* Fixed on every screen, placed next to the decision bar rather than the navigation bar
              — the question is asked at the point of decision. */}
          {!entity && <AskDock open={assistantOpen} onToggle={toggleAssistant} compact={mobile} />}
        </div>
      </div>
    </>
  )
}
