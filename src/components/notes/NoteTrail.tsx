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

   ⚠️ **ومفيش شكل جديد.** القايمة هي `.plchg` · نفس قايمة طلبات
   التعديل الجوهري وسجلّ الإغلاق، اللي كل سطر فيها صاحبه وتاريخه
   فوق نصّه. والاسم بـ`Person` زي أي اسم في السيستم، والحقل `.fld`
   زي أي حقل. اللي اتضاف هنا الربط بس.

   ⚠️ **والتعليق باسم اللي فاتح الشاشة، لا اسمًا بيتكتب.** الملاحظة
   اللي صاحبها بيتكتب بإيد حد تاني ما بتتنسبش لحد · فالاسم بييجي
   من الجلسة (`me`)، وتغيير الدور في النموذج بيغيّر صاحب التعليق.
   ═══════════════════════════════════════════════════════════ */

const KIND = {
  reject: { say: 'سبب الرفض', tone: 'warn' },
  comment: { say: 'تعليق', tone: 'mute' },
} as const

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
        <ul className="plchg">
          {notes.map((n, i) => (
            <li key={`${n.at}-${i}`}>
              <div className="plchg-h">
                <Person name={n.by} quiet={false} />
                <span className="sub">{readDateTime(n.at)}</span>
                <Tag tone={KIND[n.kind].tone}>{KIND[n.kind].say}</Tag>
              </div>
              <p className="plchg-t">{isolate(n.say)}</p>
            </li>
          ))}
        </ul>
      )}

      {onAdd && (open ? (
        <div className="notes-add">
          <label className="regf">
            <span className="lb">تعليق باسم {me}</span>
            <span className="fld">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add()
                  if (e.key === 'Escape') { setOpen(false); setDraft('') }
                }}
                aria-label="نصّ التعليق"
                placeholder="اكتب تعليقك"
              />
            </span>
          </label>
          <div className="act-a">
            <button className="btn btn-p btn-sm" disabled={!draft.trim()} onClick={add}>
              أضف التعليق
            </button>
            <button className="btn btn-2 btn-sm" onClick={() => { setOpen(false); setDraft('') }}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        /* ⚠️ **الاسم بيتقال أول ما الحقل يتفتح** («تعليق باسم عمر
           قاسم») · عشان المستخدم ما يفتكرش إنه هيكتب اسمه بنفسه، أو
           إن التعليق هيطلع بلا اسم زي الملاحظة القديمة. */
        <button className="btn btn-ghost btn-sm notes-open" onClick={() => setOpen(true)}>
          <Icon name={icons.chat} size={14} />
          أضف تعليقًا
        </button>
      ))}
    </div>
  )
}
