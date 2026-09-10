import { useEffect, useState } from 'react'

const TICK_MS = 16
const BLOCK_PAUSE_MS = 340
/** أطول مدة مقبولة لكتابة المجموعة كلها — بعدها الانتظار بيبقى شغلًا */
const BUDGET_MS = 5200

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
 *
 * السرعة مش ثابتة: بتتقسّم على ميزانية وقت ثابتة. الكتابة الحرفية
 * بتقول «بيقرا دلوقتي» وده مطلوب، بس بسرعة ثابتة كل قراءة زيادة
 * كانت بتزوّد الانتظار — ستّ قراءات كانت بتاخد تسع ثوانٍ قبل ما آخر
 * واحدة تبان. دلوقتي المجموعة كلها بتخلص في نفس المدة تقريبًا مهما
 * طالت، فزيادة القراءات بتغني الكارت ما بتأخّرهوش.
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
