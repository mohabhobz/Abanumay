import { Fragment } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Mono, Num, Riyal, Tag,
} from '@/components/ui'
import { Crumbs } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { payRequestById } from '@/data/mock/disbursements'
import { nf, NOUN, nounAfter, pct, projectCode, riyals } from '@/lib/format'
import { projectById } from '@/data/mock/projects'
import { printArea } from '@/lib/export'
import { usePayments } from '@/data/payments/store'

/* Disbursement order - step 16, and the spec's first output.

   The spec's exact wording: "an approved disbursement order ready for execution" - meaning a
   document, not a database status. The live system does print a "disbursement authorization" and
   transfers against it, held by finance in hand.

   Step 16 says the system "creates the disbursement order and links it to the project, agreement,
   payment, and funding sources" - those four are the body of the document, not its header. Each
   gets its own numbered line here, and the funding-source breakdown is a table with each source's
   value in currency, not percentage alone - because whoever executes the transfer transfers an
   amount.

   Note: the amount is also spelled out in words. Not decoration - this document goes to the bank,
   and a digit that's off by one place reads wrong with nothing to catch it. Words are what anchors
   the number.

   Note: the document isn't generated before approval. Rule 9: execution is forbidden before every
   approval is complete - so a request still sitting with the supervisor or manager gets a screen
   stating the order hasn't been generated yet, naming whose desk it's on, instead of printing a
   document with no basis.

   Note: three stations, not two. With finance before its approval the document shows as a draft for
   review («بانتظار اعتماد المالية»); after the approval (step 15) it reads «معتمد · جاهز للتنفيذ»;
   after the transfer (step 17) «نُفّذ» with the transfer and its proof. The transfer exit itself
   stays locked until the approval (rule 9). */

/* Note: section numbers are Latin digits like every other number in the system - they used to be
   Arabic-Indic (1 2 3) and passed every check, because the route that checks them had a dead
   reference, so the tool was measuring the "request not found" screen. The gap only surfaced once
   the route was fixed. */

export default function OrderPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  usePayments()
  const r = payRequestById(id)

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('أمر الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty title="الطلب غير موجود." note="ربما أُغلق الطلب، أو أن الرابط قديم." />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* The order is generated at step 16, i.e. after finance approval - before that, the request is
     still moving through approvals. */
  const ready = r.state === 'finance' || r.state === 'paid'
  const approved = Boolean(r.order) || r.state === 'paid'
  const orderNo = `PO-${r.id.replace('SR-', '')}`

  return (
    <AppLayout assistantContext={assistFor.page('أمر الصرف', r.projectName)}>
      <div className="viewstack">
        <div className="screen col">
          {/* Note: three real levels: the disbursement order is inside the request, and the request
              is inside the inbox - the old button only returned to the request, so a user wanting
              the inbox had to click twice. */}
          <Crumbs
            items={[
              { label: 'الصرف', to: ROUTES.payments },
              { label: r.id, to: ROUTES.payment(r.id) },
              { label: 'أمر الصرف' },
            ]}
          />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">أمر الصرف</h1>
              <p className="sub mt-1">
                <Mono>{orderNo}</Mono>{/* doc · output 1 · step 16 */}
              </p>
            </div>
            {ready && (
              <button className="btn btn-2" onClick={() => setTimeout(printArea, 60)}>
                <Icon name={icons.export} size="sm" />
                اطبع
              </button>
            )}
          </header>

          {!ready ? (
            <Glass>
              <Empty
                title="أمر الصرف لم يُنشأ بعد."
                note={
                  `الطلب ما زال بانتظار ${r.state === 'supervisor' ? 'مشرف المنح' : 'مدير المنح'}. ` +
                  /* doc rule 9 · step 16 */ 'لا يُنفَّذ الصرف قبل اكتمال كل الاعتمادات، ويُنشأ الأمر ' +
                  'بعد اعتماد الإدارة المالية.'
                }
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payment(r.id))}>
                    العودة إلى الطلب
                  </button>
                }
              />
            </Glass>
          ) : (
            <Glass className="order">
              <Head
                title={`أمر صرف رقم ${orderNo}`}
                meta={
                  r.state === 'paid'
                    ? <Tag tone="ok">نُفّذ</Tag>
                    : approved
                      ? <Tag tone="teal">معتمد · جاهز للتنفيذ</Tag>
                      : <Tag tone="warn">مسودة · بانتظار اعتماد المالية</Tag>
                }
              />

              {/* 1 - Project */}
              <section className="order-s">
                <h3><span className="num">1</span> · المشروع</h3>
                <dl className="kv">
                  <dt>اسم المشروع</dt><dd>{r.projectName}</dd>
                  <dt>كود المشروع</dt><dd><Mono>{projectCode(r.projectId, projectById(r.projectId)?.year ?? '2026')}</Mono></dd>
                  <dt>الجهة المستفيدة</dt>
                  <dd><Link className="tlink" to={ROUTES.entity(r.entityId)}>{r.entityName}</Link></dd>
                </dl>
              </section>

              {/* 2 - Agreement */}
              <section className="order-s">
                <h3><span className="num">2</span> · الاتفاقية</h3>
                <dl className="kv">
                  <dt>رقم الاتفاقية</dt><dd><Mono>{r.agreement.id}</Mono></dd>
                  <dt>سريانها</dt>
                  <dd>{r.agreement.active ? 'سارية' : 'غير سارية'} حتى <DateText>{r.agreement.endsAt}</DateText></dd>
                  <dt>قيمة المنحة</dt><dd><span className="num">{nf.format(r.granted)}</span> <Riyal /></dd>
                </dl>
              </section>

              {/* 3 - Payment */}
              <section className="order-s">
                <h3><span className="num">3</span> · الدفعة</h3>
                <dl className="kv">
                  <dt>الدفعة</dt>
                  <dd><span className="num">{r.no}</span> من <span className="num">{r.of}</span></dd>
                  <dt>تاريخ الاستحقاق</dt><dd><DateText>{r.dueAt}</DateText></dd>
                  <dt>قيمة الدفعة المعتمدة</dt>
                  <dd><span className="num">{nf.format(r.due)}</span> <Riyal /></dd>
                  {r.condition && <><dt>شرط الصرف</dt><dd>{r.condition}</dd></>}
                </dl>

                {/* Note: amount in words - this document goes to the bank, and nothing else catches
                    a digit that's off by one place. */}
                <div className="order-amt">
                  <div className="lb">المبلغ المطلوب صرفه</div>
                  <div className="v">
                    <span className="num">{nf.format(r.asked)}</span> <Riyal />
                  </div>
                  <div className="order-w">فقط {riyals(r.asked)} لا غير</div>
                </div>
              </section>

              {/* 4 - Funding sources - rule 12 */}
              <section className="order-s">
                <h3><span className="num">4</span> · مصادر التمويل</h3>
                <table className="order-t">
                  <thead>
                    <tr><th>المصدر</th><th className="n">النسبة</th><th className="n">المبلغ</th></tr>
                  </thead>
                  <tbody>
                    {r.sources.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td className="n"><Num>{pct(s.share)}</Num></td>
                        <td className="n"><Num>{Math.round((r.asked * s.share) / 100)}</Num></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>الإجمالي</td>
                      <td className="n"><Num>{pct(100)}</Num></td>
                      <td className="n"><Num>{r.asked}</Num></td>
                    </tr>
                  </tfoot>
                </table>
                {r.sources.length > 1 && (
                  <p className="sub cnote">
                    تُلزم القواعد {/* doc rule 12 */} بالصرف وفق هذا التوزيع المعتمد عند تعدّد المصادر.
                  </p>
                )}
              </section>

              {/* Bank account - the spec's second output. */}
              <section className="order-s">
                <h3><span className="num">5</span> · الحساب البنكي المعتمد</h3>
                <dl className="kv">
                  <dt>البنك</dt><dd>{r.bank.name}</dd>
                  <dt>حالة الحساب</dt>
                  <dd>{r.bank.active ? 'معتمد' : <span className="bad">غير نشط · لا يُحوَّل إليه</span>}</dd>
                  <dt>اسم المستفيد</dt><dd>{r.entityName}</dd>
                  {r.rep && <><dt>ممثل الجهة المخوّل</dt><dd>{r.rep.name} · {r.rep.title}</dd></>}
                </dl>
              </section>

              {/* 9.1.input-6 - what was approved outside the ordinary path travels with the order */}
              {(r.exceptions?.length ?? 0) > 0 && (
                <section className="order-s">
                  <h3><span className="num">6</span> · الموافقات والاستثناءات الخاصة</h3>
                  <dl className="kv">
                    {r.exceptions!.map((x) => (
                      <Fragment key={x.id}>
                        <dt>{x.kind === 'waiver' ? 'استثناء' : 'موافقة خاصة'}</dt>{/* doc · x.rule */}
                        <dd>{x.text} · {x.by} · <DateText>{x.at}</DateText></dd>
                      </Fragment>
                    ))}
                  </dl>
                </section>
              )}

              {/* 9.2.17 - the executed transfer, its account and proof */}
              {r.transfer && (
                <section className="order-s">
                  <h3><span className="num">{(r.exceptions?.length ?? 0) > 0 ? 7 : 6}</span> · التحويل المنفَّذ</h3>
                  <dl className="kv">
                    <dt>تاريخ التحويل</dt><dd><DateText>{r.transfer.at}</DateText></dd>
                    <dt>الحساب</dt><dd>{r.transfer.bank} · <span className="num">{r.transfer.iban}</span></dd>
                    <dt>إثبات التحويل</dt><dd>{r.transfer.proof}</dd>
                  </dl>
                </section>
              )}

              {/* Signatures - the document is held physically, so approvals belong on it. */}
              <section className="order-sign">
                {['مشرف المنح', 'مدير المنح', 'الإدارة المالية'].map((role) => {
                  /* The approving step of each desk · a return isn't a signature */
                  const step = role === 'مشرف المنح' ? 7 : role === 'مدير المنح' ? 13 : 15
                  const ev = [...r.log].reverse().find((e) => e.role === role && e.step === step && !/أعاد/.test(e.what))
                  return (
                    <div className="order-sg" key={role}>
                      <div className="lb">{role}</div>
                      <div className="order-sl" />
                      <div className="sub">
                        {ev ? <>{ev.who} · <DateText>{ev.at}</DateText></> : 'بانتظار الاعتماد'}
                      </div>
                    </div>
                  )
                })}
              </section>

              <p className="sub cnote">
                أرشفة المستندات والتقارير والمرفقات مربوطة بالطلب <Mono>{r.id}</Mono> ·{/* doc rule 21 · output 4 */}
                <Num>{r.docs.length}</Num> {nounAfter(r.docs.length, NOUN.doc)}.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
