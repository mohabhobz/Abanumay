import { Link } from 'react-router-dom'
import { DateText, Icon, Mono, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, units } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planPlanned, planSpi,
  planStageLabel, spiSay, waitingReview,
} from '@/data/mock/plans'
import type { PlanRow } from '@/types/domain'
import { PlanBar } from './PlanBar'

/* ═══════════════════════════════════════════════════════════
   خطة واحدة، كقرار · نفس بناء كارت الاتفاقية بالحرف (`.agrq`).

   ⚠️ **هيكل واحد لكل الكروت · والغايب بيقول إنه غايب.**

   الكارت ده كان بيبني نفسه من الحالة: الشريط بيتحطّ لو الخطة
   شغّالة، وسطر الجدول بيتحطّ معاه، وسطر التأخير بيتحطّ لو فيه
   تأخير، والملاحظة لو فيه ملاحظة. يعني كارت المسودة كان **تلات
   بلوكات** وكارت التنفيذ **ستة**، والاتنين جنب بعض في نفس الصندوق.

   النتيجة اللي العميل شافها: صندوق كل كارت فيه بشكل تاني، ومحدش
   يعرف يقارن اتنين ببعض، وزرار «افتح الخطة» بيقف في ارتفاع
   مختلف في كل كارت.

   **والإصلاح مش تنسيق، هو قرار في المحتوى:** الكارت بيجاوب
   **نفس أربع أسئلة** في **نفس الترتيب** مهما كانت الحالة، والسؤال
   اللي الخطة دي لسه ما وصلتش له بيتجاوب «لسه» لا بيتشال:

     ١ · مين؟        الترويسة · المشروع والجهة وحجم الخطة
     ٢ · فين؟        الحالة · الوسم ومين واقف والعمر
     ٣ · ماشية إزاي؟ الشريط · أو «القياس ما بدأش» قبل الاعتماد
     ٤ · فيه إيه؟    تلات إجابات ثابتة: الجدول · المراجعة · المواعيد

   **الغياب مش إجابة** · ودي نفس القاعدة اللي المساعد اتصلّح عليها
   (`QuickRead` كان بيختفي لمّا القراءات تفضى).

   ⚠️ **والشريط فيه علامة عند المخطَّط، لا نسبة وحدها.** «٦٠٪ منجَز»
   لوحدها ما بتقولش حاجة: ٦٠ في مشروع لسه في نصّه ممتازة، و٦٠ في
   مشروع باقي له شهر متأخّرة.

   ⚠️ **والطبقة الفاتحة بين المقبول والمُعلَن هي الشغل المستنّي
   مراجعة** · الفرق ده هو بالظبط اللي القاعدة 14 موجودة عشانه.
   ═══════════════════════════════════════════════════════════ */

/** سطر إجابة واحد · نفس الشكل للتلاتة عشان العين تقارنهم */
function Check({ ok, say, src }: { ok: boolean; say: React.ReactNode; src: React.ReactNode }) {
  return (
    <li className={ok ? 'ok' : 'no'}>
      <Icon name={ok ? icons.check : icons.alert} size={13} />
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

  /* ⚠️ **القياس بيبدأ من النسخة المرجعية لا من فتح الخطة.** قبل
     الاعتماد مفيش «مخطَّط لليوم» يتقاس عليه، فأي نسبة هتبقى رقمًا
     بلا مرجع · فالشريط بيتقال إنه لسه ما بدأش بدل ما يتشال. */
  const measured = p.baseline > 0

  return (
    <article className="agrq glass">
      {/* ── ١ · مين ── */}
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.plan(p.id)}>{p.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{p.id}</Mono>
            <span className="pc-dot" />
            {p.entityName}
            <span className="pc-dot" />
            {/* ⚠️ الصفر بيتقال بجملته · «0 نشاطًا» بتقرا رقمًا،
                و«بلا أنشطة» بتقول إن الخطة لسه فاضية */}
            <span className="payq-pay">
              {acts === 0
                ? 'بلا أنشطة'
                : `${units.phase(p.phases.length)} · ${units.activity(acts)}`}
            </span>
          </div>
        </div>
      </header>

      {/* ── ٢ · فين ──
          ⚠️ **الوسم مرة واحدة بس.** كان مكتوبًا في ركن الترويسة
          («مقبول») وتحت في الوسوم («قيد التنفيذ») · حاجتان بيقولوا
          نفس الحاجة بكلمتين مختلفتين في نفس الكارت. */}
      <div className="payq-tags">
        <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>
        {measured
          ? <Tag tone="teal">النسخة المرجعية V<Num>{p.baseline}</Num></Tag>
          : <span className="sub">في المرحلة دي <Num>{days}</Num> يومًا</span>}
        {/* ⚠️ «المشرف بالنيابة» مش تفصيلة إدارية · الوثيقة بتقول إن
            الجهة هي اللي بتكتب، فاللي اتكتب عنها بيتراجع بعين تانية */}
        {p.drafter === 'supervisor' && <Tag tone="ret">كتبها المشرف بالنيابة</Tag>}
        {change && <Tag tone="warn">طلب تعديل مستنّي مدير المنح</Tag>}
      </div>

      {/* ── ٣ · ماشية إزاي · **الشريط موجود دايمًا** ──
          الفقرة النصّية اللي كانت مكان الشريط قبل الاعتماد كانت
          بتدّي الكارت شكلًا تانيًا · فالمسار بيتعرض فاضي والحكاية
          بتتقال تحته بنفس السطر اللي بيشيل النِسب. */}
      <PlanBar done={done} claim={claim} want={want} pending={!measured} />

      {/* ── ٤ · فيه إيه · تلات إجابات ثابتة بنفس الترتيب ── */}
      <ul className="payq-ck">
        <Check
          ok={measured ? say.tone === 'ok' : true}
          say={measured
            ? <>{say.say}{spi !== null && <> · أداء الجدول <span className="num">{spi.toFixed(2)}</span></>}</>
            : 'لسه ما بدأش القياس'}
          src="الجدول"
        />
        <Check
          ok={queue === 0}
          say={queue === 0
            ? 'مفيش نشاط مستنّي مراجعة'
            /* ⚠️ الجملة قصيرة عن قصد · السطر بيتقصّ بتلات نقط لو
               طال (عشان الصفوف تفضل بارتفاع واحد)، والمقصوص بيضيّع
               المعلومة نفسها. و«مش محسوب في النسبة» مقولة أصلًا في
               عمود المصدر: «قاعدة 14». */
            : <><Num>{queue}</Num> نشاطًا مستنّي قبولك</>}
          src={<>قاعدة <Num>14</Num></>}
        />
        <Check
          ok={late === 0}
          say={late === 0
            ? 'مفيش نشاط عدّى موعده'
            : <><Num>{late}</Num> نشاطًا عدّى موعده</>}
          src="المواعيد"
        />
      </ul>

      {p.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{isolate(p.note)}</span>
        </div>
      )}

      {/* ⚠️ **سطر واحد في الرصيف · والزرار في نفس المكان.** سطر
          التواريخ كان بيلفّ لسطرين في الكروت المعتمدة (فُتحت +
          اعتُمدت)، فالرصيف بيعلا والزرار بيقف في ارتفاع مختلف عن
          جيرانه في نفس الصفّ · وده اللي العميل شافه. السطر بقى
          بيتقصّ والزرار ثابت. */}
      <footer className="payq-f">
        <span className="sub payq-when">
          فُتحت <DateText>{p.openedAt}</DateText>
          {p.baselineAt && <> · اعتُمدت <DateText>{p.baselineAt}</DateText></>}
        </span>
        <Link to={ROUTES.plan(p.id)} className="btn btn-2 btn-sm">
          افتح الخطة
          <Icon name={icons.chevron} size={14} />
        </Link>
      </footer>
    </article>
  )
}
