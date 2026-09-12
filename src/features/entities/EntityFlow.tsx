import { Link } from 'react-router-dom'
import { Glass, Money, Num } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   رحلة الريال في الجهة · **عمود ملوّن وأربع بطاقات متداخلة**

   المرجع اللي العميل باعته: عمود رأسي بلونين في النصّ، وأربع
   بطاقات بيضا متداخلة معاه من أركانه · اتنين كبار واتنين صغار،
   وخطوط رفيعة بنقط بتخرج للحوافّ.

   ═══ اللي اتاخد، واللي اتغيّر ═══

   · **التركيب اتاخد كامل**: العمود بلونين، الأربع بطاقات متداخلة
     معاه، الكبير جنب الصغير، والخطوط والنقط.

   · **الاتجاه اتقلب.** المرجع إنجليزي فالكبار على الشمال. هنا
     القراءة بتبدأ من اليمين، فالبطاقتان الكبيرتان على اليمين ·
     والتخطيط كله بخصائص منطقية فبيتقلب لوحده.

   · **الألوان من السيستم.** المرجع أزرق وبرتقالي · العمود هنا
     بلونَي الرسوم البيانية (`--ch-1` و`--ch-2`)، وهمّ اللي
     بيرسموا كل جراف في السيستم.

   · **الحجم بيقول حاجة.** في المرجع الكبير والصغير زينة. هنا
     الكبيرتان هما الرقمان الكبيران فعلًا (الإجمالي واللي وصل)،
     والصغيرتان الجزء الصغير والمقطع الزمني.

   ═══ والعلاقة مش أربع خطوات ═══

       ٠١ إجمالي الممنوح  =  ٠٢ وصل فعلًا  +  ٠٣ تحت الصرف
       ٠٤ ممنوح هذه الدورة =  مقطع زمني من ٠١

   فالنسبة مكتوبة في كل بطاقة، والأولى مكتوب عليها إنها **الكلّ**
   لا واحدة من أربعة.
   ═══════════════════════════════════════════════════════════ */

export function EntityFlow({ entity }: { entity: EntityRow }) {
  /* المصروف = الملتزم به ناقص اللي لسه في الطريق. القيمتان في ملف
     الجهة، والفرق بينهما هو الوحيد المحسوب هنا. */
  const total = entity.grantedTotal
  const pending = entity.inDisbursement
  const paid = Math.max(0, total - pending)
  const byEntity = `${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  /* الحالة الفاضية كارت له أرضية معروفة · النصّ العريان على الميش
     كان بيقع تحت حدّ التباين */
  if (total <= 0) {
    return (
      <Glass className="ejr ejr-none">
        <span className="ejr-ht">رحلة الريال في هذه الجهة</span>
        <p>ما اتمنحش لها ريال لحدّ دلوقتي · الجهة مسجَّلة ولسّه ما دخلتش دورة صرف.</p>
      </Glass>
    )
  }

  const cards = [
    {
      k: '01', slot: 'الكلّ', big: true,
      label: 'إجمالي الممنوح', value: total, pct: null,
      note: 'من أول تسجيلها', to: byEntity,
    },
    {
      k: '02', slot: 'الجزء الأكبر', big: true,
      label: 'وصل فعلًا', value: paid, pct: share(paid),
      note: 'دفعات اتصرفت', to: ROUTES.payments,
    },
    {
      k: '03', slot: 'الباقي', big: false,
      label: 'تحت الصرف', value: pending, pct: share(pending),
      note: '', to: ROUTES.payments,
    },
    {
      k: '04', slot: 'مقطع زمني', big: false,
      label: 'دورة 2026', value: entity.grantedThisYear, pct: share(entity.grantedThisYear),
      note: '', to: byEntity,
    },
  ]

  return (
    <div className="ejr">
      <div className="ejr-h">
        <span className="ejr-ht">رحلة الريال في هذه الجهة</span>
        <span className="ejr-hs">كل ما اتمنح لها من أول تسجيلها، وفين وصل دلوقتي</span>
      </div>

      <div className="ejr-stage">
        {/* العمود · لونان، الأعلى للكلّ والأسفل لللي وصل منه */}
        <span className="ejr-bar" aria-hidden="true"><i /><i /></span>

        {/* الخطوط والنقط · زينة المرجع، مرسومة في SVG عشان تفضل
            رفيعة على أي مقاس */}
        <svg className="ejr-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M3 20 H15 V7 H43" />
          <path d="M97 28 H86 V13 H63" />
          <path d="M3 76 H17 V92 H41" />
          <path d="M97 84 H88 V97 H61" />
          {/* النقط **مسارات بطول صفر بطرف مدوّر**، مش `circle` ·
              الـ`viewBox` متمطّط (`preserveAspectRatio:none`)
              فالدايرة بتطلع بيضاوية. سُمك الخطّ غير متمطّط
              (`vector-effect`)، فالطرف المدوّر بيفضل دايرة. */}
          <g className="ejr-dot">
            <path d="M3 20 H3" /><path d="M43 7 H43" />
            <path d="M97 28 H97" /><path d="M63 13 H63" />
            <path d="M3 76 H3" /><path d="M41 92 H41" />
            <path d="M97 84 H97" /><path d="M61 97 H61" />
          </g>
        </svg>

        {cards.map((c) => (
          <Link key={c.k} to={c.to} className={`ejr-c ejr-c${c.k}${c.big ? ' big' : ''}`}>
            <span className="ejr-slot">{c.slot}</span>
            <span className="ejr-n"><span className="num">{c.k}</span></span>
            <span className="ejr-t">{c.label}</span>
            <b className="ejr-v"><Money sm>{c.value}</Money></b>
            <span className="ejr-s">
              {c.pct === null
                ? c.note
                : <><Num>{c.pct}</Num>% من الإجمالي{c.note ? ` · ${c.note}` : ''}</>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
