import { DateText, Icon, Money, Num, Tag, icons } from '@/components/ui'
import {
  ACTIVITY_SAY, ACTIVITY_TONE, TODAY, phaseDone,
} from '@/data/mock/plans'
import { pct } from '@/lib/format'
import type { PlanActivity, PlanPhase } from '@/types/domain'
import { NoteTrail } from '@/components/notes'

/* Phase and activity tree - the plan's core.

   Note: a phase collapses over its activities, while activities stay expanded. This is the opposite
   of our tables' default (grouping starts collapsed), because the question here isn't "how many
   phases" - it's "which activity is pending". A phase whose activities are all accepted collapses
   on its own, since it's genuinely done.

   Note: a late activity is tagged from its date, not its status. An activity can be "in progress"
   with its due date a month past - status says work is happening, and date says that work is late.
   They're two different pieces of information.

   Note: the accept and reject buttons sit on the activity itself, not on the page's action dock.
   The dock takes one decision for the whole document, while review here happens activity by
   activity - a dock-level decision would accept every piece of evidence with one click, and that's
   exactly what rule 14 exists to prevent. */

export interface PhaseTreeProps {
  phases: PlanPhase[]
  /** The plan is approved - before that, activity review doesn't exist at all. */
  live: boolean
  /** The current user is the grants supervisor - only they can accept or reject. */
  canReview: boolean
  /** The entity can update its activity - the entity's own portal. */
  canClaim?: boolean
  open: Set<string>
  onToggle: (id: string) => void
  onAccept?: (actId: string) => void
  onReject?: (actId: string) => void
  onClaim?: (actId: string) => void
  /** Upload evidence - the entity's portal only. */
  onUpload?: (actId: string, kind: string) => void
  /** Comment on an activity - under the name of whoever opened the screen (`me`). */
  onComment?: (actId: string, say: string) => void
  /** Whoever opened the screen - comments are attributed to them. */
  me?: string
  /** The activity the page links to - tagged live. */
  focus?: string
}

const isLate = (a: PlanActivity) => a.state !== 'accepted' && a.to < TODAY

export function PhaseTree({
  phases, live, canReview, canClaim, open, onToggle, onAccept, onReject, onClaim,
  onUpload, focus, onComment, me = '',
}: PhaseTreeProps) {
  return (
    <div className="phtree">
      {phases.map((ph, i) => {
        const done = phaseDone(ph)
        const shut = !open.has(ph.id)
        const queue = ph.activities.filter((a) => a.state === 'claimed').length
        const late = ph.activities.filter(isLate).length

        return (
          <section className="phase" key={ph.id}>
            <button
              type="button"
              className="phase-h"
              aria-expanded={!shut}
              onClick={() => onToggle(ph.id)}
            >
              <Icon name={shut ? icons.chevronDown : icons.chevronUp} size="sm" />
              <span className="phase-n num">{i + 1}</span>
              <span className="phase-t">{ph.name || 'مرحلة بلا اسم'}</span>

              <span className="phase-d sub">
                <DateText>{ph.from}</DateText> ← <DateText>{ph.to}</DateText>
              </span>

              <span className="phase-c"><Money sm>{ph.cost}</Money></span>

              {/* Percentage of the accepted amount alone - rule 14. */}
              <Tag tone={done === 100 ? 'ok' : done > 0 ? 'teal' : 'mute'}>
                {pct(done)}
              </Tag>
              {/* Percentage is the phase's status - both counters are weighted text, not badges. */}
              {queue > 0 && <span className="sub"><b><Num>{queue}</Num></b> بانتظار</span>}
              {late > 0 && <span className="sub"><b><Num>{late}</Num></b> متأخّر</span>}
            </button>

            {!shut && (
              <ul className="acts">
                {ph.activities.length === 0 && (
                  <li className="act">
                    <span className="sub">
                      المرحلة بلا أنشطة · تُقاس المرحلة بأنشطتها، فلا يوجد ما يُراجَع.
                    </span>
                  </li>
                )}
                {ph.activities.map((a) => (
                  <li
                    className={`act${a.id === focus ? ' on' : ''}${isLate(a) ? ' late' : ''}`}
                    key={a.id}
                    id={`act-${a.id}`}
                  >
                    <div className="act-h">
                      <span className="act-t">{a.name}</span>
                      <Tag tone={ACTIVITY_TONE[a.state]}>{ACTIVITY_SAY[a.state]}</Tag>
                      {/* Note: delay is a tag independent of status - "in progress" and "due a month ago" are two
   different pieces of information. */}
                      {/* A neutral badge - the only colored element in the row is status. */}
                      {isLate(a) && <Tag tone="mute">تجاوز موعده</Tag>}
                      <span className="pc-sp" />
                      <span className="sub act-w">
                        الوزن <span className="num">{a.weight}</span>
                      </span>
                    </div>

                    <div className="act-m sub">
                      <DateText>{a.from}</DateText> ← <DateText>{a.to}</DateText>
                      {a.doneAt && <> · قُبِل <DateText>{a.doneAt}</DateText></>}
                    </div>

                    {/* Required evidence against what's uploaded - the check is visible in the row, not hidden behind
   opening the activity. */}
                    <ul className="act-ev">
                      {a.needs.map((need) => {
                        const got = a.evidence.find((e) => e.kind === need)
                        return (
                          <li key={need} className={got ? 'ok' : 'no'}>
                            <Icon name={got ? icons.check : icons.alert} size="sm" />
                            <span>{need}</span>
                            {got
                              ? <span className="sub act-f">{got.fileName}</span>
                              : <span className="sub act-f">لم يُرفع</span>}
                            {/* Note: upload sits next to the specific missing evidence item, not behind one button above. A
   generic "upload attachment" button lets the entity upload a file and pick its type, and picking
   wrong sends the activity back. The button here already knows its type from the row it's in, so
   there's no choice to get wrong. */}
                            {live && canClaim && !got && onUpload && (
                              <button
                                className="btn btn-ghost btn-sm act-up"
                                onClick={() => onUpload(a.id, need)}
                              >
                                <Icon name={icons.upload} size="sm" />
                                ارفع الشاهد
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {/* Note: a log, not a single line. Every note carries its author and time, and the add button opens
   a field under the name of whoever opened the screen. The button appears only on an activity with
   a note or one under review, not on every activity in the tree - a comment button on an activity
   that "hasn't started" has nothing to say. */}
                    <NoteTrail
                      notes={a.notes ?? []}
                      me={me}
                      onAdd={onComment && live
                        && ((a.notes?.length ?? 0) > 0 || a.state === 'claimed' || a.state === 'rejected')
                        ? (say) => onComment(a.id, say)
                        : undefined}
                    />

                    {/* Note: the decision sits on the activity - acceptance is locked if a required piece of evidence is
   missing, and the reason is written in the tooltip. */}
                    {live && canReview && a.state === 'claimed' && (
                      <div className="act-a">
                        {(() => {
                          const missing = a.needs.filter(
                            (n) => !a.evidence.some((e) => e.kind === n),
                          )
                          return (
                            <>
                              <button
                                className="btn btn-p btn-sm"
                                disabled={missing.length > 0}
                                title={missing.length > 0
                                  ? `ينقص: ${missing.join(' · ')}`
                                  : 'يُحتسب إنجازًا من لحظة القبول · قاعدة 14'}
                                onClick={() => onAccept?.(a.id)}
                              >
                                اقبل النشاط
                              </button>
                              <button
                                className="btn btn-2 btn-sm"
                                onClick={() => onReject?.(a.id)}
                              >
                                أعده بملاحظة
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    )}

                    {/* The entity's portal - "done" reads as claimed, not accepted. */}
                    {live && canClaim
                      && (a.state === 'doing' || a.state === 'todo' || a.state === 'rejected') && (
                      <div className="act-a">
                        <button
                          className="btn btn-2 btn-sm"
                          disabled={a.needs.some((n) => !a.evidence.some((e) => e.kind === n))}
                          title={a.needs.some((n) => !a.evidence.some((e) => e.kind === n))
                            ? 'ارفع الشواهد المطلوبة أولًا'
                            : 'يحتسبه المشرف إنجازًا بعد المراجعة'}
                          onClick={() => onClaim?.(a.id)}
                        >
                          أرسل النشاط المكتمل للمراجعة
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
