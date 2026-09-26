import { Link } from 'react-router-dom'
import { DateText, Icon, icons, Money, Mono, Num, Person, Tag, Riyal} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf, NOUN, nounAfter, pct } from '@/lib/format'
import {
  AGR_TONE, agrHeat, agrPaymentsBalance, agrReserveGap, agrStageLabel,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'

/* A single agreement, as a decision.

   The card carries what's blocking the transition, exactly like the disbursement card — because the
   question an officer opens this queue to answer is "what's stuck and why", not "how many
   agreements are there".

   The two things that hold up an agreement are stated explicitly in the spec: the sum of payments
   must equal the grant amount with percentages totaling 100%, and the agreement value must equal
   the amount reserved in the budget. A third rule blocks approval when data or attachments are
   incomplete.

   One structure for every card, and a missing item states that it's missing (the same fix applied
   to the plan card). This card used to build itself from whatever state it had: the tag row
   branched three ways saying different things, a "paper copy" line appeared only for paper
   agreements, and the note and AI output appeared only if present — so every card in the queue
   ended up a different length with information in a different place, and the "open agreement"
   button sat at a different height than its neighbors.

   Now: the stage is always shown, its age next to it, and all four answers are always present —
   whichever doesn't apply says "not applicable".

   The version number is shown once there's more than one. Multiple versions are allowed with one
   active, and any edit after signing means a new version and a full approval cycle. So a second
   version isn't a detail, it's **a cycle repeated twice** — and it's the same source that feeds the
   fourth indicator. */

const HEAT_SAY = { ok: '', late: 'متأخرة', stuck: 'متعثرة' } as const

export function AgreementCard({ a }: { a: AgreementRow }) {
  const heat = agrHeat(a)
  const days = Math.round(a.hoursInStage / 24)
  const balance = agrPaymentsBalance(a)
  const gap = agrReserveGap(a)

  return (
    <article className="agrq glass">
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.agreement(a.id)}>{a.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{a.id}</Mono>
            <span className="pc-dot" />
            {a.entityName}
            <span className="pc-dot" />
            <span className="payq-pay">{a.kind}</span>
          </div>
        </div>

        <div className="payq-amt">
          <b><Money sm>{a.amount}</Money></b>
          <span className="payq-due sub">
            <Num>{a.payments.length}</Num> {nounAfter(a.payments.length, NOUN.payment)}
          </span>
        </div>
      </header>

      {/* The stage is always the first tag on every card · it used to show up in three different forms
   (urgency, age, activation date) depending on status, so no two cards stated the same kind of
   information in the same place. */}
      <div className="payq-tags">
        {/* One colored tag per card = the stage. Everything else is information with a neutral tag. */}
        <Tag tone={AGR_TONE[a.stage]}>{agrStageLabel(a.stage)}</Tag>
        {a.stage === 'active' && a.activeAt
          ? <Tag tone="mute">فُعّلت <DateText>{a.activeAt}</DateText></Tag>
          : <span className="sub">في هذه المرحلة منذ <Num>{days}</Num> {nounAfter(days, NOUN.day)}</span>}
        {heat !== 'ok' && (
          <Tag tone="mute">{HEAT_SAY[heat]}</Tag>
        )}
        {a.version > 1 && <Tag tone="mute">الإصدار <Num>{a.version}</Num></Tag>}
      </div>

      {/* The template · an electronic agreement is built from an approved template */}
      <div className="payq-cond">
        <span className="lb">النموذج</span>
        <span>{a.template}</span>
      </div>

      {/* What blocks sending for approval · each with its own source in the spec */}
      <ul className="payq-ck">
        <li className={balance.balanced ? 'ok' : 'no'}>
          <Icon name={balance.balanced ? icons.check : icons.alert} size="sm" />
          <span>
            {balance.balanced
              ? 'جدول الدفعات متوازن'
              : <>مجموع الدفعات <Mono>{nf.format(balance.sum)}</Mono> وقيمة المنحة <Mono>{nf.format(a.amount)}</Mono></>}
          </span>
          <span className="payq-r">قاعدة <Num>8</Num></span>
        </li>
        <li className={gap === 0 ? 'ok' : 'no'}>
          <Icon name={gap === 0 ? icons.check : icons.alert} size="sm" />
          <span>
            {gap === 0
              ? 'مطابقة للمخصص المحجوز'
              : <>الفرق عن المحجوز <Mono>{nf.format(Math.abs(gap))}</Mono> <Riyal /></>}
          </span>
          <span className="payq-r">خطوة <Num>11</Num></span>
        </li>
        <li className={a.docs.length > 0 ? 'ok' : 'no'}>
          <Icon name={a.docs.length > 0 ? icons.check : icons.alert} size="sm" />
          <span>
            {a.docs.length > 0
              ? <>المرفقات والملاحق · <Num>{a.docs.length}</Num></>
              : 'لا توجد مرفقات · لا يمكن الاعتماد'}
          </span>
          <span className="payq-r">قاعدة <Num>9</Num></span>
        </li>
        {/* A signed paper copy must be attached before activation.
           This line appears on both cards: the electronic one says "not applicable" instead of
           removing the line and leaving its card one line shorter than its neighbor. */}
        <li className={a.kind !== 'ورقية' || a.stage === 'active' ? 'ok' : 'no'}>
          <Icon
            name={a.kind !== 'ورقية' || a.stage === 'active' ? icons.check : icons.alert}
            size="sm"
          />
          <span>
            {a.kind !== 'ورقية'
              ? 'إلكترونية · النسخة الورقية لا تنطبق'
              : 'النسخة الورقية الموقّعة'}
          </span>
          <span className="payq-r">قاعدة <Num>16</Num></span>
        </li>
      </ul>

      {/* Return note · stating the reason is required */}
      {a.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size="sm" />
          <span>{isolate(a.note)}</span>
        </div>
      )}

      {/* AI-generated output, tagged as an assumption */}
      {a.ai && (
        <div className="payq-ai">
          <Icon name={icons.spark} size="sm" />
          <span>{a.ai}</span>
          <Tag tone="mute">استرشادي</Tag>
        </div>
      )}

      {/* The footer is one line: the owner takes the remaining space and gets truncated, and the button
   stays fixed, so the button sits at the same height on every card */}
      <footer className="payq-f">
        <span className="payq-when"><Person name={a.owner} /></span>
        <Link className="btn btn-2 btn-sm" to={ROUTES.agreement(a.id)}>
          افتح الاتفاقية
          <Icon name={icons.chevron} size="sm" />
        </Link>
      </footer>
    </article>
  )
}

/** Payment schedule completion rate · for a quick glance in the queue */
export const balancePct = (a: AgreementRow): string =>
  pct(Math.round((agrPaymentsBalance(a).sum / a.amount) * 100))
