import { useCallback, useEffect, useRef, useState } from 'react'
import { MIN_COL_W, readWidths, writeWidths, type ColWidths } from './model'

export interface Dragging {
  key: string
  /** موضع الخط الدليل بالنسبة لحاوية الجدول */
  x: number
}

export interface ColumnResize {
  widths: ColWidths
  dragging: Dragging | null
  /** بيتربط على `onPointerDown` في مقبض العمود */
  start: (key: string, e: React.PointerEvent<HTMLElement>) => void
  /** بيرجّع العمود لعرضه الافتراضي — دبل كليك على المقبض */
  reset: (key: string) => void
}

/**
 * سحب حدود الأعمدة.
 *
 * العرض بيتقاس من الترويسة نفسها وقت بداية السحب لا من قيمة محفوظة:
 * الجدول `width:100%`، فالمتصفح بيقسّم الزيادة على الأعمدة، والعرض
 * اللي على الشاشة مش هو الرقم المكتوب في التعريف. لو السحب بدأ من
 * الرقم المكتوب، العمود بينطّ أول لمسة قبل ما يتحرّك.
 *
 * والاتجاه: في RTL حدّ العمود اللي بنسحب منه هو حافته **اليسرى**،
 * فالسحب لليسار (نقصان `clientX`) بيكبّر العمود. الحساب بياخد
 * الاتجاه من الصفحة نفسها عشان يشتغل في الاتجاهين.
 */
export function useColumnResize(table: string | undefined): ColumnResize {
  const [widths, setWidths] = useState<ColWidths>(() => (table ? readWidths(table) : {}))
  const [dragging, setDragging] = useState<Dragging | null>(null)

  /* المرجع بيحمل حالة السحب الجارية: المستمعات بتتسجّل مرة واحدة،
     وقراءة الحالة من `useState` جوّاها بتبقى قديمة. */
  const live = useRef<{
    key: string
    startX: number
    startW: number
    rtl: boolean
    host: HTMLElement | null
  } | null>(null)

  const start = useCallback((key: string, e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.closest('th')
    if (!th) return
    live.current = {
      key,
      startX: e.clientX,
      startW: th.getBoundingClientRect().width,
      rtl: getComputedStyle(th).direction === 'rtl',
      host: th.closest('.tblock'),
    }
    setDragging({ key, x: e.clientX - (live.current.host?.getBoundingClientRect().left ?? 0) })
  }, [])

  useEffect(() => {
    if (!dragging) return

    const move = (e: PointerEvent) => {
      const d = live.current
      if (!d) return
      const delta = d.rtl ? d.startX - e.clientX : e.clientX - d.startX
      const w = Math.max(MIN_COL_W, Math.round(d.startW + delta))
      setWidths((prev) => ({ ...prev, [d.key]: w }))
      setDragging({ key: d.key, x: e.clientX - (d.host?.getBoundingClientRect().left ?? 0) })
    }

    const stop = () => {
      live.current = null
      setDragging(null)
    }

    /* `pointercancel` مش رفاهية: لو المتصفح خطف المؤشّر (تمرير
       باللمس مثلًا) من غيره الجدول بيفضل في وضع السحب للأبد. */
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    /* منع تظليل النص أثناء السحب */
    document.body.classList.add('colresizing')
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.classList.remove('colresizing')
    }
  }, [dragging])

  /* الحفظ بعد ما السحب يخلص بس: التخزين مع كل حركة مؤشّر كتابة
     مية مرة في الثانية بلا داعي. */
  const saved = useRef(widths)
  useEffect(() => {
    if (dragging || !table || saved.current === widths) return
    saved.current = widths
    writeWidths(table, widths)
  }, [dragging, table, widths])

  const reset = useCallback((key: string) => {
    setWidths((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  return { widths, dragging, start, reset }
}
