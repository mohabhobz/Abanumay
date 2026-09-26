import { useEffect, useState } from 'react'

const TICK_MS = 16
const BLOCK_PAUSE_MS = 340
/**
 * Longest acceptable duration for typing out the whole set — beyond it,
 * waiting starts to feel like a chore.
 */
const BUDGET_MS = 5200

export interface TypedBlocksState {
  /** Index of the block currently being typed. */
  block: number
  /** Number of characters typed in this block so far. */
  chars: number
  done: boolean
}

/**
 * Types out a set of texts one after another, character by character.
 * Respects `prefers-reduced-motion` by showing everything instantly.
 *
 * Speed isn't fixed: it's divided across a fixed time budget. The
 * typing effect signals "reading now," which is wanted, but at a
 * constant speed each extra item added to the wait — six items used to
 * take nine seconds before the last one appeared. Now the whole set
 * finishes in roughly the same duration no matter how long it is, so
 * adding more items enriches the card instead of delaying it.
 */
export function useTypedBlocks(texts: string[], active: boolean): TypedBlocksState {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches

  const [block, setBlock] = useState(reduced ? texts.length : 0)
  const [chars, setChars] = useState(0)

  const total = texts.reduce((n, t) => n + t.length, 0)
  const ticks = Math.max(1, (BUDGET_MS - texts.length * BLOCK_PAUSE_MS) / TICK_MS)
  const step = Math.max(3, Math.ceil(total / ticks))

  useEffect(() => {
    if (!active || reduced || block >= texts.length) return

    const text = texts[block] ?? ''
    if (chars < text.length) {
      const id = setTimeout(
        () => setChars((v) => Math.min(text.length, v + step)),
        TICK_MS,
      )
      return () => clearTimeout(id)
    }

    const id = setTimeout(() => { setBlock((v) => v + 1); setChars(0) }, BLOCK_PAUSE_MS)
    return () => clearTimeout(id)
  }, [active, reduced, block, chars, texts, step])

  return { block, chars, done: block >= texts.length }
}
