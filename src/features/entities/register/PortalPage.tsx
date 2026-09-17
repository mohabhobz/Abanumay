import { Link, useNavigate } from 'react-router-dom'
import {
  DateText, Glass, Head, Icon, KV, Mono, Num, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { readDate } from '@/lib/format'
import {
  BANK_DOC_LABEL, REG_STATES, REG_STATE_SAY, REG_TONE, regMissingDocs, regRequestById,
} from '@/data/mock/registration'
import { REG_MAILS, portalViewOf } from '@/data/mock/regPortal'

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
   ═══════════════════════════════════════════════════════════ */

/** الطلب اللي الجهة داخلة عليه · في النموذج بيتحدّد بالرابط */
const DEFAULT_REQ = 'RG-1039'

export default function PortalPage() {
  const navigate = useNavigate()
  const { values } = useQueryParams(['req'])
  const r = regRequestById(values.req ?? DEFAULT_REQ) ?? regRequestById(DEFAULT_REQ)!

  const view = portalViewOf(r.state)
  const short = regMissingDocs(r)
  const mail = REG_MAILS.find((m) => m.on === r.state)

  /* ⚠️ المسار **مراحل الطلب لا مراحلنا الداخلية.** الجهة ما
     بتشوفش «عند مسؤول النظام» ولا «عند مدير المنح» · دي حالات
     بتقول مين واقف عندنا إحنا، وهي ما تقدرش تعمل فيها حاجة،
     فبتتحوّل لقلق لا لمعلومة (نفس درس ح-3). */
  const done = (k: string) => {
    const order = ['draft', 'review', 'decided']
    const at = r.state === 'draft' ? 0 : r.state === 'review' ? 1 : 2
    return order.indexOf(k) < at ? 'done' : order.indexOf(k) === at ? 'now' : 'todo'
  }

  const steps: StepItem[] = [
    { label: 'تجهيز الطلب', note: 'عندك إنت', state: done('draft') },
    {
      label: 'مراجعة المؤسسة',
      note: r.state === 'completion' ? 'رجّعته لك بملاحظات' : 'بتتراجع البيانات والمستندات',
      state: done('review'),
    },
    {
      label: 'القرار',
      note: r.state === 'approved' ? 'اتعتمد' : r.state === 'rejected' ? 'اترفض' : 'لسه',
      state: done('decided'),
    },
  ]

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

          <div className="prow">
            <Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag>
            <span className="sub">{view.say}</span>
            <span className="pc-sp" />
            {view.act && (
              <button
                className="btn btn-p"
                onClick={() =>
                  navigate(
                    r.state === 'approved'
                      ? ROUTES.entity(r.entityId ?? '755')
                      : `${ROUTES.entityRegister}?step=form`,
                  )
                }
              >
                <Icon name={r.state === 'approved' ? icons.entity : icons.edit} size={15} />
                {view.act}
              </button>
            )}
          </div>

          <div className="g2">
            <div className="col">
              {/* ⚠️ الملاحظة قبل أي حاجة تانية: الجهة اللي فتحت
                  البوّابة بعد إيميل «طلبك محتاج استكمال» جاية
                  تدوّر عليها هي بالذات */}
              {r.note && (
                <Glass>
                  <Head
                    title={r.state === 'rejected' ? 'سبب الرفض' : 'اللي المؤسسة طلبته'}
                    meta={<Tag tone={r.state === 'rejected' ? 'no' : 'warn'}>
                      {r.state === 'rejected' ? 'قرار نهائي' : 'مطلوب منك'}
                    </Tag>}
                  />
                  <p className="payq-note">{r.note}</p>
                  {short.length > 0 && (
                    <ul className="ptl-miss">
                      {short.map((d) => (
                        <li key={d.key}>
                          <Icon name={icons.alert} size={14} />
                          {d.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </Glass>
              )}

              <Glass>
                <Head title="مسار طلبك" meta={<span className="sub">ثلاث محطات</span>} />
                <Steps items={steps} flow="ladder" />
                {/* ⚠️ الفرق ده مكتوب لأنه **السؤال الأول** اللي في
                    دماغ اللي فاتح الشاشة: «طيب فين باقي النظام؟» */}
                <p className="sub cnote">
                  الحساب ده على <b>طلبك إنت</b> · بيشوف الطلب ده وحالته وبس.
                  وحساب الجهة الكامل (المشاريع والاتفاقيات والدفعات) بيتولد بعد
                  الاعتماد، والقاعدة <span className="num">2</span> في الإجراء.
                </p>
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
            </div>

            <div className="col">
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
                <Head title="اللي بيوصلك" meta={<span className="sub">بريد ورسالة</span>} />
                {/* ⚠️ الجدول ده بيقلّل أسئلة الدعم: الجهة اللي مش
                    عارفة هيوصلها إيه بتتصل تسأل، واللي قارياه
                    بتستنّى */}
                <ul className="ptl-mail">
                  {REG_MAILS.map((m) => (
                    <li key={`${m.on}-${m.to}`} className={mail && m.on === mail.on ? 'now' : ''}>
                      <Icon name={m.to === 'mobile' ? icons.device : icons.send} size={14} />
                      <div>
                        <b>{m.title}</b>
                        <span className="sub">{m.body}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Glass>

              <Glass>
                <Head title="الحالات الخمس" meta={<span className="sub">قاعدة 26</span>} />
                <ul className="ptl-st">
                  {REG_STATES.map((st) => {
                    const pv = portalViewOf(st.key)
                    return (
                      <li key={st.key} className={st.key === r.state ? 'now' : ''}>
                        <Tag tone={REG_TONE[st.key]}>{st.label}</Tag>
                        <span className="sub">
                          {pv.act || (pv.waiting ? 'تستنّى' : 'خلاص')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Glass>
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
