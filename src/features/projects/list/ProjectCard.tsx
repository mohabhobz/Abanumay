import { Link } from 'react-router-dom'
import { Icon, icons, Money, Mono, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { NOUN, nounAfter } from '@/lib/format'
import { stagePressure } from '@/data/repository'
import { days, groupTone, pressureColor, TONE } from '@/lib/tone'
import type { ProjectRow } from '@/types/domain'
import { isPortfolio, rowCode, rowHref } from './columns'

export interface ProjectCardProps {
  row: ProjectRow
  selected: boolean
  onSelect: (id: string, on: boolean) => void
}

/**
 * Project card.
 *
 * The system's table has 62 columns; this card surfaces the 12 fields decisions
 * actually depend on: status by actual workflow stage, not by group, plus time
 * spent in that stage — the number that shows a reviewer has been stuck for 87 days.
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
        <Mono>{rowCode(row)}</Mono>
        <span className="pc-sp" />
        <Tag tone={groupTone(row.statusGroup)}>{row.statusGroup}</Tag>
      </div>

      <Link className="pc-title" to={rowHref(row)}>{row.name}</Link>

      <div className="pc-meta sub">
        {isPortfolio(row) ? (
          <span className="pc-ent">
            <Icon name={icons.entity} size="sm" />
            {row.entityName}
          </span>
        ) : (
          <Link className="pc-ent" to={ROUTES.entity(row.entityId)}>
            <Icon name={icons.entity} size="sm" />
            {row.entityName}
          </Link>
        )}
        <span className="pc-dot" />
        <span className="pc-loc">
          <Icon name={icons.pinMap} size="sm" />
          {row.city}
        </span>
      </div>

      <div className="pc-goal mut trim1" title={row.goal}>
        {row.type && row.type !== 'مشروع عادي' ? `${row.type} · ` : ''}{row.track} · {row.goal}
      </div>

      {/* Actual workflow stage plus time spent in it. */}
      <div className="pc-stage well">
        <div className="pc-stage-t">
          <span>{row.stage}</span>
          {live && (
            <b>
              <Icon name={icons.clock} size="sm" />
              <span className="num">{days(row.hoursInStage)}</span> {nounAfter(days(row.hoursInStage), NOUN.day)}
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
            <span className={`tag ${TONE.late}`}>متأخر</span>
            <span className="sub">
              <span className="num">{days(row.hoursInStage - row.stageLimit)}</span> {nounAfter(days(row.hoursInStage - row.stageLimit), NOUN.day)} بعد تجاوز الحدّ
            </span>
          </div>
        )}
        {!live && row.declineReason && (
          <div className="pc-reason mut trim1" title={row.declineReason}>{row.declineReason}</div>
        )}
      </div>

      <div className="pc-foot">
        <div className="pc-amt">
          <span className="k">{row.amountGranted > 0 ? 'الممنوح' : 'المطلوب'}</span>
          <span className="v">
            <Money sm>{row.amountGranted > 0 ? row.amountGranted : row.amountRequested}</Money>
          </span>
        </div>
        <div className="pc-own">
          {row.owner ? (
            <Person name={row.owner} />
          ) : (
            /* "Unassigned" is a warning, not a person — the tag stays a tag. */
            <Tag tone="warn">بلا مالك</Tag>
          )}
        </div>
      </div>
    </article>
  )
}
