import { Link } from 'react-router-dom'
import { Icon, icons, Mono, Riyal, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { stagePressure } from '@/data/repository'
import { days, groupTone, pressureColor } from '@/lib/tone'
import type { ProjectRow } from '@/types/domain'

export interface ProjectCardProps {
  row: ProjectRow
  selected: boolean
  onSelect: (id: string, on: boolean) => void
}

/**
 * كارت مشروع.
 *
 * جدول النظام الحالي فيه ٦٢ عمودًا؛ الكارت ده فيه ١٢ حقلًا هي اللي
 * القرار بيتاخد عليها فعلًا: الحالة **بالقسم الإجرائي الحقيقي** لا
 * بالمجموعة، ومعاها مدة المكوث في القسم — ودي الرقم اللي بيقول
 * إن المشرف واقف من ٨٧ يومًا.
 */
export function ProjectCard({ row, selected, onSelect }: ProjectCardProps) {
  const pressure = stagePressure(row)
  const live = row.stageLimit > 0

  return (
    <article className={`pcard glass${selected ? ' sel' : ''}`}>
      <div className="pc-top">
        <label className="pc-chk" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(row.id, e.target.checked)}
            aria-label={`تحديد مشروع ${row.id}`}
          />
        </label>
        <Mono>{row.id}</Mono>
        <span className="pc-sp" />
        <Tag tone={groupTone(row.statusGroup)}>{row.statusGroup}</Tag>
      </div>

      <Link className="pc-title" to={ROUTES.project(row.id)}>{row.name}</Link>

      <div className="pc-meta sub">
        <Link className="pc-ent" to={ROUTES.entity(row.entityId)}>
          <Icon path={icons.entity} size={14} />
          {row.entityName}
        </Link>
        <span className="pc-dot" />
        <span className="pc-loc">
          <Icon path={icons.pinMap} size={14} />
          {row.city}
        </span>
      </div>

      <div className="pc-goal sub trim1" title={row.goal}>{row.track} · {row.goal}</div>

      {/* القسم الإجرائي الفعلي + مدة المكوث فيه */}
      <div className="pc-stage well">
        <div className="pc-stage-t">
          <span>{row.stage}</span>
          {live && (
            <b className={pressure > 1 ? 'over' : ''}>
              <Icon path={icons.clock} size={13} />
              <span className="num">{days(row.hoursInStage)}</span> يومًا
            </b>
          )}
        </div>
        {live && (
          <div className="pc-bar">
            <i
              style={{
                width: `${Math.min(100, pressure * 100)}%`,
                background: pressureColor(pressure),
              }}
            />
          </div>
        )}
        {live && pressure > 1 && (
          <div className="pc-over">
            تجاوز حدّ القسم بـ<span className="num">{days(row.hoursInStage - row.stageLimit)}</span> يومًا
          </div>
        )}
        {!live && row.declineReason && (
          <div className="pc-reason sub trim1" title={row.declineReason}>{row.declineReason}</div>
        )}
      </div>

      <div className="pc-foot">
        <div className="pc-amt">
          <span className="k">{row.amountGranted > 0 ? 'الممنوح' : 'المطلوب'}</span>
          <span className="v num">
            {nf.format(row.amountGranted > 0 ? row.amountGranted : row.amountRequested)}
            <small><Riyal /></small>
          </span>
        </div>
        <div className="pc-own">
          {row.owner ? (
            <span className="sub">{row.owner}</span>
          ) : (
            <Tag tone="warn">بلا مالك</Tag>
          )}
        </div>
      </div>
    </article>
  )
}
