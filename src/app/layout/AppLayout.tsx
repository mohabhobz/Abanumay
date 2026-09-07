import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Background, MobileTop, Rail, AssistantPanel } from '@/components/shell'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ROUTES } from '@/app/routes'
import { fixtures } from '@/data/repository'
import type { AssistantContext } from '@/components/assistant'

export interface AppLayoutProps {
  children: ReactNode
  /** سياق لوح المساعد للصفحة الحالية */
  assistantContext?: AssistantContext
}

/**
 * قشرة كل الصفحات الداخلية: الخلفية والتنقّل ولوح المساعد.
 *
 * لوح المساعد هنا مش في كل صفحة على حدة، عشان يفضل مفتوح وأنت
 * بتتنقّل، ويتفتح من أي مكان بـ⌘K.
 */
export function AppLayout({ children, assistantContext }: AppLayoutProps) {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const user = fixtures.currentUser

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
        {mobile && <MobileTop user={user} />}

        <div className="shell">
          <Rail
            user={user}
            onAssistant={toggleAssistant}
            assistantOpen={assistantOpen}
            onSignOut={() => navigate(ROUTES.login)}
          />

          {children}

          <AssistantPanel
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            onFull={() => navigate(ROUTES.assistant)}
            ctx={assistantContext}
          />
        </div>
      </div>
    </>
  )
}
