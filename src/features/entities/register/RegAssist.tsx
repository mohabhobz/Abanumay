import { Glass, Icon, Num, Tag, icons } from '@/components/ui'
import type { StageAdvice } from '@/data/mock/regPortal'

/* ═══════════════════════════════════════════════════════════
   مساعد أبانمي في رحلة التسجيل · عمود لازق

   مهاب: «يوجّه المستخدم في كل خطوة ويقوله اللي فاضل أوتوماتيك
   لحدّ ما يخلّص الرحلة».

   ⚠️ **الكارت ده بيجمع تلات كروت كانت على الشمال.** «مسار الطلب»
   كان بيعيد الستيبر اللي فوق بشكل تاني · و«ما ينقص قبل الإرسال»
   كان بيعدّ النواقص من غير ما يقول ليه · و«الحساب البنكي» كان
   شرحًا مرجعيًّا مالوش علاقة بالخطوة اللي المستخدم واقف فيها.
   تلاتة بيتكلّموا في نفس السؤال («أنا فين وناقصني إيه») بتلات
   لغات، والمستخدم بيقرا واحدًا ويسيب التانيين.

   ⚠️ **والترتيب هو الرسالة: دلوقتي، وبعدين اللي جاي.** المساعد
   بيبدأ بخطوتك الحالية لأنها اللي تحت إيدك، وبعدين اللي فاضل ·
   وممنوع العكس، لأن قايمة طويلة فوق بتخلّي اللي تحت إيده يضيع.

   ⚠️ **بيقول لا بيمنع (قاعدة 21).** اللي بيمنع الإرسال هو الحقول
   الإلزامية المحسوبة · والكارت ده بيشرحها. لو الكارت هو اللي منع،
   المستخدم بيبقى واقف قدّام **رأي** لا قدّام قاعدة، ومحدش يقدر
   يجادل رأيًا ولا يعرف إزاي يرضيه.

   ⚠️ **والمانع فوق والتطمين تحت.** المستخدم بيقرا أول سطرين
   ويسيب الباقي · فلو «تمام» فوق و«ناقصك حاجة» تحت، بيقفل وهو
   فاكر إنه خلص.

   ⚠️ **والحكم على المستند شكلي، والجملة بتقول كده.** المساعد
   بيقرا اسم الملف وامتداده، ما بيفتحش الورقة · فبيقول «الشكل
   سليم» لا «المستند سليم». الجملة اللي بتوحي بمراجعة ما حصلتش
   بتخلّي الجهة تبعت وهي مطمّنة غلط.
   ═══════════════════════════════════════════════════════════ */

const TONE_ICON = { ok: icons.check, warn: icons.alert, no: icons.alert } as const

export interface RegStep {
  key: string
  label: string
  /** أسماء الحقول الناقصة في الخطوة دي · فاضية يعني تمّت */
  short: string[]
}

export function RegAssist({
  advice, stage, steps, onPick,
}: {
  advice: StageAdvice
  /** مفتاح الخطوة الحالية */
  stage: string
  steps: RegStep[]
  onPick: (key: string) => void
}) {
  const { blocking, notes } = advice
  const now = [...blocking, ...notes]

  const at = steps.findIndex((s) => s.key === stage)
  const done = steps.filter((s) => s.short.length === 0).length
  /* ⚠️ «اللي فاضل» = **الخطوات الناقصة غير اللي إنت فيها** ·
     تكرار الخطوة الحالية تحت اللي فوقها بيخلّي المستخدم يفتكر
     إن في نواقص تانية غير اللي قدّامه. */
  const left = steps.filter((s) => s.key !== stage && s.short.length > 0)
  const over = left.length === 0 && blocking.length === 0

  return (
    <Glass className="rgass">
      <div className="rgass-h">
        <b>مساعد أبانمي</b>
        <span className="pc-sp" />
        <Tag tone={over ? 'ok' : 'warn'}>
          <Num>{done}</Num> من <Num>{steps.length}</Num>
        </Tag>
      </div>

      {/* ⚠️ **ومفيش شريط تقدّم هنا عن قصد.** كتبته وشلته: الستيبر
          اللي فوق بيرسم الست خطوات وحالة كل واحدة، والوسم جنب
          الاسم بيقول «كام من كام» · فالشريط كان بيبقى اللسان
          التالت لنفس الجملة، وده بالظبط اللي التلات كروت اتشالوا
          عشانه. «الاستيبر اللي فوق كفاية». */}
      <div className="aiscroll rgass-s">
        <p className="rgass-k">
          خطوتك دلوقتي · <b>{steps[at]?.label ?? ''}</b>
        </p>

        {now.length === 0 ? (
          <p className="sub cnote rgass-n">
            الخطوة دي مفيهاش مانع · كمّل للّي بعدها.
          </p>
        ) : (
          <ul className="rgadv-l">
            {now.map((a) => (
              <li key={a.key} className={`rgadv-${a.tone}`}>
                <Icon name={TONE_ICON[a.tone]} size={15} />
                <div className="rgadv-b">
                  <span className="rgadv-t">{a.say}</span>
                  {a.fix && <span className="sub">{a.fix}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ⚠️ **دي اللي بتخلّيه «أوتوماتيك لحدّ ما يخلّص».** من
            غيرها المساعد بيتكلّم عن الخطوة اللي قدّامه بس، والجهة
            بتخلّص خطوة وتفتكر إنها خلصت الطلب. */}
        {left.length > 0 && (
          <>
            <p className="rgass-k rgass-k2">
              وفاضل بعدها · <span className="num">{left.length}</span>
            </p>
            <ul className="rgass-l">
              {left.map((s) => (
                <li key={s.key}>
                  {/* الخطوة هنا **رابط فعلًا**: المساعد بيوجّه،
                      والتوجيه اللي ما بينقلكش بيسيبك تدوّر فوق */}
                  <button type="button" className="lnk" onClick={() => onPick(s.key)}>
                    {s.label}
                  </button>
                  <span className="sub"> · {s.short.join(' · ')}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {over && (
          <p className="ok cnote rgass-n">
            خلصت كل الخطوات · تقدر تبعت الطلب من الشريط تحت.
          </p>
        )}

        <p className="sub cnote">
          كلام المساعد <b>استرشادي</b> · القاعدة <span className="num">21</span>.
          اللي بيمنع الإرسال هو الحقول الإلزامية وحدها، لا رأيه.
          {stage === 'docs' && ' وفحص المرفقات على الملف نفسه لا على محتواه.'}
        </p>
      </div>
    </Glass>
  )
}
