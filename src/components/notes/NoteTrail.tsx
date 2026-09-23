import { useState } from 'react'
import { Icon, Person, Tag, icons } from '@/components/ui'
import { isolate, readDateTime } from '@/lib/format'
import type { ActivityNote } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   سجلّ الملاحظات · **مكتوب مرة واحدة**

   ⚠️ **الملاحظة كانت سطرًا بلا صاحب.** «التقرير بلا كشف مستفيدين»
   جوّه صندوق ملوّن، ومحدش عارف مين كتبها ولا إمتى · والرفض التاني
   كان بيمسح الأول. والعميل طلب حاجتين (٢٢ سبتمبر): الملاحظة
   **تتنسب لصاحبها بوقتها وتاريخها**، و**حد تاني يقدر يضيف عليها**.
   يعني دي محادثة قصيرة على البند، لا لافتة.

   ⚠️ **ومفيش شكل جديد.** كل ملاحظة **فقاعة ثريد المراسلة نفسها**
   (`.thread` و`.msg` · ٢٢ سبتمبر، العميل طلب «كارت شبه الشات»):
   الاسم والوسم في السطر الأول والوقت تحتهم، واللي فاتح الشاشة
   رسايله على الناحية التانية (`mine`)، والجهة بنبرتها (`entity`).
   كانت قايمة `.plchg` مسطّحة، فالسبب والردّ عليه كانوا بيتقروا
   كإنهم سطرين في سجلّ لا كلام بين طرفين.

   ⚠️ **والتعليق باسم اللي فاتح الشاشة، لا اسمًا بيتكتب.** الملاحظة
   اللي صاحبها بيتكتب بإيد حد تاني ما بتتنسبش لحد · فالاسم بييجي
   من الجلسة (`me`)، وتغيير الدور في النموذج بيغيّر صاحب التعليق.
   ═══════════════════════════════════════════════════════════ */

/* الوسم على قرار الرفض وحده · الأسباب المضافة بعده مفهومة من مكانها
   في الثريد، ووسم على كل فقاعة بيكرّر نفس الكلمة لحدّ ما تفقد معناها */
const REJECT = 'سبب الرفض'

export interface NoteTrailProps {
  notes: ActivityNote[]
  /** اللي فاتح الشاشة · التعليق الجديد بيتنسب له */
  me: string
  /** إضافة تعليق · من غيره السجلّ للقراءة بس */
  onAdd?: (say: string) => void
}

export function NoteTrail({ notes, me, onAdd }: NoteTrailProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  if (notes.length === 0 && !onAdd) return null

  const add = () => {
    const say = draft.trim()
    if (!say || !onAdd) return
    onAdd(say)
    setDraft('')
    setOpen(false)
  }

  return (
    <div className="notes">
      {notes.length > 0 && (
        <div className="thread">
          {notes.map((n, i) => (
            <div
              key={`${n.at}-${i}`}
              className={`msg${n.from === 'entity' ? ' entity' : ''}${n.by === me ? ' mine' : ''}`}
            >
              <div className="msg-h">
                <Person name={n.by} quiet={false} />
                {n.kind === 'reject'
                  ? <Tag tone="warn">{REJECT}</Tag>
                  : <span className="msg-role">{n.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>}
                <span className="msg-at sub">{readDateTime(n.at)}</span>
              </div>
              <div className="msg-b">{isolate(n.say)}</div>
            </div>
          ))}
        </div>
      )}

      {onAdd && (open ? (
        <div className="notes-add">
          <label className="regf">
            <span className="lb">السبب · باسم {me}</span>
            <span className="fld">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add()
                  if (e.key === 'Escape') { setOpen(false); setDraft('') }
                }}
                aria-label="نصّ السبب"
                placeholder="مثال: كشف المستفيدين غير مرفق"
              />
            </span>
          </label>
          <div className="act-a">
            <button className="btn btn-p btn-sm" disabled={!draft.trim()} onClick={add}>
              أضف السبب
            </button>
            <button className="btn btn-2 btn-sm" onClick={() => { setOpen(false); setDraft('') }}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        /* ⚠️ **«إضافة سبب» لا «أضف تعليقًا» · ٢٢ سبتمبر.** الكلام
           هنا عن سبب الرفض: المشرف بيضيف سببًا تانيًا، والجهة بتردّ
           عليه · و«تعليق» كانت بتخلّيه يتقري دردشة جانبية مالهاش
           وزن. والاسم بيتقال أول ما الحقل يتفتح («السبب · باسم عمر
           قاسم»)، عشان محدش يفتكر إنه هيكتب اسمه بنفسه. */
        <button className="btn btn-ghost btn-sm notes-open" onClick={() => setOpen(true)}>
          <Icon name={icons.plus} size="sm" />
          إضافة سبب
        </button>
      ))}
    </div>
  )
}
