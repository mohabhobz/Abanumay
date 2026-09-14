import { Link } from 'react-router-dom'
import { DateText, Icon, Money, Mono, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { payHeat, payStateWho } from '@/data/mock/disbursements'
import type { PayRequest } from '@/types/domain'
import { isolate } from '@/lib/format'

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
  /** المرحلة ظاهرة في الترويسة، فالكارت ما بيكرّرهاش وهو مجمَّع بيها */
  showState?: boolean
}

const HEAT_SAY = { ok: '', late: 'متأخر', stuck: 'متعثر' } as const

export function RequestCard({ r, showState }: RequestCardProps) {
  const heat = payHeat(r)
  const days = Math.round(r.hoursInState / 24)
  const multi = r.sources.length > 1

  /* الكارت بياخد `.glass` زي `.pcard` و`.ecard` — سطح واحد معرّف
     في مكان واحد. وكلاس `hold` اتشال: الحالة بتتقال بالوسم وصفوف
     الفحص وسطر الملاحظة، والشريط الجانبي اللي كان بيرسمها راح. */
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
          {/* rule 5: قيمة الطلب ما تتجاوزش الدفعة المعتمدة · لو ساوتها
              مفيش حاجة تتقال، ولو زادت دي مخالفة لازم تبان */}
          {r.asked !== r.due && (
            <span className="payq-due bad">
              الدفعة المعتمدة <Money sm>{r.due}</Money>
            </span>
          )}
          <span className="payq-due sub">استحقاقها <DateText>{r.dueAt}</DateText></span>
        </div>
      </header>

      <div className="payq-tags">
        {showState && <Tag tone="mute">{payStateWho(r.state)}</Tag>}
        {heat !== 'ok' && (
          <Tag tone={heat === 'stuck' ? 'no' : 'warn'}>
            {HEAT_SAY[heat]} · <Num>{days}</Num> يومًا
          </Tag>
        )}
        {heat === 'ok' && r.state !== 'paid' && (
          <span className="sub">في المرحلة <Num>{days}</Num> يومًا</span>
        )}
        {r.state === 'paid' && r.paidAt && (
          <Tag tone="ok">اتصرفت <DateText>{r.paidAt}</DateText></Tag>
        )}
        {multi && <Tag tone="teal">تمويل من مصدرين</Tag>}
      </div>

      {/* شرط الصرف · rule 6 · وهو السبب اللي الدفعة اتصرفت عليه،
          ومدفون في النظام العامل جوّه ملاحظات إذن الصرف */}
      {r.condition && (
        <div className="payq-cond">
          <span className="lb">شرط الدفعة</span>
          <span>{isolate(r.condition)}</span>
        </div>
      )}

      {/* الشروط اللي بتمنع الانتقال · كل واحدة بقاعدتها، فالمشرف
          يعرف إيه اللي واقف ومين قالها لا «الطلب مرفوض» */}
      <ul className="payq-ck">
        {r.checks.map((c) => (
          <li key={c.rule} className={c.ok ? 'ok' : 'no'}>
            <Icon name={c.ok ? icons.check : icons.alert} size={13} />
            <span>{c.label}</span>
            <span className="payq-r">قاعدة <Num>{c.rule}</Num></span>
          </li>
        ))}
        <li className={r.bank.active ? 'ok' : 'no'}>
          <Icon name={r.bank.active ? icons.check : icons.alert} size={13} />
          <span>{r.bank.name}{r.bank.active ? '' : ' · الحساب معطَّل'}</span>
          <span className="payq-r">الحساب المعتمد</span>
        </li>
      </ul>

      {/* ملاحظة الإعادة · rules 7 و8 بيلزموا توضيح الملاحظات */}
      {r.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{r.note}</span>
        </div>
      )}

      {/* مخرج الذكاء الاصطناعي · خطوة 6، والوسم من rule 20:
          «استرشادية ولا تغني عن اعتماد أصحاب الصلاحية» */}
      {r.ai && (
        <div className="payq-ai">
          <Icon name={icons.spark} size={14} />
          <span>{r.ai}</span>
          <Tag tone="mute">استرشادي</Tag>
        </div>
      )}

      <footer className="payq-f">
        <Person name={r.owner} />
        <span className="pc-sp" />
        {/* الطلب لا المشروع · الكارت بيلخّص القرار وصفحة الطلب
            بتاخده · فالزرار بيكمّل الطريق بدل ما يخرج منه */}
        <Link className="btn btn-2 btn-sm" to={ROUTES.payment(r.id)}>
          افتح الطلب
          <Icon name={icons.chevron} size={14} />
        </Link>
      </footer>
    </article>
  )
}
