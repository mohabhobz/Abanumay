import { useState } from 'react'
import { DateText, Glass, Head, KV, Person, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { isExternal, mayPayee, setPayee, usePayments } from '@/data/payments/store'
import type { PayRequest } from '@/types/domain'

/* v3 · 11.2.10 · 11.4.10 · a project supported through an external party may be paid to a third party ·
   only on a formal document or agreement that justifies it · the actual beneficiary and the reference
   stand on the permit, before the transfer order */
export function PayeeCard({ r }: { r: PayRequest }) {
  usePayments()
  const { role, user } = useRole()
  const [name, setName] = useState('')
  const [ref, setRef] = useState('')
  const [doc, setDoc] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const [edit, setEdit] = useState(false)
  if (!isExternal(r.projectId)) return null
  const may = mayPayee(r, role.key)
  if (!r.payee && !may) return null
  return (
    <Glass>
      <Head title="التحويل لطرف ثالث" meta={r.payee ? <Tag tone="warn">إلى طرف ثالث</Tag> : <Tag tone="mute">إلى الجهة الخارجية</Tag>} />
      {r.payee && !edit ? (
        <KV rows={[
          { k: 'المستفيد الفعلي', v: r.payee.name },
          { k: 'المرجع', v: r.payee.ref },
          { k: 'المستند المبرّر', v: r.payee.doc },
          { k: 'سجّله', v: <><Person name={r.payee.by} /> · <DateText>{r.payee.at}</DateText>{may && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEdit(true); setName(r.payee!.name); setRef(r.payee!.ref); setDoc(r.payee!.doc) }}>عدّل قبل أمر الصرف</button>}</> },
        ]} />
      ) : (
        <div className="regfields">
          <label className="regf"><span className="lb">المستفيد الفعلي</span><span className="fld"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="المستفيد الفعلي" /></span></label>
          <label className="regf"><span className="lb">المرجع</span><span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="مرجع التحويل لطرف ثالث" /></span></label>
          <span className="rowf gp-2">
            <span className="sub">{doc || 'المستند أو الاتفاقية الرسمية المبرّرة'}</span>
            <UploadButton label="المستند المبرّر" onPick={(f) => setDoc(f.name)} />
            <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = setPayee(r.id, { name, ref, doc }, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'التحويل لطرف ثالث' }); if (!out.length) setEdit(false) }}>سجّل في الإذن</button>
          </span>
        </div>
      )}
      {said.ok && <p className="ok-ink cnote" role="status">سُجّل: <b>{said.ok}</b></p>}
      {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

    </Glass>
  )
}
