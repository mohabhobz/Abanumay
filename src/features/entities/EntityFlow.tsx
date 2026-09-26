import { Link } from 'react-router-dom'
import { Glass, Icon, icons, Money } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'
import { pct } from '@/lib/format'

/* The riyal's flow through an entity - a colored column with four overlapping cards.

   The client's reference: a two-tone vertical column at the center, with four white cards
   overlapping it from its corners - two large, two small, with thin dotted lines running out to the
   edges.

   What was kept, and what changed:
   - the composition was kept in full: the two-tone column, the four overlapping cards, large next
   to small, and the lines with dots.
   - direction was flipped. The reference is in English, with the large cards on the left. Here
   reading starts from the right, so the two large cards sit on the right - the whole layout uses
   logical properties so it flips on its own.
   - colors come from the system. The reference is blue and orange; the column here uses the chart
   palette (`--ch-1` and `--ch-2`), the same colors used to draw every chart in the system.
   - size carries meaning. In the reference, large and small are decorative. Here the large cards
   are the two figures that actually matter most (total granted and actually disbursed), and the
   small ones are the smaller share and the time slice.

   The relationship isn't four independent steps:
   01 total granted = 02 actually disbursed + 03 pending disbursement
   04 granted this cycle = a time slice of 01

   So each card states its share, and the first one states that it is the whole, not one of four. */

export function EntityFlow({ entity }: { entity: EntityRow }) {
  /* Disbursed = committed minus what's still in transit. Both figures live in the entity's file,
     and the difference between them is the only thing computed here. */
  const total = entity.grantedTotal
  const pending = entity.inDisbursement
  const paid = Math.max(0, total - pending)
  const byEntity = `${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  /* The empty state has a known background - plain text on the mesh used to fall below the contrast
     threshold. */
  if (total <= 0) {
    return (
      <Glass className="ejr ejr-none">
        <span className="ejr-ht">رحلة الريال في هذه الجهة</span>
        <p>لم تُمنح هذه الجهة أي مبلغ حتى الآن · الجهة مسجَّلة ولم تدخل دورة صرف بعد.</p>
      </Glass>
    )
  }

  const cards = [
    {
      k: '01', slot: 'الكلّ', big: true, icon: 'budget' as const,
      label: 'إجمالي الممنوح', value: total, pct: null,
      note: 'منذ تسجيلها', to: byEntity,
    },
    {
      k: '02', slot: 'الجزء الأكبر', big: true, icon: 'check' as const,
      label: 'وصل فعلًا', value: paid, pct: share(paid),
      note: '', to: ROUTES.payments,
    },
    {
      k: '03', slot: 'المتبقي', big: false, icon: 'clock' as const,
      label: 'تحت الصرف', value: pending, pct: share(pending),
      note: '', to: ROUTES.payments,
    },
    {
      k: '04', slot: 'مقطع زمني', big: false, icon: 'chart' as const,
      label: 'دورة 2026', value: entity.grantedThisYear, pct: share(entity.grantedThisYear),
      note: '', to: byEntity,
    },
  ]

  return (
    <div className="ejr">
      <div className="ejr-stage">
        {cards.map((c) => (
          <Link key={c.k} to={c.to} className={`ejr-c ejr-c${c.k}${c.big ? ' big' : ''}`}>
            {/* A glass circle on top - the icon takes the field's color, which is what returns
                color to the white card. */}
            <span className="ejr-ic" aria-hidden="true">
              <Icon name={icons[c.icon]} size="lg" />
            </span>
            <span className="ejr-slot">{c.slot}</span>
            <span className="ejr-t">{c.label}</span>
            <b className="ejr-v"><Money sm>{c.value}</Money></b>
            <span className="ejr-s">
              {c.pct === null
                ? c.note
                : <>{/* Note: the "%" sign sits inside the isolated span - it used to sit outside it
                        and jump to the start of the Arabic sentence. */}
                  <span className="num">{pct(c.pct)}</span> من الإجمالي{c.note ? ` · ${c.note}` : ''}</>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
