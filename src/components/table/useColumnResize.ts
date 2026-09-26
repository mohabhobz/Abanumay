import { useCallback, useEffect, useRef, useState } from 'react'
import { MIN_COL_W, readWidths, writeWidths, type ColWidths } from './model'

export interface Dragging {
  key: string
  /** Guide line position relative to the table container. */
  x: number
}

export interface ColumnResize {
  widths: ColWidths
  dragging: Dragging | null
  /** Bound to `onPointerDown` on the column handle. */
  start: (key: string, e: React.PointerEvent<HTMLElement>) => void
  /** Resets the column to its default width — double-click on the handle. */
  reset: (key: string) => void
}

/**
 * Dragging column boundaries.
 * Width is measured from the header itself at drag start, not from a stored value: the table is
 * full-width, so the browser distributes any surplus across the columns, and the width on screen
 * isn't the number written in the definition. If the drag started from the written number, the
 * column would jump on the first touch before it even moves.
 * Direction: in RTL the boundary being dragged is the column's left edge, so dragging left
 * (decreasing the pointer's x) grows the column. The calculation reads direction from the page
 * itself so it works either way.
 */
export function useColumnResize(table: string | undefined): ColumnResize {
  const [widths, setWidths] = useState<ColWidths>(() => (table ? readWidths(table) : {}))
  const [dragging, setDragging] = useState<Dragging | null>(null)

  /* The ref holds the drag's live state: listeners are registered once, and reading state from a hook
   inside them would go stale. */
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

    /* `pointercancel` isn't a nicety: if the browser steals the pointer (a touch scroll, for example),
   without it the table would stay stuck in drag mode forever. */
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    /* Prevents text selection while dragging. */
    document.body.classList.add('colresizing')
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.classList.remove('colresizing')
    }
  }, [dragging])

  /* Saved only once dragging ends: writing to storage on every pointer move would fire far too often
   for no reason. */
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
