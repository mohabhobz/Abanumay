import type { CSSProperties } from 'react'

export interface IconProps {
  /** مسار SVG من `icons` */
  path: string
  size?: number
  style?: CSSProperties
  className?: string
}

/**
 * أيقونة خطية على شبكة 24×24.
 * المسارات نصوص ثابتة معرَّفة عندنا في `icons.ts` — مش مدخلات مستخدم —
 * فحقنها آمن، والبديل (كومبوننت لكل أيقونة) بيضخّم الباندل بلا فايدة.
 */
export function Icon({ path, size = 20, style, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  )
}
