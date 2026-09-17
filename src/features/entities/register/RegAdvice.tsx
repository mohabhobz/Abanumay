import { Icon, Num, Tag, icons } from '@/components/ui'
import type { StageAdvice } from '@/data/mock/regPortal'

/* ═══════════════════════════════════════════════════════════
   مساعد أبانمي في نموذج التسجيل · ن-3

   مهاب: «مع كل نكست بيقوله المشاكل اللي عنده فين · لو رفع مرفق
   يقوله إذا كان المرفق ده سليم ولا فيه مشكلة».

   ⚠️ **بيقول لا بيمنع (قاعدة 21).** اللي بيمنع الإرسال هو النواقص
   الإلزامية المحسوبة من الحقول · والكارت ده بيشرحها. لو الكارت
   هو اللي منع، بيبقى المستخدم واقف قدّام **رأي** لا قدّام قاعدة،
   ومحدش يقدر يجادل رأيًا ولا يعرف إزاي يرضيه.

   ⚠️ **والمانع فوق والتطمين تحت.** المستخدم بيقرا أول سطرين
   ويسيب الباقي · فلو «تمام» فوق و«ناقصك حاجة» تحت، بيقفل وهو
   فاكر إنه خلص.

   ⚠️ **والحكم على المستند شكلي، والجملة بتقول كده.** المساعد
   بيقرا اسم الملف وامتداده، ما بيفتحش الورقة · فبيقول «الشكل
   سليم» لا «المستند سليم»، وبيكمّل إن المراجع هو اللي بيقرا.
   الجملة اللي بتوحي بمراجعة ما حصلتش بتخلّي الجهة تبعت وهي
   مطمّنة غلط.
   ═══════════════════════════════════════════════════════════ */

const TONE_ICON = { ok: icons.check, warn: icons.alert, no: icons.alert } as const

export function RegAdvice({ advice, stage }: { advice: StageAdvice; stage: string }) {
  const { blocking, notes } = advice
  const all = [...blocking, ...notes]
  if (all.length === 0) return null

  /* ⚠️ **بلوك على سطح الكارت لا `Glass` جوّه `Glass`.** النسخة
     الأولى كانت كارتًا جوّه كارت · والزجاج المتداخل بيدّي شفافية
     مضاعفة، فالوسم اللي مظبوط على سطح كارت واحد نزل تحت AA في
     الثيم الأخضر (3.42). السيستم مفيهوش «كارت جوّه كارت» أصلًا،
     والسطح ده كان بيتخلق بالغلط لا بقرار. */
  return (
    <section className="rgadv">
      <div className="rgadv-h">
        <b>مساعد أبانمي</b>
        <span className="pc-sp" />
        {blocking.length > 0
          ? <Tag tone="warn"><Num>{blocking.length}</Num> بيمنع الإرسال</Tag>
          : <Tag tone="ok">مفيش مانع في الخطوة دي</Tag>}
      </div>

      <ul className="rgadv-l">
        {all.map((a) => (
          <li key={a.key} className={`rgadv-${a.tone}`}>
            <Icon name={TONE_ICON[a.tone]} size={15} />
            <div className="rgadv-b">
              <span className="rgadv-t">{a.say}</span>
              {a.fix && <span className="sub">{a.fix}</span>}
            </div>
          </li>
        ))}
      </ul>

      <p className="sub cnote">
        كلام المساعد <b>استرشادي</b> · القاعدة <span className="num">21</span>.
        اللي بيمنع الإرسال هو الحقول الإلزامية وحدها، لا رأيه.
        {stage === 'docs' && ' وفحص المرفقات على الملف نفسه لا على محتواه.'}
      </p>
    </section>
  )
}
