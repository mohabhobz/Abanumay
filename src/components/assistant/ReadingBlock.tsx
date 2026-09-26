import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { nf, pct, unitAfter } from '@/lib/format'
import { DateText } from '@/components/ui/primitives'
import { highlight } from './highlight'
import type { Reading } from './reading'

export interface ReadingBlockProps {
  reading: Reading
  /** Currently being written — shows the text truncated with the cursor. */
  typing: boolean
  chars: number
  /** Hasn't reached its turn to be written yet. */
  hidden: boolean
}

/**
 * A single reading.
 * This component is the **only renderer for a reading in the system**: the compact bar above lists,
 * the full context card, and the analysis card all call it. Before this, the analysis card drew its
 * own blocks by hand, so the same information (a process running over time) was written twice in
 * two different forms on the same page.
 */
export function ReadingBlock({ reading: r, typing, chars, hidden }: ReadingBlockProps) {
  if (hidden) return null
  const body = typing ? r.text.slice(0, chars) : highlight(r.text, r.bold, r.danger)

  return (
    <div className={`qr-item${r.kind === 'flag' ? ' flag' : ''}${typing ? ' typing' : ''}`}>
      {r.label && (
        <div className="qr-lbl">
          <span className={`itag${r.kind === 'flag' ? ' no' : ''}`}>{r.label}</span>
        </div>
      )}

      {/* The number leads the line rather than sitting above it: a large number used to carry more
          weight than the sentence itself, and the page filled up with red numbers. */}
      <div className="qr-tx">
        {r.metric && (
          <>
            <MetricText m={r.metric} lead />
            {'، '}
          </>
        )}
        {body}
        {typing && <span className="caret" />}
      </div>

      {!typing && (
        <div className="rise">
          {r.bar && (
            <>
              {/* Over the limit: the bar fills completely, with a mark at the limit itself. Without
                  it, a full bar reads as "fine," when it's exactly what's saying "exceeded." */}
              <div className={`bar${r.bar.value > r.bar.limit ? ' over' : ''}`}>
                <i
                  style={{
                    width: `${Math.min(100, (r.bar.value / r.bar.limit) * 100)}%`,
                    background:
                      r.bar.value > r.bar.limit
                        ? undefined
                        : 'linear-gradient(90deg,var(--teal),var(--lime))',
                  }}
                />
                {r.bar.value > r.bar.limit && (
                  <u style={{ insetInlineStart: `${Math.round((r.bar.limit / r.bar.value) * 100)}%` }} />
                )}
              </div>
              <div className="qr-barl">
                <span className="sub">
                  {r.bar.limitLabel} <span className="num">{r.bar.unit === '%' ? pct(r.bar.limit) : nf.format(r.bar.limit)}</span>
                  {r.bar.unit && r.bar.unit !== '%' && ` ${unitAfter(r.bar.limit, r.bar.unit)}`}
                </span>
                <span className="sub">
                  {r.bar.valueLabel} <span className="num">{r.bar.unit === '%' ? pct(r.bar.value) : nf.format(r.bar.value)}</span>
                  {r.bar.unit && r.bar.unit !== '%' && ` ${unitAfter(r.bar.value, r.bar.unit)}`}
                </span>
              </div>
            </>
          )}

          {r.src && <div className="src">المصدر: {r.src}</div>}

          {(r.to || r.actions) && (
            <div className="qr-acts">
              {r.to && (
                <Link className="btn btn-2 btn-sm" to={r.to}>
                  {r.toLabel ?? 'اعرضها'}
                  <Icon name={icons.chevron} size="sm" />
                </Link>
              )}
              {r.actions?.map((a) => (
                <button key={a.label} className={`btn ${a.kind ?? 'btn-2'} btn-sm`} onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One-line glimpse of the most important reading, shown while the card is closed. */
export function ReadingPeek({ reading: r }: { reading: Reading }) {
  return (
    <div className="qr-peek">
      {/* ⚠️ The number stays **outside** `.trim1`, as before — inside it, the bold red ink fails
          contrast against the line text, once measured. */}
      {r.metric && (
        <b className={r.kind === 'flag' ? 'bad' : undefined}>
          {r.metric.date ? <>{r.metric.unit} <DateText>{r.metric.value}</DateText></> : r.metric.value}
        </b>
      )}
      <span className="trim1">
        {r.metric ? `${r.metric.date ? '' : unitAfter(r.metric.value, r.metric.unit)}، ` : ''}
        {r.text}
      </span>
    </div>
  )
}

/**
 * The reading's number with its unit — a **single entry point** for three places (the reading, the
 * glimpse, the closed card). They used to be drawn three different ways, and one of them put the
 * raw date before its sentence.
 */
export function MetricText({ m, lead }: { m: NonNullable<Reading['metric']>; lead?: boolean }) {
  if (m.date) return <>{m.unit} <DateText>{m.value}</DateText></>
  return (
    <>
      <b className={lead ? 'qr-lead num' : 'num'}>{m.value}</b>{' '}
      <span className={lead ? 'qr-unit' : undefined}>{unitAfter(m.value, m.unit)}</span>
    </>
  )
}
