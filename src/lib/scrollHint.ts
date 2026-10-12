/* A wide table says it has more (11 Oct · alignment audit UI-199).
   A `.tblwrap` scrolls sideways when its table is wider than the card, but nothing showed it: the
   last column was simply cut at the card's edge («تاريخ المر») and the scrollbar sat under a long
   table, out of sight. Every wrapper that can scroll gets `data-more` while content is left past
   its far edge, and the stylesheet fades that edge. One observer for the whole app, so a table
   added anywhere is covered without wiring. */

const SEL = '.tblwrap, .tabs'

function mark(el: HTMLElement) {
  const over = el.scrollWidth - el.clientWidth
  /* RTL: scrollLeft runs from 0 to −over as the reader moves toward the far (left) edge */
  const left = over > 2 && Math.abs(el.scrollLeft) < over - 2
  if (left) el.setAttribute('data-more', '')
  else el.removeAttribute('data-more')
}

export function installScrollHints(root: Document = document) {
  const seen = new WeakSet<HTMLElement>()
  const ro = new ResizeObserver((es) => { for (const e of es) mark(e.target as HTMLElement) })
  const hook = (el: HTMLElement) => {
    if (seen.has(el)) return
    seen.add(el)
    ro.observe(el)
    const t = el.querySelector('table') ?? el.lastElementChild
    if (t) ro.observe(t)
    el.addEventListener('scroll', () => mark(el), { passive: true })
    mark(el)
  }
  const scan = () => root.querySelectorAll<HTMLElement>(SEL).forEach(hook)
  let raf = 0
  new MutationObserver(() => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan() })
  }).observe(root.body, { childList: true, subtree: true })
  scan()
}
