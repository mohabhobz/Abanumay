import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AskDock, Background, MobileTop, Rail } from '@/components/shell'
import { AssistantOverlay } from '@/features/assistant/AssistantOverlay'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { signOut } from '@/data/session'
import type { AssistantContext } from '@/components/assistant'

export interface AppLayoutProps {
  children: ReactNode
  /** كونتنت المساعد للصفحة الحالية · سطر المدى والكروت */
  assistantContext?: AssistantContext
}

/**
 * قشرة كل الصفحات الداخلية: الخلفية والتنقّل ولوح المساعد.
 *
 * لوح المساعد هنا مش في كل صفحة على حدة، عشان يفضل مفتوح وأنت
 * بتتنقّل، ويتفتح من أي مكان بـ⌘K.
 *
 * ما بيفتحش لوحده في أي صفحة: المستخدم بيقع على شاشة المساعد
 * الكاملة بعد الدخول، فالترحيب بيحصل هناك مرة واحدة · ولوح
 * جانبي بيفتح لوحده فوق كده يبقى إزعاج لا ترحيب.
 */
export function AppLayout({ children, assistantContext }: AppLayoutProps) {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { user } = useRole()

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
        {mobile && <MobileTop user={user} onSignOut={() => { signOut(); navigate(ROUTES.login, { replace: true }) }} />}

        <div className="shell">
          <Rail
            user={user}
            onSignOut={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}
            shut={assistantOpen}
          />

          {children}

          <AssistantOverlay
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            ctx={assistantContext}
          />

          {/* ثابت في كل شاشة، ومكانه جنب شريط القرار لا في شريط
              التنقّل · السؤال بيتسأل عند القرار. */}
          <AskDock open={assistantOpen} onToggle={toggleAssistant} compact={mobile} />
        </div>
      </div>
    </>
  )
}
