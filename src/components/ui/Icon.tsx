import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface IconProps {
  /** أيقونة من `icons` */
  name: LucideIcon
  size?: number
  style?: CSSProperties
  className?: string
}

/**
 * أيقونة لوسيد بمقاس وسُمك موحّدين.
 *
 * السُمك `2` هو اللي أيقونات لوسيد **مرسومة له** على شبكة ٢٤×٢٤،
 * فبنسيبه زي ما هو: تغييره بيخلّي الأشكال تبان مرسومة غلط عند
 * التقاطعات والزوايا. المقاس الافتراضي ٢٠ ماشي مع `--fs-3`.
 */
export function Icon({ name: Glyph, size = 20, style, className }: IconProps) {
  return (
    <Glyph
      className={className}
      size={size}
      strokeWidth={2}
      style={style}
      aria-hidden="true"
    />
  )
}
