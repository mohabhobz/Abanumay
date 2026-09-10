import { Link } from 'react-router-dom'
import { Icon, icons, Money, type IconName } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   إجماليات الجهة — أربع بطاقات بدائرة أيقونة

   الأربعة رحلة واحدة للمال: كل الممنوح ← اللي وصل ← اللي لسه في
   الطريق ← نصيب السنة الجارية. والتدرّج اللوني من الغامق للفاتح
   بيمشي مع الرحلة، فالعين تقرا الترتيب قبل ما تقرا الأرقام.

   واللوحات ملتصقة بلا فواصل — شريط واحد متّصل زي المرجع، الكتف
   المقوّس بيفصل بينها لا المسافة. والتدرّج طالع من تحت.
   ═══════════════════════════════════════════════════════════ */

interface Tile {
  key: string
  label: string
  value: number
  note: string
  icon: IconName
  /** نبرة البطاقة — توكن في الـCSS عشان يقلب مع المظهر */
  tone: string
  /** البطاقة اللي بتستدعي فعلًا */
  now?: boolean
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
      icon: 'budget',
      tone: 'var(--tone-1)',
      to: byEntity,
    },
    {
      key: 'paid',
      label: 'المصروف لها',
      value: disbursed,
      note: 'وصل فعلًا',
      icon: 'pay',
      tone: 'var(--tone-2)',
      to: ROUTES.payments,
    },
    {
      key: 'pending',
      label: 'تحت الصرف',
      value: entity.inDisbursement,
      note: 'ملتزم لها ولم يصل',
      icon: 'clock',
      tone: 'var(--tone-3)',
      now: true,
      to: ROUTES.payments,
    },
    {
      key: 'year',
      label: 'ممنوح هذه السنة',
      value: entity.grantedThisYear,
      note: 'من دورة 2026',
      icon: 'chart',
      tone: 'var(--tone-4)',
      to: byEntity,
    },
  ]

  const base = Math.max(entity.grantedTotal, 1)

  return (
    <div className="einf" role="list">
      {tiles.map((t, i) => {
        const pct = Math.min(100, Math.round((t.value / base) * 100))
        return (
          <Link
            key={t.key}
            to={t.to}
            role="listitem"
            className={`einf-t${t.now ? ' now' : ''}`}
            style={{ '--tone': t.tone, '--pct': `${pct}%`, '--n': i } as React.CSSProperties}
          >
            <span className="einf-c">
              <Icon path={icons[t.icon]} size={26} />
            </span>

            <span className="einf-k">{t.label}</span>
            <span className="einf-v">
              <Money sm>{t.value}</Money>
            </span>
            <span className="einf-n">
              {t.note}
              {t.key !== 'total' && (
                <> · <span className="num">{pct}%</span></>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
