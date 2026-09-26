import { useLayoutEffect, useRef, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { exportPng, exportXlsx, printArea, type Sheet } from '@/lib/export'
import { PrintSheet } from './PrintSheet'

/**
 * Export button — **the only export shape in the system**.
 * Before this, every screen wrote its own button: the project and entity lists had all three
 * (Excel, PDF, image), reports had only Excel. A user who learned to export an image from the
 * project list would look for it in reports and not find it — a difference with no reason, just
 * duplicated code that had drifted apart.
 * So this component owns all three outputs and the print version together. Any screen with a
 * `Sheet` gets the same menu in one line, and there's no other way to export.
 * **Why these three specifically?** Each answers a different question:
 *   Excel - "I want to work the numbers" (real cells, filtering, totals).
 *   PDF   - "I want to attach it to a record" (a formal sheet with a header and stated scope).
 *   Image - "I want to drop it in a slide or send it in a message" (a clean screenshot).
 * And all three export **the same scope**: the same `Sheet` the screen computes — the selected rows
 * if any are selected, otherwise the full filtered result.
 */
export function ExportMenu({
  sheet,
  /** "12 selected projects" — shown above the list and in the print header. */
  note,
  /** A counter on the button (the selection count), if there is a selection. */
  count,
}: {
  sheet: Sheet
  note?: string
  count?: number
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  /** Open direction: `start` grows toward the start of the line, `end` the opposite. */
  const [side, setSide] = useState<'start' | 'end'>('start')
  const menu = useRef<HTMLDivElement>(null)

  /**
   * The menu flips if it would open off-screen.
   * The export button sits at the end of the toolbar, and in RTL the end of the toolbar is **the
   * left edge of the screen**. The menu anchors to the button's start and grows leftward, so on the
   * budget screen it used to start off-screen and get clipped at the edge of the scrollable
   * container. Measurement happens once after opening, and flipping moves it back inward.
   */
  useLayoutEffect(() => {
    if (!open) return
    const el = menu.current
    const anchor = box.current
    if (!el || !anchor) return
    /* The calculation uses **the button's anchor and the menu's width**, not the menu's current
       position: measuring the current position would leave a once-flipped menu flipped forever,
       since flipping already placed it inside the screen. */
    const a = anchor.getBoundingClientRect()
    const w = el.offsetWidth
    const rtl = getComputedStyle(el).direction === 'rtl'
    const left = rtl ? a.right - w : a.left
    const pad = 12
    setSide(left < pad || left + w > window.innerWidth - pad ? 'end' : 'start')
  }, [open, box])

  const pick = (run: () => void) => () => {
    setOpen(false)
    /* A brief delay before printing so the menu closes first — otherwise it would show up on the
       printed page. The other outputs share the same delay so the feel is consistent. */
    setTimeout(run, 60)
  }

  return (
    <>
      <div className="fexp" ref={box}>
        <button
          className={`fchip${open ? ' on' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={icons.export} size="sm" />
          تصدير
          {count ? <b className="num">{count}</b> : null}
        </button>

        {open && (
          <div className={`fmenu fexp-m${side === 'end' ? ' flip' : ''}`} role="menu" ref={menu}>
            {note && <div className="fexp-s sub">{note}</div>}
            <button className="fopt" role="menuitem" onClick={pick(() => exportXlsx(sheet))}>
              <span className="fopt-t">Excel · xlsx</span>
              <span className="fopt-n sub">خلايا حقيقية للفلترة والجمع</span>
            </button>
            <button className="fopt" role="menuitem" onClick={pick(printArea)}>
              <span className="fopt-t">PDF · عبر الطباعة</span>
              <span className="fopt-n sub">ورقة رسمية للإرفاق في محضر</span>
            </button>
            <button className="fopt" role="menuitem" onClick={pick(() => exportPng(sheet))}>
              <span className="fopt-t">صورة · png</span>
              <span className="fopt-n sub">لقطة للشريحة أو المحادثة</span>
            </button>
          </div>
        )}
      </div>

      {/* The print version is a portal on `body`: sitting inside the export menu's own container
          would hide it during printing along with everything else; sitting inside the app root
          would print it along with the screen. Outside both, it becomes the only sheet on the page. */}
      {createPortal(<PrintSheet sheet={sheet} note={note} />, document.body)}
    </>
  )
}
