import type { CSSProperties } from 'react'
import type { IconGlyph } from './icons'

/**
 * مقاس الأيقونة · **تلات درجات بس** (٢٣ سبتمبر · DDR-013).
 *
 * كان رقمًا حرًّا، والكود كان فيه ١٠ مقاسات (11 · 12 · 13 · 14 · 15 ·
 * 16 · 17 · 18 · 20 · 22) · يعني العين بتشوف أيقونات متقاربة ومختلفة
 * في نفس الشاشة. الدرجات ماشية مع النصّ اللي جنبها:
 *   sm 16  جنب نصّ ١٢–١٤ (خلية · وسم · زرار صغير · قايمة)
 *   md 20  الزرار · الريل · الحقل (الافتراضي)
 *   lg 24  ترويسة · حالة فاضية
 * ونفس القيم توكنز في الـCSS (`--ic-sm/md/lg`) للـsvg اللي بيتقاس هناك.
 */
export type IconSize = 'sm' | 'md' | 'lg'
const PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 }

export interface IconProps {
  /** أيقونة من `icons` */
  name: IconGlyph
  size?: IconSize
  /** البند النشِط/المختار · الأيقونة بتتملي بدل ما تفضل خطًّا */
  active?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * أيقونة Phosphor بوزن `regular` (سُمك يساوي ١٫٥ على شبكة ٢٤ · نفس
 * سُمك لوسيد اللي كان متظبط للخط العربي الخفيف)، و`fill` للنشِط.
 */
export function Icon({ name: Glyph, size = 'md', active, style, className }: IconProps) {
  return (
    <Glyph
      className={className}
      size={PX[size]}
      weight={active ? 'fill' : 'regular'}
      style={style}
      aria-hidden="true"
    />
  )
}
