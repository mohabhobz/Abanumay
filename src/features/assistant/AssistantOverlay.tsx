import { useEffect, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { Background } from '@/components/shell'
import type { AssistantContext } from '@/components/assistant'
import { roles, type AssistantRole } from '@/data/mock/assistant'
import { AssistantScreen } from './AssistantScreen'

const FALLBACK_CONTEXT: AssistantContext = {
  title: 'منح أبانمي',
  sub: '',
  scope: 'كيف أساعدك في النظام؟',
  cards: [
    {
      icon: 'alert',
      title: 'ما الذي بانتظار قراري؟',
      sub: 'ما ينتظرني أنا لا غيري',
      prompt: 'ما الأمور التي بانتظار قراري؟',
    },
  ],
}

export interface AssistantOverlayProps {
  open: boolean
  onClose: () => void
  /** Page welcome and its cards - the only part that changes from page to page. */
  ctx?: AssistantContext
}

/**
 * The Abanumay assistant, layered over whichever page you're on.
 *
 * Same screen, not a different one.
 *
 * This used to be a side panel with its own header and no chat list, so a user who clicked "Ask
 * Abanumay" from a project page landed in a different assistant: no saved conversations, and a
 * layout unlike the one first seen on login. Now it opens the same `AssistantScreen` that lives at
 * `/assistant` - same list, same header, same welcome, same cards.
 *
 * The only thing that changes is the content: the scope line ("How can I help with <project
 * name>?") and the four cards. The personal welcome is constant across pages, and the layout never
 * changes at all.
 *
 * It opens full, and the button shrinks it.
 *
 * Opening starts at full size (a question needs room), and the button shrinks it to a side panel
 * when the user wants to see the page while asking. So the button resizes rather than navigates,
 * and both states are the same conversation in the same component. Shrinking only hides the list -
 * it isn't a third layout.
 *
 * Every new opening starts full, and the previous size resets completely (`key={runs}`): shrinking
 * last time had a reason specific to that moment, and the question asked then was about a different
 * page.
 */
export function AssistantOverlay({ open, onClose, ctx = FALLBACK_CONTEXT }: AssistantOverlayProps) {
  /* Note: opens as a centered dialog now. It used to open full and the button shrank it to a side
     drawer; testing showed a preference for the centered dialog. So the dialog is now the default,
     and the button expands it to the full screen. The side drawer was removed as a state (see
     `.apanel:not(.wide)`). */
  const [wide, setWide] = useState(false)
  /* Open counter - changes on every opening so the screen rebuilds from its initial state, without
     the component needing to know it's inside a panel. */
  const [runs, setRuns] = useState(0)
  useEffect(() => {
    if (!open) return
    setWide(false)
    setRuns((n) => n + 1)
  }, [open])

  /* Note: the first opening matches the `/assistant` welcome exactly. The welcome here used to have
     its own scope line and cards in a shrunken layout (no card background, colored cards), so users
     effectively saw two different assistants. Now it's the same component with the same copy and
     the same four cards; the only difference is the dialog's width (in CSS). Page context still
     reaches screen readers through the dialog's name. */
  const role = roles[0] as AssistantRole

  return (
    <>
      {/* Backdrop dimming applies to the centered dialog only - the full-screen mode isn't a layer
          over a page, it's the screen itself with the reel still running behind it, so dimming it
          would misstate what's there. */}
      <div
        className={`ascrim${open && !wide ? ' on' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`apanel${open ? ' on' : ''}${wide ? ' wide' : ''}`}
        role="dialog"
        aria-label={`مساعد · ${ctx.title}`}
        aria-hidden={!open}
      >
        {open && wide && <Background />}
        {open && (
          <AssistantScreen
            key={runs}
            label="مساعد أبانمي"
            greet={role.greet}
            sub="كيف أساعدك اليوم؟"
            cards={role.cards}
            onClose={onClose}
            focusOnMount
            headExtra={(
              <button
                className="aclose"
                onClick={() => setWide((v) => !v)}
                title={wide ? 'صغّر إلى نافذة وسطية' : 'وسّع إلى ملء الشاشة'}
                aria-label={wide ? 'صغّر إلى نافذة وسطية' : 'وسّع إلى ملء الشاشة'}
                aria-pressed={wide}
              >
                <Icon name={wide ? icons.shrink : icons.expand} size="sm" />
              </button>
            )}
          />
        )}
      </aside>
    </>
  )
}
