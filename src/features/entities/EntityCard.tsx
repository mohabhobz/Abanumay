import { activationSay } from '@/data/shared/decisions'
import { Link } from 'react-router-dom'
import { EntityMark, Icon, icons, Money, Mono, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { ENTITY_DOCS_TOTAL } from '@/data/repository'
import { activationTone } from '@/lib/tone'
import { entityCode } from '@/lib/format'
import type { EntityRow } from '@/types/domain'

/**
 * Entity card.
 *
 * The live system shows entities across six lists sharing the same sixteen columns. This card
 * combines the two questions actually asked before any decision: is this entity active with a
 * complete file, and how has our track record with it been?
 */
export function EntityCard({ row }: { row: EntityRow }) {
  const docsPct = Math.round((row.docsUploaded / ENTITY_DOCS_TOTAL) * 100)
  const complete = row.docsUploaded >= ENTITY_DOCS_TOTAL

  return (
    <article className="ecard glass">
      <div className="ec-top">
        <EntityMark logo={row.logo} />
        <div className="ec-id">
          <Link className="ec-name" to={ROUTES.entity(row.id)}>{row.name}</Link>
          <div className="sub">
            <Mono>{entityCode(row.id, row.registeredAt)}</Mono> · {row.type}
          </div>
        </div>
        <Tag tone={activationTone(row.activation)}>{activationSay(row.activation)}</Tag>
      </div>

      <div className="ec-meta sub">
        <span><Icon name={icons.pinMap} size="sm" /> {row.region} · {row.city}</span>
        <span className="pc-dot" />
        <span>الحوكمة: <b>{row.governance}</b></span>
      </div>

      {/* Documents file - this figure is what blocks agreements. */}
      <div className="ec-docs well">
        <div className="ec-docs-t">
          <span>ملف المستندات</span>
          <b className={complete ? '' : 'over'}>
            <span className="num">{row.docsUploaded}</span> من{' '}
            <span className="num">{ENTITY_DOCS_TOTAL}</span>
          </b>
        </div>
        <div className="pc-bar">
          <i style={{ width: `${docsPct}%`, background: complete ? 'var(--ok)' : 'var(--warn)' }} />
        </div>
      </div>

      <div className="ec-nums">
        <div><b className="num">{row.projectsRunning}</b><span>تحت التشغيل</span></div>
        <div><b className="num">{row.projectsCompleted}</b><span>مكتمل</span></div>
        <div><b className="num">{row.projectsDeclined}</b><span>معتذر</span></div>
        <div>
          <b className="num">
            {row.projectsStalled}
            {row.projectsStalled > 0 && <span className="dotmark" />}
          </b>
          <span>متعثر</span>
        </div>
      </div>

      <div className="ec-foot">
        <div className="pc-amt">
          <span className="k">إجمالي الممنوح</span>
          <span className="v">
            <Money sm>{row.grantedTotal}</Money>
          </span>
        </div>
        <Link className="btn btn-2 btn-sm" to={ROUTES.entity(row.id)}>ملف الجهة</Link>
      </div>
    </article>
  )
}
