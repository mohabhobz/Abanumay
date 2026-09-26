import { useEffect, useRef, useState } from 'react'
import { Glass, Icon, icons } from '@/components/ui'
import { MetricText, ReadingBlock, ReadingPeek } from './ReadingBlock'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import type { Reading } from './reading'
import { AbLeaf } from '@/components/soul'

/**
 * The assistant thinks for a moment before it starts writing, so the reply reads as produced, not
 * retrieved from cache.
 */
const THINK_MS = 900

export interface AnalysisCardProps {
  /** Everything the assistant has said about this entity — the trail and the readings. */
  readings: Reading[]
  onAsk: () => void
  /** "Quick project analysis" / "Quick entity analysis". */
  title?: string
  /** CTA button text — "Analyze project" by default. */
  cta?: string
  /**
   * The message shown when there are no readings.
   * ⚠️ **The card doesn't disappear — it says there's nothing.** It used to return `null`, and on
   * the reports dashboard readings are computed from the **selected period** — so switching periods
   * would remove the whole side column, and the layout would jump between two columns and one.
   * Same issue as `QuickRead` with filters: absence reads as a bug, and "no notes" is an answer.
   */
  empty?: string
  /**
   * Is the "Ask" button shown?
   * ⚠️ **The registration gate has no assistant at all.** The entity registering has no account, so
   * there's no rail, no conversations, no shortcut — and a button that opens something that doesn't
   * exist is worse than no button. The card there is limited to the reading alone.
   */
  ask?: boolean
}

/**
 * Analysis card — the **only place** the assistant talks about the open entity (project or
 * organization).
 * There used to be two: the "project journey" bar above the tabs, and the "project analysis" card
 * in the context column, both saying the same thing in two different phrasings. "87 days into the
 * project review, 132% over the limit" appeared twice on the same screen in two different forms.
 * They were merged here.
 * **On request, not automatic.** The intent: keep the section present, small and unopened by
 * default, and start producing analysis only once the user asks for it. The context column was
 * otherwise taking up the full screen height before the user even read the project itself.
 * Even so, the closed card **shows a glimpse of the most important reading**: the first question a
 * user opens a project for ("where does this stand and what does it need") reads with no click, and
 * the detail is computed on request.
 * After the first run it stays computed: closing and opening it toggles visibility, it doesn't
 * recompute — recomputing every time would be a show, not information.
 * ⚠️ The "reading" delay in this mock stands in for a server call. Once there's a backend, this
 * state becomes real waiting, not a timer.
 */
export function AnalysisCard({
  readings, onAsk, title: heading = 'تحليلات المشروع السريعة', cta, ask = true, empty,
}: AnalysisCardProps) {
  const card = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(card)
  const [thought, setThought] = useState(false)
  /** Requested at least once — stays computed after that. */
  const [armed, setArmed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!armed || !onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [armed, onScreen, thought])

  /* ⚠️ The empty-state reading is built here, not per screen — same as `QuickRead`. */
  const calm: Reading[] = [{
    id: 'ai-calm',
    kind: 'note',
    text: empty ?? 'لا توجد ملاحظات في النطاق الحالي. وسّع النطاق لعرض المزيد.',
  }]
  const list = readings.length > 0 ? readings : calm

  const { block, chars, done } = useTypedBlocks(list.map((r) => r.text), thought)
  const thinking = armed && onScreen && !thought

  const title = (
    <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 'var(--fs-4)' }}>{heading}</div>
  )

  /* -- Closed: a banner mid-card --
     The side column has a single card filling the available height, so the closed state isn't a
     small line above empty space: the spark, title, glimpse, and button sit vertically centered in
     the card. The space that used to be on the side becomes what makes the CTA visible. */
  if (!armed) {
    return (
      <Glass className="aicard aishut" ref={card}>
        <div className="aishut-c">
          <span className="badge badge-44"><AbLeaf className="aispark live" /></span>

          <h2 className="aishut-t">{heading}</h2>

          {/* ⚠️ The "needs attention" tag was removed — the assistant doesn't set status tags; the
              glimpse below states the same thing. */}
          {/* Glimpse of the most important reading: "where does this stand and what does it need"
              is the first question asked, so it reads with no click, and the detail is computed on
              request. */}
          {list[0] && (
            <p className="aishut-p">
              {list[0].metric && (
                <b>
                  <MetricText m={list[0].metric} />{' '}
                </b>
              )}
              {list[0].text}
            </p>
          )}

          {/* An assistant CTA, not a screen CTA: the main action on the project page is "recommend
              approval" in the decision bar. One primary CTA per screen — everything else is
              secondary. */}
          <button className="btn btn-2 aishut-go" onClick={() => { setArmed(true); setOpen(true) }}>
            {cta ?? (heading.includes('الجهة') ? 'حلّل ملف الجهة' : 'حلّل المشروع')}
          </button>
        </div>
      </Glass>
    )
  }

  return (
    <Glass className="aicard aiopen" ref={card}>
      <div className="rowf" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        <span className={`badge badge-30${done ? ' breath' : ''}`}>
          <AbLeaf className="aispark live" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {title}
          <div className="sub">
            {done ? (
              'قراءة آلية · استرشادية غير مُلزِمة'
            ) : (
              <>مساعد أبانمي يقرأ الملف<span className="dots"><i /><i /><i /></span></>
            )}
          </div>
        </div>
        {ask && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
        )}
        <button
          className="aifold"
          aria-expanded={open}
          aria-label={open ? 'إخفاء التحليل' : 'إظهار التحليل'}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size="sm" />
        </button>
      </div>

      {open && thinking && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} />
          <span style={{ width: '78%' }} />
          <span style={{ width: '56%' }} />
        </div>
      )}

      {!open && list[0] && <ReadingPeek reading={list[0]} />}

      {/* Conditional render, not `hidden`: `.qr-list` has padding and borders in the CSS that the
          property doesn't override, so the card would stay open. */}
      {open && (
        <div className="qr-list aiscroll">
          {list.map((r, i) => (
            <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
          ))}
        </div>
      )}
    </Glass>
  )
}
