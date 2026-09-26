import { Link } from 'react-router-dom'
import { DateText, Icon, Mono, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, NOUN, nounAfter, units, ver } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planPlanned, planSpi,
  planStageLabel, spiSay, waitingReview,
} from '@/data/mock/plans'
import type { PlanRow } from '@/types/domain'
import { PlanBar } from './PlanBar'

/* A single plan, treated as a decision - same structure as the agreement card exactly (`.agrq`).

   Note: one structure for every card, and an absent item states that it's absent.

   This card used to build itself from state: the bar appeared only for an active plan, the schedule
   line appeared with it, the delay line appeared if there was a delay, the note if there was a
   note. So a draft card was three blocks and an active card was six, sitting side by side in the
   same inbox.

   What the client saw: every card in the inbox shaped differently, no way to compare two side by
   side, and the "open plan" button sitting at a different height on every card.

   The fix isn't formatting, it's a content decision: the card answers the same four questions in
   the same order regardless of state, and a question this plan hasn't reached yet is answered "not
   yet" rather than omitted:

     1. Who?         Header - project, entity, plan size
     2. Where?       Status - badge, who it's with, age
     3. How's it going? The bar - or "tracking hasn't started" before approval
     4. What's in it? Three fixed answers: schedule, review, dates

   Absence isn't an answer - same rule the assistant was fixed on (`QuickRead` used to disappear
   when readings were empty).

   Note: the bar carries a marker at the planned point, not a percentage alone. "60% complete" alone
   says nothing: 60 in a project still at its midpoint is excellent, and 60 with a month left is
   late.

   Note: the light layer between accepted and declared is work awaiting review - exactly the gap
   rule 14 exists for. */

/** One answer line - same shape for all three so the eye can compare them. */
function Check({ ok, say, src }: { ok: boolean; say: React.ReactNode; src: React.ReactNode }) {
  return (
    <li className={ok ? 'ok' : 'no'}>
      <Icon name={ok ? icons.check : icons.alert} size="sm" />
      <span>{say}</span>
      <span className="payq-r">{src}</span>
    </li>
  )
}

export function PlanCard({ p }: { p: PlanRow }) {
  const done = planDone(p)
  const claim = planClaimed(p)
  const want = planPlanned(p)
  const spi = planSpi(p)
  const say = spiSay(spi)
  const queue = waitingReview(p).length
  const late = lateActivities(p).length
  const days = Math.round(p.hoursInStage / 24)
  const acts = p.phases.reduce((s, ph) => s + ph.activities.length, 0)
  const change = p.changes.some((c) => c.state === 'waiting')

  /* Note: tracking starts from the baseline, not from opening the plan. Before approval there's no
   "planned as of today" to measure against, so any percentage would be a number with no reference -
   so the bar states it hasn't started yet instead of being removed. */
  const measured = p.baseline > 0

  return (
    <article className="agrq glass">
      {/* -- 1. Who -- */}
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.plan(p.id)}>{p.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{p.id}</Mono>
            <span className="pc-dot" />
            {p.entityName}
            <span className="pc-dot" />
            {/* Note: zero is stated in its own sentence - "0 activities" reads as a number, while "no activities
   yet" says the plan is still empty. */}
            <span className="payq-pay">
              {acts === 0
                ? 'بلا أنشطة'
                : `${units.phase(p.phases.length)} · ${units.activity(acts)}`}
            </span>
          </div>
        </div>
      </header>

      {/* -- 2. Where --
         Note: the badge appears once only. It used to be written in the header corner ("accepted")
         and again below in the tags ("in progress") - two things saying the same thing with
         different words on the same card. */}
      <div className="payq-tags">
        {/* Note: one colored badge per card is the stage - everything else is a neutral badge. */}
        <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>
        {measured
          ? <Tag tone="mute">النسخة المرجعية <Num>{ver(p.baseline)}</Num></Tag>
          : <span className="sub">في هذه المرحلة منذ <Num>{days}</Num> {nounAfter(days, NOUN.day)}</span>}
        {/* Note: "drafted on the entity's behalf" isn't an administrative footnote - the spec states the
   entity is the one who writes it, so anything written on their behalf gets a second look in
   review. */}
        {p.drafter === 'supervisor' && <Tag tone="mute">كتبها المشرف بالنيابة</Tag>}
        {change && <Tag tone="mute">طلب تعديل بانتظار مدير المنح</Tag>}
      </div>

      {/* -- 3. How's it going - the bar is always present --
         The text paragraph that used to sit in the bar's place before approval gave the card a
         different shape - so the track now shows empty and the story is stated underneath, on the
         same line that otherwise carries the percentages. */}
      <PlanBar done={done} claim={claim} want={want} pending={!measured} />

      {/* -- 4. What's in it - three fixed answers in the same order -- */}
      <ul className="payq-ck">
        <Check
          ok={measured ? say.tone === 'ok' : true}
          say={measured
            ? <>{say.say}{spi !== null && <> · أداء الجدول <span className="num">{spi.toFixed(2)}</span></>}</>
            : 'لم يبدأ القياس بعد'}
          src="الجدول"
        />
        <Check
          ok={queue === 0}
          say={queue === 0
            ? 'لا يوجد نشاط بانتظار المراجعة'
            /* Note: the sentence is deliberately short - the line truncates with an ellipsis if it grows (so
   rows keep one consistent height), and a truncated line loses that same information. "Not counted
   in the percentage" is already stated at the source column: "rule 14". */
            : <><Num>{queue}</Num> {nounAfter(queue, NOUN.activity)} بانتظار قبولك</>}
          src={<>قاعدة <Num>14</Num></>}
        />
        <Check
          ok={late === 0}
          say={late === 0
            ? 'لا يوجد نشاط تجاوز موعده'
            : <><Num>{late}</Num> {nounAfter(late, NOUN.activity)} تجاوز موعده</>}
          src="المواعيد"
        />
      </ul>

      {p.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size="sm" />
          <span>{isolate(p.note)}</span>
        </div>
      )}

      {/* Note: one line in the dock, and the button stays in the same place. The dates line used to wrap
   to two lines on approved cards (opened + approved), pushing the dock taller and leaving the
   button at a different height than its neighbors in the same row - which is what the client saw.
   The line now truncates and the button stays fixed. */}
      <footer className="payq-f">
        <span className="sub payq-when">
          فُتحت <DateText>{p.openedAt}</DateText>
          {p.baselineAt && <> · اعتُمدت <DateText>{p.baselineAt}</DateText></>}
        </span>
        <Link to={ROUTES.plan(p.id)} className="btn btn-2 btn-sm">
          افتح الخطة
          <Icon name={icons.chevron} size="sm" />
        </Link>
      </footer>
    </article>
  )
}
