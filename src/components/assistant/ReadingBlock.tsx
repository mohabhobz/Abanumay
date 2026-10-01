import { useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { nf, pct, unitAfter } from '@/lib/format'
import { DateText } from '@/components/ui/primitives'
import { highlight } from './highlight'
import type { Reading, ReadingAction } from './reading'

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
  const here = useLocation()
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
                <Link
                  className="btn btn-2 btn-sm"
                  to={readingHref(r.to, here)}
                  onClick={(e) => rescrollIfSame(e, readingHref(r.to!, here), here)}
                >
                  {r.toLabel ?? 'اعرضها'}
                  <Icon name={icons.chevron} size="sm" />
                </Link>
              )}
              {r.actions && <ReadingActs actions={r.actions} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Here = { pathname: string; search: string; hash: string }

/**
 * Where a reading's link actually goes.
 * A link to the page the user is already on keeps the filters they set and only adds (or replaces)
 * the reading's own: the reading was computed from that filtered slice, so dropping the rest of the
 * scope would open a list that no longer matches its number. Pagination resets, since the slice
 * changes. A link to another page is left as written.
 */
function readingHref(to: string, here: Here): string {
  const url = new URL(to, 'http://x')
  if (url.pathname !== here.pathname) return to
  const merged = new URLSearchParams(here.search)
  merged.delete('page')
  url.searchParams.forEach((val, key) => merged.set(key, val))
  const qs = merged.toString()
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`
}

const sameQuery = (a: string, b: string) => {
  const norm = (s: string) => [...new URLSearchParams(s)].map(([k, v]) => `${k}=${v}`).sort().join('&')
  return norm(a) === norm(b)
}

/**
 * Clicking a reading whose filter is already applied changes nothing in the URL, so the shared
 * hash-scroll hook never fires. Scroll and flash the target here instead, so the click still lands.
 */
function rescrollIfSame(e: MouseEvent, href: string, here: Here) {
  const url = new URL(href, 'http://x')
  if (url.pathname !== here.pathname || !url.hash) return
  if (!sameQuery(url.search, here.search) || url.hash !== here.hash) return
  const el = document.getElementById(decodeURIComponent(url.hash.slice(1)))
  if (!el) return
  e.preventDefault()
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
  el.classList.remove('arrive')
  void el.offsetWidth
  el.classList.add('arrive')
  window.setTimeout(() => el.classList.remove('arrive'), 2400)
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

/**
 * The reading's own actions. Each one does something visible: a reminder is sent and the reading
 * says so; a "record" action opens a short note first and confirms once saved. A button that does
 * nothing on click reads as broken, which is what the client saw on «ذكّر الجهة».
 */
function ReadingActs({ actions }: { actions: ReadingAction[] }) {
  const [done, setDone] = useState<Record<string, true>>({})
  const [writing, setWriting] = useState<ReadingAction | null>(null)
  const [text, setText] = useState('')

  const finish = (a: ReadingAction) => {
    a.onClick?.()
    setDone((d) => ({ ...d, [a.label]: true }))
    setWriting(null)
    setText('')
  }

  return (
    <>
      {actions.map((a) =>
        done[a.label] ? (
          <span key={a.label} className="qr-done sub">
            <Icon name={icons.check} size="sm" className="ok-ink" />
            {a.done ?? 'تم'}
          </span>
        ) : (
          <button
            key={a.label}
            type="button"
            className={`btn ${a.kind ?? 'btn-2'} btn-sm`}
            aria-expanded={a.note ? writing === a : undefined}
            onClick={() => (a.note ? setWriting(writing === a ? null : a) : finish(a))}
          >
            {a.label}
          </button>
        ),
      )}
      {writing && (
        <div className="qr-note">
          <span className="fld">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) finish(writing) }}
              placeholder={writing.note}
              aria-label={writing.note}
            />
          </span>
          <button type="button" className="btn btn-p btn-sm" disabled={!text.trim()} onClick={() => finish(writing)}>
            حفظ
          </button>
        </div>
      )}
    </>
  )
}
