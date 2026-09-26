import { useCallback, useEffect, useState } from 'react'
import { respond } from '@/data/mock/assistant'
import type { AiMessageModel, ChatMessage } from './types'

/** Display pace — slow enough that the user can read the reasoning steps. */
const THINK_STEP_MS = 620
const TYPE_CHARS = 3
const TYPE_MS = 14

const isPending = (m: ChatMessage): m is AiMessageModel =>
  m.who === 'ai' && m.state !== 'done'

export interface AssistantController {
  msgs: ChatMessage[]
  busy: boolean
  send: (text: string) => void
  stop: () => void
  reset: () => void
}

/**
 * Assistant engine shared by the full screen and the side panel.
 * A three-phase state machine: `think` shows the sources opening step by step, then `type` writes
 * character by character, then `done` reveals the evidence, sources, and actions.
 */
export function useAssistant(): AssistantController {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const busy = msgs.some(isPending)

  const send = useCallback((text: string) => {
    const question = String(text ?? '').trim()
    if (!question) return
    setMsgs((prev) => [
      ...prev,
      { who: 'me', text: question },
      { who: 'ai', ...respond(question), state: 'think', step: 0, chars: 0 },
    ])
  }, [])

  /* Reasoning steps play one after another, then the writing goes character by character. */
  useEffect(() => {
    const index = msgs.findIndex(isPending)
    if (index === -1) return

    const message = msgs[index] as AiMessageModel
    const patch = (changes: Partial<AiMessageModel>) =>
      setMsgs((all) => all.map((m, i) => (i === index ? { ...(m as AiMessageModel), ...changes } : m)))

    if (message.state === 'think') {
      const steps = message.think ?? []
      if (message.step < steps.length) {
        const t = setTimeout(() => patch({ step: message.step + 1 }), THINK_STEP_MS)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => patch({ state: 'type' }), 260)
      return () => clearTimeout(t)
    }

    const full = message.text ?? ''
    if (message.chars < full.length) {
      const t = setTimeout(
        () => patch({ chars: Math.min(full.length, message.chars + TYPE_CHARS) }),
        TYPE_MS,
      )
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => patch({ state: 'done' }), 200)
    return () => clearTimeout(t)
  }, [msgs])

  /** Jumps to the end of the answer instead of waiting for the typing. */
  const stop = useCallback(() => {
    setMsgs((all) =>
      all.map((m) =>
        isPending(m) ? { ...m, state: 'done', chars: (m.text ?? '').length } : m,
      ),
    )
  }, [])

  const reset = useCallback(() => setMsgs([]), [])

  return { msgs, busy, send, stop, reset }
}
