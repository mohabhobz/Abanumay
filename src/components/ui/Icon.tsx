import type { CSSProperties } from 'react'
import type { IconGlyph } from './icons'

/**
 * Icon size · **only three sizes**.
 *
 * It used to be a free-form number, and the code had 10 sizes (11 · 12 · 13 · 14 · 15 · 16 · 17 ·
 * 18 · 20 · 22), so the eye saw icons that were close but not identical on the same screen. The
 * sizes track the text next to them:
 *   sm 16  next to 12-14px text (table cell · tag · small button · list)
 *   md 20  button · timeline · field (default)
 *   lg 24  header · empty state
 * The same values are CSS tokens (`--ic-sm/md/lg`) for the svg sized there.
 */
export type IconSize = 'sm' | 'md' | 'lg'
const PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 }

export interface IconProps {
  /** Icon from `icons` */
  name: IconGlyph
  size?: IconSize
  /** The active/selected item · the icon fills in instead of staying outlined */
  active?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * Phosphor icon at `regular` weight (stroke equal to 1.5 on a 24 grid, the same stroke as Lucide,
 * which was tuned for light Arabic type), and `fill` for the active state.
 */
/* Warning: a single color, and the color transitions on hover. Two colors (duotone) were tried and
   dropped for being unclear. The stroke uses the context color (gray), hover shifts it to the
   product teal with a small bounce, and the active state is filled and stays visible at all times.
   The class `ic2` is the CSS entry point (`.ic` is an old name for a different set of line icons).
   */
export function Icon({ name: Glyph, size = 'md', active, style, className }: IconProps) {
  return (
    <Glyph
      className={`ic2${active ? ' ic2-on' : ''}${className ? ` ${className}` : ''}`}
      size={PX[size]}
      weight={active ? 'fill' : 'regular'}
      style={style}
      aria-hidden="true"
    />
  )
}
