import { Empty, Glass, Head, Icon, icons, Mono, Num, Riyal, Stat, Tag } from '@/components/ui'
import { nf, pct } from '@/lib/format'
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
 * دورة من أربعة إجراءات** — إذن الصرف من المشرف، وسند الصرف من
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
          title="لا توجد دفعات — المشروع لم يصل لمرحلة الصرف."
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
          value={nf.format(granted)}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`على ${payments.length === 1 ? 'دفعة واحدة' : `${payments.length} دفعات`}`}
        />
        <Stat
          label="المصروف"
          value={nf.format(paidSum)}
          unit={<Riyal />}
          bar={{ w: `${Math.round((paidSum / granted) * 100)}%`, c: 'var(--lime)' }}
          note={`${pct(Math.round((paidSum / granted) * 100))} من المعتمد`}
        />
        <Stat
          label="المتبقي"
          value={nf.format(rest)}
          unit={<Riyal />}
          note={rest > 0 ? `${payments.length - paid.length} دفعة لم تُصرف` : 'صُرفت كاملة'}
        />
        <Stat
          label="الدفعة القادمة"
          value={payments.find((p) => p.status !== 'مدفوع')?.date ?? '—'}
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
                <span className="pay-amt num">{nf.format(p.amount)} <Riyal /></span>
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

              <ol className="pay-steps">
                <Step label="إذن الصرف" who="مشرف المنح" on={true} />
                <Step label="سند الصرف والتحويل" who="القسم المالي" on={p.status === 'مدفوع'} />
                <Step label="سند القبض والقيد" who="الجهة" on={Boolean(p.receipt)} />
                <Step label="اعتماد السند" who="القسم المالي" on={Boolean(p.receipt)} />
              </ol>

              {p.voucher && (
                <div className="rowf" style={{ gap: '.5rem', marginTop: '.7rem' }}>
                  <button className="btn btn-2 btn-sm">
                    <Icon path={icons.doc} size={15} />
                    إذن الصرف <Mono>{p.voucher}</Mono>
                  </button>
                  <button className="btn btn-2 btn-sm">سند القبض</button>
                  <button className="btn btn-2 btn-sm">سند القيد</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sub" style={{ marginTop: '.9rem' }}>
          «إذن الصرف» مستند مستقل قابل للطباعة، فيه بيانات الجهة وحسابها البنكي والمبلغ كتابةً —
          وهو اللي المالية بتحوّل بناءً عليه.
        </div>
      </Glass>
    </>
  )
}

/** محطة في دورة الدفعة */
function Step({ label, who, on }: { label: string; who: string; on: boolean }) {
  return (
    <li className={`pay-step${on ? ' on' : ''}`}>
      <span className="pay-dot" aria-hidden="true">
        {on && <Icon path={icons.check} size={11} />}
      </span>
      {/* الاسم تحت العنوان لا جنبه: أربع محطات في صفّ واحد بأربع
          أسماء بتتقصّ كلها لـ«سند الصر…». */}
      <span className="pay-txt">
        <span className="pay-lbl">{label}</span>
        <span className="sub">{who}</span>
      </span>
    </li>
  )
}
