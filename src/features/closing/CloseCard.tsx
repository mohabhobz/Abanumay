import { Link } from 'react-router-dom'
import { DateText, Icon, icons, Money, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, MISSING_ITEM, nf, NOUN, nounAfter } from '@/lib/format'
import {
  CLOSE_TONE, closeCycle, closeLate, closeRequirements, closeStageLabel,
  evalApproved, needsComms, reportApproved, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'

/* One closing request, as a decision.

   Note: same card structure as the plan and agreement cards, exactly - four fixed answers, and an
   absent one states that it's absent. This lesson has repeated twice already: a card that builds
   its own length from state ends up a different height per row, with its button landing at a
   different level than its neighbors - so all four are always present.

   The four here:
   1. Report complete? - rules 4 and 10
   2. Media coverage? - rule 9, and where it isn't required it says "not applicable" rather than disappearing
   3. Report approved? - rule 6, and this is what opens the evaluation
   4. Financial requirements? - rules 8 and 18

   Note: the cycle is stated above - rule 17: two independent cycles, meaning "with the grants
   manager" happens twice and means two different things - so the card states which cycle we're in
   before it states which stage. */

const CYCLE_SAY = { report: 'التقرير الختامي', eval: 'تقييم المشروع' } as const

export function CloseCard({ c }: { c: CloseRow }) {
  const days = Math.round(c.hoursInStage / 24)
  const missing = reportBlockers(c)
  const req = closeRequirements(c)
  const done = reportApproved(c)

  return (
    <article className="agrq glass">
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.closing(c.id)}>{c.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{c.id}</Mono>
            <span className="pc-dot" />
            {c.entityName}
            <span className="pc-dot" />
            <span className="payq-pay">{CYCLE_SAY[closeCycle(c)]}</span>
          </div>
        </div>

        {/* Note: actual spending sits where the amount normally sits - every card in the system puts its
   headline figure there, and the headline figure at closing is what was actually spent against what
   was planned. */}
        <div className="payq-amt">
          <b>{c.report.budget === null
            ? <span className="sub">بلا ميزانية فعلية</span>
            : <Money sm>{c.report.budget}</Money>}</b>
          <span className="payq-due sub">
            {c.report.beneficiaries === null
              ? 'بلا عدد مستفيدين'
              : <><Num>{c.report.beneficiaries}</Num> {nounAfter(c.report.beneficiaries, NOUN.beneficiary)}</>}
          </span>
        </div>
      </header>

      <div className="payq-tags">
        {/* One colored tag per card = the stage. Everything else is information with a neutral tag. */}
        <Tag tone={CLOSE_TONE[c.stage]}>{closeStageLabel(c.stage)}</Tag>
        {evalApproved(c) && c.closedAt
          ? <Tag tone="mute">أُغلق <DateText>{c.closedAt}</DateText></Tag>
          : <span className="sub">في هذه المحطة منذ <Num>{days}</Num> {nounAfter(days, NOUN.day)}</span>}
        {closeLate(c) && <Tag tone="mute">تجاوز مهلة المحطة</Tag>}
        {c.versions.length > 1 && <Tag tone="mute">الإصدار <Num>{c.versions.length}</Num></Tag>}
      </div>

      {/* The project in the chain - rule 16: its status doesn't move during the cycle. */}
      <div className="payq-cond">
        <span className="lb">حالة المشروع</span>
        <span>{evalApproved(c) ? 'مشروع مكتمل' : 'تحت التنفيذ · قاعدة 16'}</span>
      </div>

      <ul className="payq-ck">
        <li className={missing.length === 0 ? 'ok' : 'no'}>
          <Icon name={missing.length === 0 ? icons.check : icons.alert} size="sm" />
          <span>
            {missing.length === 0
              ? 'التقرير الختامي مكتمل'
              : <><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)} · {isolate(missing[0])}</>}
          </span>
          <span className="payq-r">قاعدة <Num>4</Num></span>
        </li>
        {/* Rule 9 - "when it was required" - and where it wasn't required, that's stated, not removed, or
   the card ends up a line shorter than its neighbor. */}
        <li className={!needsComms(c) || done ? 'ok' : 'ret'}>
          <Icon name={!needsComms(c) || done ? icons.check : icons.clock} size="sm" />
          <span>
            {needsComms(c)
              ? (done ? 'اعتمد الاتصال المؤسسي النشر' : 'النشر الإعلامي بانتظار مراجعة الاتصال المؤسسي')
              : 'لا التزام بالنشر · مراجعة الاتصال لا تنطبق'}
          </span>
          <span className="payq-r">قاعدة <Num>9</Num></span>
        </li>
        <li className={done ? 'ok' : 'ret'}>
          <Icon name={done ? icons.check : icons.clock} size="sm" />
          <span>
            {done
              ? 'التقرير معتمد من المدير التنفيذي'
              : 'لا يبدأ التقييم قبل اعتماد المدير التنفيذي'}
          </span>
          <span className="payq-r">قاعدة <Num>6</Num></span>
        </li>
        <li className={req.ok ? 'ok' : 'no'}>
          <Icon name={req.ok ? icons.check : icons.alert} size="sm" />
          <span>{req.say}</span>
          <span className="payq-r">قاعدة <Num>18</Num></span>
        </li>
      </ul>

      {/* Return note - rule 19 requires stating the reason for a new version. */}
      {c.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size="sm" />
          <span>{isolate(c.note)}</span>
        </div>
      )}

      <footer className="payq-f">
        <span className="payq-when"><Person name={c.owner} /></span>
        <Link className="btn btn-2 btn-sm" to={ROUTES.closing(c.id)}>
          افتح الإغلاق
          <Icon name={icons.chevron} size="sm" />
        </Link>
      </footer>
    </article>
  )
}

/** Difference between planned and actual budget - for quick viewing. */
export const budgetSay = (c: CloseRow): string =>
  c.report.budget === null ? 'بلا ميزانية فعلية' : nf.format(c.report.budget)
