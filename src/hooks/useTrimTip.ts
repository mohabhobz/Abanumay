import { useEffect } from 'react'

/* Client 27 Oct · «أي حاجة فيها تريم في الجدول لما أعمل هوفر عليها» · a text a table cell cuts (an
   ellipsis or a clamp) reads whole in a small tip under it while the pointer is on it · only a text
   that is actually cut gets one. */
const cut = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1

export function useTrimTip(): void {
  useEffect(() => {
    let tip: HTMLDivElement | null = null
    let on: HTMLElement | null = null
    const hide = () => { tip?.remove(); tip = null; on = null }
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      const cell = t?.closest?.('.tbl td, .tbl th') as HTMLElement | null
      if (!cell) { if (on) hide(); return }
      let el: HTMLElement | null = t
      while (el && el !== cell.parentElement && !(el.textContent?.trim() && cut(el))) el = el.parentElement
      if (!el || el === cell.parentElement) { if (on) hide(); return }
      if (el === on) return
      hide()
      const text = el.innerText.trim()
      if (!text) return
      const r = el.getBoundingClientRect()
      tip = document.createElement('div')
      tip.className = 'trimtip'
      tip.setAttribute('role', 'tooltip')
      tip.textContent = text
      document.body.appendChild(tip)
      const w = tip.offsetWidth
      const x = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8)
      tip.style.left = `${x}px`
      tip.style.top = `${Math.min(r.bottom + 6, window.innerHeight - tip.offsetHeight - 8)}px`
      on = el
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('scroll', hide, true); hide() }
  }, [])
}
