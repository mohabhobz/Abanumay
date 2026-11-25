import { useEffect } from 'react'

/* Client 25 Nov · the today board's floor · once its tabs pin, every column reaches down to just
   above what floats at the screen's foot («اسأل أبانمي», a decision bar) and no further · measured
   from the live screen and written as `--tday-room` on the screen (the board may remount), so a column with few cards (or
   none) still fills the screen, and only a column with more cards grows past it. */
export function useBoardRoom(boardSel = '.tday-board', tabsSel = '.tday-tabs') {
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const board = document.querySelector<HTMLElement>(boardSel)
      const tabs = document.querySelector<HTMLElement>(tabsSel)
      const screen = board?.closest<HTMLElement>('.screen')
      if (!board || !tabs || !screen) return
      const vh = window.innerHeight
      const sr = screen.getBoundingClientRect()
      const gap = parseFloat(getComputedStyle(board).rowGap) || 20
      const tops = [...document.querySelectorAll<HTMLElement>('.decdock .decbar, .askfab, .chatfab')]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.width > 0 && r.top > vh / 2)
        .map((r) => r.top)
      const line = Math.min(sr.bottom, ...tops) - gap
      /* where the board starts once the tabs pin · the tabs' sticky place plus their height and the
         space between them and the board */
      const pt = parseFloat(getComputedStyle(screen).paddingTop) || 0
      const tr = tabs.getBoundingClientRect()
      const between = board.getBoundingClientRect().top - tr.bottom
      const pinnedTop = sr.top + pt + (parseFloat(getComputedStyle(tabs).top) || 0) + tr.height + between
      screen.style.setProperty('--tday-room', `${Math.max(240, Math.round(line - pinnedTop))}px`)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    /* measured once the screen settles, and again on resize only · a tab switch or a floating
       button's own animation never moves the floor, so the columns hold still */
    const t = window.setTimeout(schedule, 450)
    window.addEventListener('resize', schedule)
    return () => { if (raf) cancelAnimationFrame(raf); window.clearTimeout(t); window.removeEventListener('resize', schedule) }
  }, [boardSel, tabsSel])
}
