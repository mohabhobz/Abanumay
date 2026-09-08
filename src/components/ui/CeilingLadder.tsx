import { nf } from '@/lib/format'
import type { AuthorityMatrix } from '@/types/domain'

/**
 * سُلّم السقوف — نفس منطق قوس الاعتماد، بس كقائمة رأسية.
 * بيحسب أول دور سقفه يستوعب المبلغ، ويبيّن إن اللي فوقه غير مطلوب وليه.
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

  // أول دور له سقف ويستوعب المبلغ هو صاحب القرار
  let decider = roles.findIndex((r, i) => i > 0 && r.ceiling !== null && r.ceiling >= amount)
  if (decider === -1) decider = roles.length - 1 // تعدّى كل السقوف، يروح للمجلس

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
                        {' '}· يقدر يزيد المبلغ حتى{' '}
                        <span className="num">{nf.format(Math.round(amount * (1 + r.uplift / 100)))}</span>{' '}
                        <span className="num">(+{r.uplift}%)</span>
                      </>
                    ) : null}
                  </>
                )}
                {!isNow && !isDecider && (off ? 'غير مطلوبة، المبلغ دون السقف' : 'ضمن المسار')}
              </div>
            </div>
            <div className="lcap">
              {/* الخط المونو للأرقام بس — على العربي بيبوّظ المسافات */}
              <div className={`lnum${r.ceiling ? ' mono' : ''}`}>
                {r.ceiling ? nf.format(r.ceiling) : r.kind === 'recommend' ? 'توصية' : 'بلا سقف'}
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
        <div className="lprov">السقوف مؤقتة لحين تأكيدها من العميل</div>
      )}
    </div>
  )
}
