import type { IconName } from '@/components/ui'
import type { DecisionKind, Tone } from '@/types/domain'

/** Evidence blocks the assistant shows under an answer. */
export type EvidenceBlock =
  | { kind: 'meter'; label: string; value: number; limit: number; note: string }
  | { kind: 'stats'; items: { k: string; v: string | number; u?: string }[] }
  | { kind: 'ledger'; rows: { k: string; v: string; strong?: boolean }[] }
  | { kind: 'bars'; items: { k: string; real: number; plan?: number }[]; note?: string }
  | { kind: 'list'; items: { t: string; s: string; tone: Tone | '' }[] }

export interface AssistantAction {
  label: string
  kind: DecisionKind
}

/** Pre-written answer for a known question. */
export interface AssistantAnswer {
  think: string[]
  text: string
  more?: string
  block?: EvidenceBlock
  sources?: string[]
  actions?: AssistantAction[]
  follow?: string[]
  /** AI output is advisory, not binding — this rule is stated in the UI. */
  advisory?: boolean
}

export type MessageState = 'think' | 'type' | 'done'

export interface UserMessage {
  who: 'me'
  text: string
}

export interface AiMessageModel extends AssistantAnswer {
  who: 'ai'
  state: MessageState
  /** How many reasoning steps have appeared so far. */
  step: number
  /** How many characters have been typed so far. */
  chars: number
}

export type ChatMessage = UserMessage | AiMessageModel

/**
 * Side panel context — changes with the page it's opened from.
 * The panel is now exactly the full screen's initial state, so this context is responsible for one
 * thing: **what tells the user where it will search**. The personalized welcome ("Welcome, [name]")
 * comes from the user, not from here, since it's the same on every page.
 */
export interface AssistantContext {
  /** Panel header title — the name of what you're in. */
  title: string
  /** Line under the title in the header. */
  sub: string
  /** Scope line under the welcome: "How can I help you with [x]?" */
  scope: string
  cards: { icon: IconName; title: string; sub: string; prompt: string }[]
}
