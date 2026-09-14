import { useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Mono, Num, Riyal, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { payRequestById } from '@/data/mock/disbursements'
import { nf, riyals } from '@/lib/format'
import { printArea } from '@/lib/export'

/* ═══════════════════════════════════════════════════════════
   أمر الصرف · خطوة 16 · والمخرج الأول في الوثيقة

   المخرج الأول نصًّا: «**أمر صرف مالي معتمد وجاهز للتنفيذ**» ·
   يعني ورقة، لا حالة في قاعدة بيانات. والنظام العامل بيطبع «إذن
   الصرف» فعلًا وبيحوّل بناءً عليه، والمالية بتمسكه في إيدها.

   وخطوة 16 بتقول النظام «ينشئ أمر الصرف **ويربطه بالمشروع
   والاتفاقية والدفعة ومصادر التمويل**» · الأربعة دول هم جسم الورقة،
   مش ترويستها. فكل واحد فيهم سطر مرقّم هنا، وتوزيع المصادر جدول
   بقيمة كل مصدر بالريال لا بالنسبة وحدها — لأن اللي بيحوّل بيحوّل
   مبلغًا.

   ⚠️ **والمبلغ مكتوب بالحروف كمان.** ده مش زينة: الورقة دي بتروح
   للبنك، والرقم اللي فيه خانة زيادة أو ناقصة بيتقرا غلط وما فيش
   حاجة تكشفه. الحروف هي اللي بتمسك الرقم.

   ⚠️ **والورقة ما بتتولدش قبل الاعتماد.** قاعدة 9: ممنوع التنفيذ
   قبل اكتمال الاعتمادات · فالطلب اللي لسّه عند المشرف أو المدير
   الشاشة بتقول له إن الأمر ما اتولدش لسّه وتقول واقف عند مين، بدل
   ما تطبع ورقة مالهاش سند.
   ═══════════════════════════════════════════════════════════ */

/* ⚠️ أرقام الأقسام **لاتينية** زي كل رقم في السيستم · كانت
   عربية-هندية (١ ٢ ٣) وعدّت على كل الفحوص، لأن المسار اللي
   بيفحصها في `routes.mjs` كان معرّفه ميّتًا فالأداة كانت بتقيس
   شاشة «الطلب غير موجود». الخرق ما بانش إلا لما المسار اتصلّح. */

export default function OrderPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const r = payRequestById(id)

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('أمر الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty title="الطلب غير موجود." note="يمكن يكون اتقفل أو الرابط قديم." />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* الأمر بيتولد عند خطوة 16، يعني بعد اعتماد المالية · قبل كده
     الطلب لسّه ماشي في الاعتمادات */
  const ready = r.state === 'finance' || r.state === 'paid'
  const orderNo = `PO-${r.id.replace('SR-', '')}`

  return (
    <AppLayout assistantContext={assistFor.page('أمر الصرف', r.projectName)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الطلب" onClick={() => navigate(ROUTES.payment(r.id))} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">أمر الصرف</h1>
              <p className="sub mt-1">
                <Mono>{orderNo}</Mono> · المخرج الأول في الإجراء · خطوة 16
              </p>
            </div>
            {ready && (
              <button className="btn btn-2" onClick={() => setTimeout(printArea, 60)}>
                <Icon name={icons.export} size={15} />
                اطبع
              </button>
            )}
          </header>

          {!ready ? (
            <Glass>
              <Empty
                title="أمر الصرف لم يُنشأ بعد."
                note={
                  `الطلب لسّه عند ${r.state === 'supervisor' ? 'مشرف المنح' : 'مدير المنح'}. ` +
                  'القاعدة 9 بتمنع تنفيذ الصرف قبل اكتمال كل الاعتمادات، والأمر بيتولّد ' +
                  'في خطوة 16 بعد اعتماد الإدارة المالية.'
                }
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payment(r.id))}>
                    ارجع للطلب
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
                    : <Tag tone="warn">جاهز للتنفيذ</Tag>
                }
              />

              {/* ١ · المشروع */}
              <section className="order-s">
                <h3><span className="num">1</span> · المشروع</h3>
                <dl className="kv">
                  <dt>اسم المشروع</dt><dd>{r.projectName}</dd>
                  <dt>رقم المشروع</dt><dd><Mono>{r.projectId}</Mono></dd>
                  <dt>الجهة المستفيدة</dt><dd>{r.entityName}</dd>
                </dl>
              </section>

              {/* ٢ · الاتفاقية */}
              <section className="order-s">
                <h3><span className="num">2</span> · الاتفاقية</h3>
                <dl className="kv">
                  <dt>رقم الاتفاقية</dt><dd><Mono>{r.agreement.id}</Mono></dd>
                  <dt>سريانها</dt>
                  <dd>{r.agreement.active ? 'سارية' : 'غير سارية'} حتى <DateText>{r.agreement.endsAt}</DateText></dd>
                  <dt>قيمة المنحة</dt><dd><span className="num">{nf.format(r.granted)}</span> <Riyal /></dd>
                </dl>
              </section>

              {/* ٣ · الدفعة */}
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

                {/* ⚠️ المبلغ بالحروف · الورقة بتروح للبنك، والرقم
                    اللي فيه خانة غلط ما فيش حاجة تكشفه غير ده */}
                <div className="order-amt">
                  <div className="lb">المبلغ المطلوب صرفه</div>
                  <div className="v">
                    <span className="num">{nf.format(r.asked)}</span> <Riyal />
                  </div>
                  <div className="order-w">فقط {riyals(r.asked)} لا غير</div>
                </div>
              </section>

              {/* ٤ · مصادر التمويل · قاعدة 12 */}
              <section className="order-s">
                <h3><span className="num">4</span> · مصادر التمويل</h3>
                <table className="order-t">
                  <thead>
                    <tr><th>المصدر</th><th>النسبة</th><th>المبلغ</th></tr>
                  </thead>
                  <tbody>
                    {r.sources.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td className="num">{s.share}%</td>
                        <td className="num">{nf.format(Math.round((r.asked * s.share) / 100))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>الإجمالي</td>
                      <td className="num">100%</td>
                      <td className="num">{nf.format(r.asked)}</td>
                    </tr>
                  </tfoot>
                </table>
                {r.sources.length > 1 && (
                  <p className="sub cnote">
                    القاعدة 12 بتلزم الصرف بالتوزيع المعتمد ده عند تعدّد المصادر.
                  </p>
                )}
              </section>

              {/* الحساب البنكي · المخرج التاني في الوثيقة */}
              <section className="order-s">
                <h3><span className="num">5</span> · الحساب البنكي المعتمد</h3>
                <dl className="kv">
                  <dt>البنك</dt><dd>{r.bank.name}</dd>
                  <dt>حالة الحساب</dt>
                  <dd>{r.bank.active ? 'معتمد' : <span className="bad">معطَّل · لا يُحوَّل إليه</span>}</dd>
                  <dt>اسم المستفيد</dt><dd>{r.entityName}</dd>
                </dl>
              </section>

              {/* التواقيع · الورقة بتتمسك بإيد، فالاعتمادات مكانها فيها */}
              <section className="order-sign">
                {['مشرف المنح', 'مدير المنح', 'الإدارة المالية'].map((role) => {
                  const ev = r.log.find((e) => e.role === role)
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
                أرشفة المستندات والتقارير والمرفقات مربوطة بالطلب <Mono>{r.id}</Mono> ·
                المخرج الرابع في الإجراء والقاعدة 21 · <Num>{r.docs.length}</Num> مستندًا.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
