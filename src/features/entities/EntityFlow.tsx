import { Link } from 'react-router-dom'
import { Glass, Icon, icons, Money, Num } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   رحلة الريال في الجهة · **أربع مربّعات بشقّ دائري في الرُّكن**

   المرجع اللي العميل باعته: أربع مربّعات ملوّنة ٢×٢، كل واحد
   مقطوع من الرُّكن اللي ناحية النصّ بربع دايرة بلون الصفحة،
   والأيقونة قاعدة في الشقّ · فالأربع شقوق بيعملوا وردة في النصّ.

   ═══ اللي اتاخد منه، واللي اتغيّر، وليه ═══

   · **التركيب اتاخد كامل**: ٢×٢، الشقّ في الرُّكن الداخلي،
     الأيقونة جوّه الشقّ، عنوان وسطر تحته في كل مربّع.

   · **الألوان اتغيّرت.** المرجع أصفر وتركوازي وكحلي وأحمر، وحبره
     أبيض فوقهم · والأصفر دُه **١٫٧٧:١** مع الأبيض، يعني العنوان
     في المربّع الأول في المرجع نفسه **مش مقروء**. وألوان السيستم
     كمان: `--tone-2` بتدّي ٣٫٦٥ و`--tone-3` ٢٫٤٤ و`--tone-4`
     ١٫٧٧. فالأربعة اتاخدوا من نفس عيلة الهوية (أخضر غامق ←
     تركوازي ← لايم) بقيم **متقاسة**: ١٢٫٢٧ · ٧٫٨٢ · ٤٫٨٨ · ٥٫١٤.

   · **الترتيب مش أربع خطوات.** العلاقة الحقيقية:

         ٠١ إجمالي الممنوح  =  ٠٢ وصل فعلًا  +  ٠٣ تحت الصرف
         ٠٤ ممنوح هذه الدورة =  مقطع زمني من ٠١

     الشبكة ٢×٢ بتقول «أربعة أنداد»، وده مش صح · فالنسبة مكتوبة
     جوّه كل مربّع (`٩٢٪ من الإجمالي`)، والمربّع الأول مكتوب عليه
     إنه **الكلّ** لا واحد من أربعة. الترقيم بيقول ترتيب القراءة
     لا ترتيب الخطوات.
   ═══════════════════════════════════════════════════════════ */

export function EntityFlow({ entity }: { entity: EntityRow }) {
  /* المصروف = الملتزم به ناقص اللي لسه في الطريق. القيمتان في ملف
     الجهة، والفرق بينهما هو الوحيد المحسوب هنا. */
  const total = entity.grantedTotal
  const pending = entity.inDisbursement
  const paid = Math.max(0, total - pending)
  const byEntity = `${ROUTES.projects}?q=${encodeURIComponent(entity.name)}`

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  /* الحالة الفاضية **كارت** لا نصًّا عريانًا على أرضية الصفحة ·
     الشريط بقى بعرض الصفحة، والميش تحته بيغمق في نصّها، فالنصّ
     الرمادي وقع على ٣٫٣٣:١. الكارت بيدّيه أرضية معروفة. */
  if (total <= 0) {
    return (
      <Glass className="esq esq-none">
        <span className="esq-ht">رحلة الريال في هذه الجهة</span>
        <p className="mut">
          ما اتمنحش لها ريال لحدّ دلوقتي · الجهة مسجَّلة ولسّه ما دخلتش دورة صرف.
        </p>
      </Glass>
    )
  }

  /* المربّع الأول هو **الكلّ** فمالوش نسبة · التلاتة الباقية
     نسبتهم منه، والنسبة مكتوبة عشان الشبكة ٢×٢ ما تقولش
     «أربعة أنداد» وهمّ مش كده. */
  const tiles = [
    { k: '01', icon: icons.pay, label: 'إجمالي الممنوح', value: total,
      pct: null, tail: 'كل ما اتمنح لها من أول تسجيلها', to: byEntity },
    { k: '02', icon: icons.check, label: 'وصل فعلًا', value: paid,
      pct: share(paid), tail: 'من الإجمالي', to: ROUTES.payments },
    { k: '03', icon: icons.clock, label: 'تحت الصرف', value: pending,
      pct: share(pending), tail: 'من الإجمالي', to: ROUTES.payments },
    { k: '04', icon: icons.chart, label: 'ممنوح في دورة 2026',
      value: entity.grantedThisYear, pct: share(entity.grantedThisYear),
      tail: 'من الإجمالي · مقطع زمني منه', to: byEntity },
  ]

  return (
    <div className="esq">
      <div className="esq-h">
        <span className="esq-ht">رحلة الريال في هذه الجهة</span>
        <span className="esq-hs mut">
          كل ما اتمنح لها من أول تسجيلها، وفين وصل دلوقتي
        </span>
      </div>

      <div className="esq-g">
        {tiles.map((t) => (
          <Link key={t.k} to={t.to} className="esq-c">
            {/* `.num` على **الأرقام وحدها** · لو نزلت على الخانة،
                `direction:ltr` اللي جوّاها بتقلب `inset-inline-*`
                فالرقم بيروح للركن الغلط ويقع تحت الشقّ */}
            <span className="esq-n"><span className="num">{t.k}</span></span>
            <span className="esq-b">
              <span className="esq-k">{t.label}</span>
              <b className="esq-v"><Money sm>{t.value}</Money></b>
              <span className="esq-s">
                {t.pct === null ? t.tail : <><Num>{t.pct}</Num>% {t.tail}</>}
              </span>
            </span>
            {/* الشقّ · ربع دايرة بلون الصفحة في الرُّكن الداخلي،
                والأيقونة قاعدة جوّاه · ده توقيع المرجع */}
            <span className="esq-cut" aria-hidden="true">
              <Icon name={t.icon} size={20} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
