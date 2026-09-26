import { forwardRef } from 'react'
import type { IconProps } from '@phosphor-icons/react'

/* Leaf motif family — "the leaf grows".

   The shapes are drawn from the identity reference material, not cut from the logo, and the logo
   itself is never touched.

   ⚠️ **Rules that go with the shapes:**
   - `viewBox` only; every color is a themed variable so both light and dark modes come from the
   same file
   - no text inside the SVG; always `aria-hidden` (the shape is decorative, not informational — the
   information lives in the text next to it)
   - **never** inside a data card, behind a card surface, under a number, or in place of a status
   tag
   - at most one shape-moment per page */

/** Assistant mark — a single leaf blade only; an asymmetric lens with no vein. */
export const ABLEAF_PATH = 'M4 20.5C5.6 12.2 11.4 5.9 20 3.5c.6 7.8-3 14.2-16 17Z'

/**
 * `AbLeaf` — **the single glyph for the assistant**.
 * There used to be two: a CSS-masked leaf with a vein, and a separate icon-set leaf — two shapes
 * for the same meaning, one of which read as "a generic leaf." Now this is the only source: idle is
 * a 1.5px outline, active is filled.
 */
export function AbLeaf({ className = 'aispark', active = true }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" data-ableaf="">
      <path
        d={ABLEAF_PATH}
        fill={active ? 'currentColor' : 'none'}
        stroke={active ? 'none' : 'currentColor'}
        strokeWidth={active ? undefined : 1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The same glyph wrapped as an icon-set component, so it stays a usable key in the icon lookup. */
export const AbLeafGlyph = forwardRef<SVGSVGElement, IconProps>(function AbLeafGlyph(
  { size = 20, weight = 'regular', className, style, color, ...rest },
  ref,
) {
  const fill = weight === 'fill'
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      color={color}
      aria-hidden="true"
      data-ableaf=""
      {...rest}
    >
      <path
        d={ABLEAF_PATH}
        fill={fill ? 'currentColor' : 'none'}
        stroke={fill ? 'none' : 'currentColor'}
        strokeWidth={fill ? undefined : 1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
})

/** Motif 1 — two leaves: a lime blade behind a teal blade, rising from the bottom corner. */
export function Leaves({ className = 'sv-leaves' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 200" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      <path className="lf-back" fill="var(--il-accent)" d="M0 200C38 124 112 56 204 10c9-4 16 0 16 9V200Z" />
      <path className="lf-front" fill="var(--il-tone)" d="M64 200c40-58 110-104 214-128 11-3 18 4 15 15-10 44-30 82-62 113Z" />
    </svg>
  )
}

/** Motif 2 — the branch: cropped twigs, tone on tone, on a dark surface with no data. */
export function Branch({ className = 'sv-branch' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true"
      fill="none" stroke="var(--m2-ink)" strokeLinecap="round">
      <path strokeWidth="18" d="M40 300C60 240 100 205 150 185" />
      <path strokeWidth="14" d="M150 185c40-15 70-55 82-115" />
      <path strokeWidth="9" d="M205 150c35 0 63-10 87-32" />
      <path strokeWidth="12" d="M150 185c-10-45-30-75-62-97" />
      <path strokeWidth="8" d="M126 124c2-30 14-54 34-74" />
      <path strokeWidth="10" d="M88 234c-28-12-50-34-64-62" />
    </svg>
  )
}

/**
 * The seal — for four-stage approval and closure completion **only**.
 * **Next to the title** — it never replaces or overrides the status tag.
 * `fresh` means it was just sealed (plays once); otherwise it shows static.
 */
export function Seal({ fresh, label = 'مختوم' }: { fresh?: boolean; label?: string }) {
  return (
    <span className={`seal${fresh ? ' fresh' : ''}`} role="img" aria-label={label}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="44" fill="none" stroke="var(--il-ink-line)" strokeWidth="3" />
        <circle cx="48" cy="48" r="35" fill="none" stroke="var(--il-ink-line)" strokeWidth="1.5" strokeDasharray="2 5" />
        <path fill="var(--il-accent)" d="M30 66c2-18 12-32 30-40 2-1 4 0 4 2-2 20-14 32-34 38Z" />
        <path fill="var(--il-tone)" d="M42 68c5-12 14-20 28-23 2 0 3 1 3 3-6 12-16 19-31 20Z" />
      </svg>
    </span>
  )
}

/* A single blade at ground level — derived from the "agreement not yet reached" drawing. */
const BLADE = (x: number, h: number) =>
  `M${x} 124c3 ${-h * .4} 16 ${-h * .75} 42 ${-h}c2-1.5 5 0 5 2c-1.5 ${h * .42}-16 ${h * .75}-47 ${h * .97}Z`

/**
 * Growth-stage drawings — **the number of blades equals the grant's stage.**
 * Plan: 1, agreement: 2, disbursement: 3, closure: 4. The completed stage is solid, the current one
 * is a dotted outline, and the rest are just dots on the ground — read right to left.
 * Used in the `art` slot of the empty state, in a limited, audited set of places. **Never** for an
 * empty result after filtering, a loading state, a permission block, or the assistant.
 */
export function GrowthSpot({ done, total = 4 }: { done: number; total?: number }) {
  const step = 168 / total
  const xs = Array.from({ length: total }, (_, i) => 190 - i * step)
  return (
    <svg className="ill ill-spot" viewBox="0 0 240 140" aria-hidden="true">
      <line x1="228" y1="124" x2="22" y2="124" stroke="var(--il-ghost)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="124" r="4" fill="var(--il-accent)" />
      {xs.map((x, i) => {
        const h = 62 + i * 6
        if (i < done) {
          return <path key={i} className="bl" fill={i % 2 ? 'var(--il-accent)' : 'var(--il-tone)'} d={BLADE(x - 20, h)} />
        }
        if (i === done) {
          return (
            <path key={i} className="bl" fill="none" stroke="var(--il-accent-line)" strokeWidth="2.5"
              strokeDasharray="6 6" strokeLinejoin="round" d={BLADE(x - 20, h)} />
          )
        }
        return <circle key={i} cx={x} cy="124" r="3" fill="var(--il-ghost)" />
      })}
    </svg>
  )
}

/** Success drawing — "a seed planted": the closure arc plus two rising blades. */
export function HeroSuccess() {
  return (
    <svg className="ill ill-hero" viewBox="0 0 320 340" aria-hidden="true">
      <path fill="var(--il-ink)" d="M30 340V170a130 130 0 0 1 260 0V340Z" />
      <path fill="var(--il-accent)" d="M290 40a60 60 0 0 0-60 60h60Z" />
      <circle cx="40" cy="62" r="16" fill="var(--il-tone)" />
      <path className="bl" fill="var(--il-accent)" d="M120 340c0-70 30-128 92-162 5-3 10 0 9 6-6 76-40 128-101 156Z" />
      <path className="bl" fill="var(--il-tone)" d="M150 340c10-44 40-78 88-94 5-2 9 2 7 7-16 42-46 72-95 87Z" />
      <line x1="30" y1="339" x2="290" y2="339" stroke="var(--il-accent)" strokeWidth="2" />
    </svg>
  )
}

/**
 * Secondary layer: an underline beneath the path with two small leaves at its end.
 * Static, and the leaves are removed on their own if the page already has another illustration — at
 * most one shape-moment per page.
 */
export function Trail() {
  return (
    <span className="trail" aria-hidden="true">
      <span className="trail-leaves"><Leaves className="sv-leaves" /></span>
    </span>
  )
}
