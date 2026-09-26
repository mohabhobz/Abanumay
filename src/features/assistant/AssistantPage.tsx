import { useNavigate } from 'react-router-dom'
import { useQueryParams } from '@/hooks/useQueryParams'
import { Background, MobileTop, Rail } from '@/components/shell'
import { roles, type AssistantRole } from '@/data/mock/assistant'
import { fixtures } from '@/data/repository'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
import { AssistantScreen } from './AssistantScreen'

/**
 * The Abanumay assistant - the full screen, on its own route.
 *
 * This page is now a shell: background, reel, and the assistant screen. Everything that used to be
 * written here (list, header, welcome, input, cards) moved into `AssistantScreen`, because the
 * panel that opens from any page now shows the same screen - if it stayed here, it would need to be
 * rewritten there too, and any later change would need to be made twice.
 *
 * Governed by three rules from the spec:
 * 1. AI output is advisory, not binding, so any answer involving a decision is flagged in the UI.
 * 2. If AI is the only entry point, a user can get stuck in a flow with no answer, so the cards are
 * shortcuts to known outcomes, not invitations to an open-ended conversation.
 * 3. Pinning and searching conversations are core, not decoration.
 */
export default function AssistantPage() {
  const navigate = useNavigate()
  const mobile = useIsMobile()
  /* Note: collapsed state lives in the URL - a collapsed sidebar is still a state, and without this
     key the inventory would render the sidebar open every time. */
  const { values: v, set } = useQueryParams<{ list: string | undefined }>(['list'])

  const role = roles[0] as AssistantRole
  const out = () => { signOut(); navigate(ROUTES.login, { replace: true }) }

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={fixtures.currentUser} />}

        <div className="shell">
          {/* The whole assistant screen is for the conversation - the sidebar stays closed here. */}
          <Rail user={fixtures.currentUser} onSignOut={out} shut />

          <AssistantScreen
            greet={role.greet}
            /* Scope here is the whole system - this page has no prior-page context, so the question
               is open-ended. */
            sub="كيف أساعدك اليوم؟"
            cards={role.cards}
            onClose={() => navigate(-1)}
            /* Note: closed until requested. It used to open automatically as soon as the screen
               loaded, so a user arriving with a question found a third of the screen taken up by an
               old chat list before they could even type. The assistant is also the first screen
               after login, so this used to be the very first thing shown in the whole system. The
               sidebar opens via the conversations button next to the title, so the URL states the
               exception (`?list=open`), not the default. */
            listShut={v.list !== 'open'}
            onListShut={(x) => set({ list: x ? undefined : 'open' })}
            focusOnMount
          />
        </div>
      </div>
    </>
  )
}
