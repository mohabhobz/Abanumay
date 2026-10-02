import { createContext, useMemo, useState } from 'react'

/** Where a page's unsaved-changes dock renders · see `SaveBar` */
export const DockSlot = createContext<{ el: HTMLElement | null; setOn: (on: boolean) => void } | null>(null)

export function useDockSlot() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [on, setOn] = useState(false)
  return { setEl, on, value: useMemo(() => ({ el, setOn }), [el]) }
}

export const DockSlotProvider = DockSlot.Provider

