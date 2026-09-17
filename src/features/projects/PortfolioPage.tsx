import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, Empty, Glass, Head, Icon, KV, Money, Num, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { pct } from '@/lib/format'
import {
  IMPLEMENTER_DIFF, implementerName, itemsSpent, itemsTotal,
  portfolioById, portfolioIssues,
} from '@/data/mock/implementer'

/* ═══════════════════════════════════════════════════════════
   المحفظة · ب-8 · سيناريو إحسان

   ⚠️ **المحفظة مش مشروع كبير، هي كيان أب تحته مشاريع.** عشان كده
   ليها صفحتها ومالهاش صفّ في قايمة المشاريع · اللي في القايمة
   أبناؤها لو اتسجّلوا كمشاريع، والمحفظة نفسها بتتقرا من هنا.

   ⚠️ **وأهم حاجة في الشاشة دي هي اللي مش فيها:** مفيش اتفاقية،
   ومفيش مسوغات من الجهة، ومفيش بوّابة. والشاشة بتقول ده **صريحًا**
   في كارت «اللي بيتغيّر» بدل ما تسيب القارئ يلاحظ الغياب ·
   الغياب اللي مش مكتوب بيتقرا سهوًا.

   ⚠️ **والافتراض موسوم.** سؤال «المحفظة يعني إيه بالظبط في الشاشة؟»
   لسه مفتوح عند مظفر · فاللي هنا افتراض «أب وتحته مشاريع»، ومكتوب
   في الشاشة إنه افتراض لا حاجة متّفق عليها.
   ═══════════════════════════════════════════════════════════ */

export default function PortfolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const p = id ? portfolioById(id) : undefined

  if (!p) {
    return (
      <AppLayout assistantContext={assistFor.page('المحافظ')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />
            <Glass>
              <Empty
                title="المحفظة غير موجودة."
                note="المحافظ بتتسجّل للشركاء المنفّذين وحدهم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.projects)}>
                    ارجع للمشاريع
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const sum = itemsTotal(p)
  const spent = itemsSpent(p)
  const issues = portfolioIssues(p)
  const done = p.items.filter((x) => x.status === 'مكتمل').length

  /* مسار المحفظة · تلات محطات لا أربعة · والاتفاقية مش واحدة منهم */
  const steps: StepItem[] = [
    { label: 'تسجيل المحفظة', note: 'مشرف المنح · من جوّه', state: 'done' },
    { label: 'تنفيذ مشاريعها', note: `${done} من ${p.items.length} مكتمل`, state: 'now' },
    { label: 'الإغلاق', note: 'بعد آخر مشروع', state: 'todo' },
  ]

  return (
    <AppLayout assistantContext={assistFor.page(p.name)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">{p.name}</h1>
              <p className="sub mt-1">
                {implementerName(p.entityId)} · <span className="num">{p.items.length}</span> مشاريع ·
                سنة <span className="num">{p.year}</span>
              </p>
            </div>
            <div className="hacts">
              <Tag tone="ret">شريك منفّذ</Tag>
              <Tag tone="warn">افتراض · بانتظار تأكيد</Tag>
            </div>
          </header>

          <div className="g2">
            <div className="col">
              <Glass className="tblcard">
                <Head
                  title="مشاريع المحفظة"
                  meta={
                    <span className="sub">
                      <Num>{p.items.length}</Num> مشاريع · <Num>{done}</Num> مكتمل
                    </span>
                  }
                />

                {/* ⚠️ **جدول السيستم `.tbl` لا شبكة مخترعة.** النسخة
                    الأولى كان لها `.pfh` بمقاس خطّ وحشو وارتفاع صفّ
                    من عندها · فصفحة المحفظة كانت شكلًا تاني عن كل
                    جدول في السيستم، ونفس الداتا بتتعرض بمقاسين. */}
                <div className="tblwrap">
                  <table className="tbl t-pf" aria-label="مشاريع المحفظة">
                    {/* العروض في الـCSS (`.t-pf`) · و`<col>` مرساة العمود */}
                    <colgroup>
                      <col /><col /><col /><col /><col />
                    </colgroup>

                    <thead>
                      <tr>
                        <th><span className="th-t">المشروع</span></th>
                        <th><span className="th-t">المنطقة</span></th>
                        <th className="n"><span className="th-t">المخصص</span></th>
                        <th className="n"><span className="th-t">المنصرف</span></th>
                        <th><span className="th-t">الحالة</span></th>
                      </tr>
                    </thead>

                    <tbody>
                      {p.items.map((x) => (
                        <tr key={x.id}>
                          <td>{x.name}</td>
                          <td className="sub">{x.region}</td>
                          <td className="n"><Money sm>{x.amount}</Money></td>
                          <td className="n">
                            <Money sm>{x.spent}</Money>
                            <span className="sub"> · {pct(Math.round((x.spent / x.amount) * 100))}</span>
                          </td>
                          <td>
                            <Tag tone={x.status === 'مكتمل' ? 'ok' : x.status === 'لم يبدأ' ? 'mute' : 'ret'}>
                              {x.status}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* ⚠️ الإجمالي **تحقّق** · نفس انضباط شجرة الميزانية
                        وجدول الدفعات: محفظة بتلخّص وبس بتخفي الغلط */}
                    <tfoot>
                      <tr className={sum === p.total ? '' : 'bad'}>
                        <td>الإجمالي</td>
                        <td>
                          {sum === p.total
                            ? <Tag tone="ok">مطابق</Tag>
                            : <Tag tone="warn">غير مطابق</Tag>}
                        </td>
                        <td className="n"><Money sm>{sum}</Money></td>
                        <td className="n"><Money sm>{spent}</Money></td>
                        <td className="sub">{pct(Math.round((spent / sum) * 100))} منصرف</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {issues.map((i) => (
                  <p key={i.key} className="bad cnote">
                    {i.say} <span className="sub">· {i.rule}</span>
                  </p>
                ))}
              </Glass>
            </div>

            <div className="col">
              {/* ⚠️ الكارت ده هو **قلب ب-8**: بيقول اللي **مش**
                  موجود، لأن الغياب اللي مش مكتوب بيتقرا سهوًا */}
              <Glass>
                <Head title="اللي بيتغيّر مع الشريك المنفّذ" meta={<Tag tone="ret">كونديشنز</Tag>} />
                <ul className="pfdiff">
                  {IMPLEMENTER_DIFF.map((d) => (
                    <li key={d.on}>
                      <Icon name={icons.check} size={13} />
                      <span className="pfdiff-on">{d.on}</span>
                      <span className="pfdiff-off">بدل: {d.off}</span>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  إحسان <b>ما بتدخلش المنصة أصلًا</b> · فكل حاجة بتفترض وجودها
                  بتسقط: البوّابة والتوقيع والاتفاقية ومسوغات الجهة.
                </p>
              </Glass>

              <Glass>
                <Head title="مسار المحفظة" meta={<span className="sub">ثلاث محطات</span>} />
                <Steps items={steps} flow="ladder" />
                <p className="sub cnote">
                  مفيش محطة اتفاقية · الدفعات بتتعمل مباشرةً على مشاريع المحفظة.
                </p>
              </Glass>

              <Glass>
                <Head title="بيانات المحفظة" />
                <KV
                  rows={[
                    {
                      k: 'الجهة',
                      v: (
                        <Link className="tlink" to={ROUTES.entity(p.entityId)}>
                          {implementerName(p.entityId)}
                        </Link>
                      ),
                    },
                    { k: 'نوع الشراكة', v: <Tag tone="ret">شريك منفّذ</Tag> },
                    { k: 'مبلغ المحفظة', v: <Money>{p.total}</Money> },
                    { k: 'المنصرف', v: <Money>{spent}</Money> },
                    { k: 'المتبقّي', v: <Money>{p.total - spent}</Money> },
                    { k: 'الاتفاقية', v: <span className="sub">مفيش · شريك منفّذ</span> },
                  ]}
                />
              </Glass>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
