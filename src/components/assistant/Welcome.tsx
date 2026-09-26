import { useRef, type CSSProperties, type ReactNode } from 'react'
import { Icon, icons, type IconName } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { AbLeaf } from '@/components/soul'

export interface WelcomeCard {
  /** Icon name in `icons`. */
  icon: IconName
  title: string
  /** Line under the title: the result of the shortcut, not a restatement of it. */
  sub: string
  prompt: string
}

export interface WelcomeProps {
  /** Personalized welcome — greets the user by name. */
  greet: string
  /** The line that says **where** it will search: "How can I help you with [x]?" */
  sub: string
  cards: WelcomeCard[]
  onPick: (prompt: string) => void
  composer: ReactNode
}

/**
 * The assistant's initial state — **one shape for both the full screen and the panel**.
 * Before this, each had its own look: the full screen had a large spark, a welcome, a question, an
 * input box, and cards with headings and explanations; the panel had a single welcome line, a
 * narrow list of buttons, and the input box below in the dock. So a user opening the panel from a
 * project page felt like they'd entered something different and smaller, not the same assistant in
 * a narrower space.
 * Now both are the same block in the same order — spark, welcome, question, input, cards — and only
 * one thing changes: **what it says it will search**. On the full screen it's "How can I help you
 * today?" because its scope is the whole system; in the panel it's "How can I help you with
 * [project name]?" because its scope is the open page — and the cards change with it too.
 */
export function Welcome({ greet, sub, cards, onPick, composer }: WelcomeProps) {
  const grid = useRef<HTMLDivElement>(null)
  useProximity(grid, { reach: 300, selector: '.wcard' })

  return (
    <div className="welcome">
      <div className="whead">
        {/* The leaf is alive like the "Ask Abanumay" leaf (the askleaf family) — on the page and in
            the window; static when reduced motion is on. */}
        <span className="wspark"><AbLeaf className="aispark live" /></span>
        <div className="wtext">
          <h1 className="wgreet">{greet}</h1>
          <p className="wsub">{sub}</p>
        </div>
      </div>

      {composer}

      {/* Shortcuts sit under the input box — writing is the primary input, these are quick paths. */}
      <div className="wcards" ref={grid}>
        {cards.map((c, i) => (
          <button
            className="wcard glass"
            key={c.title}
            style={{ '--d': `calc(var(--mo-stagger) * ${Math.min(i, 2)})` } as CSSProperties}
            onClick={() => onPick(c.prompt)}
          >
            <span className="badge badge-30"><Icon name={icons[c.icon as IconName]} /></span>
            <span className="wc-t">{c.title}</span>
            <span className="wc-s">{c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
