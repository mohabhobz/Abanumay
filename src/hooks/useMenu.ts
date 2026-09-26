import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'

/**
 * Dropdown menu behavior — written once.
 *
 * It used to be duplicated six times across the system: `Select`,
 * `MultiSelect`, `PageSize`, `SavedViews`, the column picker, and the
 * account menu. When something gets written six times, it drifts:
 *
 * - Five listened for `pointerdown` and one for `mousedown` — meaning
 * the export menu wouldn't close on tablet touch while it closed with a mouse.
 * - Five listened on `document` and one on `window`.
 *
 * That difference wasn't a decision — it's the result of the code being
 * copied at six different moments. This hook closes that gap: closing on
 * an outside click or Escape, with the same event and the same target,
 * everywhere.
 *
 * `pointerdown`, not `click`: the click that closes the menu shouldn't
 * also pass through to whatever's underneath and trigger another action.
 *
 * The conversations menu was the seventh case, left outside this hook —
 * not because its behavior differs, but because its state does: it
 * isn't "open/closed" but "open on which row." The line that closes it
 * on an outside click was missed, and the menu stayed open until the
 * user clicked its button again. `useMenuOf` below provides the same
 * behavior for state keyed by an id instead of a boolean.
 */

/** Shared listening logic — what both are built on, so they don't drift apart. */
function useAway(active: boolean, box: RefObject<HTMLElement | null>, close: () => void, pop?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return
    /* `pop` = a panel portaled into `body` (`useFloat`) — outside `box` in
       the DOM, so it must be treated as "inside," or the first click on it
       would close it. */
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !pop?.current?.contains(t)) close()
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
  /** Placed on the container that holds both the button and the panel together. */
  box: RefObject<T | null>
  /** The panel, if portaled outside `box` (`useFloat`). */
  pop: RefObject<HTMLDivElement | null>
} {
  const [open, setOpen] = useState(false)
  const box = useRef<T>(null)
  const pop = useRef<HTMLDivElement>(null)
  useAway(open, box, () => setOpen(false), pop)
  return { open, setOpen, box, pop }
}

/**
 * The same behavior for one menu among many — state is the id of the
 * open row. `box` is placed on the row whose menu is open, not on the
 * whole list — otherwise clicking a different row wouldn't close the
 * first one's menu, since both are inside the same container.
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
