import { Link } from 'react-router-dom'
import { DateText, Icon, icons, Money, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf, pct } from '@/lib/format'
import {
  AGR_TONE, agrHeat, agrPaymentsBalance, agrReserveGap, agrStageLabel,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   اتفاقية واحدة، كقرار.

   الكارت بيحمل **اللي بيمنع الانتقال**، زي كارت الصرف بالظبط · لأن
   السؤال اللي المشرف بيفتح الصندوق عشانه هو «إيه اللي واقف وليه»
   لا «فيه كام اتفاقية».

   والحاجتين اللي بتوقفوا الاتفاقية مكتوبين في الوثيقة بالحرف:
     قاعدة 8  · مجموع الدفعات = قيمة المنحة، والنسب = 100%
     خطوة 11 · قيمة الاتفاقية = المبلغ المحجوز في الميزانية
   والتالتة قاعدة 9: نقص في البيانات أو المرفقات بيمنع الاعتماد.

   ⚠️ **هيكل واحد لكل الكروت · والغايب بيقول إنه غايب** (نفس
   القاعدة اللي كارت الخطة اتصلّح عليها). الكارت ده كان بيبني
   نفسه من الحالة: صفّ الوسوم تلات فروع بيقولوا حاجات مختلفة،
   وسطر «النسخة الورقية» بيظهر للورقية وحدها، والملاحظة ومخرج
   الذكاء لو موجودين · فكل كارت في الصندوق طلع بطول مختلف
   ومعلوماته في مكان مختلف، وزرار «افتح الاتفاقية» وقف في ارتفاع
   غير جيرانه.

   دلوقتي: **المرحلة دايمًا مكتوبة**، والعمر جنبها، والأربع
   إجابات كلها موجودة · واللي ما بينطبقش بيقول «ما بينطبقش».

   ⚠️ **والإصدار معروض لما يبقى أكتر من واحد.** قاعدة 24 بتسمح
   بإصدارات متعددة وواحد ساري، وقاعدة 17 بتقول إن أي تعديل بعد
   التوقيع = إصدار جديد ودورة اعتماد كاملة. فالإصدار التاني مش
   تفصيلة، هو **دورة اتلفّت مرتين** — وهو نفسه مصدر المؤشر الرابع.
   ═══════════════════════════════════════════════════════════ */

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
            <Num>{a.payments.length}</Num> دفعات
          </span>
        </div>
      </header>

      {/* ⚠️ **المرحلة أول وسم في كل كارت** · كانت بتظهر بتلات
          صور مختلفة (سخونة · عمر · تاريخ تفعيل) حسب الحالة، فمفيش
          كارتين بيقولوا نفس النوع من المعلومة في نفس المكان. */}
      <div className="payq-tags">
        <Tag tone={AGR_TONE[a.stage]}>{agrStageLabel(a.stage)}</Tag>
        {a.stage === 'active' && a.activeAt
          ? <Tag tone="ok">فُعّلت <DateText>{a.activeAt}</DateText></Tag>
          : <span className="sub">في المرحلة دي <Num>{days}</Num> يومًا</span>}
        {heat !== 'ok' && (
          <Tag tone={heat === 'stuck' ? 'no' : 'warn'}>{HEAT_SAY[heat]}</Tag>
        )}
        {a.version > 1 && <Tag tone="teal">الإصدار <Num>{a.version}</Num></Tag>}
      </div>

      {/* النموذج · قاعدة 4: الإلكترونية بتتبني على نموذج معتمد */}
      <div className="payq-cond">
        <span className="lb">النموذج</span>
        <span>{a.template}</span>
      </div>

      {/* اللي بيمنع الإرسال للاعتماد · كل واحد بمصدره في الوثيقة */}
      <ul className="payq-ck">
        <li className={balance.balanced ? 'ok' : 'no'}>
          <Icon name={balance.balanced ? icons.check : icons.alert} size={13} />
          <span>
            {balance.balanced
              ? 'جدول الدفعات متوازن'
              : <>مجموع الدفعات <Mono>{nf.format(balance.sum)}</Mono> والمنحة <Mono>{nf.format(a.amount)}</Mono></>}
          </span>
          <span className="payq-r">قاعدة <Num>8</Num></span>
        </li>
        <li className={gap === 0 ? 'ok' : 'no'}>
          <Icon name={gap === 0 ? icons.check : icons.alert} size={13} />
          <span>
            {gap === 0
              ? 'مطابقة للمخصص المحجوز'
              : <>فرق عن المحجوز <Mono>{nf.format(Math.abs(gap))}</Mono> ريال</>}
          </span>
          <span className="payq-r">خطوة <Num>11</Num></span>
        </li>
        <li className={a.docs.length > 0 ? 'ok' : 'no'}>
          <Icon name={a.docs.length > 0 ? icons.check : icons.alert} size={13} />
          <span>
            {a.docs.length > 0
              ? <>المرفقات والملاحق · <Num>{a.docs.length}</Num></>
              : 'لا مرفقات · الاعتماد ممنوع'}
          </span>
          <span className="payq-r">قاعدة <Num>9</Num></span>
        </li>
        {/* قاعدة 16 · الورقية لازم تُرفق موقّعة قبل التفعيل.
            ⚠️ والسطر موجود في الكارتين · الإلكترونية بتقول «ما
            بينطبقش» بدل ما السطر يتشال ويخلّي الكارت أقصر من
            جاره بسطر. */}
        <li className={a.kind !== 'ورقية' || a.stage === 'active' ? 'ok' : 'no'}>
          <Icon
            name={a.kind !== 'ورقية' || a.stage === 'active' ? icons.check : icons.alert}
            size={13}
          />
          <span>
            {a.kind !== 'ورقية'
              ? 'إلكترونية · النسخة الورقية ما بتنطبقش'
              : 'النسخة الورقية الموقّعة'}
          </span>
          <span className="payq-r">قاعدة <Num>16</Num></span>
        </li>
      </ul>

      {/* ملاحظة الإعادة · قاعدة 10 بتلزم توضيح السبب */}
      {a.note && (
        <div className="payq-note">
          <Icon name={icons.chat} size={14} />
          <span>{isolate(a.note)}</span>
        </div>
      )}

      {/* مخرج الذكاء الاصطناعي · 9.5 · والوسم من قاعدة 21 */}
      {a.ai && (
        <div className="payq-ai">
          <Icon name={icons.spark} size={14} />
          <span>{a.ai}</span>
          <Tag tone="mute">استرشادي</Tag>
        </div>
      )}

      {/* الرصيف سطر واحد · المالك بياخد الباقي وبيتقصّ والزرار
          ثابت، فالزرار بيقف في نفس الارتفاع في كل كارت */}
      <footer className="payq-f">
        <span className="payq-when"><Person name={a.owner} /></span>
        <Link className="btn btn-2 btn-sm" to={ROUTES.agreement(a.id)}>
          افتح الاتفاقية
          <Icon name={icons.chevron} size={14} />
        </Link>
      </footer>
    </article>
  )
}

/** نسبة اكتمال جدول الدفعات · للعرض السريع في الصندوق */
export const balancePct = (a: AgreementRow): string =>
  pct(Math.round((agrPaymentsBalance(a).sum / a.amount) * 100))
