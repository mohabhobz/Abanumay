import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, Money, Mono, Num, Steps, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { DocFile } from '@/components/docs'
import type { AgreementDetail, PaymentDetail } from '@/data/mock/detail'

export interface AgreementTabProps {
  agreement: AgreementDetail | null
  payments: PaymentDetail[]
  entityName: string
  /** مشروع وصل للمرحلة دي · للحالة الفارغة */
  example?: { id: string; name: string }
  onOpenExample?: (id: string) => void
  /**
   * مدخل إعداد الاتفاقية · هـ-4.
   *
   * ⚠️ **ده المدخل الوحيد للبانِي**، ومفيش زرار في ترويسة صندوق
   * الاتفاقيات · لأن الاتفاقية بتتعمل **لمشروع** لا من الصندوق
   * (قاعدة 2). والحالة الفاضية هنا كانت بتشرح اللي هيحصل وما
   * بتدّيش طريقة تعمله.
   */
  onStart?: () => void
  /** المشروع مؤهَّل فعلًا · قاعدة 1 · وغير كده السبب بيتقال */
  startBlocked?: string
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
export function AgreementTab({
  agreement: A, payments, entityName, example, onOpenExample, onStart, startBlocked,
}: AgreementTabProps) {
  if (!A) {
    return (
      <Glass>
        <Head title="اتفاقية المشروع" meta="تُفتح بعد الاعتماد النهائي" />
        <Empty
          title="لا توجد اتفاقية بعد، فالمشروع لم يصل إلى مرحلة الاعتماد."
          note="عند الوصول إليها يختار المشرف القالب، ويعبّئ النظام بيانات المشروع والجهة، فيُولَّد النص وجدول الدفعات، ثم تمرّ الاتفاقية على مدير المنح والإدارة المالية والمدير التنفيذي، وأخيرًا الجهة."
          actions={
            <>
              {onStart && (
                <button
                  className="btn btn-p"
                  disabled={Boolean(startBlocked)}
                  title={startBlocked || 'ابدأ إعداد الاتفاقية'}
                  onClick={onStart}
                >
                  <Icon name={icons.plus} size={16} />
                  ابدأ إعداد الاتفاقية
                </button>
              )}
              {example && onOpenExample && (
                <button className="btn btn-2" onClick={() => onOpenExample(example.id)}>
                  اعرض اتفاقية مشروع بلغ هذه المرحلة
                </button>
              )}
            </>
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
            {/* ك-2 · رقم الاتفاقية له صفحة، فهو رابط لا نصّ */}
            <Link className="tlink" to={ROUTES.agreement(A.no)}><Mono>{A.no}</Mono></Link>
            {' · '}{A.kind}
          </>}
        />

        <div className="agr-top">
          <div>
            <div className="lb">حالة الاتفاقية</div>
            <div style={{ marginTop: 'var(--sp-2)' }}>
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
            <div className="agr-date">{A.signedAt ? <DateText>{A.signedAt}</DateText> : 'لم تُوقَّع'}</div>
          </div>
        </div>

        <div className="rowf" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <DocFile name="الاتفاقية.pdf" meta={A.no} />
          {/* ⚠️ كان زرارًا بلا فعل · دلوقتي بيفتح طباعة المتصفح */}
          <button className="btn btn-2 btn-sm" onClick={() => window.print()}>
            <Icon name={icons.doc} size={15} />
            اطبع الاتفاقية
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
            at: s.at ? <DateText>{s.at}</DateText> : undefined,
          }))}
        />

        {A.returned && (
          <div className="data i flag" style={{ marginTop: 'var(--sp-5)', padding: 'var(--sp-4) 0 var(--sp-2)' }}>
            <div className="rowf" style={{ justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
              <span className="itag no">طلب التعديل على الاتفاقية</span>
              <span className="sub">{A.returned.by} · <DateText>{A.returned.at}</DateText></span>
            </div>
            <div className="tx">{A.returned.note}</div>
            <div className="src">
              أُعيدت الاتفاقية إلى المشرف مرة واحدة قبل الاعتماد، والإعادة مسجَّلة في السجل إجراءً مستقلًا.
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
                    <td><DateText>{p.date}</DateText></td>
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
          <div className="sub mt-3">
            يُدرج هذا الجدول في نص الاتفاقية عبر المتغيّر <Mono>payments_table</Mono>، بأرقام تبويب الدفعات نفسها.
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
        <div className="sub mt-4">
          الاسم والمبلغ والمدة والدفعات كلها متغيّرات، والنص واحد لكل مشروع يستخدم القالب نفسه،
          ولا يختلف إلا في هذه القيم. توقيع {entityName} مسجَّل في السجل بوصفه إجراء «قبول الإتفاقية».
        </div>
      </Glass>
    </>
  )
}
