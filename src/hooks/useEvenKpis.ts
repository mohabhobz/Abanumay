import { useEffect } from 'react'

/* Client 27 Oct · a row of KPI cards reads across · same height, and the numbers on one line even
   when one card's label wraps to a second line. CSS can't size a label by its neighbour's once the
   cards are plain flex columns (the subgrid that did it sized the tracks from the grid's gap and
   left uneven insets), so the labels of each visual row take the row's tallest label as their
   floor. Runs on resize and on any change under the screen. */
const ROWS = '.stats4, .gb-kpis, .stats, .pfi-kpi, .pfi-two'
const LABEL = ':scope > .stat > .lb, :scope > .gb-kpi > .gb-kpi-k'

function even() {
  for (const box of document.querySelectorAll<HTMLElement>(ROWS)) {
    const labels = [...box.querySelectorAll<HTMLElement>(LABEL)]
    labels.forEach((l) => { l.style.minBlockSize = '' })
    const rows = new Map<number, HTMLElement[]>()
    for (const l of labels) {
      const top = Math.round(l.parentElement!.getBoundingClientRect().top)
      const row = rows.get(top) ?? []
      row.push(l)
      rows.set(top, row)
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue
      const h = Math.max(...row.map((l) => l.getBoundingClientRect().height))
      row.forEach((l) => { l.style.minBlockSize = `${h}px` })
    }
  }
}

export function useEvenKpis(): void {
  useEffect(() => {
    let raf = 0
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(even) }
    run()
    const mo = new MutationObserver(run)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', run)
    return () => { cancelAnimationFrame(raf); mo.disconnect(); window.removeEventListener('resize', run) }
  }, [])
}
