import { Empty, Glass, Head, Icon, icons, Money, Mono, Num, Steps, Tag } from '@/components/ui'
import { DocFile } from '@/components/docs'
import type { AgreementDetail, PaymentDetail } from '@/data/mock/detail'

export interface AgreementTabProps {
  agreement: AgreementDetail | null
  payments: PaymentDetail[]
  entityName: string
  /** مشروع وصل للمرحلة دي · للحالة الفارغة */
  example?: { id: string; name: string }
  onOpenExample?: (id: string) => void
}

/**
 * اتفاقية المشروع.
 *
 * في النظام العامل الاتفاقية **مولَّدة من قالب** لا مرفوعة كملف:
 * المشرف يختار القالب، والنظام يعبّي ٢٦ متغيّرًا من ملف المشروع
 * والجهة، ويطلع نصًّا قابلًا للطباعة. والشاشة دي بتوري نفس الشيء
 * ومعاه اللي النظام بيخبّيه: **القالب اللي اتاخد ومنين اتحدد**،
 * و**دورة الاعتماد الرباعية**، و**حلقة الإرجاع** لو الاتفاقية رجعت.
 *
 * الاتفاقية الورقية في النظام تابها فاضي (قيمته `-`) · الورقة برّه
 * النظام. فبنقولها صراحة بدل ما نوري شاشة فاضية.
 */
export function AgreementTab({ agreement: A, payments, entityName, example, onOpenExample }: AgreementTabProps) {
  if (!A) {
    return (
      <Glass>
        <Head title="اتفاقية المشروع" meta="تُفتح بعد الاعتماد النهائي" />
        <Empty
          title="لا توجد اتفاقية، المشروع لم يصل لمرحلة الاعتماد."
          note="عند الوصول: يختار المشرف القالب، ويعبّي النظام بيانات المشروع والجهة، فيُولَّد النص وجدول الدفعات ثم تمرّ الاتفاقية على مدير المنح والمالية والمدير التنفيذي وأخيرًا الجهة."
          actions={
            example && onOpenExample ? (
              <button className="btn btn-2" onClick={() => onOpenExample(example.id)}>
                اعرض اتفاقية مشروع وصل لهذه المرحلة
              </button>
            ) : undefined
          }
        />
      </Glass>
    )
  }

  const done = A.steps.filter((s) => s.state === 'done').length

  return (
    <>
      <Glass>
        <Head
          title="اتفاقية المشروع"
          meta={<>
            <Mono>{A.no}</Mono> · {A.kind}
          </>}
        />

        <div className="agr-top">
          <div>
            <div className="lb">حالة الاتفاقية</div>
            <div style={{ marginTop: '.35rem' }}>
              <Tag tone={A.signedAt ? 'ok' : 'warn'}>{A.status}</Tag>
            </div>
          </div>
          <div>
            <div className="lb">القالب المستخدَم</div>
            <div className="agr-tpl">{A.template}</div>
            {/* القالب مش اختيارًا حرًّا: النظام عنده عشرة، والاسم نفسه
                بيقول قاعدة الاختيار · مصدر التمويل × حجم المنحة ×
                الظهور الإعلامي. */}
            <div className="sub">يُختار آليًا من مصدر التمويل وحجم المنحة والظهور الإعلامي · 10 قوالب</div>
          </div>
          <div>
            <div className="lb">التوقيع</div>
            <div className="agr-date">{A.signedAt ? <Mono>{A.signedAt}</Mono> : 'لم تُوقَّع'}</div>
          </div>
        </div>

        <div className="rowf" style={{ gap: '.6rem', marginTop: '1.1rem' }}>
          <DocFile name="الاتفاقية.pdf" meta={A.no} />
          <button className="btn btn-2 btn-sm">
            <Icon name={icons.doc} size={15} />
            طباعة الاتفاقية
          </button>
        </div>
      </Glass>

      <Glass>
        <Head title="دورة الاعتماد" meta={`${done} من ${A.steps.length}`} />
        <Steps
          items={A.steps.map((s) => ({
            label: s.role,
            /* `pending` في الداتا = `todo` في المكوّن. الاسمين
               بيقولوا نفس الحاجة، والمكوّن بيثبّت واحد. */
            state: s.state === 'pending' ? 'todo' : s.state,
            note: s.state === 'now' ? 'بانتظاره الآن' : s.note,
            at: s.at ? <Mono>{s.at}</Mono> : undefined,
          }))}
        />

        {A.returned && (
          <div className="data i flag" style={{ marginTop: '.9rem', padding: '.85rem 0 .2rem' }}>
            <div className="rowf" style={{ justifyContent: 'space-between', marginBottom: '.4rem' }}>
              <span className="itag no">طلب التعديل على الاتفاقية</span>
              <span className="sub">{A.returned.by} · <Mono>{A.returned.at}</Mono></span>
            </div>
            <div className="tx">{A.returned.note}</div>
            <div className="src">
              الاتفاقية رجعت للمشرف مرة واحدة قبل الاعتماد، الإرجاع مسجَّل في السجل كإجراء مستقل.
            </div>
          </div>
        )}
      </Glass>

      {payments.length > 0 && (
        <Glass>
          <Head title="جدول الدفعات في الاتفاقية" meta={`${payments.length} دفعات`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr><th>الدفعة</th><th className="n">المبلغ</th><th>التاريخ</th><th>الشرط</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.no}>
                    <td><Num>{p.no}</Num></td>
                    <td className="n"><Money>{p.amount}</Money></td>
                    <td><Mono>{p.date}</Mono></td>
                    {/* `mut` لا `sub`: الغرض كان **يخفّت** العمود، و`sub`
                        بتخفّت وبتصغّر. الصغر ما نفعش أصلًا · `.tbl td`
                        أقوى تحديدًا منها فالمقاس فضل مقاس الجدول · فكان
                        المطلوب حاصل والمكتوب بيقول حاجة تانية. `mut`
                        بتقول اللي بيحصل فعلًا: لون بس. */}
                    <td className="mut">{p.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ marginTop: '.8rem' }}>
            الجدول ده بيتحقن في نص الاتفاقية بمتغيّر <Mono>payments_table</Mono>، نفس أرقام تاب الدفعات.
          </div>
        </Glass>
      )}

      <Glass>
        <Head title="نص الاتفاقية" meta="مولَّد من القالب" />
        <div className="agr-body">
          {A.body.map((c) => (
            <section key={c.title}>
              <h3>{c.title}</h3>
              <ul>
                {c.items.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <div className="sub" style={{ marginTop: '1rem' }}>
          الاسم والمبلغ والمدة والدفعات كلها متغيّرات، النص ده هو نفسه لكل مشروع بنفس القالب،
          والفروق دي بس. توقيع {entityName} مسجَّل في السجل كإجراء «قبول الإتفاقية».
        </div>
      </Glass>
    </>
  )
}
