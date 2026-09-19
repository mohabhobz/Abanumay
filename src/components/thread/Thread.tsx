import { DateText, Empty, Icon, icons } from '@/components/ui'
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

export function Thread({
  messages, entityName, me, why, placeholder, emptyTitle, emptyNote,
}: ThreadProps) {
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
                <div className="msg-h">
                  <span className="msg-by">{m.from === 'entity' ? entityName : m.by}</span>
                  <span className="msg-role">{m.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>
                  <span className="pc-sp" />
                  <DateText>{m.at}</DateText>
                </div>
                <div className="msg-b">{m.body}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty title={emptyTitle} note={emptyNote} />
      )}

      <div className="ask free mt-4">
        <span className="ph">{placeholder}</span>
        <button className="attach" aria-label="إرفاق"><Icon name={icons.clip} /></button>
        <button className="go" aria-label="إرسال"><Icon name={icons.send} /></button>
      </div>
    </>
  )
}
