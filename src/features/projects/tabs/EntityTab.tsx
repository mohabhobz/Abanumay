import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/routes'
import { Glass, Head, Tag, Mono, KV, DateText } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { askData, DATA_ASKS, useEntityFlow } from '@/data/entities/store'
import { entityRows } from '@/data/mock/entities'
import { addWorkingDays } from '@/data/intake/cycle'
import { toast } from '@/data/feedback'
import { DocList } from '@/components/docs'
import type { BankAccount, Entity } from '@/types/domain'

export interface EntityTabProps {
  entity: Entity
  bank: BankAccount
  /** v3 · 2.4.10 · 2.4.11 · moving the project to another entity, and its history · client 24 Oct ·
      they left «بيانات المشروع» for this tab, where the entity is */
  action?: ReactNode
  history?: ReactNode
}

/** The entity's file, documents, and bank account. */
export function EntityTab({ entity: E, bank, action, history }: EntityTabProps) {
  useEntityFlow()
  const { user } = useRole()
  const uploaded = E.docs.filter((d) => d.uploaded).length
  const eid = E.id ?? entityRows.find((x) => x.name === E.name)?.id ?? ''
  const [busy, setBusy] = useState<string | null>(null)
  /* 17 Oct · on the client's comment · «اطلبه من الجهة» did nothing · it now asks the entity for the
     document (an update request with a due date, a notice in its portal and its file's log), says so,
     and the row reads «طُلب» with the date until the entity uploads it */
  const askedOf = (name: string) => DATA_ASKS.find((a) => a.entityId === eid && a.items.includes(name))
  const ask = (name: string) => {
    if (!eid) { toast('تعذّر تحديد الجهة · افتح ملفها وأرسل الطلب منه', 'bad'); return }
    setBusy(name)
    const due = addWorkingDays(new Date().toISOString().slice(0, 10), 5)
    askData([eid], [name], due, 'مستند ناقص في ملف الجهة', user.name)
    toast(`أُرسل طلب «${name}» إلى ${E.name} · الاستحقاق ${due}`)
    setBusy(null)
  }

  return (
    <>
      <Glass>
        <Head title="ملف الجهة" meta={E.type} />
        <KV
          rows={[
            { k: 'اسم الجهة', v: <span className="rowf gp-2">{eid ? <Link className="tlink" to={ROUTES.entity(String(eid))}>{E.name}</Link> : E.name}{action}</span> },
            ...(history ? [{ k: 'تعديلات الجهة', v: history }] : []),
            { k: 'التصنيف', v: E.type },
            { k: 'الجهة المرخِّصة', v: E.licensor },
            { k: 'الإشراف الفني', v: E.supervisor },
            { k: 'المنطقة والمدينة', v: `${E.region} · ${E.city}` },
            { k: 'رقم الترخيص', v: <Mono>{E.licenseNo}</Mono> },
            {
              k: 'نهاية الترخيص',
              v: <><Mono>{E.licenseEnd}</Mono> <span className="sub">{E.licenseEndH}</span></>,
            },
            { k: 'نهاية تكليف المجلس', v: <Mono>{E.boardEnd}</Mono> },
            {
              k: 'التأسيس',
              v: <><Mono>{E.founded}</Mono> <span className="sub">{E.foundedH}</span></>,
            },
            { k: 'المدير التنفيذي', v: `${E.ceo}، ${E.ceoMobile}` },
            { k: 'مدخل البيانات', v: E.dataEntry },
            { k: 'جوال الجهة', v: <Mono>{E.mobile}</Mono> },
            { k: 'البريد', v: <Mono>{E.email}</Mono> },
            { k: 'نوع الحساب', v: E.accountType },
            { k: 'درجة الحوكمة', v: <Tag tone="warn">{E.governance}</Tag> },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="مستندات الجهة" meta={`${uploaded} من ${E.docs.length}`} />
        <DocList
          label="مستندات الجهة وحالتها"
          rows={E.docs.map((d) => ({
            name: d.name,
            uploaded: d.uploaded,
            /* An uploaded item is read from where it is (the file itself is the
               button), and a missing one requests it from the entity — no row without
               an action. */
            action: d.uploaded ? undefined : askedOf(d.name) ? (
              <span className="rowf gp-2">
                <Tag tone="mute">طُلب · <DateText>{askedOf(d.name)!.at.slice(0, 10)}</DateText></Tag>
                <button type="button" className="lnk" onClick={() => ask(d.name)}>ذكّر الجهة</button>
              </span>
            ) : (
              <button type="button" className="lnk" disabled={busy === d.name} onClick={() => ask(d.name)}>اطلبه من الجهة</button>
            ),
          }))}
        />
      </Glass>

      <Glass>
        <Head title="الحساب البنكي" meta="حساب واحد نشط" />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>المصرف</th><th>اسم الحساب</th><th>الآيبان</th><th>الحالة</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{bank.name}</td>
                <td>{bank.account}</td>
                <td><Mono>{bank.iban}</Mono></td>
                <td><Tag tone="ok">{bank.status}</Tag></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Glass>
    </>
  )
}
