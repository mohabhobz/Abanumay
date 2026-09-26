import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Money, Num, Riyal, Stat, Steps, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { sequence } from '@/lib/steps'
import { DocFile } from '@/components/docs'
import { NOUN, countOf, isolate, pct } from '@/lib/format'
import type { PaymentDetail } from '@/data/mock/detail'

export interface PaymentsTabProps {
  payments: PaymentDetail[]
  granted: number
  /** Project ID — connects the tab to the disbursement panel. */
  projectId?: string
  example?: { id: string; name: string }
  onOpenExample?: (id: string) => void
}

/**
 * Payments.
 *
 * The system's table has five quiet columns (payment · amount · date ·
 * status · disbursement authorization), and the real story is scattered
 * across the log: each payment is a cycle of four actions — disbursement
 * authorization from the reviewer, a disbursement voucher from finance, a
 * receipt voucher from the entity, and its acceptance by finance. The
 * condition a payment was released on is written in the disbursement
 * authorization's notes, not in the table.
 *
 * This screen brings them together: the row states amount and status, and
 * below it the cycle and condition. So "where's the second payment?" gets
 * answered without opening the log.
 */
export function PaymentsTab({ payments, granted, projectId, example, onOpenExample }: PaymentsTabProps) {
  if (payments.length === 0) {
    return (
      <Glass>
        <Head title="جدول الدفعات" meta="يُفتح بعد اعتماد الاتفاقية" />
        <Empty
          art={{ done: 2 }}
          title="لا توجد دفعات بعد، فالمشروع لم يصل إلى مرحلة الصرف."
          note="عند الوصول إليها يُصدر المشرف إذن الصرف، ثم تُصدر الإدارة المالية سند الصرف وتحوّل المبلغ، ثم ترفع الجهة سند القبض والقيد، وتعتمده الإدارة المالية."
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
          note={`على ${payments.length === 1 ? 'دفعة واحدة' : `${countOf(payments.length, NOUN.payment)}`}`}
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
          note={rest > 0 ? `${countOf(payments.length - paid.length, NOUN.payment)} لم تُصرف` : 'صُرفت كاملة'}
        />
        <Stat
          label="الدفعة القادمة"
          value={payments.find((p) => p.status !== 'مدفوع')
            ? <DateText>{payments.find((p) => p.status !== 'مدفوع')!.date}</DateText>
            : 'لا توجد'}
          note={payments.find((p) => p.status !== 'مدفوع') ? 'حسب جدول الاتفاقية' : 'لا توجد'}
        />
      </div>

      <Glass>
        <Head
          title="جدول الدفعات المعتمدة"
          meta={
            <>
              <span className="sub"><Num>{paid.length}</Num> مصروفة من <Num>{payments.length}</Num></span>
              {projectId && (
                <>
                  <span className="decsep" />
                  <Link className="lnk" to={`${ROUTES.payments}?q=${projectId}`}>
                    طلبات الصرف
                  </Link>
                </>
              )}
            </>
          }
        />

        <div className="paylist">
          {payments.map((p) => (
            <div className={`pay${p.status === 'مدفوع' ? ' done' : ''}`} key={p.no}>
              <div className="pay-h">
                <span className="pay-no">الدفعة <Num>{p.no}</Num></span>
                <span className="pay-amt"><Money>{p.amount}</Money></span>
                <span className="pc-sp" />
                <DateText>{p.date}</DateText>
                <Tag tone={p.status === 'مدفوع' ? 'ok' : 'warn'}>{p.status}</Tag>
              </div>

              {/* The condition matters more than the amount: it's what says why a payment
                  was or wasn't released. In the system it's buried in the disbursement
                  authorization's notes. */}
              {p.condition && (
                <div className="pay-cond">
                  <span className="lb">شرط الصرف</span>
                  {/* The condition is an Arabic sentence containing "50% completion" —
                      without isolating it, the `%` sign jumps to the wrong side of the number. */}
                  <span>{isolate(p.condition)}</span>
                </div>
              )}
              {p.via && (
                <div className="pay-cond">
                  <span className="lb">التحويل عبر</span>
                  <span>{p.via}</span>
                </div>
              )}

              {/* Steps are sequential, so "currently in progress" status is derived from
                  order rather than written per step — see `sequence` below. Steps used to
                  be either green or gray, meaning "two done, two not" with no way to know
                  which one is stuck — and that's the one question a reviewer opens this
                  screen to answer. */}
              <Steps
                flow="row"
                items={sequence([
                  { label: 'إذن الصرف', note: 'مشرف المنح', done: true },
                  { label: 'سند الصرف والتحويل', note: 'الإدارة المالية', done: p.status === 'مدفوع' },
                  { label: 'سند القبض والقيد', note: 'الجهة', done: Boolean(p.receipt) },
                  { label: 'اعتماد السند', note: 'الإدارة المالية', done: Boolean(p.receipt) },
                ])}
              />

              {p.voucher && (
                <div className="pay-docs">
                  {/* The name stays short with the number on the line below: "Disbursement
                      Authorization SV-2025-20611-1.pdf" would truncate in any column. */}
                  <DocFile name="إذن الصرف.pdf" meta={p.voucher} />
                  <DocFile name="سند القبض.pdf" meta="من الجهة" />
                  <DocFile name="سند القيد.pdf" meta="من الجهة" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* The cycle drawn above matches the current system's four steps
            (disbursement authorization · disbursement voucher · receipt voucher ·
            its acceptance), while the spec describes four stages ending at transfer
            with no receipt voucher. That discrepancy is recorded and awaiting the
            client's response, so the tab follows what the system actually does until
            then — what's in the system is evidence, what's in the spec is a
            proposal, and evidence isn't removed before it's confirmed. */}
        <div className="sub mt-4">
          «إذن الصرف» مستند مستقل قابل للطباعة، يتضمن بيانات الجهة وحسابها البنكي والمبلغ كتابةً، وعلى أساسه تحوّل الإدارة المالية المبلغ.
        </div>
      </Glass>
    </>
  )
}
