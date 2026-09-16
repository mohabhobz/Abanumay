import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'

/**
 * سلوك القائمة المنسدلة · **مكتوب مرة واحدة**.
 *
 * كان مكرّرًا **ستّ مرات** في السيستم: `Select` و`MultiSelect`
 * و`PageSize` و`SavedViews` ومنتقي الأعمدة وقائمة الحساب. ولمّا
 * الحاجة تتكتب ستّ مرات، بتفرق:
 *
 *   · خمسة كانوا بيسمعوا `pointerdown` وواحد `mousedown` · يعني
 *     قايمة التصدير ما بتقفلش باللمس على التابلت وهي بتقفل بالماوس
 *   · خمسة على `document` وواحد على `window`
 *
 * والفرق ده **مش قرار** · هو أثر إن الكود اتنسخ في ستّ لحظات
 * مختلفة. الهوك ده بيقفل الباب: القفل بالضغط برّه أو بـEsc، بنفس
 * الحدث وعلى نفس الهدف، في كل مكان.
 *
 * `pointerdown` لا `click`: الضغطة اللي بتقفل القايمة ما تنفعش
 * تعدّي لعنصر تحتها وتعمل فعل تاني.
 *
 * ⚠️ **وقايمة المحادثات كانت السابع اللي برّه الهوك.** مش لأنها
 * مختلفة في السلوك، هي مختلفة في **الحالة**: مش «مفتوحة/مقفولة»
 * لكن «مفتوحة على أنهي صفّ». فالسطر اللي بيقفل بالضغط برّه اتنسي،
 * والقايمة فضلت مفتوحة لحد ما المستخدم يدوس على الزرار تاني.
 * `useMenuOf` تحت بيدّي نفس السلوك لحالة بمعرّف بدل بوليان.
 */

/** الاستماع المشترك · اللي الاتنين مبنيين عليه، فما يفرقوش */
function useAway(active: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!active) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  })
}

export function useMenu<T extends HTMLElement>(): {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  /** يتحطّ على الحاوية اللي جوّاها الزرار **واللوحة** مع بعض */
  box: RefObject<T | null>
} {
  const [open, setOpen] = useState(false)
  const box = useRef<T>(null)
  useAway(open, box, () => setOpen(false))
  return { open, setOpen, box }
}

/**
 * نفس السلوك لقايمة واحدة من كتير · الحالة معرّف الصفّ المفتوح.
 *
 * `box` بيتحطّ على **الصفّ** اللي قايمته مفتوحة، مش على الليست
 * كلها · غير كده الضغط على صفّ تاني ما بيقفلش قايمة الأول لأنه
 * جوّه نفس الحاوية.
 */
export function useMenuOf<T extends HTMLElement>(): {
  id: string | null
  toggle: (x: string) => void
  close: () => void
  box: RefObject<T | null>
} {
  const [id, setId] = useState<string | null>(null)
  const box = useRef<T>(null)
  useAway(id !== null, box, () => setId(null))
  return {
    id,
    toggle: (x) => setId((v) => (v === x ? null : x)),
    close: () => setId(null),
    box,
  }
}
