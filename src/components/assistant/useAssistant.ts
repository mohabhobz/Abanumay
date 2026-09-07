import { useCallback, useEffect, useState } from 'react'
import { respond } from '@/data/mock/assistant'
import type { AiMessageModel, ChatMessage } from './types'

/** إيقاع العرض — بطيء بما يكفي إن المستخدم يقرا خطوات التفكير */
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
 * محرّك المساعد المشترك بين الشاشة الكاملة واللوح الجانبي.
 *
 * آلة حالة من ثلاث مراحل: `think` بيعرض المصادر اللي بتتفتح خطوة خطوة،
 * بعدين `type` بيكتب حرف حرف، بعدين `done` بيظهر الأدلة والمصادر والإجراءات.
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

  /* خطوات التفكير واحدة ورا التانية، بعدين الكتابة حرف حرف */
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

  /** يقفز لآخر الإجابة بدل ما يستنى الكتابة */
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
