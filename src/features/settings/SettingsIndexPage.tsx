import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { SETTING_MODULES } from '@/data/mock/settings'

/* ═══════════════════════════════════════════════════════════
   جرد الإعدادات · د-1

   ⚠️ **الصفحة دي مش مكان الإعدادات، هي فهرسها.** كل مجموعة
   بتتظبّط في صفحة موديولها، والصفحة دي بتجاوب سؤالًا واحدًا:
   «إيه اللي محتاج يتظبّط في السيستم ده».

   والسبب إن في مدخلين لنفس الشاشة، وكل واحد لسؤال مختلف:

     زرار في ترويسة الموديول   اللي شغّال دلوقتي، وقايمة ناقصة
                               وقفته: «فين أضيف المدينة دي»
     الصفحة دي                 مسؤول النظام الجاي يظبّط من الأول

   ومحدش منهم بيعمل نسخة تانية من الشاشة · نفس المسار بيتفتح
   من الاتنين.

   ⚠️ **ومفيش مدخل ليها في الريل.** الريل سبع عناصر ومقصود إنه
   سبعة، واللي بيستعمل الشاشة دي واحد من كل عشرين مستخدم ·
   فمدخلها من قايمة الحساب مع التفضيلات.
   ═══════════════════════════════════════════════════════════ */

export default function SettingsIndexPage() {
  const groups = SETTING_MODULES.flatMap((m) => m.groups)
  const master = groups.filter((g) => g.kind === 'master').length
  const rules = groups.length - master

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات النظام')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">إعدادات النظام</h1>
              {/* ⚠️ الرقم ما يجيش بعد `·` على طول · النقطة محايدة
                  اتجاهيًا، فبتلزق بالرقم اللاتيني وتبان كإنها صفر
                  («· 7» بتتقرا «70»). فالكلمة بتفصل بينهم. */}
              <p className="sub mt-1">
                القيم والقواعد اللي كل الموديولات مبنية عليها ·
                عندنا <Num>{master}</Num> مجموعة ماستر داتا
                و<Num>{rules}</Num> مجموعتَي قواعد عمل
              </p>
            </div>
          </header>

          {SETTING_MODULES.map((m) => (
            <Glass key={m.key}>
              <Head
                title={m.label}
                meta={
                  <Link className="btn btn-2 btn-sm" to={m.to}>
                    <Icon name={icons.gear} size={15} />
                    افتح الإعدادات
                  </Link>
                }
              />
              <ul className="cfggrid">
                {m.groups.map((g) => (
                  <li key={g.key}>
                    <span className="cfgg-h">
                      <b>{g.label}</b>
                      <span className="pc-sp" />
                      <Tag tone={g.kind === 'master' ? 'ret' : 'warn'}>
                        {g.kind === 'master' ? 'ماستر داتا' : 'قاعدة عمل'}
                      </Tag>
                    </span>
                    <span className="sub cfgg-w">{g.where}</span>
                    <span className="cfgg-f">
                      <span className="sub">{g.owner}</span>
                      <span className="pc-sp" />
                      {/* «قيمة» مش تزويق · رقم عريان في ركن الكارت
                          بيخلّي القارئ يسأل «أربعة إيه» */}
                      <span className="sub"><b className="num"><Num>{g.count}</Num></b> قيمة</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Glass>
          ))}

          {/* التفرقتان دول في الآخر عن قصد · الصفحة بتفتح على اللي
              المستخدم جاي يعمله، والقواعد بتفسّر بعد ما يشوف */}
          <div className="g2">
            {/* ⚠️ التفضيلات الشخصية **مش** هنا · الثيم والكثافة في
                حساب المستخدم، والخلط بينهم هو اللي بيخلّي حد يدوّر
                على «المدن» في تفضيلاته */}
            <Glass>
              <Head title="وإيه اللي مش هنا" meta={<Tag tone="mute">تفرقة</Tag>} />
              <p className="sub">
                الثيم والكثافة واللغة <b>تفضيلات شخصية</b> لا إعدادات نظام ·
                مكانها في{' '}
                <Link className="tlink" to={ROUTES.preferences}>تفضيلات الحساب</Link>.
                اللي هنا بيغيّر سلوك السيستم لكل المستخدمين.
              </p>
            </Glass>

            {/* ⚠️ القاعدة اللي بتكشف النواقص · مكتوبة عشان اللي جاي
                بعدنا يعرف إزاي يعرف إن في حاجة ناقصة */}
            <Glass>
              <Head title="إزاي نعرف إن في إعداد ناقص" meta={<Tag tone="mute">قاعدة</Tag>} />
              <p className="sub">
                أي قائمة منسدلة في أي فورم = <b>ماستر داتا</b> ليها مكان هنا ·
                فلو لقيت قايمة مكتوبة في الكود، يبقى دي مجموعة ناقصة في
                الإعدادات لا اختصارًا مقصودًا.
              </p>
            </Glass>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
