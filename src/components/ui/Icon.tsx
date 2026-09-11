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
 * السُمك **١٫٥** لا ٢. لوسيد بترسم على ٢٤×٢٤ بسُمك ٢ افتراضيًّا،
 * وده صحيح لواجهة بخط ثقيل. واجهتنا زجاج فاتح وخط عربي خفيف،
 * والسُمك ٢ كان بيخلّي الأيقونة أتقل عنصر في الشاشة — أتقل من
 * العنوان نفسه. ١٫٥ هو الدرجة اللي لوسيد نفسها بتوصّي بيها
 * للواجهات الخفيفة، وبتفضل على الشبكة فالتقاطعات سليمة.
 *
 * المقاس الافتراضي ٢٠ ماشي مع `--fs-3`.
 */
export function Icon({ name: Glyph, size = 20, style, className }: IconProps) {
  return (
    <Glyph
      className={className}
      size={size}
      strokeWidth={1.5}
      style={style}
      aria-hidden="true"
    />
  )
}
