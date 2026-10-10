import { Link } from 'react-router-dom'
import { DateText, Icon, Money, Mono, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { payHeat, payStateWho } from '@/data/mock/disbursements'
import type { PayRequest } from '@/types/domain'
import { isolate, NOUN, nounAfter } from '@/lib/format'

/* ═══════════════════════════════════════════════════════════
   One disbursement request, as a decision

   The live system holds about 72 open disbursement transactions —
   not thousands. At that size a table row is the wrong object: the
   supervisor is not scanning for a pattern, they are taking one
   decision at a time and they need the whole reason in front of
   them. So the card carries everything the document says gates the
   step, each labelled with the rule that demands it.

   The head answers "what and how much". The checks answer "may it
   pass". The AI line answers "what does the analysis say" and is
   marked advisory, because rule 20 says it never substitutes for
   the approver.
   ═══════════════════════════════════════════════════════════ */

export interface RequestCardProps {
  r: PayRequest
  /**
   * The stage is shown in the header, so the card doesn't repeat it since it's already grouped by
   * it.
   */
  showState?: boolean
}

const HEAT_SAY = { ok: '', late: 'متأخر', stuck: 'متعثر' } as const

export function RequestCard({ r, showState }: RequestCardProps) {
  const heat = payHeat(r)
  const days = Math.round(r.hoursInState / 24)
  const multi = r.sources.length > 1

  /* The card takes `.glass` like `.pcard` and `.ecard` - one surface defined in one place. The
     `hold` class was removed: status is conveyed by the badge, the check rows, and the note line -
     the side bar that used to draw it is gone. */
  return (
    <article className="payq glass">
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.project(r.projectId)}>{r.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{r.id}</Mono>
            <span className="pc-dot" />
            {r.entityName}
            <span className="pc-dot" />
            <span className="payq-pay">الدفعة <Num>{r.no}</Num> من <Num>{r.of}</Num></span>
          </div>
        </div>

        <div className="payq-amt">
          <b><Money sm>{r.asked}</Money></b>
          {/* Rule 5: the request amount can't exceed the approved payment - if they're equal
              there's nothing to say, and if it's over, that violation must be visible. */}
          {r.asked !== r.due && (
            <span className="payq-due bad">
              الدفعة المعتمدة <Money sm>{r.due}</Money>
            </span>
          )}
          <span className="payq-due sub">تستحق في <DateText>{r.dueAt}</DateText></span>
        </div>
      </header>

      <div className="payq-tags">
        {showState && <Tag tone="mute">{payStateWho(r.state)}</Tag>}
        {heat !== 'ok' && (
          /* The only colored status in the card - and stalled is amber, not red. */
          <Tag tone="warn">
            {HEAT_SAY[heat]} · <Num>{days}</Num> {nounAfter(days, NOUN.day)}
          </Tag>
        )}
        {heat === 'ok' && r.state !== 'paid' && (
          <span className="sub">في المرحلة <Num>{days}</Num> {nounAfter(days, NOUN.day)}</span>
        )}
        {r.state === 'paid' && r.paidAt && (
          <Tag tone="ok">صُرفت في <DateText>{r.paidAt}</DateText></Tag>
        )}
        {multi && <Tag tone="mute">تمويل من مصدرين</Tag>}
      </div>

      {/* Disbursement condition - rule 6 - the reason the payment was disbursed against, buried in
          the live system inside the disbursement authorization notes. */}
      {r.condition && (
        <div className="payq-cond">
          <span className="lb">شرط الدفعة</span>
          <span>{isolate(r.condition)}</span>
        </div>
      )}

      {/* The conditions blocking progress - each with its rule cited, so the supervisor knows
          what's pending and on whose authority, not just "request rejected". */}
      <ul className="payq-ck">
        {r.checks.map((c) => (
          <li key={c.rule} className={c.ok ? 'ok' : 'no'}>
            <Icon name={c.ok ? icons.check : icons.alert} size="sm" />
            <span>{c.label}</span>
            {/* doc rule c.rule */}
          </li>
        ))}
        <li className={r.bank.active ? 'ok' : 'no'}>
          <Icon name={r.bank.active ? icons.check : icons.alert} size="sm" />
          <span>{r.bank.name}{r.bank.active ? '' : ' · الحساب غير نشط'}</span>
          <span className="payq-r">الحساب المعتمد</span>
        </li>
      </ul>

      {/* Return note - rules 7 and 8 require the notes to be explicit. */}
      {r.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size="sm" />
          <span>{r.note}</span>
        </div>
      )}

      {/* AI-assist output - step 6, tagged per rule 20: "advisory only, does not replace approval
          by those with authority". */}
      {r.ai && (
        <div className="payq-ai">
          <Icon name={icons.spark} size="sm" />
          <span>{r.ai}</span>
          <Tag tone="mute">استرشادي</Tag>
        </div>
      )}

      <footer className="payq-f">
        <Person name={r.owner} />
        <span className="pc-sp" />
        {/* The request, not the project - the card summarizes the decision and the request page
            carries it through, so the button continues the path instead of leaving it. */}
        <Link className="btn btn-2 btn-sm" to={ROUTES.payment(r.id)}>
          افتح الطلب
          <Icon name={icons.chevron} size="sm" />
        </Link>
      </footer>
    </article>
  )
}
