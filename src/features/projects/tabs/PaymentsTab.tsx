import { Empty, Glass, Head, Money, Mono, Num, Riyal, Stat, Steps, Tag } from '@/components/ui'
import { sequence } from '@/lib/steps'
import { DocFile } from '@/components/docs'
import { pct } from '@/lib/format'
import type { PaymentDetail } from '@/data/mock/detail'

export interface PaymentsTabProps {
  payments: PaymentDetail[]
  granted: number
  example?: { id: string; name: string }
  onOpenExample?: (id: string) => void
}

/**
 * الدفعات.
 *
 * الجدول في النظام خمسة أعمدة ساكتة (الدفعة · المبلغ · التاريخ ·
 * الحالة · إذن الصرف)، والقصة الحقيقية مبعترة في السجل: **كل دفعة
 * دورة من أربعة إجراءات** · إذن الصرف من المشرف، وسند الصرف من
 * المالية، وسند القبض من الجهة، وقبوله من المالية. والشرط اللي
 * الدفعة اتصرفت عليه مكتوب في ملاحظات إذن الصرف لا في الجدول.
 *
 * الشاشة دي بتجمّعهم: الصف بيقول المبلغ والحالة، وتحته الدورة
 * والشرط. فالسؤال «فين الدفعة التانية؟» بيتجاوب من غير ما تفتح السجل.
 */
export function PaymentsTab({ payments, granted, example, onOpenExample }: PaymentsTabProps) {
  if (payments.length === 0) {
    return (
      <Glass>
        <Head title="جدول الدفعات" meta="يُفتح بعد اعتماد الاتفاقية" />
        <Empty
          title="لا توجد دفعات، المشروع لم يصل لمرحلة الصرف."
          note="عند الوصول: يصدر المشرف إذن الصرف، ثم تُصدر المالية سند الصرف وتحوّل المبلغ، ثم ترفع الجهة سند القبض والقيد، ثم تعتمده المالية."
          actions={
            example && onOpenExample ? (
              <button className="btn btn-2" onClick={() => onOpenExample(example.id)}>
                اعرض دفعات مشروع في الصرف
              </button>
            ) : undefined
          }
        />
      </Glass>
    )
  }

  const paid = payments.filter((p) => p.status === 'مدفوع')
  const paidSum = paid.reduce((s, p) => s + p.amount, 0)
  const rest = granted - paidSum

  return (
    <>
      <div className="stats4">
        <Stat
          label="المعتمد"
          value={<Num>{granted}</Num>}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`على ${payments.length === 1 ? 'دفعة واحدة' : `${payments.length} دفعات`}`}
        />
        <Stat
          label="المصروف"
          value={<Num>{paidSum}</Num>}
          unit={<Riyal />}
          bar={{ w: `${Math.round((paidSum / granted) * 100)}%`, c: 'var(--lime)' }}
          note={`${pct(Math.round((paidSum / granted) * 100))} من المعتمد`}
        />
        <Stat
          label="المتبقي"
          value={<Num>{rest}</Num>}
          unit={<Riyal />}
          note={rest > 0 ? `${payments.length - paid.length} دفعة لم تُصرف` : 'صُرفت كاملة'}
        />
        <Stat
          label="الدفعة القادمة"
          value={payments.find((p) => p.status !== 'مدفوع')?.date ?? 'لا توجد'}
          note={payments.find((p) => p.status !== 'مدفوع') ? 'حسب جدول الاتفاقية' : 'لا توجد'}
        />
      </div>

      <Glass>
        <Head title="جدول الدفعات المعتمدة" meta={`${paid.length} مصروفة من ${payments.length}`} />

        <div className="paylist">
          {payments.map((p) => (
            <div className={`pay${p.status === 'مدفوع' ? ' done' : ''}`} key={p.no}>
              <div className="pay-h">
                <span className="pay-no">الدفعة <Num>{p.no}</Num></span>
                <span className="pay-amt"><Money>{p.amount}</Money></span>
                <span className="pc-sp" />
                <Mono>{p.date}</Mono>
                <Tag tone={p.status === 'مدفوع' ? 'ok' : 'warn'}>{p.status}</Tag>
              </div>

              {/* الشرط أهم من الرقم: هو اللي بيقول ليه الدفعة اتصرفت
                  ولا لسه. في النظام مدفون في ملاحظات إذن الصرف. */}
              {p.condition && (
                <div className="pay-cond">
                  <span className="lb">شرط الصرف</span>
                  <span>{p.condition}</span>
                </div>
              )}
              {p.via && (
                <div className="pay-cond">
                  <span className="lb">التحويل عبر</span>
                  <span>{p.via}</span>
                </div>
              )}

              {/* المحطات متسلسلة، فحالة «الدور عليها الآن» بتتشتقّ
                  من الترتيب لا بتتكتب لكل محطة · تحت في `sequence`.
                  قبل كده كانت المحطة إما خضرا إما رمادية، يعني
                  «اتنين خلصوا واتنين لأ» من غير ما حد يعرف **مين
                  واقف** · وده السؤال الوحيد اللي المشرف بيفتح
                  الشاشة عشانه. */}
              <Steps
                flow="row"
                items={sequence([
                  { label: 'إذن الصرف', note: 'مشرف المنح', done: true },
                  { label: 'سند الصرف والتحويل', note: 'القسم المالي', done: p.status === 'مدفوع' },
                  { label: 'سند القبض والقيد', note: 'الجهة', done: Boolean(p.receipt) },
                  { label: 'اعتماد السند', note: 'القسم المالي', done: Boolean(p.receipt) },
                ])}
              />

              {p.voucher && (
                <div className="pay-docs">
                  {/* الاسم قصير والرقم في السطر التحتاني: «إذن الصرف
                      SV-2025-20611-1.pdf» بيتقصّ في أي عمود. */}
                  <DocFile name="إذن الصرف.pdf" meta={p.voucher} />
                  <DocFile name="سند القبض.pdf" meta="من الجهة" />
                  <DocFile name="سند القيد.pdf" meta="من الجهة" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sub" style={{ marginTop: '.9rem' }}>
          «إذن الصرف» مستند مستقل قابل للطباعة، فيه بيانات الجهة وحسابها البنكي والمبلغ كتابةً، وهو اللي المالية بتحوّل بناءً عليه.
        </div>
      </Glass>
    </>
  )
}
