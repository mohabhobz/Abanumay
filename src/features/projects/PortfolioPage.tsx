import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, Empty, Glass, Head, Icon, KV, Money, Num, Person, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nounAfter, pct } from '@/lib/format'
import {
  IMPLEMENTER_DIFF, implementerName, itemsSpent, itemsTotal,
  portfolioById, portfolioIssues,
} from '@/data/mock/implementer'

/* Portfolio - Ihsan scenario.

   Note: a portfolio isn't a large project, it's a parent entity with projects underneath it. It
   appears in the projects list as a row of type "portfolio" (filterable by type), and that row
   opens this page instead of a project page.

   Note: the most important thing on this screen is what's missing from it: no agreement, no entity
   justifications, no portal. The screen states this explicitly, in a "what's different" card,
   rather than leaving the reader to notice the absence - an unstated absence reads as an oversight.

   Note: the assumption is tagged as one. The question "what exactly does a portfolio mean on
   screen" is still open - what's here is the assumption "a parent with projects underneath", and
   the screen states it as an assumption, not an agreed fact. */

/** Partners whose coordinator has an account (role «الشريك الاستراتيجي») */
const PARTNER_ACCOUNT: Record<string, string> = { '860': 'نواف الشهري' }

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
                note="تُسجَّل المحافظ للشركاء المنفّذين وحدهم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.projects)}>
                    العودة إلى المشاريع
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

  /* The portfolio's path - three stages, not four, and the agreement isn't one of them. */
  const steps: StepItem[] = [
    { label: 'تسجيل المحفظة', note: 'مشرف المنح · داخليًا', state: 'done' },
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
                {implementerName(p.entityId)} · <span className="num">{p.items.length}</span> {nounAfter(p.items.length, NOUN.project)} ·
                سنة <span className="num">{p.year}</span>
              </p>
            </div>
            <div className="hacts">
              <Tag tone="mute">شريك منفّذ</Tag>
              <Tag tone="mute">افتراض · بانتظار تأكيد</Tag>
            </div>
          </header>

          <div className="g2">
            <div className="col">
              <Glass className="tblcard">
                <Head
                  title="مشاريع المحفظة"
                  meta={
                    <span className="sub">
                      <Num>{p.items.length}</Num> {nounAfter(p.items.length, NOUN.project)} · <Num>{done}</Num> مكتمل
                    </span>
                  }
                />

                {/* Note: the system's own `.tbl` table, not an invented grid. The first version had
                    its own `.pfh` with its own font size, padding and row height - so the portfolio
                    page looked different from every other table in the system while showing the
                    same kind of data at a different scale. */}
                <div className="tblwrap">
                  <table className="tbl t-pf" aria-label="مشاريع المحفظة">
                    {/* Widths in CSS (`.t-pf`) - `<col>` anchors the column. */}
                    <colgroup>
                      <col /><col /><col /><col /><col />
                    </colgroup>

                    <thead>
                      <tr>
                        <th><span className="th-t">المشروع</span></th>
                        <th><span className="th-t">المنطقة</span></th>
                        <th className="n"><span className="th-t">المخصص</span></th>
                        <th className="n"><span className="th-t">المصروف</span></th>
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
                            <Tag tone={x.status === 'مكتمل' ? 'ok' : x.status === 'لم يبدأ' ? 'mute' : 'teal'}>
                              {x.status}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Note: the total is a check, not a sum - same discipline as the budget tree
                        and payment schedule: a portfolio that only summarizes ends up hiding the
                        error. */}
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
                        <td className="sub">{pct(Math.round((spent / sum) * 100))} مصروف</td>
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
              {/* Note: this card is the heart of the scenario - it states what's absent, since an
                  unstated absence reads as an oversight. */}
              <Glass>
                <Head title="ما يتغيّر مع الشريك المنفّذ" meta={<Tag tone="mute">الشروط</Tag>} />
                <ul className="pfdiff">
                  {IMPLEMENTER_DIFF.map((d) => (
                    <li key={d.on}>
                      <Icon name={icons.check} size="sm" />
                      <span className="pfdiff-on">{d.on}</span>
                      <span className="pfdiff-off">بدلًا من: {d.off}</span>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  {implementerName(p.entityId)} <b>لا تتقدّم من البوّابة</b> · يضيفها مشرف المنح من الداخل،
                  فيسقط كل ما يفترض تقدّمها: التسجيل والتوقيع والاتفاقية ومسوغات الجهة. وإن مُنح منسّقها
                  حسابًا، فهو بدور «الشريك الاستراتيجي»: يرى محافظه وحدها ويغذّيها ولا يقرّر.
                </p>
              </Glass>

              <Glass>
                <Head title="مسار المحفظة" meta={<span className="sub">ثلاث محطات</span>} />
                <Steps items={steps} flow="ladder" />
                <p className="sub cnote">
                  لا توجد محطة اتفاقية · تُصرف الدفعات مباشرةً على مشاريع المحفظة.
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
                    { k: 'نوع الشراكة', v: <Tag tone="mute">شريك استراتيجي</Tag> },
                    {
                      /* Meeting 1 Oct · the partner is a persona of its own: optional access, its
                         own portfolios only (see «الصلاحيات والأدوار»). */
                      k: 'حساب الشريك',
                      v: PARTNER_ACCOUNT[p.entityId]
                        ? <span className="pfacct"><Person name={PARTNER_ACCOUNT[p.entityId]} /> <Link className="tlink" to={`${ROUTES.permissions}?tab=roles&r=partner`}>دخول محدود · محافظه فقط</Link></span>
                        : <span className="sub">بلا دخول · يديرها مشرف المنح</span>,
                    },
                    { k: 'مبلغ المحفظة', v: <Money>{p.total}</Money> },
                    { k: 'المصروف', v: <Money>{spent}</Money> },
                    { k: 'المتبقّي', v: <Money>{p.total - spent}</Money> },
                    { k: 'الاتفاقية', v: <span className="sub">لا يوجد · شريك منفّذ</span> },
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
