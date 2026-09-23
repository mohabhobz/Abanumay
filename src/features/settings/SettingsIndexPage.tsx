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
                القيم والقواعد التي تُبنى عليها جميع الوحدات ·
                وتضم <Num>{master}</Num> مجموعة بيانات أساسية
                و<Num>{rules}</Num> مجموعة قواعد عمل
              </p>
            </div>
          </header>

          {SETTING_MODULES.map((m) => (
            <Glass key={m.key}>
              <Head
                title={m.label}
                meta={
                  <Link className="btn btn-2 btn-sm" to={m.to}>
                    <Icon name={icons.gear} size="sm" />
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
                      <Tag tone={g.kind === 'master' ? 'mute' : 'warn'}>
                        {g.kind === 'master' ? 'بيانات أساسية' : 'قاعدة عمل'}
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
              <Head title="ما لا تجده هنا" meta={<Tag tone="mute">توضيح</Tag>} />
              <p className="sub">
                المظهر والكثافة واللغة <b>تفضيلات شخصية</b> لا إعدادات نظام ·
                تجدها في{' '}
                <Link className="tlink" to={ROUTES.preferences}>تفضيلات الحساب</Link>.
                أما ما هنا فيغيّر سلوك النظام لجميع المستخدمين.
              </p>
            </Glass>

            {/* ⚠️ القاعدة اللي بتكشف النواقص · مكتوبة عشان اللي جاي
                بعدنا يعرف إزاي يعرف إن في حاجة ناقصة */}
            <Glass>
              <Head title="كيف يُكتشف الإعداد الناقص" meta={<Tag tone="mute">قاعدة</Tag>} />
              <p className="sub">
                كل قائمة منسدلة في أي نموذج = <b>بيانات أساسية</b> لها مكان هنا ·
                فإن وُجدت قائمة مكتوبة في الكود، فهي مجموعة ناقصة في
                الإعدادات لا اختصار مقصود.
              </p>
            </Glass>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
