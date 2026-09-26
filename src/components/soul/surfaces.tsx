import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { StepItem } from '@/components/ui/Steps'
import { Branch, Leaves, Seal } from './motifs'

/**
 * Identity field — the greeting banner on the home screen **only**.
 * ⚠️ **A solid surface specific to this element, not a page background.** The page behind it and
 * the cards below it stay exactly as they are.
 * - Greeting and date only — **no number or KPI ever sits on the field** (numbers stay on their own
 * surface below it)
 * - White ink is the primary and secondary ink for this surface only — the one exception to "no
 * colored text," flagged in the CSS so the text-color check skips it deliberately
 * - Its height is the least that fits two lines (density tuned at 1600x900)
 * - One field per page
 */
export function IdentityBanner({ title, sub, action }: { title: ReactNode; sub: ReactNode; action?: ReactNode }) {
  /* ⚠️ **The action is anchored to the two leaves at 16px, not to the banner text.** The leaves are
   sized from the banner's height, so their visible width shifts with screen size and font — the
   padding reserving their space used to be a fixed number, so the action would land inside the
   text. Here the leaves' visible edge is measured and padding is set to their width plus a fixed
   gap. */
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const h = ref.current
    if (!h) return
    const fit = () => {
      const hr = h.getBoundingClientRect()
      const leaves = h.querySelectorAll('.idban-art .sv-leaves path')
      if (!leaves.length || !hr.width) return
      const rtl = getComputedStyle(h).direction === 'rtl'
      let reach = 0
      leaves.forEach((p) => {
        const r = p.getBoundingClientRect()
        reach = Math.max(reach, rtl ? Math.min(r.right, hr.right) - hr.left : hr.right - Math.max(r.left, hr.left))
      })
      /* The 16px gap is between the action's **visible shape** and the leaves — the ghost button has
   transparent padding on the leaves' side, so it's subtracted to keep the gap a true 16px. */
      const act = h.querySelector<HTMLElement>(':scope > a, :scope > button')
      const pad = act ? parseFloat(getComputedStyle(act).paddingInlineEnd) || 0 : 0
      h.style.setProperty('--idban-art-w', `${Math.round(reach - pad)}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(h)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [])
  return (
    <header className="idban hhead" ref={ref}>
      <span className="idban-art" aria-hidden="true">
        <Branch />
        <Leaves />
      </span>
      <div className="hhead-t">
        <h1 className="htitle">{title}</h1>
        <p className="hdate">{sub}</p>
      </div>
      {action}
    </header>
  )
}

/**
 * Approval progress bar.
 * One slot per approval stage; completed ones are filled, and the stage just sealed (`fresh`) fills
 * once, animating from the leading edge — no numbers, no percentage. The names under each slot are
 * plain text, not tags.
 */
export function ApprovalBar({ items, fresh }: { items: StepItem[]; fresh?: number }) {
  return (
    <ol className="apbar" aria-label="محطات الاعتماد">
      {items.map((s, i) => (
        <li key={`${s.label}-${i}`} className={`apbar-i ${s.state}${fresh === i ? ' fresh' : ''}`}>
          <i aria-hidden="true" />
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Page title with the seal — the seal sits **next to the title**, and the status tag stays in its
 * place with its new state; the seal never replaces it.
 */
export function SealedTitle({ children, sealed, fresh }: { children: ReactNode; sealed: boolean; fresh?: boolean }) {
  return (
    <h1 className="ptitle sealt">
      {children}
      {sealed && <Seal fresh={fresh} label="اكتمل الاعتماد" />}
    </h1>
  )
}
