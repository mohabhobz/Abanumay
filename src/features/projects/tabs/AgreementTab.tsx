import { Link, useNavigate } from 'react-router-dom'
import { payHref } from '@/features/agreements/ScheduleEditor'
import { Button, DateText, Empty, Glass, Head, Icon, Money, Mono, Num, Steps, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { DocFile } from '@/components/docs'
import type { AgreementDetail, PaymentDetail } from '@/data/mock/detail'
import { NOUN, countOf } from '@/lib/format'

export interface AgreementTabProps {
  agreement: AgreementDetail | null
  payments: PaymentDetail[]
  entityName: string
  /** Client sheet 24 Oct (#104) · each payment row opens its payment screen */
  projectId?: string
  /** A project that has reached this stage — for the empty state. */
  example?: { id: string; name: string }
  onOpenExample?: (id: string) => void
  /**
   * Entry point for setting up the agreement.
   *
   * This is the only entry point to the builder — there's no button in the
   * agreements panel header, because an agreement is created for a project, not
   * from the panel. The empty state here used to explain what would happen
   * without giving a way to actually do it.
   */
  onStart?: () => void
  /** The project is actually eligible — otherwise the reason is stated. */
  startBlocked?: string
}

/**
 * Project agreement.
 *
 * In the current system, an agreement is generated from a template rather
 * than uploaded as a file: the reviewer picks a template, and the system
 * fills 26 variables from the project and entity files to produce printable
 * text. This screen shows the same thing plus what the system otherwise
 * hides: which template was used and why, the four-step approval cycle, and
 * the return loop if the agreement was sent back.
 *
 * A paper agreement has an empty tab in the system (value "-") — the paper
 * copy lives outside the system, so we state that explicitly instead of
 * showing a blank screen.
 */
export function AgreementTab({
  agreement: A, payments, projectId, example, onOpenExample, onStart, startBlocked,
}: AgreementTabProps) {
  const go = useNavigate()
  if (!A) {
    return (
      <Glass>
        <Head title="اتفاقية المشروع" />
        <Empty
          art={{ done: 1 }}
          title={onStart && !startBlocked ? 'المشروع معتمد وحجزه نهائي · جاهز لإعداد الاتفاقية.' : `لا توجد اتفاقية بعد${startBlocked ? ` · ${startBlocked}` : ''}.`}
          actions={
            <>
              {onStart && (
                <Button
                  variant="p"
                  disabled={Boolean(startBlocked)}
                  title={startBlocked || 'ابدأ إعداد الاتفاقية'}
                  onClick={onStart}
                >
                  <Icon name={icons.plus} size="sm" />
                  ابدأ إعداد الاتفاقية
                </Button>
              )}
              {example && onOpenExample && (
                <Button variant="2" onClick={() => onOpenExample(example.id)}>
                  اعرض اتفاقية مشروع بلغ هذه المرحلة
                </Button>
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
            {/* The agreement number has its own page, so it's a link, not plain text. */}
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
          </div>
          <div>
            <div className="lb">التوقيع</div>
            <div className="agr-date">{A.signedAt ? <DateText>{A.signedAt}</DateText> : 'لم تُوقَّع'}</div>
          </div>
        </div>

        <div className="rowf" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
          <DocFile name="الاتفاقية.pdf" meta={A.no} />
          {/* Used to be a button with no action — now it opens the browser's print dialog. */}
          <Button variant="2" size="sm" onClick={() => window.print()}>
            <Icon name={icons.doc} size="sm" />
            اطبع الاتفاقية
          </Button>
        </div>
      </Glass>

      <Glass>
        <Head title="دورة الاعتماد" meta={`${done} من ${A.steps.length}`} />
        <Steps
          items={A.steps.map((s) => ({
            label: s.role,
            /* `pending` in the data equals `todo` in the component. Both names mean the
               same thing; the component standardizes on one. */
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
          </div>
        )}
      </Glass>

      {payments.length > 0 && (
        <Glass>
          <Head title="جدول الدفعات في الاتفاقية" meta={`${countOf(payments.length, NOUN.payment)}`} />
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr><th>الدفعة</th><th className="n">المبلغ</th><th>التاريخ</th><th>الشرط</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.no} className={projectId ? 'clk' : undefined} onClick={projectId ? (ev) => { if (!(ev.target as HTMLElement).closest('a')) go(payHref(projectId, p.no)) } : undefined}>
                    <td>{projectId ? <Link className="tlink" to={payHref(projectId, p.no)}>الدفعة <Num>{p.no}</Num></Link> : <Num>{p.no}</Num>}</td>
                    <td className="n"><Money>{p.amount}</Money></td>
                    <td><DateText>{p.date}</DateText></td>
                    {/* `mut`, not `sub`: the intent was to mute the column, and `sub` both mutes
                        and shrinks. The shrinking never actually applied — `.tbl td` has stronger
                        specificity, so the size stayed the table's size — so the intended effect
                        worked while the class name claimed something else. `mut` states what
                        actually happens: color only. */}
                    <td className="mut">{[p.basis, p.condition].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Glass>
      )}

      <Glass>
        <Head title="نص الاتفاقية" />
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
      </Glass>
    </>
  )
}
