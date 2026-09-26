import { pct } from '@/lib/format'

/* Plan progress bar - written once.

   This bar appears in the inbox card and the plan page header, and used to be written in both
   places - and when something is written twice, they drift. Same lesson as `useMenu`, `sheetOf`,
   and `ReadingBlock` elsewhere in this system.

   Note: three numbers on one track, and that's the whole idea:

     Declared - what the entity says is done
     Accepted - what the supervisor reviewed and accepted - and this is what counts
     Planned  - what should be done as of today

   "60% complete" alone says nothing: 60 in a project still at its midpoint is excellent, and 60 in
   a project with a month left is late. The marker places "planned" on the same track, so the gap is
   visible without doing the math.

   Note: the two layers are absolutely positioned because `.bar` is flex - in normal flow they'd sit
   side by side, making the bar read as "declared + accepted" summed, when they aren't a sum:
   declared includes accepted, and the gap between them is work still awaiting review (rule 14). */

export interface PlanBarProps {
  /** Accepted - reviewed by the supervisor. */
  done: number
  /** Declared - the entity says it's done. */
  claim: number
  /** Planned as of today - from the baseline. */
  want: number
  /**
   * The plan isn't approved yet - there's no baseline to measure against.
   *
   * Note: the bar states that it's empty rather than being removed. The card used to render the bar
   * for an active plan and swap in a text paragraph for a draft - meaning the inbox had cards with
   * a bar and cards without one, and the eye can't compare the two. The track stays drawn, and the
   * state is stated underneath it.
   */
  pending?: boolean
}

export function PlanBar({ done, claim, want, pending }: PlanBarProps) {
  if (pending) {
    return (
      <>
        <div className="bar over plbar plbar-w" />
        <div className="qr-barl">
          <span className="sub">لم تُعتمد بعد</span>
          <span className="sub">يبدأ القياس بعد اعتماد النسخة المرجعية</span>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="bar over plbar">
        <i className="plbar-c" style={{ width: `${Math.min(100, claim)}%` }} />
        <i className="plbar-d" style={{ width: `${Math.min(100, done)}%` }} />
        {/* The marker only appears when planned is within the track - past 100% means the whole duration has
   elapsed, and a marker on the edge would misstate that. */}
        {want > 0 && want <= 100 && (
          <u style={{ insetInlineStart: `${want}%` }} title="المخطَّط لليوم" />
        )}
      </div>
      <div className="qr-barl">
        <span className="sub">المخطَّط لليوم {pct(want)}</span>
        <span className="sub">
          {claim > done
            ? <>المُعلَن {pct(claim)} · المقبول {pct(done)}</>
            : <>المقبول {pct(done)}</>}
        </span>
      </div>
    </>
  )
}
