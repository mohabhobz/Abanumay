import { useState } from 'react'
import { DateText, Icon, icons } from '@/components/ui'
import { Composer } from '@/components/assistant'
import type { ThreadMessage } from '@/data/mock/detail'

/* ═══════════════════════════════════════════════════════════
   المراسلة · **مكتوبة مرة واحدة**.

   ⚠️ الثريد كان مرسومًا جوّه تاب المراسلات في صفحة المشروع، ولمّا
   بوّابة الجهة احتاجت نفس الشيء كان أسهل حاجة إني أنسخه · وده
   اللي بيخلّي حاجتين بيقولوا نفس المعنى بشكلين بعد شهر.

   والقناة دي في النظام العامل **شبه ميتة**: صفر رسائل في ٣٨
   مشروعًا فحصناه، والثريد الوحيد اللي لقيناه كان كله عن سند قبض
   اتعطّل. يعني هي مش قناة تواصل عام · بتتفتح **لما إجراء يقف على
   طرف**. فالكومبوننت بيقول ده صراحةً لمّا يفضى بدل ما يوري صندوق
   شات فاضي.

   ⚠️ **والجهة بتشوف نفسها على اليمين.** `me` بيقول مين الفاتح،
   فرسايله بتتعلّم `mine` · من غيره الجهة بتقرا رسايلها كإنها
   جاية من المؤسسة.
   ═══════════════════════════════════════════════════════════ */

export interface ThreadProps {
  messages: ThreadMessage[]
  /** اسم الجهة · بيتكتب فوق رسايلها */
  entityName: string
  /** مين اللي فاتح الشاشة · بيحدّد ناحية الرسالة */
  me: 'staff' | 'entity'
  /** سبب فتح القناة · بيتقال فوق الثريد */
  why?: string
  /** النصّ البديل في خانة الكتابة */
  placeholder: string
  /** نصّ الفراغ · بيتغيّر حسب الشاشة */
  emptyTitle: string
  emptyNote: string
}

/**
 * القناة وهي فاضية.
 *
 * ⚠️ **نفس بوستر مساعد أبانمي المقفول** (`.aishut-c`): شارة في
 * النص، وعنوان، وسطر بيقول إمتى القناة بتتفتح. الفراغ في السيستم
 * ده **حالة مصمَّمة** لا سطر رمادي · والقناة دي فاضية في أغلب
 * الوقت فعلًا (صفر رسائل في ٣٨ مشروعًا)، يعني ده **المنظر
 * الأساسي** لها لا الاستثناء.
 *
 * ⚠️ **وبلا زرار.** بوستر المساعد زرّاره بيشغّل التحليل فعلًا ·
 * وهنا مفيش حاجة يعملها غير إنه يوجّه لخانة الكتابة اللي تحته
 * على طول. **زرار بيعمل حاجة الخانة بتعملها بنفسها = زرار ما
 * بيعملش حاجة**، والعميل شافه.
 */
function Blank({ title, note }: { title: string; note: string }) {
  return (
    <div className="thread-blank">
      <div className="aishut-c">
        <span className="badge badge-44"><Icon name={icons.chat} size={20} /></span>
        <h2 className="aishut-t">{title}</h2>
        <p className="aishut-p">{note}</p>
      </div>
    </div>
  )
}

export function Thread({
  messages, entityName, me, why, placeholder, emptyTitle, emptyNote,
}: ThreadProps) {
  const [draft, setDraft] = useState('')

  return (
    <>
      {messages.length > 0 ? (
        <>
          {why && (
            <div className="thread-why">
              <Icon name={icons.alert} size={15} />
              <span className="sub">{why}</span>
            </div>
          )}
          <div className="thread">
            {messages.map((m, i) => (
              <div className={`msg ${m.from}${m.from === me ? ' mine' : ''}`} key={`${m.at}-${i}`}>
                {/* ⚠️ **الوقت تحت الاسم لا في آخر الصفّ.** كان
                    متعلّقًا على الطرف التاني من الفقاعة بـ`pc-sp`،
                    فالعين بتقرا اسمًا هنا وتاريخًا هناك ومحتاجة
                    ترجع · وهو تابع للاسم أصلًا. */}
                <div className="msg-h">
                  <span className="msg-by">{m.from === 'entity' ? entityName : m.by}</span>
                  <span className="msg-role">{m.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>
                  <span className="msg-at sub"><DateText>{m.at}</DateText></span>
                </div>
                <div className="msg-b">{m.body}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Blank title={emptyTitle} note={emptyNote} />
      )}

      {/* ⚠️ **خانة الكتابة هي `Composer` بتاعة السيستم** · كانت
          مرسومة هنا بإيدي (`.ask free`): سطر واحد والزرارين على
          الطرف التاني بفراغ نص الكارت بينهم · وده مش شكل الكتابة
          في السيستم ولا اتجاهه. الشكل الواحد: مساحة بتكبر مع
          النصّ والأزرار في صفّ تحتها · وزرار الإرسال بيفضل مقفولًا
          لحدّ ما تكتب، فما بيوعدش بحاجة ما بتحصلش. */}
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => setDraft('')}
        onStop={() => {}}
        busy={false}
        placeholder={placeholder}
      />
    </>
  )
}
