import { Link } from 'react-router-dom'
import { DateText, Icon, Mono, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, pct } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planPlanned, planSpi,
  planStageLabel, spiSay, waitingReview,
} from '@/data/mock/plans'
import type { PlanRow } from '@/types/domain'
import { PlanBar } from './PlanBar'

/* ═══════════════════════════════════════════════════════════
   خطة واحدة، كقرار · نفس بناء كارت الاتفاقية بالحرف (`.agrq`).

   ⚠️ **الشريط فيه علامة عند المخطَّط، لا نسبة وحدها.** «٦٠٪ منجَز»
   لوحدها ما بتقولش حاجة: ٦٠ في مشروع لسه في نصّه ممتازة، و٦٠ في
   مشروع باقي له شهر متأخّرة. العلامة بتحطّ المخطَّط لليوم على نفس
   الشريط، فالفرق بيتشاف من غير ما المستخدم يحسب · نفس فكرة
   `.bar.over` في تحليلات المشروع.

   ⚠️ **والطبقة الفاتحة بين المقبول والمُعلَن هي الشغل المستنّي
   مراجعة.** الجهة شايفاه إنجازًا والمؤسسة لسه لأ · والفرق ده هو
   بالظبط اللي القاعدة 14 موجودة عشانه، فإخفاؤه بيخلّي الكارت
   يقول نص الحقيقة.
   ═══════════════════════════════════════════════════════════ */

export function PlanCard({ p }: { p: PlanRow }) {
  const done = planDone(p)
  const claim = planClaimed(p)
  const want = planPlanned(p)
  const spi = planSpi(p)
  const say = spiSay(spi)
  const queue = waitingReview(p).length
  const late = lateActivities(p).length
  const live = p.stage === 'active' || p.stage === 'done'
  const days = Math.round(p.hoursInStage / 24)
  const acts = p.phases.reduce((s, ph) => s + ph.activities.length, 0)

  return (
    <article className="agrq glass">
      <header className="payq-h">
        <div className="payq-id">
          <Link className="payq-p" to={ROUTES.plan(p.id)}>{p.projectName}</Link>
          <div className="payq-m sub">
            <Mono>{p.id}</Mono>
            <span className="pc-dot" />
            {p.entityName}
            <span className="pc-dot" />
            <span className="payq-pay">
              <Num>{p.phases.length}</Num> مراحل · <Num>{acts}</Num> نشاطًا
            </span>
          </div>
        </div>

        <div className="payq-amt">
          <b>{live ? <>{pct(done)}</> : <span className="sub">·</span>}</b>
          <span className="payq-due sub">
            {live ? 'مقبول' : planStageLabel(p.stage)}
          </span>
        </div>
      </header>

      <div className="payq-tags">
        <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>
        {p.baseline > 0
          ? <Tag tone="teal">النسخة المرجعية V<Num>{p.baseline}</Num></Tag>
          : <span className="sub">في المرحلة <Num>{days}</Num> يومًا</span>}
        {/* ⚠️ «المشرف بالنيابة» مش تفصيلة إدارية · الوثيقة بتقول إن
            الجهة هي اللي بتكتب، فاللي اتكتب عنها بيتراجع بعين تانية */}
        {p.drafter === 'supervisor' && <Tag tone="ret">كتبها المشرف بالنيابة</Tag>}
      </div>

      {live && (
        <>
          <PlanBar done={done} claim={claim} want={want} />
        </>
      )}

      {/* اللي بيمنع أو بيتأخّر · كل واحد بمصدره في الوثيقة */}
      <ul className="payq-ck">
        {live && (
          <li className={say.tone === 'ok' ? 'ok' : 'no'}>
            <Icon name={say.tone === 'ok' ? icons.check : icons.alert} size={13} />
            <span>
              {say.say}
              {spi !== null && <> · أداء الجدول <span className="num">{spi.toFixed(2)}</span></>}
            </span>
            <span className="payq-r">SPI</span>
          </li>
        )}
        <li className={queue === 0 ? 'ok' : 'no'}>
          <Icon name={queue === 0 ? icons.check : icons.alert} size={13} />
          <span>
            {queue === 0
              ? 'مفيش نشاط مستنّي مراجعة'
              : <><Num>{queue}</Num> نشاطًا مستنّي قبولك · مش محسوب في النسبة</>}
          </span>
          <span className="payq-r">قاعدة <Num>14</Num></span>
        </li>
        {late > 0 && (
          <li className="no">
            <Icon name={icons.alert} size={13} />
            <span><Num>{late}</Num> نشاطًا عدّى موعده وما اتقبلش</span>
            <span className="payq-r">V<Num>{p.baseline}</Num></span>
          </li>
        )}
        {p.changes.some((c) => c.state === 'waiting') && (
          <li className="no">
            <Icon name={icons.alert} size={13} />
            <span>طلب تعديل جوهري مستنّي مدير المنح</span>
            <span className="payq-r">قاعدة <Num>21</Num></span>
          </li>
        )}
      </ul>

      {p.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{isolate(p.note)}</span>
        </div>
      )}

      <footer className="payq-f">
        <span className="sub">
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
