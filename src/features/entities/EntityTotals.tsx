import { Link } from 'react-router-dom'
import { Riyal } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import type { EntityRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   إجماليات الجهة — أربع مربّعات

   نفس فكرة مروحة الصلاحيات في صفحة المشروع، بشكل تاني: سُلَّم
   مرسوم، وموقعك عليه مُعلَّم. هناك السُّلَّم صلاحيات وموقعك صاحب
   القرار؛ هنا السُّلَّم رحلة المال، والمُعلَّم هو اللي لسه معلّق —
   **تحت الصرف**. لأن ده الرقم الوحيد في الأربعة اللي بيستدعي فعلًا.

   والتعبئة جوّه كل مربّع نسبته من الإجمالي، مش زخرفة: العين بتقرا
   «قد إيه اتصرف من اللي اتلزم» من المساحة قبل ما توصل للرقم.
   ═══════════════════════════════════════════════════════════ */

interface Tile {
  key: string
  label: string
  value: number
  note: string
  /** المربّع اللي بيستدعي فعلًا */
  now?: boolean
  money?: boolean
  to: string
}

export function EntityTotals({ entity }: { entity: EntityRow }) {
  /* المصروف = الملتزم به ناقص اللي لسه في الطريق. القيمتان في ملف
     الجهة، والفرق بينهما هو الوحيد المحسوب هنا. */
  const disbursed = Math.max(0, entity.grantedTotal - entity.inDisbursement)
  const byEntity = `${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`

  const tiles: Tile[] = [
    {
      key: 'total',
      label: 'إجمالي الممنوح',
      value: entity.grantedTotal,
      note: 'من أول تسجيلها',
      money: true,
      to: byEntity,
    },
    {
      key: 'paid',
      label: 'المصروف لها',
      value: disbursed,
      note: 'وصل فعلًا',
      money: true,
      to: ROUTES.payments,
    },
    {
      key: 'pending',
      label: 'تحت الصرف',
      value: entity.inDisbursement,
      note: 'ملتزم لها ولم يصل',
      money: true,
      now: true,
      to: ROUTES.payments,
    },
    {
      key: 'year',
      label: 'ممنوح هذه السنة',
      value: entity.grantedThisYear,
      note: 'من دورة 2026',
      money: true,
      to: byEntity,
    },
  ]

  const base = Math.max(entity.grantedTotal, 1)

  return (
    <div className="etot" role="list">
      {tiles.map((t, i) => {
        const pct = Math.min(100, Math.round((t.value / base) * 100))
        return (
          <Link
            key={t.key}
            to={t.to}
            role="listitem"
            className={`etile glass${t.now ? ' now' : ''}`}
            style={{ '--pct': `${pct}%`, '--n': i } as React.CSSProperties}
          >
            {/* التعبئة من تحت: نسبة الرقم من الإجمالي */}
            <span className="etile-f" aria-hidden="true" />
            <span className="etile-k">{t.label}</span>
            <span className="etile-v num">
              {nf.format(t.value)}
              {t.money && <small><Riyal /></small>}
            </span>
            <span className="etile-n">
              {t.note}
              {t.key !== 'total' && (
                <>
                  {' · '}
                  <span className="num">{pct}%</span> من الإجمالي
                </>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
