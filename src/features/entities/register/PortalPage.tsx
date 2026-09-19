import { Link, useNavigate } from 'react-router-dom'
import {
  DateText, Glass, Head, Icon, KV, Mono, Num, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { Thread } from '@/components/thread'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { readDate } from '@/lib/format'
import {
  BANK_DOC_LABEL, REG_STATE_SAY, REG_TONE, regMissingDocs, regRequestById,
} from '@/data/mock/registration'
import { portalViewOf, regThread } from '@/data/mock/regPortal'
import { planStageLabel, plansOfEntity, waitingReview } from '@/data/mock/plans'

/* ═══════════════════════════════════════════════════════════
   بوّابة الجهة · ن-2 · «شاشة خاصة بيه بيشوف طلبه هو بس»

   ⚠️ **أهم حاجة في الشاشة دي إنها فاضية عن قصد.** الجهة بتفتح
   وبتلاقي **طلبًا واحدًا** ومفيش ريل ولا مشاريع ولا دفعات ·
   واللي ما يتقالّهاش هتفتكره نظامًا ناقصًا أو صلاحية اتنسيت.
   فالشاشة بتقول بالنص إن ده كل اللي ليها **لحدّ ما الطلب
   يُعتمد**، وإن حساب الجهة الكامل بيتولد ساعتها (قاعدة 2).

   ⚠️ **والحالة بتتقال بالفعل المطلوب لا بالاسم.** «بانتظار
   الاستكمال» اسم إداري بيقول للجهة **مين واقف** لا **هي تعمل
   إيه** · والسطر اللي تحته هو اللي بيقول «ارفع الناقص وابعت
   تاني». ونفس الدرس اللي في ح-3: حالة نهائية (مرفوض) مكتوب
   جنبها «تستنّى» بتوعد بحاجة جاية وهي مفيش.

   ⚠️ **والتعديل مفتوح في حالة واحدة بس.** الطلب اللي في المراجعة
   ما يتعدّلش، وإلا المراجع بيقرا نسخة والجهة بتعدّل نسخة تانية
   في نفس اللحظة.

   ⚠️ **والشاشة كانت بتشرح النظام بدل ما تخلّص الطلب.** كان فيها
   «اللي بيوصلك» (جدول بالإيميلات اللي هتوصلها) و«الحالات الخمس»
   (قاعدة 26 بحالاتها) · دول شرح نظام لواحدة عندها **حاجة واحدة
   تعملها**: ترفع الناقص وتبعت. والأسوأ إن الزرار كان بيودّيها
   للفورم من أوّله (`?step=form`) عشان ترفع ورقتين.

   فالشاشة بقت حاجتين:
     · **يمين · كارت الطلب** · الستيبر فوق زي باقي السيستم، وتحته
       نتيجة المراجعة بالاسم، وكل ناقص جنبه زرار رفعه في مكانه،
       وزرار واحد بيبعت تاني.
     · **شمال · المراسلة** · نفس ثريد المشروع بالحرف (`Thread`)،
       لأن اللي بيقف عند الجهة بيتحلّ بكلمة لا بفورم.
   ═══════════════════════════════════════════════════════════ */

/** الطلب اللي الجهة داخلة عليه · في النموذج بيتحدّد بالرابط */
const DEFAULT_REQ = 'RG-1039'

export default function PortalPage() {
  const navigate = useNavigate()
  const { values } = useQueryParams(['req'])
  const r = regRequestById(values.req ?? DEFAULT_REQ) ?? regRequestById(DEFAULT_REQ)!

  const view = portalViewOf(r.state)
  /* خطط الجهة · بتتقرا من `entityId` اللي اتولد بعد الاعتماد */
  const plans = r.entityId ? plansOfEntity(r.entityId) : []
  const short = regMissingDocs(r)

  /* ⚠️ المسار **مراحل الطلب لا مراحلنا الداخلية.** الجهة ما
     بتشوفش «عند مسؤول النظام» ولا «عند مدير المنح» · دي حالات
     بتقول مين واقف عندنا إحنا، وهي ما تقدرش تعمل فيها حاجة،
     فبتتحوّل لقلق لا لمعلومة (نفس درس ح-3). */
  /* ⚠️ **الطلب المُعاد بيرجع للمحطة الأولى.** كانت `completion`
     بتتحسب مع القرار (`at = 2`)، فالستيبر بيقول «مراجعة المؤسسة
     خلصت» والوسم فوقه بيقول «بانتظار الاستكمال» · حاجتان
     بيتناقضوا في نفس الكارت. والطلب اللي رجع بملاحظات فعلًا عند
     الجهة تاني، فمحطته هي الأولى. */
  const done = (k: string) => {
    const order = ['draft', 'review', 'decided']
    const at = r.state === 'draft' || r.state === 'completion'
      ? 0
      : r.state === 'review' ? 1 : 2
    return order.indexOf(k) < at ? 'done' : order.indexOf(k) === at ? 'now' : 'todo'
  }

  /* ⚠️ **بلا `note` في الستيبر.** الشريط الأفقي بيجاوب سؤالًا
     واحدًا: إنت فين ووصلت لفين · والسطر التاني تحت كل محطة بيحوّله
     لفقرة، وهي مكتوبة تحت الشريط أصلًا. نفس القاعدة اللي اتطبّقت
     على ستيبر التسجيل. */
  const steps: StepItem[] = [
    { label: 'تجهيز الطلب', state: done('draft') },
    { label: 'مراجعة المؤسسة', state: done('review') },
    { label: 'القرار', state: done('decided') },
  ]

  const thread = regThread(r.state, r.name)

  /* ⚠️ **بلا ريل وبلا مساعد داخلي · زي شاشة التسجيل بالظبط.**
     اللي فاتح دي جهة مالهاش حساب في النظام، وريل فيه «المشاريع»
     و«الميزانية» بيوعد بحاجات مش ليها · وأول ضغطة كانت هتوقعها
     في شاشة دخول من غير ما تفهم ليه. القشرة العامّة هي نفسها
     اللي في `RegisterPage`، فالجهة بتشوف نفس المكان اللي سجّلت
     منه. */
  const body = (
      <div className="viewstack">
        <div className="screen col">
          <div className="regtop">
            <Logo className="mark mark-38" />
            <div>
              <b>منح أبانمي</b>
              <span className="sub">بوّابة الجهة · طلبك أنت</span>
            </div>
            <span className="pc-sp" />
            <button className="btn btn-2 btn-sm">
              <Icon name={icons.logout} size={15} />
              خروج
            </button>
          </div>

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{r.name}</h1>
              <p className="sub mt-1">
                طلب تسجيل <Mono>{r.id}</Mono> · اتبعت في{' '}
                <DateText>{r.submittedAt}</DateText>
              </p>
            </div>
          </header>

          <div className="g2">
            {/* ═══ يمين · كارت الطلب ═══
                كل اللي الجهة محتاجاه في كارت واحد: فين وصل، والمؤسسة
                قالت إيه، وإيه الناقص، وزرار بيبعت · بالترتيب ده. */}
            <div className="col">
              <Glass className="ptl-req">
                <Head
                  title="طلبك"
                  meta={<Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag>}
                />

                {/* ⚠️ **ستيبر زي باقي السيستم** · كان سُلّمًا رأسيًّا
                    هنا وستيبر أفقي في كل شاشة تانية فيها محطات ·
                    نفس المعنى بشكلين. */}
                <div className="ptl-steps">
                  <Steps items={steps} flow="stepper" />
                </div>

                <p className="sub cnote">{view.say}</p>

                {/* ── نتيجة المراجعة · اللي المؤسسة قالته بالنصّ ── */}
                {r.note && (
                  <div className={`ptl-res${r.state === 'rejected' ? ' no' : ''}`}>
                    <Icon name={icons.alert} size={15} />
                    <div>
                      <b>{r.state === 'rejected' ? 'سبب الرفض' : 'اللي المؤسسة طلبته'}</b>
                      <p>{r.note}</p>
                    </div>
                  </div>
                )}

                {/* ── الناقص · كل واحد بزرار رفعه في مكانه ──
                    ⚠️ **الرفع من هنا لا من الفورم من أوّله.** الزرار
                    القديم كان بيودّي `?step=form` · يعني عشان ترفع
                    ورقتين بتعدّي على ست محطات كلها متملّية. */}
                {view.editable && short.length > 0 && (
                  <>
                    <div className="ptl-short-h">
                      <b>الناقص</b>
                      <Tag tone="warn"><Num>{short.length}</Num> مستند</Tag>
                    </div>
                    <ul className="ptl-short">
                      {short.map((d) => (
                        <li key={d.key}>
                          <Icon name={icons.file} size={15} />
                          <span className="ptl-short-l">{d.label}</span>
                          <button className="btn btn-2 btn-sm">
                            <Icon name={icons.upload} size={14} />
                            ارفع
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* ⚠️ **زرار واحد · وبيقول اللي بعده.** «ابعت تاني»
                    مش «تعديل»: الجهة مش بتعدّل بياناتها، هي بتكمّل
                    ناقصًا وتردّ الطلب للمراجعة. */}
                <footer className="payq-f">
                  <span className="sub payq-when">
                    اتبعت <DateText>{r.submittedAt}</DateText>
                    {' · '}<Mono>{r.id}</Mono>
                  </span>
                  {view.act && (
                    <button
                      className="btn btn-p"
                      disabled={view.editable && short.length > 0}
                      title={view.editable && short.length > 0
                        ? 'ارفع الناقص الأول'
                        : undefined}
                      onClick={() => {
                        if (r.state === 'approved') navigate(ROUTES.entity(r.entityId ?? '755'))
                      }}
                    >
                      <Icon name={r.state === 'approved' ? icons.entity : icons.send} size={15} />
                      {r.state === 'approved' ? view.act : 'ابعت الطلب تاني'}
                    </button>
                  )}
                </footer>
              </Glass>

              <Glass>
                <Head title="بيانات الطلب" meta={<span className="sub">زي ما بعتّها</span>} />
                <KV
                  rows={[
                    { k: 'التصنيف', v: r.type },
                    { k: 'جهة الإشراف الفني', v: r.licensor },
                    { k: 'المنطقة', v: `${r.region} · ${r.city}` },
                    { k: 'رقم الترخيص', v: <Mono>{r.licenseNo}</Mono> },
                    {
                      k: 'بريد الحساب',
                      v: <a className="tlink" href={`mailto:${r.acctEmail}`}><Mono>{r.acctEmail}</Mono></a>,
                    },
                    { k: 'المستندات المرفوعة', v: <><Num>{r.docs.length}</Num> مستند</> },
                  ]}
                />
                {!view.editable && (
                  <p className="sub cnote">
                    البيانات مقفولة دلوقتي · بتتفتح للتعديل لمّا المؤسسة ترجّع
                    الطلب لك، عشان ما تبقاش بتعدّل نسخة والمراجع بيقرا نسخة تانية.
                  </p>
                )}
              </Glass>

              <Glass>
                <Head
                  title="الحسابات البنكية"
                  meta={<span className="sub"><Num>{r.banks.length}</Num> حساب</span>}
                />
                <ul className="rgbanks">
                  {r.banks.map((b, i) => (
                    <li key={b.id}>
                      <span className="rgbank-n num">{i + 1}</span>
                      <div className="rgbank-b">
                        <div className="rgbank-t">
                          <b>{b.bankName}</b>
                          <span className="sub">· {b.bankHolder}</span>
                        </div>
                        <div className="sub"><Mono>{b.iban}</Mono></div>
                        {b.doc
                          ? <DocFile name={b.doc} meta={BANK_DOC_LABEL} download={false} />
                          : <span className="bad">{BANK_DOC_LABEL} ناقصة</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </Glass>

              {/* ═══ خطط الجهة · BPD-012 ═══
                  ⚠️ **بتبان بعد الاعتماد وحده.** قبله الجهة مالهاش
                  مشاريع أصلًا، فمالهاش خطط · وكارت فاضي اسمه «خططك»
                  في شاشة جهة لسه بتستنّى قرار بيقول إن في حاجة ناقصة
                  وهي مش ناقصة، هي ما بدأتش. */}
              {r.state === 'approved' && plans.length > 0 && (
                <Glass>
                  <Head
                    title="خطط مشاريعك"
                    meta={<span className="sub"><Num>{plans.length}</Num> خطة</span>}
                  />
                  {/* ⚠️ الجملة دي هي اللي بتمنع أكبر سوء فهم في
                      الموديول: «رفعت الشاهد» مش «اتحسب إنجازًا» */}
                  <p className="sub cnote">
                    بترفعي الشواهد وبتقولي إن النشاط خلص · والاحتساب بيحصل بعد
                    مراجعة مشرف المنح وقبوله (القاعدة <span className="num">14</span>).
                  </p>
                  <ul className="ptl-miss ptl-plans">
                    {plans.map((pl) => (
                      <li key={pl.id}>
                        <Icon name={icons.plan} size={14} />
                        <Link className="lnk" to={`${ROUTES.plan(pl.id)}?as=entity`}>
                          {pl.projectName}
                        </Link>
                        <span className="pc-sp" />
                        <span className="sub">{planStageLabel(pl.stage)}</span>
                        {waitingReview(pl).length > 0 && (
                          <Tag tone="warn">
                            <Num>{waitingReview(pl).length}</Num> عند المشرف
                          </Tag>
                        )}
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}
            </div>

            {/* ═══ شمال · المراسلة ═══
                ⚠️ نفس `Thread` بتاع صفحة المشروع بالحرف · اللي بيقف
                عند الجهة بيتحلّ بكلمة لا بفورم، والقناة هي المكان
                الطبيعي للسؤال. */}
            <div className="col">
              <Glass className="ptl-talk">
                <Head
                  title="التواصل مع المؤسسة"
                  /* ⚠️ العدّاد بيظهر لمّا يبقى فيه رسايل · «لا توجد»
                     جنب بوستر بيقول نفس الحاجة بجملة كاملة تكرار */
                  meta={thread.length > 0
                    ? <span className="sub"><Num>{thread.length}</Num> رسائل</span>
                    : undefined}
                />
                <Thread
                  messages={thread}
                  entityName={r.name}
                  me="entity"
                  placeholder="اكتب رسالة للمؤسسة…"
                  emptyTitle="القناة مفتوحة لو احتجتيها"
                  emptyNote="اكتبي للمؤسسة لو فيه حاجة مش واضحة في الطلب · مستند مش عارفة تجيبيه منين، أو ملاحظة محتاجة توضيح. وغير كده حالة الطلب بتتابعيها من الكارت جنبك."
                />
              </Glass>

              {/* ⚠️ فقرة «الحساب ده على طلبك إنت …» اتشالت بطلب
                  العميل · كانت بتشرح قاعدة 2 لواحدة جاية تخلّص
                  ورقتين، والترويسة فوق بتقول «بوّابة الجهة · طلبك
                  أنت» أصلًا. */}
            </div>
          </div>

          <p className="sub tcen cnote">
            مش طلبك؟{' '}
            <Link className="lnk" to={ROUTES.entityRegister}>ابدأ طلب تسجيل جديد</Link>
            {' · '}
            {readDate(r.submittedAt)}
          </p>
        </div>
      </div>
  )

  return (
    <>
      <Background />
      <div className="app">
        <div className="shell">{body}</div>
      </div>
    </>
  )
}
