import { useState } from 'react'
import { DateField, DateText, Icon, Money, Num, Tag, icons } from '@/components/ui'
import {
  ACTIVITY_SAY, ACTIVITY_TONE, TODAY, phaseDone,
} from '@/data/mock/plans'
import { pct } from '@/lib/format'
import type { PlanActivity, PlanPhase } from '@/types/domain'
import { NoteTrail } from '@/components/notes'
import { isStuck } from '@/data/plans/store'

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
  /** Upload evidence - the entity's portal only · `replace` is the evidence it replaces. */
  onUpload?: (actId: string, kind: string, fileName: string, replace?: string) => void
  /** Remove an uploaded evidence before the activity is submitted (12.2.20) */
  onDrop?: (actId: string, evId: string) => void
  /** Start an activity · «جارٍ» (12.2.13) */
  onStart?: (actId: string) => void
  /** Comment on an activity - under the name of whoever opened the screen (`me`). */
  onComment?: (actId: string, say: string) => void
  /** Whoever opened the screen - comments are attributed to them. */
  me?: string
  /** Batch 6 · the entity saves its activity's own data before acceptance · returns what blocks it */
  onData?: (actId: string, d: { text: string; reached: number | null; doneOn: string }) => string[]
  /** The activity the page links to - tagged live. */
  focus?: string
}

const isLate = (a: PlanActivity) => a.state !== 'accepted' && a.to < TODAY

export function PhaseTree({
  phases, live, canReview, canClaim, open, onToggle, onAccept, onReject, onClaim,
  onUpload, onDrop, onStart, focus, onComment, me = '', onData,
}: PhaseTreeProps) {
  return (
    <div className="phtree">
      {phases.map((ph, i) => {
        const done = phaseDone(ph)
        const shut = !open.has(ph.id)
        const queue = ph.activities.filter((a) => a.state === 'claimed').length
        const late = ph.activities.filter(isLate).length
        const stuck = ph.activities.filter((a) => isStuck(a)).length

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
              {stuck > 0 && <span className="sub"><b><Num>{stuck}</Num></b> متعثّر</span>}
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
                      {/* Note: delay is a tag independent of status - "in progress" and "due a
                          month ago" are two different pieces of information. */}
                      {/* A neutral badge - the only colored element in the row is status. */}
                      {isStuck(a) ? <Tag tone="no">متعثّر</Tag> : isLate(a) && <Tag tone="mute">تجاوز موعده</Tag>}
                      <span className="pc-sp" />
                      <span className="sub act-w">
                        الوزن <span className="num">{a.weight}</span>
                      </span>
                    </div>

                    <div className="act-m sub">
                      <DateText>{a.from}</DateText> ← <DateText>{a.to}</DateText>
                      {a.doneAt && <> · قُبِل <DateText>{a.doneAt}</DateText></>}
                    </div>

                    {/* Required evidence against what's uploaded - the check is visible in the row,
                        not hidden behind opening the activity. */}
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
                            {/* Note: upload sits next to the specific missing evidence item, not
                                behind one button above. A generic "upload attachment" button lets
                                the entity upload a file and pick its type, and picking wrong sends
                                the activity back. The button here already knows its type from the
                                row it's in, so there's no choice to get wrong. */}
                            {/* 12.2.20 · before submission the entity replaces or removes what it uploaded */}
                            {live && canClaim && onUpload && a.state !== 'accepted' && a.state !== 'claimed' && (
                              <label className="btn btn-ghost btn-sm act-up">
                                <Icon name={icons.upload} size="sm" />
                                {got ? 'استبدل' : 'ارفع الشاهد'}
                                <input className="vis-h" type="file" aria-label={`${got ? 'استبدل' : 'ارفع'} ${need} · ${a.name}`} onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) onUpload(a.id, need, f.name, got?.id)
                                  e.target.value = ''
                                }} />
                              </label>
                            )}
                            {live && canClaim && got && onDrop && a.state !== 'accepted' && a.state !== 'claimed' && (
                              <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف ${got.fileName}`} onClick={() => onDrop(a.id, got.id)}>
                                <Icon name={icons.close} size="sm" />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {/* Batch 6 · the activity's own data · the entity writes and edits it until the
                        activity is accepted, and everyone reads it */}
                    <ActData a={a} edit={Boolean(live && canClaim && onData && a.state !== 'accepted' && a.state !== 'claimed')} onSave={(d) => onData?.(a.id, d) ?? []} />

                    {/* Note: a log, not a single line. Every note carries its author and time, and
                        the add button opens a field under the name of whoever opened the screen.
                        The button appears only on an activity with a note or one under review, not
                        on every activity in the tree - a comment button on an activity that "hasn't
                        started" has nothing to say. */}
                    <NoteTrail
                      notes={a.notes ?? []}
                      me={me}
                      onAdd={onComment && live
                        && ((a.notes?.length ?? 0) > 0 || a.state === 'claimed' || a.state === 'rejected')
                        ? (say) => onComment(a.id, say)
                        : undefined}
                    />

                    {/* Note: the decision sits on the activity - acceptance is locked if a required
                        piece of evidence is missing, and the reason is written in the tooltip. */}
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
                                  : /* doc rule 14 */ 'يُحتسب إنجازًا من لحظة القبول'}
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
                        {a.state === 'todo' && onStart && (
                          <button className="btn btn-ghost btn-sm" onClick={() => onStart(a.id)}>ابدأ النشاط</button>
                        )}
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

/** An activity's implementation data · read-only once accepted or under review */
function ActData({ a, edit, onSave }: { a: PlanActivity; edit: boolean; onSave: (d: { text: string; reached: number | null; doneOn: string }) => string[] }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(a.actual?.text ?? '')
  const [reached, setReached] = useState(a.actual?.reached === null || a.actual?.reached === undefined ? '' : String(a.actual.reached))
  const [doneOn, setDoneOn] = useState(a.actual?.doneOn ?? '')
  const [err, setErr] = useState<string[]>([])
  if (!a.actual && !edit) return null
  if (open) {
    return (
      <div className="regfields mt-2">
        <label className="regf">
          <span className="lb">ما نُفّذ</span>
          <span className="fld"><input value={text} onChange={(e) => setText(e.target.value)} aria-label={`ما نُفّذ · ${a.name}`} /></span>
        </label>
        <label className="regf">
          <span className="lb">المستفيدون الفعليون</span>
          <span className="fld"><input inputMode="numeric" value={reached} onChange={(e) => setReached(e.target.value.replace(/[^\d]/g, ''))} aria-label={`المستفيدون الفعليون · ${a.name}`} /></span>
        </label>
        <label className="regf">
          <span className="lb">تاريخ التنفيذ الفعلي</span>
          <DateField value={doneOn} onChange={setDoneOn} label={`تاريخ التنفيذ الفعلي · ${a.name}`} />
        </label>
        {err.length > 0 && <p className="bad">{err.join(' · ')}</p>}
        <div className="rowf gp-2">
          <button type="button" className="btn btn-p btn-sm" onClick={() => {
            const e = onSave({ text, reached: reached ? Number(reached) : null, doneOn })
            setErr(e)
            if (!e.length) setOpen(false)
          }}>احفظ بيانات النشاط</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setErr([]) }}>إلغاء</button>
        </div>
      </div>
    )
  }
  return (
    <div className="act-m sub">
      {a.actual ? (
        <>
          بيانات التنفيذ: {a.actual.text}
          {a.actual.reached !== null && <> · <Num>{a.actual.reached}</Num> مستفيد</>}
          {a.actual.doneOn && <> · <DateText>{a.actual.doneOn}</DateText></>}
        </>
      ) : 'لم تُسجَّل بيانات التنفيذ بعد'}
      {edit && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          <Icon name={icons.edit} size="sm" />{a.actual ? 'عدّل بيانات النشاط' : 'سجّل بيانات النشاط'}
        </button>
      )}
    </div>
  )
}
