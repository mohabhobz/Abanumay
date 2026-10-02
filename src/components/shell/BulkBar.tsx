import { useRef, type ReactNode } from 'react'
import { Icon, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'

export interface BulkBarProps {
  /** Count of selected rows — written large before the sentence. */
  count: number
  /** The sentence: "N projects selected, amount SAR 1,240,000." */
  sentence: ReactNode
  /** Buttons — role actions plus any extra control. */
  children?: ReactNode
  onClear: () => void
  /** What ✕ does · «إلغاء التحديد» for a selection, «تراجع» for a draft */
  clearLabel?: string
}

/**
 * Bulk action bar.
 * **Identical to the decision bar**: the same floating dock at the bottom of the screen, the same
 * gradient that fades the content beneath it, the same responsiveness to the mouse. The reason:
 * users are already used to this shape on the project page, and when they check rows in a table and
 * see the same bar appear, they know it's a decision moment without reading anything.
 * It slides up from below because it wasn't there before: the motion says "this appeared because of
 * what you just did," and a card that suddenly appears mid-page reads as an error.
 * The bar floats over the content, so the page beneath it needs extra space — a dedicated class on
 * the view container provides that.
 */
export function BulkBar({ count, sentence, children, onClear, clearLabel = 'إلغاء التحديد' }: BulkBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  return (
    <div className="decdock bulkdock">
      <div className="chrome decbar bulkbar" ref={bar}>
        <div className="rowf" style={{ gap: 'var(--sp-4)', minWidth: 0 }}>
          <span className="bulkn num">{count}</span>
          <span className="decsent">{sentence}</span>
        </div>

        <div className="rowf bulkacts gp-2">
          {children}
          <button
            type="button"
            className="bulkx"
            onClick={onClear}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <Icon name={icons.close} size="sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
