import { Link } from 'react-router-dom'
import { Icon, icons, Money, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import {
  CLOSE_TONE, closeCycle, closeLate, closeRequirements, closeStageLabel,
  evalApproved, needsComms, reportApproved, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   طلب إغلاق واحد، كقرار.

   ⚠️ **نفس هيكل كارت الخطة والاتفاقية بالحرف** · أربع إجابات
   ثابتة، والغايب بيقول إنه غايب. الدرس اتكرّر مرتين قبل كده:
   الكارت اللي بيبني نفسه من الحالة بيطلع بطول مختلف في كل صفّ
   وزرّاره بيقف في ارتفاع غير جيرانه · فالأربعة دايمًا موجودين.

   الأربعة هنا:
     ١ · التقرير كامل؟          · قاعدة 4 و10
     ٢ · النشر الإعلامي؟        · قاعدة 9 · واللي مش مطلوب فيه
                                  بيقول «ما بينطبقش» لا بيختفي
     ٣ · التقرير معتمد؟         · قاعدة 6 · وده اللي بيفتح التقييم
     ٤ · المتطلبات المالية؟     · قاعدة 8 و18

   ⚠️ **والدورة مكتوبة فوق** · قاعدة 17: دورتان مستقلّتان، يعني
   «عند مدير المنح» بتحصل مرتين وبتعني حاجتين · فالكارت بيقول
   إحنا في أي دورة قبل ما يقول في أي محطة.
   ═══════════════════════════════════════════════════════════ */

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

        {/* ⚠️ **الميزانية الفعلية في مكان المبلغ** · كل كارت في
            السيستم بيحطّ رقمه الأساسي هنا، ورقم الإغلاق الأساسي
            هو اللي اتصرف فعلًا مقابل اللي اتخطّط. */}
        <div className="payq-amt">
          <b>{c.report.budget === null
            ? <span className="sub">بلا ميزانية فعلية</span>
            : <Money sm>{c.report.budget}</Money>}</b>
          <span className="payq-due sub">
            {c.report.beneficiaries === null
              ? 'بلا عدد مستفيدين'
              : <><Num>{c.report.beneficiaries}</Num> مستفيد</>}
          </span>
        </div>
      </header>

      <div className="payq-tags">
        <Tag tone={CLOSE_TONE[c.stage]}>{closeStageLabel(c.stage)}</Tag>
        {evalApproved(c) && c.closedAt
          ? <Tag tone="ok">أُغلق <Mono>{c.closedAt}</Mono></Tag>
          : <span className="sub">في المحطة دي <Num>{days}</Num> يومًا</span>}
        {closeLate(c) && <Tag tone="warn">متأخر عن حدّ المحطة</Tag>}
        {c.versions.length > 1 && <Tag tone="teal">الإصدار <Num>{c.versions.length}</Num></Tag>}
      </div>

      {/* المشروع في السلسلة · قاعدة 16: حالته ما بتتحرّكش أثناء الدورة */}
      <div className="payq-cond">
        <span className="lb">حالة المشروع</span>
        <span>{evalApproved(c) ? 'مشروع مكتمل' : 'تحت التنفيذ · قاعدة 16'}</span>
      </div>

      <ul className="payq-ck">
        <li className={missing.length === 0 ? 'ok' : 'no'}>
          <Icon name={missing.length === 0 ? icons.check : icons.alert} size={13} />
          <span>
            {missing.length === 0
              ? 'التقرير الختامي مكتمل'
              : <>ناقص <Num>{missing.length}</Num> بند · {isolate(missing[0])}</>}
          </span>
          <span className="payq-r">قاعدة <Num>4</Num></span>
        </li>
        {/* ⚠️ قاعدة 9 · «متى كانت مطلوبة» · واللي مش مطلوب فيه
            بيتقال لا بيتشال، وإلا الكارت بقى أقصر من جاره بسطر */}
        <li className={!needsComms(c) || done ? 'ok' : 'ret'}>
          <Icon name={!needsComms(c) || done ? icons.check : icons.clock} size={13} />
          <span>
            {needsComms(c)
              ? (done ? 'الاتصال المؤسسي اعتمد النشر' : 'النشر الإعلامي محتاج مراجعة الاتصال')
              : 'بلا التزام نشر · مراجعة الاتصال ما بتنطبقش'}
          </span>
          <span className="payq-r">قاعدة <Num>9</Num></span>
        </li>
        <li className={done ? 'ok' : 'ret'}>
          <Icon name={done ? icons.check : icons.clock} size={13} />
          <span>
            {done
              ? 'التقرير معتمد من المدير التنفيذي'
              : 'التقييم ما يبدأش قبل اعتماد التنفيذي'}
          </span>
          <span className="payq-r">قاعدة <Num>6</Num></span>
        </li>
        <li className={req.ok ? 'ok' : 'no'}>
          <Icon name={req.ok ? icons.check : icons.alert} size={13} />
          <span>{req.say}</span>
          <span className="payq-r">قاعدة <Num>18</Num></span>
        </li>
      </ul>

      {/* ملاحظة الإعادة · قاعدة 19 بتلزم توضيح سبب الإصدار الجديد */}
      {c.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{isolate(c.note)}</span>
        </div>
      )}

      <footer className="payq-f">
        <span className="payq-when"><Person name={c.owner} /></span>
        <Link className="btn btn-2 btn-sm" to={ROUTES.closing(c.id)}>
          افتح الإغلاق
          <Icon name={icons.chevron} size={14} />
        </Link>
      </footer>
    </article>
  )
}

/** الفرق بين المخطَّط والفعلي في الميزانية · للعرض السريع */
export const budgetSay = (c: CloseRow): string =>
  c.report.budget === null ? '·' : nf.format(c.report.budget)
