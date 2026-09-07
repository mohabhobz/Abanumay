import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Background, MobileTop, Rail, AssistantPanel } from '@/components/shell'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import type { AssistantContext } from '@/components/assistant'

export interface AppLayoutProps {
  children: ReactNode
  /** سياق لوح المساعد للصفحة الحالية */
  assistantContext?: AssistantContext
  /**
   * يفتح لوح المساعد لوحده أول مرة في الجلسة.
   * مرة واحدة بس — لو فضل يفتح مع كل تنقّل يبقى إزعاج لا ترحيب،
   * والمستخدم اللي قفله عايز يشتغل.
   */
  autoAssistant?: boolean
}

/**
 * قشرة كل الصفحات الداخلية: الخلفية والتنقّل ولوح المساعد.
 *
 * لوح المساعد هنا مش في كل صفحة على حدة، عشان يفضل مفتوح وأنت
 * بتتنقّل، ويتفتح من أي مكان بـ⌘K.
 */
const AUTO_KEY = 'abanumay.assistant.greeted'

export function AppLayout({ children, assistantContext, autoAssistant }: AppLayoutProps) {
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { user } = useRole()

  const toggleAssistant = useCallback(() => setAssistantOpen((v) => !v), [])

  /* الترحيب بيتأخّر لحظة عشان الصفحة تكون رسمت الأول — اللوح
     بيدخل فوق محتوى ظاهر، مش فوق شاشة فاضية. */
  useEffect(() => {
    if (!autoAssistant) return
    let greeted = false
    try { greeted = sessionStorage.getItem(AUTO_KEY) === '1' } catch { greeted = false }
    if (greeted) return
    const id = setTimeout(() => {
      setAssistantOpen(true)
      try { sessionStorage.setItem(AUTO_KEY, '1') } catch { /* وضع خاص */ }
    }, 620)
    return () => clearTimeout(id)
  }, [autoAssistant])

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
