import {
  Glass, Head, Tag, Num, Mono, KV, Timeline, Stat, Riyal,
} from '@/components/ui'
import { DocDownload, DocFile } from '@/components/docs'
import { addDays, costPerBeneficiary, nf, pct, readDate, units } from '@/lib/format'
import type { Project } from '@/types/domain'
import type { LogEvent } from '@/data/mock/log'

export interface DataTabProps {
  project: Project
  entityName: string
  onOpenEntity: () => void
  /** أحدث قيد في السجل — بيتعرض تحت التعريف */
  last?: LogEvent
  onOpenLog: () => void
}

/** بيانات المشروع — التعريف والفكرة والمراحل والنطاق والمرفقات */
export function DataTab({ project: P, entityName, onOpenEntity, last, onOpenLog }: DataTabProps) {
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  const uploaded = P.attachments.filter((a) => a.uploaded).length

  return (
    <>
      <Glass>
        <Head title="التعريف" meta="9 حقول" />
        <KV
          rows={[
            { k: 'الجهة', v: <a onClick={onOpenEntity}>{entityName}</a> },
            { k: 'رقم المشروع', v: <Mono>{P.id}</Mono> },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            /* التاريخان جنب بعض: «330 يومًا» لوحدها ما بتقولش إمتى
               بيخلص، والنهاية هي اللي بتحدّد لو المشروع هيعدّي السنة
               المالية. والمدة في الاتفاقية بتبدأ من صرف أول دفعة. */
            { k: 'تاريخ البدء', v: readDate(P.startDate) },
            {
              k: 'الانتهاء المتوقع',
              v: (
                <>
                  {readDate(addDays(P.startDate, P.durationDays))}
                  <span className="sub"> · بعد <span className="num">{nf.format(P.durationDays)}</span> يومًا</span>
                </>
              ),
            },
            {
              k: 'الوسوم',
              v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span>,
            },
          ]}
        />

        {/* آخر إجراء تحت التعريف مباشرة — كان كارتًا في العمود الجانبي،
            وده مكان بعيد عن السؤال اللي بيسبقه: «المشروع ده إيه، وآخر
            حاجة حصلت فيه إيه». الاتنين بقوا في نفس الكارت. */}
        {last && (
          <div className="lastact">
            <div className="lastact-h">
              <span className="lb">آخر إجراء</span>
              <span className="pc-sp" />
              <button className="lnk" onClick={onOpenLog}>السجل كامل</button>
            </div>
            <div className="lastact-b">
              <b>{last.action}</b>
              <span className="lastact-d">{last.dept}</span>
            </div>
            <div className="sub" style={{ marginTop: '.3rem' }}>
              {last.by} · <Mono>{last.at}</Mono>
              {' · '}
              <span style={{ color: last.hours > last.limit ? 'var(--no-ink)' : undefined }}>
                <Num>{last.days}</Num> يومًا · <Num>{last.hours}</Num> من <Num>{last.limit}</Num> ساعة
              </span>
            </div>
          </div>
        )}
      </Glass>

      <div className="stats4">
        <Stat
          label="المبلغ المطلوب"
          value={<Num>{P.amountRequested}</Num>}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`${pct(100)} من إجمالي المشروع`}
        />
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
          note={`≈ ${units.month(Math.round(P.durationDays / 30))} · تبدأ من صرف الدفعة الأولى`}
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
          note="تقدير الجهة، لم يُراجَع من المشرف"
        />
        <Stat
          label="تكلفة المستفيد"
          value={<Num>{perBeneficiary}</Num>}
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
              {/* مفيش عمود «إجراء»: الملف نفسه زرار المعاينة، وجنبه
                  زرار التنزيل. عمود بيقول «اضغط الملف» بيشرح واجهة
                  المفروض تشرح نفسها. */}
              <tr><th>المرفق</th><th className="n">الحالة</th></tr>
            </thead>
            <tbody>
              {P.attachments.map((a) => (
                <tr key={a.name} className={a.uploaded ? '' : 'off'}>
                  <td>
                    {/* المرفوع بيتعرض بثامبنيله — النوع بيبان قبل الفتح.
                        وغير المرفوع مالوش ثامبنيل لأن مفيش محتوى. */}
                    {a.uploaded ? (
                      <DocFile name={a.name} download={false} />
                    ) : (
                      <span className="nmc sub">{a.name}</span>
                    )}
                  </td>
                  {/* التنزيل جنب الحالة في آخر الصف: الأيقونات بتتسطّر
                      في عمود واحد بدل ما تقف بعد كل اسم في مكان. */}
                  <td className="n">
                    <span className="dstat">
                      {a.uploaded ? (
                        <Tag tone="ok">مرفوع</Tag>
                      ) : (
                        <Tag>{a.required ? 'مطلوب، غير مرفوع' : 'اختياري، غير مرفوع'}</Tag>
                      )}
                      {a.uploaded && <DocDownload name={a.name} />}
                    </span>
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
      {/* `flush`: الصفوف بيفصلها خط شعري، والفجوة بينهم بتخلّي
          المسافة فوق السطر نصّ اللي تحته فيتقري ملزوقًا في خطّه. */}
      <div className="col-s flush">
        {items.map((item, i) => (
          <div className="data" key={i}>
            <div style={{ fontSize: '.85rem', lineHeight: 1.7 }}>{item}</div>
          </div>
        ))}
      </div>
    </>
  )
}
