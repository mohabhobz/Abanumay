import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'

/**
 * سلوك القائمة المنسدلة — **مكتوب مرة واحدة**.
 *
 * كان مكرّرًا **ستّ مرات** في السيستم: `Select` و`MultiSelect`
 * و`PageSize` و`SavedViews` ومنتقي الأعمدة وقائمة الحساب. ولمّا
 * الحاجة تتكتب ستّ مرات، بتفرق:
 *
 *   · خمسة كانوا بيسمعوا `pointerdown` وواحد `mousedown` — يعني
 *     قايمة التصدير ما بتقفلش باللمس على التابلت وهي بتقفل بالماوس
 *   · خمسة على `document` وواحد على `window`
 *
 * والفرق ده **مش قرار** — هو أثر إن الكود اتنسخ في ستّ لحظات
 * مختلفة. الهوك ده بيقفل الباب: القفل بالضغط برّه أو بـEsc، بنفس
 * الحدث وعلى نفس الهدف، في كل مكان.
 *
 * `pointerdown` لا `click`: الضغطة اللي بتقفل القايمة ما تنفعش
 * تعدّي لعنصر تحتها وتعمل فعل تاني.
 */
export function useMenu<T extends HTMLElement>(): {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  /** يتحطّ على الحاوية اللي جوّاها الزرار **واللوحة** مع بعض */
  box: RefObject<T | null>
} {
  const [open, setOpen] = useState(false)
  const box = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return { open, setOpen, box }
}
