import { Link } from 'react-router-dom'
import { Money, Num } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   رحلة الريال في الجهة · كروت متداخلة على أرضية بنسبة حقيقية

   المرجع اللي اتبعت كان قالبًا جاهزًا: كروت بيضا متداخلة بأرقام
   كبيرة على أشكال ملوّنة، ومعاها خطوط واصلة ونقط. اللي أخدناه منه
   هو **التركيب**: طبقات متداخلة، ورقم كبير بيرسّي كل كارت، وأرضية
   ملوّنة تحتهم.

   واللي ما أخدناهوش، وليه:

   · **«OPTION 01» بترقيم ما بيقولش حاجة.** الترقيم هنا بيقول
     ترتيبًا حقيقيًّا في رحلة المال، ولو ما كانش فيه ترتيب ما
     بيتكتبش.
   · **الخطوط والنقط الواصلة.** في القالب زينة · العلاقة هنا
     بتتقال بالعرض نفسه: عرض كل جزء = نصيبه من الإجمالي.
   · **الظلال التقيلة.** الظلّ في السيستم ده بيتصرف بالدور، والكارت
     المرفوع واحد بس.

   ═══ والبنية مش أربع خطوات ═══

   الأربع أرقام **مش متتالية**. العلاقة الحقيقية:

       ٠١ إجمالي الممنوح  =  ٠٢ المصروف  +  ٠٣ تحت الصرف
       ٠٤ ممنوح هذه السنة =  مقطع زمني من ٠١

   فلو رسمناهم أربع درجات نازلة، الرسم هيقول إن ٠٣ بعد ٠٢ وأصغر
   منه · وده غلط: هما **جزآن من كلّ** لا خطوتان. الرسم بيقول
   الحقيقة: سطر كامل للكلّ، وتحته سطر واحد متقسّم بنسبتهم، والرابع
   برّه الرحلة بعلامته.
   ═══════════════════════════════════════════════════════════ */

export function EntityFlow({ entity }: { entity: EntityRow }) {
  /* المصروف = الملتزم به ناقص اللي لسه في الطريق. القيمتان في ملف
     الجهة، والفرق بينهما هو الوحيد المحسوب هنا. */
  const total = entity.grantedTotal
  const pending = entity.inDisbursement
  const paid = Math.max(0, total - pending)
  const byEntity = `${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  const paidPct = share(paid)
  const pendPct = share(pending)
  const yearPct = share(entity.grantedThisYear)

  if (total <= 0) {
    return (
      <div className="eflow eflow-none">
        <span className="eflow-t">رحلة الريال في هذه الجهة</span>
        <p className="mut">
          ما اتمنحش لها ريال لحدّ دلوقتي · الجهة مسجَّلة ولسّه ما دخلتش دورة صرف.
        </p>
      </div>
    )
  }

  return (
    <div className="eflow">
      <div className="eflow-h">
        <span className="eflow-t">رحلة الريال في هذه الجهة</span>
        <span className="eflow-s mut">
          كل ما اتمنح لها من أول تسجيلها، وفين وصل دلوقتي
        </span>
      </div>

      {/* ═══ ٠١ · الكلّ ═══
          سطر بعرض كامل: هو المرجع اللي النِّسَب تحته بتتقاس منه */}
      <Link to={byEntity} className="eflow-r eflow-all">
        <span className="eflow-n">01</span>
        <span className="eflow-b">
          <span className="eflow-k">إجمالي الممنوح</span>
          <b className="eflow-v"><Money sm>{total}</Money></b>
        </span>
        <span className="eflow-ground" aria-hidden="true" />
      </Link>

      {/* ═══ ٠٢ و٠٣ · جزآن من الكلّ ═══
          الاتنين في صفّ واحد وعرض كل واحد = نصيبه · فالعين بتقرا
          القسمة من الشكل قبل ما تقرا النسبة مكتوبة. والحدّ الأدنى
          للعرض عشان الجزء الصغير يفضل يتقري لا يختفي. */}
      <div
        className="eflow-split"
        /* `fr` جوّه `calc()` **غير صالحة** · الوحدة مش طول،
           فالتصريح كله بيتلغي والشبكة بترجع عمودًا واحدًا. القيمة
           بتتكتب كاملة من هنا. */
        style={{ '--a': `${paidPct || 1}fr`, '--b': `${pendPct || 1}fr` } as React.CSSProperties}
      >
        <Link to={ROUTES.payments} className="eflow-r eflow-paid">
          <span className="eflow-n">02</span>
          <span className="eflow-b">
            <span className="eflow-k">وصل فعلًا</span>
            <b className="eflow-v"><Money sm>{paid}</Money></b>
            <span className="eflow-m"><Num>{paidPct}</Num>% من الإجمالي</span>
          </span>
          <span className="eflow-ground" aria-hidden="true" />
        </Link>

        <Link to={ROUTES.payments} className="eflow-r eflow-pend now">
          <span className="eflow-n">03</span>
          <span className="eflow-b">
            <span className="eflow-k">تحت الصرف</span>
            <b className="eflow-v"><Money sm>{pending}</Money></b>
            <span className="eflow-m"><Num>{pendPct}</Num>% من الإجمالي</span>
          </span>
          <span className="eflow-ground" aria-hidden="true" />
        </Link>
      </div>

      {/* ═══ ٠٤ · برّه الرحلة ═══
          مقطع زمني من ٠١ لا خطوة بعد ٠٣ · فشكله مختلف ومكتوب جنبه
          إنه مقطع، عشان الترقيم ما يكدبش */}
      <Link to={byEntity} className="eflow-side">
        <span className="eflow-n sm">04</span>
        <span className="eflow-k">ممنوح في دورة <span className="num">2026</span></span>
        <b className="eflow-v"><Money sm>{entity.grantedThisYear}</Money></b>
        <span className="eflow-m">
          <Num>{yearPct}</Num>% من الإجمالي · مقطع زمني من <span className="num">01</span>،
          مش خطوة بعد <span className="num">03</span>
        </span>
      </Link>
    </div>
  )
}
