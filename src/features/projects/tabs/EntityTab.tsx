import { Glass, Head, Tag, Mono, KV } from '@/components/ui'
import { DocDownload, DocFile } from '@/components/docs'
import type { BankAccount, Entity } from '@/types/domain'

export interface EntityTabProps {
  entity: Entity
  bank: BankAccount
}

/** ملف الجهة ومستنداتها وحسابها البنكي */
export function EntityTab({ entity: E, bank }: EntityTabProps) {
  const uploaded = E.docs.filter((d) => d.uploaded).length

  return (
    <>
      <Glass>
        <Head title="ملف الجهة" meta={E.type} />
        <KV
          rows={[
            { k: 'اسم الجهة', v: E.name },
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
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>المستند</th><th>الحالة</th><th className="n">إجراء</th></tr>
            </thead>
            <tbody>
              {E.docs.map((d) => (
                <tr key={d.name} className={d.uploaded ? '' : 'off'}>
                  <td>
                    {d.uploaded ? <DocFile name={d.name} download={false} /> : <span className="nmc sub">{d.name}</span>}
                  </td>
                  <td>
                    <span className="dstat">
                      {d.uploaded ? <Tag tone="ok">مرفوع</Tag> : <Tag tone="warn">ناقص</Tag>}
                      {d.uploaded && <DocDownload name={d.name} />}
                    </span>
                  </td>
                  <td className="n">
                    {/* المرفوع يتقرا من مكانه (الملف نفسه زرار)، والناقص
                        يتطلب من الجهة · مفيش صف بلا إجراء */}
                    {d.uploaded ? (
                      <span className="sub"> </span>
                    ) : (
                      <span className="rowf" style={{ justifyContent: 'flex-end' }}>
                        <button className="lnk">اطلبه من الجهة</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          خمسة مستندات ناقصة، منها تقرير الحوكمة وتقرير المراجع القانوني، وهي المدخلات التي
          تُبنى عليها درجة الحوكمة.
        </div>
      </Glass>

      <Glass>
        <Head title="الحساب البنكي" meta="حساب واحد مفعّل" />
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
