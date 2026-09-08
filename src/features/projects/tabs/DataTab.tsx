import { useState } from 'react'
import {
  Glass, Head, Tag, Num, Mono, KV, Timeline, Stat, Riyal, Icon, icons,
} from '@/components/ui'
import { costPerBeneficiary, nf, pct } from '@/lib/format'
import { FilePreview, type PreviewFile } from '../components/FilePreview'
import type { Project } from '@/types/domain'

export interface DataTabProps {
  project: Project
  entityName: string
  onOpenEntity: () => void
}

/** بيانات المشروع — التعريف والفكرة والمراحل والنطاق والمرفقات */
export function DataTab({ project: P, entityName, onOpenEntity }: DataTabProps) {
  const [preview, setPreview] = useState<PreviewFile | null>(null)
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  const uploaded = P.attachments.filter((a) => a.uploaded).length

  return (
    <>
      <Glass>
        <Head title="التعريف" meta="7 حقول" />
        <KV
          rows={[
            { k: 'الجهة', v: <a onClick={onOpenEntity}>{entityName}</a> },
            { k: 'رقم المشروع', v: <Mono>{P.id}</Mono> },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            {
              k: 'الوسوم',
              v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span>,
            },
          ]}
        />
      </Glass>

      <div className="stats4">
        <Stat
          label="المبلغ المطلوب"
          value={nf.format(P.amountRequested)}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`${pct(100)} من إجمالي المشروع`}
        />
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
          note={<>تبدأ <Mono>{P.startDate}</Mono></>}
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
          note="تقدير الجهة، لم يُراجَع من المشرف"
        />
        <Stat
          label="تكلفة المستفيد"
          value={perBeneficiary}
          unit={<Riyal />}
          note="محسوبة، لمقارنة المشاريع"
        />
      </div>

      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p style={{ fontSize: '.87rem', lineHeight: 1.9, margin: 0 }}>{P.idea}</p>

        <div className="well" style={{ padding: '.9rem 0 0', marginTop: '1rem' }}>
          <div className="lb">الهدف العام</div>
          <div style={{ fontSize: '.86rem', lineHeight: 1.8, marginTop: '.25rem' }}>{P.mainGoal}</div>
        </div>

        <BulletSection title="الأهداف التفصيلية" items={P.goals} />
        <BulletSection title="المخرجات" items={P.outputs} />
        <BulletSection title="المسوغات" items={P.rationale} />
      </Glass>

      <Glass>
        <Head title="مراحل التنفيذ" meta={`${P.phases.length} مراحل · 11 شهرًا`} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: <><b>{ph.name}</b> — {ph.tasks}</>,
            by: <Mono>{ph.months}</Mono>,
          }))}
        />
        <div className="sub" style={{ marginTop: '.9rem' }}>
          في النظام الحالي هذه المراحل نصٌّ حر داخل حقل واحد. هنا كيان له بنود وتواريخ، ويصلح
          لربط دفعات الصرف به.
        </div>
      </Glass>

      <Glass>
        <Head title="النطاق والأثر" meta="مطابقة لنموذج التقديم" />
        <KV
          rows={[
            { k: 'المنطقة والمدينة', v: `${P.region} · ${P.city}` },
            {
              k: 'عدد المستفيدين',
              v: (
                <>
                  <Num>{P.beneficiaries}</Num>{' '}
                  <span className="sub">
                    (الفعلي من المشرف: <Num>{P.beneficiariesVerified}</Num>)
                  </span>
                </>
              ),
            },
            {
              k: 'الفئة المستهدفة',
              v: (
                <div className="chips" style={{ gap: '.35rem' }}>
                  {P.audiences.map((a) => (
                    <span
                      className="chip"
                      key={a}
                      style={{ fontSize: '.72rem', padding: '.28rem .65rem' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
        />

        <div className="hd" style={{ marginTop: '1.3rem', marginBottom: '.6rem' }}>
          <h3 style={{ fontSize: '.9rem' }}>الامتثال</h3>
          <span className="meta">3 إقرارات</span>
        </div>
        <div className="g3" style={{ gap: '.6rem' }}>
          {P.compliance.map((c) => (
            <div className="well" key={c.k} style={{ padding: '.75rem 0 0' }}>
              <div className="lb">{c.k}</div>
              <div
                style={{
                  fontSize: '.9rem',
                  fontFamily: 'var(--fd)',
                  fontWeight: 600,
                  marginTop: '.2rem',
                }}
              >
                {c.v}
              </div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="المرفقات" meta={`${uploaded} من ${P.attachments.length} مرفوعة`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>المرفق</th><th>الحالة</th><th className="n">إجراء</th></tr>
            </thead>
            <tbody>
              {P.attachments.map((a) => (
                <tr key={a.name} className={a.uploaded ? '' : 'off'}>
                  <td>
                    <div className="nmc">
                      <Icon path={icons.file} size={16} style={{ color: 'var(--t3)' }} />
                      {a.name}
                    </div>
                  </td>
                  <td>
                    {a.uploaded ? (
                      <Tag tone="ok">مرفوع</Tag>
                    ) : (
                      <Tag>{a.required ? 'مطلوب، غير مرفوع' : 'اختياري، غير مرفوع'}</Tag>
                    )}
                  </td>
                  <td className="n">
                    {a.uploaded ? (
                      <span className="rowf" style={{ gap: '.5rem', justifyContent: 'flex-end' }}>
                        <button className="lnk" onClick={() => setPreview(a)}>عرض</button>
                        <span className="dot" />
                        <a>تحميل</a>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          الموازنة التفصيلية هي المطلوبة في طلب الاستكمال الحالي — الملف المرفوع صورة لا تُقرأ آليًا.
        </div>
      </Glass>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}

      <Glass>
        <Head title="جهة الاتصال والحساب البنكي" meta="من نموذج التقديم" />
        <KV
          rows={[
            { k: 'مدير المشروع', v: P.manager.name },
            { k: 'الجوال', v: <Mono>{P.manager.phone}</Mono> },
            { k: 'البريد', v: <Mono>{P.manager.email}</Mono> },
            { k: 'المصرف', v: P.bank.name },
            { k: 'اسم الحساب', v: P.bank.account },
            { k: 'الآيبان', v: <Mono>{P.bank.iban}</Mono> },
            { k: 'حالة الحساب', v: <Tag tone="ok">{P.bank.status}</Tag> },
          ]}
        />
        <div className="sub" style={{ marginTop: '.8rem' }}>
          البيانات البنكية مصدرها ملف الجهة، معروضة هنا للمراجعة فقط ولا تُحرَّر من المشروع.
        </div>
      </Glass>
    </>
  )
}

/** قائمة بنود بعنوان وعدّاد — بتتكرر ثلاث مرات في نفس الكارت */
function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <div className="hd" style={{ marginTop: '1.4rem', marginBottom: '.7rem' }}>
        <h3 style={{ fontSize: '.9rem' }}>{title}</h3>
        <span className="meta">{items.length}</span>
      </div>
      <div className="col-s">
        {items.map((item, i) => (
          <div className="data" key={i} style={{ padding: '.7rem 0' }}>
            <div style={{ fontSize: '.85rem', lineHeight: 1.7 }}>{item}</div>
          </div>
        ))}
      </div>
    </>
  )
}
