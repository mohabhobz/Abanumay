import { useState } from 'react'
import { DateText, Glass, Head, Num, Person, Select, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { isolate } from '@/lib/format'
import { mayRecordException, recordException, usePayments } from '@/data/payments/store'
import type { PayException, PayRequest } from '@/types/domain'

/* «الموافقات والاستثناءات الخاصة» · 9.1.input-6.

   The document lists them among the inputs of a request: what was approved outside the ordinary
   path is written on the request itself, with its author and date, so finance doesn't receive an
   exception it has to ask about. Two kinds:
   · a special approval · recorded by the supervisor or the grants manager, informational
   · a waiver · the grants manager lifts one unmet check, rule 3 (attachments) or rule 6 (the
     payment's condition) · the agreement in force, the hold and the grant's ceiling (rules 10, 11,
     14) are financial controls and are never waived
   Both close once finance approves the order: what's approved after that is a new request. */

const KIND_SAY: Record<PayException['kind'], string> = { approval: 'موافقة خاصة', waiver: 'استثناء من شرط' }

export function PayExceptions({ request: r }: { request: PayRequest }) {
  usePayments()
  const { role, user } = useRole()
  const [kind, setKind] = useState<PayException['kind']>('approval')
  const [rule, setRule] = useState<string | undefined>()
  const [text, setText] = useState('')
  const [file, setFile] = useState<string | undefined>()
  const [bad, setBad] = useState<string[]>([])
  const list = r.exceptions ?? []
  const may = mayRecordException(r, role.key)
  const unmet = r.checks.filter((c) => !c.ok && (c.rule === 3 || c.rule === 6))
  const kinds: PayException['kind'][] = role.key === 'grants-manager' && unmet.length ? ['approval', 'waiver'] : ['approval']
  if (!may && !list.length) return null

  const submit = () => {
    const out = recordException(r.id, { kind, rule: kind === 'waiver' ? (Number(rule) as 3 | 6) : undefined, text, file }, user.name, role.key)
    setBad(out)
    if (!out.length) { setText(''); setFile(undefined); setRule(undefined); setKind('approval') }
  }

  return (
    <Glass>
      <Head
        title="الموافقات والاستثناءات الخاصة"
        meta={list.length ? <Tag tone="teal"><Num>{list.length}</Num> مسجّل</Tag> : <span className="sub">لا شيء مسجّل</span>}
      />
      {list.length > 0 && (
        <ul className="apv-list">
          {list.map((x) => (
            <li key={x.id}>
              <span className="apv-t">
                <b>{KIND_SAY[x.kind]}</b>{/* doc · x.rule */}
                <span className="sub">{isolate(x.text)}{x.file ? ` · ${x.file}` : ''}</span>
              </span>
              <span className="pc-sp" />
              <Person name={x.by} />
              <span className="sub"><DateText>{x.at}</DateText></span>
            </li>
          ))}
        </ul>
      )}
      {may && (
        <>
          <div className="apv-row mt-3">
            {kinds.length > 1 && (
              <Select
                value={kind}
                all="نوع القيد"
                allowEmpty={false}
                options={kinds.map((k) => ({ value: k, label: KIND_SAY[k] }))}
                onChange={(v) => setKind((v as PayException['kind']) ?? 'approval')}
              />
            )}
            {kind === 'waiver' && (
              <Select
                value={rule}
                all="الشرط المستثنى"
                options={unmet.map((c) => ({ value: String(c.rule), label: c.label /* doc · c.rule */ }))}
                onChange={setRule}
              />
            )}
            <span className="fld">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="نص الموافقة أو الاستثناء ومرجعه · إلزامي" aria-label="نص الموافقة أو الاستثناء" />
            </span>
            <UploadButton label="مرفق الموافقة" onPick={(f) => setFile(f.name)} />
            <button type="button" className="btn btn-2 btn-sm" disabled={!text.trim() || (kind === 'waiver' && !rule)} onClick={submit}>
              سجّل
            </button>
          </div>
          {file && <p className="sub cnote">المرفق: {file}</p>}
          {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
          <p className="sub cnote">
            الاستثناء من شرط صلاحية مدير المنح، ويرفع {/* doc rules 3 · 6 */}شرط اكتمال المستندات أو شرط الدفعة وحدهما · أما سريان الاتفاقية
            والمحجوز وسقف المنحة فضوابط مالية لا تُستثنى. ويُغلق التسجيل باعتماد الإدارة المالية لأمر الصرف.
          </p>
        </>
      )}
    </Glass>
  )
}
