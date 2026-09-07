import { useEffect, useState } from 'react'

const CHARS_PER_TICK = 3
const TICK_MS = 16
const BLOCK_PAUSE_MS = 340

export interface TypedBlocksState {
  /** رقم البلوك اللي بيتكتب دلوقتي */
  block: number
  /** كام حرف اتكتب في البلوك ده */
  chars: number
  done: boolean
}

/**
 * بيكتب مجموعة نصوص واحدًا ورا التاني، حرف حرف.
 * بيحترم `prefers-reduced-motion` فيعرض كل حاجة فورًا.
 */
export function useTypedBlocks(texts: string[], active: boolean): TypedBlocksState {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches

  const [block, setBlock] = useState(reduced ? texts.length : 0)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    if (!active || reduced || block >= texts.length) return

    const text = texts[block] ?? ''
    if (chars < text.length) {
      const id = setTimeout(
        () => setChars((v) => Math.min(text.length, v + CHARS_PER_TICK)),
        TICK_MS,
      )
      return () => clearTimeout(id)
    }

    const id = setTimeout(() => { setBlock((v) => v + 1); setChars(0) }, BLOCK_PAUSE_MS)
    return () => clearTimeout(id)
  }, [active, reduced, block, chars, texts])

  return { block, chars, done: block >= texts.length }
}
