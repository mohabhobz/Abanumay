import { nf } from '@/lib/format'
import type { AuthorityMatrix } from '@/types/domain'

/**
 * Ceiling ladder · same logic as the approval arc, but as a vertical list.
 * Computes the first tier whose ceiling covers the amount, and shows why the ones above aren't needed.
 */
export function CeilingLadder({
  amount,
  authority,
  currentRole,
}: {
  amount: number
  authority: AuthorityMatrix
  currentRole?: string
}) {
  const roles = authority.roles

  // The first tier with a ceiling that covers the amount is the approver
  let decider = roles.findIndex((r, i) => i > 0 && r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1 // Exceeds every ceiling — goes to the board

  return (
    <div className="lad">
      {roles.map((r, i) => {
        const isNow = r.role === currentRole
        const isDecider = i === decider
        const off = i > decider
        const fill = r.ceiling ? Math.min(100, (amount / r.ceiling) * 100) : null

        return (
          <div
            key={r.role}
            className={`lrow${isNow ? ' now' : ''}${isDecider ? ' decide' : ''}${off ? ' off' : ''}`}
          >
            <span className="ldot" />
            <div className="lmain">
              <div className="lrole">{r.role}</div>
              <div className="lnote">
                {isNow && 'الحالية · بانتظار الجهة'}
                {!isNow && isDecider && (
                  <>
                    صاحب القرار
                    {r.uplift ? (
                      <>
                        {' '}· يمكنه رفع المبلغ حتى{' '}
                        <span className="num">{nf.format(Math.round(amount * (1 + r.uplift / 100)))}</span>{' '}
                        <span className="num">(+{r.uplift}%)</span>
                      </>
                    ) : null}
                  </>
                )}
                {!isNow && !isDecider && (off ? 'غير مطلوبة، فالمبلغ دون الحد المالي' : 'ضمن المسار')}
              </div>
            </div>
            <div className="lcap">
              {/* Monospace digits only — with Arabic text it breaks the spacing */}
              <div className={`lnum${r.ceiling ? ' mono' : ''}`}>
                {r.ceiling ? nf.format(r.ceiling) : r.kind === 'recommend' ? 'توصية' : 'بلا حد مالي'}
              </div>
              {fill !== null && (
                <div className="lbar">
                  <i style={{ width: `${fill}%` }} />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {authority.provisional && (
        <div className="lprov">الحدود المالية مؤقتة حتى يؤكدها العميل</div>
      )}
    </div>
  )
}
