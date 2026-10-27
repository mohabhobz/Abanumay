import { useEffect } from 'react'

/* Client 27 Oct · status tags sit at the end of their cell in every table · a column whose cells
   hold only a status tag (or an empty dash) takes `.tcol-end` on its header and cells, so the tags
   line up along one edge whatever their length. Hand-written tables and DataTable alike, so no
   page has to remember it. Runs on any change under the screen. */
const TAG = '.tag'

function onlyTag(td: HTMLTableCellElement): 'tag' | 'empty' | 'other' {
  const text = (td.textContent ?? '').trim()
  if (!text || text === '—') return 'empty'
  const tags = td.querySelectorAll<HTMLElement>(TAG)
  if (tags.length !== 1) return 'other'
  return (tags[0].textContent ?? '').trim() === text ? 'tag' : 'other'
}

function mark() {
  for (const t of document.querySelectorAll<HTMLTableElement>('table.tbl')) {
    const head = t.tHead?.rows[t.tHead.rows.length - 1]
    if (!head) continue
    const n = head.cells.length
    const seen = new Array<number>(n).fill(0)
    const bad = new Array<boolean>(n).fill(false)
    const rows = [...t.tBodies].flatMap((b) => [...b.rows]).filter((r) => r.cells.length === n)
    for (const r of rows) {
      for (let i = 0; i < n; i++) {
        if (bad[i]) continue
        const k = onlyTag(r.cells[i])
        if (k === 'other') bad[i] = true
        else if (k === 'tag') seen[i]++
      }
    }
    for (let i = 0; i < n; i++) {
      const on = !bad[i] && seen[i] > 0
      const cells = [head.cells[i], ...rows.map((r) => r.cells[i])]
      for (const c of cells) if (c.classList.contains('tcol-end') !== on) c.classList.toggle('tcol-end', on)
    }
  }
}

export function useTagCols(): void {
  useEffect(() => {
    let raf = 0
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark) }
    run()
    const mo = new MutationObserver(run)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => { cancelAnimationFrame(raf); mo.disconnect() }
  }, [])
}
